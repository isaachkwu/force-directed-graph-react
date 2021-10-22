import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three'
import * as d3 from 'd3';
import { WEBGL } from 'three/examples/jsm/WebGL';
import { zoom, zoomIdentity } from 'd3-zoom';
import { select } from 'd3-selection';

import Slider from '../../slider/Slider'

import defaultColors from '../../../data/colors-40.json'
import useWindowDimension from '../../../hooks/useWindowDimension';

import './ForceDirectedGraphThree.css';


const ForceDirectedGraphWebgl = ({
    nodes,
    links
}) => {
    const { width, height } = useWindowDimension();
    const [selectedNode, setSelectedNode] = useState(null);
    const [mousePosition, setMousePosition] = useState(null);
    const [selectedNodeColor, setSelectedNodeColor] = useState(null);

    const defaultControlValue = 50

    const [xScaleControl, setXScaleControl] = useState(defaultControlValue);
    const [yScaleControl, setYScaleControl] = useState(defaultControlValue);

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

        // 1. create camera, scene, renderer
        cameraRef.current = new THREE.PerspectiveCamera(fov, aspect, near, far + 1);
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xcccccc);
        rendererRef.current = new THREE.WebGLRenderer();
        rendererRef.current.setSize(width, height);
        mount.appendChild(rendererRef.current.domElement)

        // 2. create zoom/pan handler
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
            cameraRef.current.position.set(_x, _y, _z);
            // console.log(cameraRef.current.position)
        }
        d3ZoomRef.current = d3.zoom()
            .scaleExtent([getScaleFromZ(far), getScaleFromZ(near)])
            .on('zoom', (event) => {
                let d3_transform = event.transform;
                zoomHandler(d3_transform);
            });
        const setUpZoom = () => {
            const view = d3.select(rendererRef.current.domElement)
                .call(d3ZoomRef.current);
            const initialScale = getScaleFromZ(far);
            const initialTransform = d3.zoomIdentity.translate(width / 2, height / 2).scale(initialScale);
            d3ZoomRef.current.transform(view, initialTransform);
            // cameraRef.current.position.set(0, 0, far)
        }

        // 3. create nodes
        const pointGeo = new THREE.BufferGeometry();
        const xExtent = d3.extent(nodes, node => node.x);
        const yExtent = d3.extent(nodes, node => node.y);
        const xScale = d3.scaleLinear()
            .domain(xExtent)
            .range([-400, 400]);
        const yScale = d3.scaleLinear()
            .domain(yExtent)
            .range([-300, 300]);
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
            size: 6,
            sizeAttenuation: false,
            vertexColors: true,
            map: circle_sprite,
            transparent: true,
        });
        pointsRef.current = new THREE.Points(pointGeo, pointsMaterial);
        pointsRef.current.geometry.attributes.position.needsUpdate = true;
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
        branchesRef.current.geometry.attributes.position.needsUpdate = true;
        scene.add(branchesRef.current)

        // 5. craete hover interaction
        const raycaster = new THREE.Raycaster();
        raycaster.params.Points.threshold = 6;
        const mouseToThree = (mouseX, mouseY) => (
            new THREE.Vector3(
                mouseX / width * 2 - 1,
                -(mouseY / height) * 2 + 1,
                1
            )
        )
        const setUpHover = () => {
            d3.select(rendererRef.current.domElement)
                .on("mousemove", (event) => {
                    const [mouseX, mouseY] = d3.pointer(event);
                    const mousePosition = [mouseX, mouseY]
                    // console.log(mouseToThree)
                    checkIntersects(mousePosition);
                })
                .on("mouseleave", () => {
                    removeHighlight()
                    hideTooltip();
                })
        }
        const checkIntersects = (mousePosition) => {
            const mouseVector = mouseToThree(...mousePosition);
            raycaster.setFromCamera(mouseVector, cameraRef.current);
            const intersects = raycaster.intersectObject(pointsRef.current);
            // console.log(intersects)
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
                const selectedNode = nodes[firstIntersect.index];
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
            const pointMaterial = new THREE.PointsMaterial({
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
            setSelectedNode(null);
            setSelectedNodeColor(null);
            setMousePosition(null)
        }

        // 6. animate and apply zoom handler
        function animate() {
            requestAnimationFrame(animate);
            rendererRef.current.render(scene, cameraRef.current);
        }
        if (WEBGL.isWebGLAvailable()) {
            animate();
            setUpZoom();
            setUpHover();

        } else {
            mount.appendChild(WEBGL.getWebGLErrorMessage());
        }

        return () => {
            // clean up
            mount.removeChild(rendererRef.current.domElement);
        }

    }, [nodes, links, height, width, aspect, getScaleFromZ])

    useEffect(() => {
        if (pointsRef.current !== null && branchesRef.current !== null) {
            const xRatio = xScaleControl / 50;
            const yRatio = yScaleControl / 50;
            const previousXScale = pointsRef.current.scale.x
            const previousYScale = branchesRef.current.scale.y
            pointsRef.current.scale.set(xRatio, yRatio, 1);
            branchesRef.current.scale.set(xRatio, yRatio, 1);

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
            <br/>
            <div style={{
                color: selectedNode && selectedNode.cluster === '' ? 'white' : 'black',
                backgroundColor: selectedNodeColor ? selectedNodeColor : 'white',
                ...styles.groupBox
            }}>
                Group: {selectedNode && selectedNode.cluster}
            </div>
        </div>
        <div style={styles.container} ref={mountRef} />
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