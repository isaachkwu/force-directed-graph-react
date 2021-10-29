import React, { useRef, useState, useCallback, useLayoutEffect, useEffect } from 'react';
import * as THREE from 'three'
import * as d3 from 'd3';
import { WEBGL } from 'three/examples/jsm/WebGL';
import Stats from 'three/examples/jsm/libs/stats.module';

import Slider from '../../slider/Slider'
import SimWorker from '../../../workers/force-simulation.worker'
import defaultColors from '../../../data/colors-40.json'
import useComponentDimension from '../../../hooks/useComponentDimension';

import './ForceDirectedGraphThree2.css';
import { render } from '@testing-library/react';


const ForceDirectedGraphThree2 = ({
    nodes,
    links,
    enableSimulate = false,
    enableDrag = false,
    xScaleRatio = 100, // used as a default value, or pass it dynamically to change it
    yScaleRatio = 100, // used as a default value, or pass it dynamically to change it
    backgroundColor = '#cccccc',
    nodeColorFunc,
    linkColor = '#000000'
}) => {
    const containerRef = useRef(null);
    const { width, height } = useComponentDimension(containerRef);

    const [isDragScreen, setIsDragScreen] = useState(true)
    const toggleDrag = () => {
        setIsDragScreen(!isDragScreen)
    }

    // hover selection
    const [selectedNode, setSelectedNode] = useState(null);
    const [selectedNodePosition, setSelectedNodePosition] = useState(null);

    // one-time force simulation (only when drag disabled)
    const [loadingProgress, setLoadingProgress] = useState(0)
    const [isCanvasReady, setIsCanvasReady] = useState(true)

    // manual scaling
    const [xScaleControl, setXScaleControl] = useState(xScaleRatio);
    const [yScaleControl, setYScaleControl] = useState(yScaleRatio);
    const onChangeXSlider = useCallback((value) => {
        setXScaleControl(value);
    }, [])
    const onChangeYSlider = useCallback((value) => {
        setYScaleControl(value);
    }, [])
    const resetCamera = () => {
        const view = d3.select(rendererRef.current.domElement)
        const initialTransform = d3.zoomIdentity.translate(width / 2, height / 2).scale(getScaleFromZ(far));
        d3ZoomRef.current.transform(view, initialTransform);
    }

    // Refs and constants
    const mountRef = useRef(null);
    const fov = 75, near = 0.1, far = 600, aspect = width / height;
    // refs on d3 side
    const d3NodesRef = useRef(null);
    const d3linksRef = useRef(null);
    const d3ZoomRef = useRef(null);
    const d3DragRef = useRef(null);
    const simulationRef = useRef(null);
    // refs on three.js side
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const rendererRef = useRef(null);
    const nodes3dRef = useRef(null);
    const links3dRef = useRef(null);
    const circleTextureLink = "https://fastforwardlabs.github.io/visualization_assets/circle-sprite.png"
    const nodesConfig = (circleTexture) => ({
        sizeAttenuation: false,
        vertexColors: true,
        map: circleTexture,
        transparent: true,
    })
    const hoverContainerRef = useRef(null);

    // utility function
    const toRadians = (angle) => angle * (Math.PI / 180);
    const getScaleFromZ = useCallback((camera_z_position) => { // => screen height / threejs viewing height
        let half_fov = fov / 2;
        let half_fov_radians = toRadians(half_fov);
        let half_fov_height = Math.tan(half_fov_radians) * camera_z_position;
        let fov_height = half_fov_height * 2;
        let scale = height / fov_height;
        return scale;
    }, [height])
    const mouseToThree = useCallback((mouseX, mouseY) => (
        new THREE.Vector2(
            mouseX / width * 2 - 1,
            -(mouseY / height) * 2 + 1
        )
    ), [height, width])
    const getNodeColor = useCallback((node) => {
        if (nodeColorFunc === null || nodeColorFunc === undefined) return '#ffffff'
        return nodeColorFunc(node)
    }, [nodeColorFunc])

    // Three.js camera, scene, renderer set-up with clean-ups
    useLayoutEffect(() => {
        console.log('Three js init')
        const mount = mountRef.current
        sceneRef.current = new THREE.Scene();
        cameraRef.current = new THREE.PerspectiveCamera(fov, 0, near, far + 1);
        sceneRef.current.background = new THREE.Color(backgroundColor);
        rendererRef.current = new THREE.WebGLRenderer({ antialias: true, });
        mount.appendChild(rendererRef.current.domElement)
        return () => {
            // clean up
            mount.removeChild(rendererRef.current.domElement);
        }
    }, [])

    useLayoutEffect(() => {
        console.log("simulation init")
        d3NodesRef.current = nodes;
        d3linksRef.current = links;
        if (enableSimulate === true) {
            simulationRef.current = d3.forceSimulation(d3NodesRef.current)
                .force("charge", d3.forceManyBody())
                .force("link", d3.forceLink(d3linksRef.current).id(d => d.id))
                .force("center", d3.forceCenter(0, 0));
        }

        return () => {
            if (enableSimulate === true) {
                simulationRef.current.stop();
            }
        }
    }, [nodes, links, enableSimulate])

    // Add nodes and links 3d objects to Three.js scene via props
    useLayoutEffect(() => {
        console.log("nodes and links init")
        const nodesGeo = new THREE.BufferGeometry();
        const nodesPosition = d3NodesRef.current.map((node) => new THREE.Vector3(node.x, node.y, 0));
        const nodesColor = [];
        for (const node of d3NodesRef.current) {
            const color = new THREE.Color(
                getNodeColor(node)
            )
            nodesColor.push(color.r, color.g, color.b);
        }
        nodesGeo.setFromPoints(nodesPosition)
        nodesGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(nodesColor), 3))
        const nodesMaterial = new THREE.PointsMaterial({
            ...nodesConfig(new THREE.TextureLoader().load(circleTextureLink)),
            size: 4
        });
        nodes3dRef.current = new THREE.Points(nodesGeo, nodesMaterial);
        sceneRef.current.add(nodes3dRef.current);
        const linksMaterial = new THREE.LineBasicMaterial({ color: linkColor, });
        const linksPosition = []
        d3linksRef.current.forEach((link) => {
            linksPosition.push(
                new THREE.Vector3(link.source.x, link.source.y, 0),
                new THREE.Vector3(link.target.x, link.target.x, 0))
        })
        const linksGeo = new THREE.BufferGeometry().setFromPoints(linksPosition);
        links3dRef.current = new THREE.LineSegments(linksGeo, linksMaterial);
        sceneRef.current.add(links3dRef.current)
    }, [])

    useLayoutEffect(() => {
        console.log("setup animation loop")
        const stats = Stats()
        document.body.appendChild(stats.dom)
        let id;
        const animate = () => {
            id = requestAnimationFrame(animate);
            rendererRef.current.render(sceneRef.current, cameraRef.current);
            stats.update()
            if (enableSimulate === true) {
                // Update points, links position
                const pointsPosition = nodes3dRef.current.geometry.attributes.position.array;
                const linksPosition = links3dRef.current.geometry.attributes.position.array;
                for (let i = 0; i < d3NodesRef.current.length; i++) {
                    pointsPosition[i * 3] = d3NodesRef.current[i].x
                    pointsPosition[i * 3 + 1] = d3NodesRef.current[i].y
                }
                for (let i = 0; i < d3linksRef.current.length; i++) {
                    linksPosition[i * 6] = d3linksRef.current[i].source.x
                    linksPosition[i * 6 + 1] = d3linksRef.current[i].source.y
                    linksPosition[i * 6 + 3] = d3linksRef.current[i].target.x
                    linksPosition[i * 6 + 4] = d3linksRef.current[i].target.y
                }
                nodes3dRef.current.geometry.attributes.position.needsUpdate = true;
                links3dRef.current.geometry.attributes.position.needsUpdate = true;
                nodes3dRef.current.geometry.computeBoundingBox()
                nodes3dRef.current.geometry.computeBoundingSphere()
                links3dRef.current.geometry.computeBoundingBox()
                links3dRef.current.geometry.computeBoundingSphere()
            }
        };
        animate();
        return () => {
            // clean up previous animate loop
            cancelAnimationFrame(id);
        }
    }, [enableSimulate])

    // Set-up three.js by screen size
    useLayoutEffect(() => {
        console.log("set aspect ratio")
        cameraRef.current.aspect = aspect;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(width, height);
    }, [width, height, aspect])

    // Zoom and pan
    useLayoutEffect(() => {
        const minNodeSize = 1
        const nodeSizeScale = d3.scaleLinear()
            .domain([0.5, 10])
            .range([4, 30]);
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
            const size = nodeSizeScale(scale)
            nodes3dRef.current.material.size = size < minNodeSize ? minNodeSize : size
            cameraRef.current.position.set(_x, _y, _z);
        }
        if (d3ZoomRef.current === null) {
            console.log("init setUpZoom effect")
            d3ZoomRef.current = d3.zoom()
                .scaleExtent([getScaleFromZ(far), getScaleFromZ(near)])
                .on('zoom', (event) => {
                    zoomHandler(event.transform);
                });
        } else {
            console.log("update setUpZoom effect")
            d3ZoomRef.current
                .scaleExtent([getScaleFromZ(far), getScaleFromZ(near)])
                .on("zoom", (event) => {
                    zoomHandler(event.transform);
                });
        }
        const view = d3.select(rendererRef.current.domElement)
        const initialScale = getScaleFromZ(far);
        const initialTransform = d3.zoomIdentity.translate(width / 2, height / 2).scale(initialScale);
        d3ZoomRef.current.transform(view, initialTransform);
        return () => {
            d3ZoomRef.current.on("zoom", null)
        }
    }, [getScaleFromZ, height, width])

    useLayoutEffect(() => {
        console.log("toggle drag screen effect")
        if (isDragScreen === false) {
            d3.select(rendererRef.current.domElement).on("mousedown.zoom", null);
            // TODO: enable node drag
        } else {
            d3.select(rendererRef.current.domElement).call(d3ZoomRef.current)
            // TODO: disable node drag
        }
    }, [isDragScreen])

    useLayoutEffect(() => {
        const raycaster = new THREE.Raycaster();
        raycaster.params.Points.threshold = 6;

        d3.select(rendererRef.current.domElement)
            .on("mousemove", (event) => {
                const [mouseX, mouseY] = d3.pointer(event);
                const mousePosition = [mouseX, mouseY];
                const closestNode = findClosestNode(mousePosition);
                if (closestNode !== null) {
                    const node = d3NodesRef.current[closestNode.index];
                    setSelectedNode(node);
                    setSelectedNodePosition(mousePosition)
                } else {
                    setSelectedNode(null)
                    setSelectedNodePosition(null)
                }
            })
            .on("mouseleave", () => {
                setSelectedNode(null)
                setSelectedNodePosition(null)
            })
        const findClosestNode = (mousePosition) => {
            const mouseThree = mouseToThree(...mousePosition);
            raycaster.setFromCamera(mouseThree, cameraRef.current);
            let intersects = raycaster.intersectObject(nodes3dRef.current);
            if (intersects.length > 0) {
                const closestNode = intersects.sort((a, b) => {
                    if (a.distanceToRay < b.distanceToRay) return -1
                    if (a.distanceToRay > b.distanceToRay) return 1
                    return 0
                })
                return closestNode[0]
            } else {
                return null
            }
        }
    }, [getNodeColor, mouseToThree, nodes])

    useLayoutEffect(() => {
        console.log("init hover point container")
        hoverContainerRef.current = new THREE.Object3D();
        sceneRef.current.add(hoverContainerRef.current);
    }, [])

    useLayoutEffect(() => {
        if (hoverContainerRef.current.children.length > 0) {
            if (selectedNode !== null && selectedNodePosition !== null) {
                console.log('moved node')
                const pointPosition = hoverContainerRef.current.children[0].geometry.attributes.position.array;
                pointPosition[0] = selectedNode.x;
                pointPosition[1] = selectedNode.y;
                hoverContainerRef.current.children[0].geometry.attributes.position.needsUpdate = true;
                hoverContainerRef.current.children[0].geometry.computeBoundingBox()
                hoverContainerRef.current.children[0].geometry.computeBoundingSphere()
            } else {
                console.log('removed node')
                hoverContainerRef.current.remove(...hoverContainerRef.current.children)
            }
        } else {
            if (selectedNode !== null && selectedNodePosition !== null) {
                console.log('added node')
                const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(selectedNode.x, selectedNode.y, 0)]);
                const c = new THREE.Color(getNodeColor(selectedNode))
                geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array([c.r, c.g, c.b]), 3))
                const pointMaterial = new THREE.PointsMaterial({
                    ...nodesConfig(new THREE.TextureLoader().load(circleTextureLink)),
                    size: 12, // TODO: scale larger
                });
                const point = new THREE.Points(geometry, pointMaterial);
                const scale = nodes3dRef.current.scale;
                point.scale.set(scale.x, scale.y, scale.z);
                hoverContainerRef.current.add(point);
            }
        }
    }, [getNodeColor, selectedNode, selectedNodePosition])

    // Drag
    useLayoutEffect(() => {
        const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
        const raycaster = new THREE.Raycaster();
        raycaster.params.Points.threshold = 6;
        function dragstarted(event) {
            if (!event.active) simulationRef.current.alphaTarget(0.3).restart();
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
        }

        function dragged(event) {
            // intersection of plane is saved in planePoint variable
            // translate that point from three to d3 simulation scale
            let planePoint = new THREE.Vector3();
            const mouseVector = mouseToThree(...d3.pointer(event));
            raycaster.setFromCamera(mouseVector, cameraRef.current);
            raycaster.ray.intersectPlane(plane, planePoint);
            const translatedX = planePoint.x / nodes3dRef.current.scale.x
            const translatedY = planePoint.y / nodes3dRef.current.scale.y
            event.subject.fx = translatedX;
            event.subject.fy = translatedY;
        }

        function dragended(event) {
            if (!event.active) simulationRef.current.alphaTarget(0);
            event.subject.fx = null;
            event.subject.fy = null;
        }
        d3DragRef.current = d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended);

        d3.select(rendererRef.current.domElement).call(d3DragRef.current)
    }, [mouseToThree])

    useLayoutEffect(() => {
        function dragsubject() {
            return selectedNode;
        }
        d3DragRef.current.subject(dragsubject)
    }, [selectedNode])

    useLayoutEffect(() => {
        console.log('update scales effect')
        if (nodes3dRef.current !== null && links3dRef.current !== null) {
            const xRatio = xScaleControl / 100;
            const yRatio = yScaleControl / 100;
            const previousXScale = nodes3dRef.current.scale.x
            const previousYScale = links3dRef.current.scale.y
            nodes3dRef.current.scale.set(xRatio, yRatio, 1);
            links3dRef.current.scale.set(xRatio, yRatio, 1);

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

    // HTML stuff - like tooltips, scale slider, reset camera button
    const tooltipWidth = 120
    const tooltipXOffset = -tooltipWidth / 2;
    const tooltipYOffset = 30
    return <div ref={containerRef} className="container">
        {!isCanvasReady &&
            <h1>Loading... {(loadingProgress * 100).toFixed(2)}</h1>
        }
        <div className="sliderContainer">
            <Slider
                min={1}
                max={200}
                title='Horizontal scale'
                defaultValue={xScaleRatio}
                onChange={onChangeXSlider}
            />
            <Slider
                min={1}
                max={200}
                title='Vertical sacle'
                defaultValue={yScaleRatio}
                onChange={onChangeYSlider}
            />
        </div>
        <div className='buttonContainer'>
            <button
                className='button'
                onClick={resetCamera}>
                Reset camera
            </button>
            <button
                className='button'
                onClick={toggleDrag}>
                Toggle drag {isDragScreen === true ? '(screen)' : '(node)'}
            </button>
        </div>
        <div className="tooltipContainer"
            style={{
                display: selectedNode ? "flex" : "none",
                position: "absolute",
                left: selectedNodePosition ? selectedNodePosition[0] + tooltipXOffset : 0,
                top: selectedNodePosition ? selectedNodePosition[1] + tooltipYOffset : 0,
            }}
        >
            ID: {selectedNode && selectedNode.id}
            <br />
            Number: {selectedNode && selectedNode.num}
            <br />
            <div className="groupBox"
                style={{
                    color: 'black',
                    backgroundColor: getNodeColor(selectedNode),
                }}
            >
                Group: {selectedNode && selectedNode.cluster}
            </div>
        </div>
        <div
            style={{ display: isCanvasReady ? 'initial' : 'none' }}
            className="threeContainer"
            ref={mountRef}
        />
    </div>
}

export default ForceDirectedGraphThree2