import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three'
import * as d3 from 'd3';
import { WEBGL } from 'three/examples/jsm/WebGL';
import { zoom, zoomIdentity } from 'd3-zoom';
import { select } from 'd3-selection';
import Stats from 'three/examples/jsm/libs/stats.module';
import { DragControls } from 'three/examples/jsm/controls/DragControls';

import Slider from '../../slider/Slider'
import SimWorker from '../../../workers/force-simulation.worker'
import defaultColors from '../../../data/colors-40.json'
import useWindowDimension from '../../../hooks/useWindowDimension';

import './ForceDirectedGraphThree.css';


const ForceDirectedGraphWebgl = ({
    nodes,
    links,
    isSimulated = false,
    isDraggable = false,
}) => {
    const { width, height } = useWindowDimension();

    // selection
    const [selectedNode, setSelectedNode] = useState(null);
    const [mousePosition, setMousePosition] = useState(null);
    const [selectedNodeColor, setSelectedNodeColor] = useState(null);

    // scaling
    const defaultControlValue = 50
    const [xScaleControl, setXScaleControl] = useState(defaultControlValue);
    const [yScaleControl, setYScaleControl] = useState(defaultControlValue);

    // force simulation
    const [loadingProgress, setLoadingProgress] = useState(0)
    const [isCanvasReady, setIsCanvasReady] = useState(false)

    const onChangeXSlider = useCallback((value) => {
        setXScaleControl(value);
    }, [])

    const onChangeYSlider = useCallback((value) => {
        setYScaleControl(value);
    }, [])

    const mountRef = useRef(null);
    const pointsRef = useRef(null);
    const branchesRef = useRef(null);
    const cameraRef = useRef(null);
    const d3ZoomRef = useRef(null);
    const rendererRef = useRef(null);
    const simulation = useRef(null);

    // 0. helper functions
    const toRadians = (angle) => angle * (Math.PI / 180);
    const fov = 75, near = 0.1, far = 600, aspect = width / height;

    const getScaleFromZ = useCallback((camera_z_position) => {
        let half_fov = fov / 2;
        let half_fov_radians = toRadians(half_fov);
        let half_fov_height = Math.tan(half_fov_radians) * camera_z_position;
        let fov_height = half_fov_height * 2;
        let scale = height / fov_height; // Divide visualization height by height derived from field of view
        return scale;
    }, [height])

    const resetCamera = () => {
        const view = d3.select(rendererRef.current.domElement)
        const initialTransform = d3.zoomIdentity.translate(width / 2, height / 2).scale(getScaleFromZ(far));
        d3ZoomRef.current.transform(view, initialTransform);
    }

    useEffect(() => {
        const mount = mountRef.current
        let pointMaterial;
        const scene = new THREE.Scene();
        let animate, setUpZoom, setUpHover, setUpDrag, xScale, yScale;

        // 1. create camera, scene, renderer
        const setUp = (nodes, links) => {
            cameraRef.current = new THREE.PerspectiveCamera(fov, aspect, near, far + 1);
            scene.background = new THREE.Color(0xcccccc);
            rendererRef.current = new THREE.WebGLRenderer({
                antialias: true
            });
            rendererRef.current.setSize(width, height);
            mount.appendChild(rendererRef.current.domElement)

            // 2. create zoom/pan handler
            const minNodeSize = 1
            const nodeSizeScale = d3.scaleLinear()
                .domain([0.5, 10])
                .range([4, 6]); // IMPORTANT: setup node size epansion rates
            const getZFromScale = (scale) => {
                let half_fov = fov / 2;
                let half_fov_radians = toRadians(half_fov);
                let scale_height = height / scale;
                let camera_z_position = scale_height / (2 * Math.tan(half_fov_radians));
                return camera_z_position;
            }
            const zoomHandler = (d3_transform) => {
                let scale = d3_transform.k;
                let _x = -(d3_transform.x - width / 2) / scale;
                let _y = (d3_transform.y - height / 2) / scale;
                let _z = getZFromScale(scale);
                if (pointMaterial) {
                    const size = nodeSizeScale(scale)
                    pointsRef.current.material.size = size < minNodeSize ? minNodeSize : size
                }
                cameraRef.current.position.set(_x, _y, _z);
            }
            d3ZoomRef.current = d3.zoom()
                .scaleExtent([getScaleFromZ(far), getScaleFromZ(near)])
                .on('zoom', (event) => {
                    let d3_transform = event.transform;
                    zoomHandler(d3_transform);
                });
            setUpZoom = () => {
                const view = d3.select(rendererRef.current.domElement)
                    .call(d3ZoomRef.current)
                    .on("mousedown.zoom", null);
                const initialScale = getScaleFromZ(far);
                const initialTransform = d3.zoomIdentity.translate(width / 2, height / 2).scale(initialScale);
                d3ZoomRef.current.transform(view, initialTransform);
            }

            // 3. create nodes
            const pointGeo = new THREE.BufferGeometry();
            const xExtent = d3.extent(nodes, node => node.x);
            const yExtent = d3.extent(nodes, node => node.y);
            xScale = d3.scaleLinear()
                // .domain(xExtent)
                // .range([-200, 200]);
            yScale = d3.scaleLinear()
                // .domain(yExtent)
                // .range([-200, 200]);
            const vectors = nodes.map((node) => new THREE.Vector3(xScale(node.x), yScale(node.y), 0));
            const colors = [];
            for (const node of nodes) {
                if (node.cluster === '') {
                    colors.push(0, 0, 0) //black node is for nodes with no group assigned
                } else {
                    const c = new THREE.Color(defaultColors.colors[node.cluster % defaultColors.colors.length])
                    colors.push(c.r, c.g, c.b);
                }
            }
            pointGeo.setFromPoints(vectors)
            pointGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3))
            const circle_sprite = new THREE.TextureLoader().load(
                "https://fastforwardlabs.github.io/visualization_assets/circle-sprite.png"
            );
            const pointsMaterial = new THREE.PointsMaterial({
                size: 4,
                sizeAttenuation: false,
                vertexColors: true,
                map: circle_sprite,
                transparent: true,
            });
            pointsMaterial.needsUpdate = true
            pointsRef.current = new THREE.Points(pointGeo, pointsMaterial);
            scene.add(pointsRef.current);

            // 4. Create branches
            const lineMaterial = new THREE.LineBasicMaterial({
                color: 0x000000
            });
            const linePoints = []
            links.forEach((link) => {
                linePoints.push(
                    new THREE.Vector3(xScale(link.source.x), yScale(link.source.y), 0),
                    new THREE.Vector3(xScale(link.target.x), yScale(link.target.y), 0))
            })

            const branchesGeo = new THREE.BufferGeometry().setFromPoints(linePoints);
            branchesRef.current = new THREE.LineSegments(branchesGeo, lineMaterial);
            scene.add(branchesRef.current)

            // 5. craete hover and drag interaction
            const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
            const raycaster = new THREE.Raycaster();
            let selectedNode;
            raycaster.params.Points.threshold = 6;
            const mouseToThree = (mouseX, mouseY) => (
                new THREE.Vector2(
                    mouseX / width * 2 - 1,
                    -(mouseY / height) * 2 + 1
                )
            )
            setUpHover = () => {
                d3.select(rendererRef.current.domElement)
                    .on("mousemove", (event) => {
                        const [mouseX, mouseY] = d3.pointer(event);
                        const mousePosition = [mouseX, mouseY];
                        checkIntersects(mousePosition);
                    })
                    .on("mouseleave", () => {
                        removeHighlight()
                        hideTooltip();
                    })
            }
            setUpDrag = (simulation) => {
                const drag = () => {
                    function dragsubject(event) {
                        return selectedNode ;
                    }
                  
                    function dragstarted(event) {
                      if (!event.active) simulation.alphaTarget(0.3).restart();
                      event.subject.fx = event.subject.x;
                      event.subject.fy = event.subject.y;
                    }
                    
                    function dragged(event) {
                        // intersection of plane is saved in planePoint variable
                        // translate that point from three to d3 simulation scale
                        let planePoint = new THREE.Vector3();
                        const mouseVector = mouseToThree(...d3.pointer(event));
                        // console.log(event)
                        raycaster.setFromCamera(mouseVector, cameraRef.current);
                        raycaster.ray.intersectPlane(plane, planePoint);
                        const translatedX = planePoint.x / pointsRef.current.scale.x
                        const translatedY = planePoint.y / pointsRef.current.scale.y
                        // console.log(`planePoint: ${JSON.stringify(planePoint)}`)
                        // console.log(pointsRef.current.scale.x, pointsRef.current.scale.y)
                        // console.log(translatedX, translatedY)
                        event.subject.fx = translatedX;
                        event.subject.fy = translatedY;
                    }
                    
                    function dragended(event) {
                      if (!event.active) simulation.alphaTarget(0);
                      event.subject.fx = null;
                      event.subject.fy = null;
                    }
                    
                    return d3.drag()
                        .subject(dragsubject)
                        .on("start", dragstarted)
                        .on("drag", dragged)
                        .on("end", dragended);
                  }

                  d3.select(rendererRef.current.domElement).call(drag())
            }
            const checkIntersects = (mousePosition) => {
                // console.log(mousePosition)
                const mouseVector = mouseToThree(...mousePosition);
                raycaster.setFromCamera(mouseVector, cameraRef.current);
                const intersects = raycaster.intersectObject(pointsRef.current);
                if (intersects[0]) {
                    const sortedntersection = intersects.sort((a, b) => {
                        if (a.distanceToRay < b.distanceToRay) {
                            return -1
                        }
                        if (a.distanceToRay > b.distanceToRay) {
                            return 1
                        }
                        return 0
                    })
                    // console.log(sortedntersection.map(e => e.distanceToRay))
                    const firstIntersect = sortedntersection[0]
                    selectedNode = nodes[firstIntersect.index];
                    const scale = firstIntersect.object.scale
                    // console.log(scale)
                    highlightPoint(selectedNode, scale);
                    showTooltip(mousePosition, selectedNode);
                } else {
                    removeHighlight();
                    hideTooltip();
                }
            }
            const hoverContainer = new THREE.Object3D();
            scene.add(hoverContainer);
            const highlightPoint = (node, scale) => {
                removeHighlight();
                const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(xScale(node.x), yScale(node.y), 0)]);
                const c = node.cluster === '' ? '#000000' : new THREE.Color(defaultColors.colors[node.cluster % defaultColors.colors.length])
                geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array([
                    c.r, c.g, c.b
                ]), 3))
                pointMaterial = new THREE.PointsMaterial({
                    size: 12,
                    sizeAttenuation: false,
                    vertexColors: true,
                    map: circle_sprite,
                    transparent: true,
                });
                const point = new THREE.Points(geometry, pointMaterial);
                point.scale.set(scale.x, scale.y, scale.z)
                hoverContainer.add(point);
            }

            const removeHighlight = () => {
                hoverContainer.remove(...hoverContainer.children)
            }

            const showTooltip = (mousePosition, node) => {
                setSelectedNode(node);
                const c = node.cluster === '' ? '#000000' : defaultColors.colors[node.cluster % defaultColors.colors.length]
                setSelectedNodeColor(c);
                setMousePosition(mousePosition)
            }

            const hideTooltip = () => {
                selectedNode = null
                setSelectedNode(null);
                setSelectedNodeColor(null);
                setMousePosition(null)
            }
        }

        // 6. animate and apply zoom handler
        const stats = Stats()
        document.body.appendChild(stats.dom)
        let isRealTime = false;
        animate = () => {
            requestAnimationFrame(animate);
            rendererRef.current.render(scene, cameraRef.current);
            stats.update()
            if (isRealTime === true) {
                // Update points, links position
                const pointsPosition = pointsRef.current.geometry.attributes.position.array;
                const linksPosition = branchesRef.current.geometry.attributes.position.array;
                for (let i = 0; i < nodes.length; i++) {
                    pointsPosition[i * 3] = xScale(nodes[i].x)
                    pointsPosition[i * 3 + 1] = yScale(nodes[i].y)
                    pointsPosition[i * 3 + 2] = 0
                }
                for (let i = 0; i < links.length; i++) {
                    linksPosition[i * 6] = xScale(links[i].source.x)
                    linksPosition[i * 6 + 1] = yScale(links[i].source.y)
                    linksPosition[i * 6 + 2] = 0
                    linksPosition[i * 6 + 3] = xScale(links[i].target.x)
                    linksPosition[i * 6 + 4] = yScale(links[i].target.y)
                    linksPosition[i * 6 + 5] = 0
                }

                pointsRef.current.geometry.attributes.position.needsUpdate = true;
                branchesRef.current.geometry.attributes.position.needsUpdate = true;
                pointsRef.current.geometry.computeBoundingBox()
                pointsRef.current.geometry.computeBoundingSphere()
                branchesRef.current.geometry.computeBoundingBox()
                branchesRef.current.geometry.computeBoundingSphere()
            }
        }

        const ticked = (data) => {
            setIsCanvasReady(false);
            setLoadingProgress(data.progress)
        }

        const ended = (data) => {
            setIsCanvasReady(true);
            setUp(data.nodes, data.links);
            animate();
            setUpZoom();
            setUpHover();
        }

        if (WEBGL.isWebGLAvailable()) {
            if (!isSimulated && isDraggable) {
                setIsCanvasReady(true)
                simulation.current = d3.forceSimulation(nodes)
                    .force("charge", d3.forceManyBody())
                    .force("link", d3.forceLink(links).id(d => d.id))
                    .force("center", d3.forceCenter(0, 0));
                isRealTime = true
                setUp(nodes, links);
                animate();
                setUpZoom();
                setUpHover();
                setUpDrag(simulation.current);
            } else if (!isSimulated && !isDraggable) {
                const simWorker = new SimWorker();
                simWorker.postMessage({
                    nodes, links, width, height
                });

                // worker receive message
                simWorker.onmessage = event => {
                    switch (event.data.type) {
                        case "tick": return ticked(event.data);
                        case "end": return ended(event.data);
                        default: return
                    }
                }
            } else {
                setUp(nodes, links);
                animate();
                setUpZoom();
                setUpHover();
            }
        } else {
            mount.appendChild(WEBGL.getWebGLErrorMessage());
        }

        return () => {
            // clean up
            mount.removeChild(rendererRef.current.domElement);
        }

    }, [nodes, links, height, width, aspect, getScaleFromZ, isSimulated, isDraggable])

    useEffect(() => {
        if (pointsRef.current !== null && branchesRef.current !== null) {
            const xRatio = xScaleControl / 50;
            const yRatio = yScaleControl / 50;
            const previousXScale = pointsRef.current.scale.x
            const previousYScale = branchesRef.current.scale.y
            pointsRef.current.scale.set(xRatio, yRatio, 1);
            branchesRef.current.scale.set(xRatio, yRatio, 1);

            // reset the camera position, so the origin keeps the same when scale changes
            const currentThreeX = cameraRef.current.position.x;
            const currentThreeY = cameraRef.current.position.y;
            const currentThreeZ = cameraRef.current.position.z;
            const targetThreeX = currentThreeX / previousXScale * xRatio
            const targetThreeY = currentThreeY / previousYScale * yRatio
            const currentScale = getScaleFromZ(currentThreeZ);
            const d3X = -(targetThreeX * currentScale) + width / 2
            const d3Y = targetThreeY * currentScale + height / 2
            const view = d3.select(rendererRef.current.domElement)
            const initialTransform = d3.zoomIdentity.translate(d3X, d3Y).scale(currentScale);
            d3ZoomRef.current.transform(view, initialTransform);
        }
    }, [getScaleFromZ, height, width, xScaleControl, yScaleControl])

    const tooltipWidth = 120
    const tooltipXOffset = -tooltipWidth / 2;
    const tooltipYOffset = 30
    return <>
        {!isCanvasReady &&
            <h1>Loading... {(loadingProgress * 100).toFixed(2)}</h1>
        }
        <div style={styles.xSliderContainer}>
            <Slider
                orientation="horizontal"
                min={1}
                max={100}
                title='Horizontal slider'
                defaultValue={defaultControlValue}
                onChange={onChangeXSlider}
            />
        </div>
        <div style={styles.ySliderContainer}>
            <Slider
                orientation="vertical"
                min={1}
                max={100}
                title='Vertical slider'
                defaultValue={defaultControlValue}
                onChange={onChangeYSlider}
            />
        </div>
        <div className='buttonContainer'>
            <button className='resetButton' onClick={resetCamera}>reset camera</button>
        </div>
        <div style={{
            display: selectedNode ? "flex" : "none",
            position: "absolute",
            left: mousePosition ? mousePosition[0] + tooltipXOffset : 0,
            top: mousePosition ? mousePosition[1] + tooltipYOffset : 0,
            ...styles.tooltip
        }}>
            ID: {selectedNode && selectedNode.id}
            <br />
            Number: {selectedNode && selectedNode.num}
            <br />
            <div style={{
                color: selectedNode && selectedNode.cluster === '' ? 'white' : 'black',
                backgroundColor: selectedNodeColor ? selectedNodeColor : 'white',
                ...styles.groupBox
            }}>
                Group: {selectedNode && selectedNode.cluster}
            </div>
        </div>
        <div style={{
            ...styles.container,
            display: isCanvasReady ? 'initial' : 'none'
        }} ref={mountRef} />
    </>
}

const styles = {
    container: {
        margin: 0,
        padding: 0,
    },
    tooltip: {
        backgroundColor: 'white',
        padding: 8,
        flexDirection: 'column',
        alignItems: 'stretch'
    },
    groupBox: {
        padding: 4,
    },
    xSliderContainer: {
        position: 'absolute',
        bottom: 8,
        left: 0,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
    },
    ySliderContainer: {
        position: 'absolute',
        left: 8,
        top: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center'
    },
}


export default ForceDirectedGraphWebgl