import React, { useRef, useState, useCallback, useLayoutEffect, useEffect } from 'react';
import * as THREE from 'three'
import * as d3 from 'd3';
import { WEBGL } from 'three/examples/jsm/WebGL';
import Stats from 'three/examples/jsm/libs/stats.module';

import Slider from '../../slider/Slider'
import SimWorker from '../../../workers/force-simulation.worker'
import defaultColors from '../../../data/colors-40.json'
import useWindowDimension from '../../../hooks/useWindowDimension';

import './ForceDirectedGraphThree2.css';
import { render } from '@testing-library/react';


const ForceDirectedGraphThree2 = ({
    nodes,
    links,
    enableSimulate = false,
    enableDrag = false,
    xScaleRatio = 100, // used as a default value, or pass it dynamically to change it
    yScaleRatio = 100, // used as a default value, or pass it dynamically to change it
}) => {
    const { width, height } = useWindowDimension();

    // hover selection
    const [selectedNode, setSelectedNode] = useState(null);
    const [mousePosition, setMousePosition] = useState(null);
    const [selectedNodeColor, setSelectedNodeColor] = useState(null);

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
    const simulationRef = useRef(null);
    // refs on three.js side
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const rendererRef = useRef(null);
    const nodes3dRef = useRef(null);
    const links3dRef = useRef(null);

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

    // Three.js camera, scene, renderer set-up with clean-ups
    useLayoutEffect(() => {
        console.log('Three js init')
        const mount = mountRef.current
        sceneRef.current = new THREE.Scene();
        cameraRef.current = new THREE.PerspectiveCamera(fov, 0, near, far + 1);
        sceneRef.current.background = new THREE.Color(0xcccccc);
        rendererRef.current = new THREE.WebGLRenderer({ antialias: true, });
        mount.appendChild(rendererRef.current.domElement)

        cameraRef.current.position.z = far;

        return () => {
            // clean up
            mount.removeChild(rendererRef.current.domElement);
        }
    }, [])

    useLayoutEffect(() => {
        console.log("simulation init")
        d3NodesRef.current = nodes;
        d3linksRef.current = links;
        console.log('simulation')
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
        const pointGeo = new THREE.BufferGeometry();
        const vectors = d3NodesRef.current.map((node) => new THREE.Vector3(node.x, node.y, 0));
        const colors = [];
        for (const node of d3NodesRef.current) {
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
        nodes3dRef.current = new THREE.Points(pointGeo, pointsMaterial);
        sceneRef.current.add(nodes3dRef.current);

        const lineMaterial = new THREE.LineBasicMaterial({ color: 0x000000, });
        const linePoints = []
        d3linksRef.current.forEach((link) => {
            linePoints.push(
                new THREE.Vector3(link.source.x, link.source.y, 0),
                new THREE.Vector3(link.target.x, link.target.x, 0))
        })

        const branchesGeo = new THREE.BufferGeometry().setFromPoints(linePoints);
        links3dRef.current = new THREE.LineSegments(branchesGeo, lineMaterial);
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
                    pointsPosition[i * 3 + 2] = 0
                }
                for (let i = 0; i < d3linksRef.current.length; i++) {
                    linksPosition[i * 6] = d3linksRef.current[i].source.x
                    linksPosition[i * 6 + 1] = d3linksRef.current[i].source.y
                    linksPosition[i * 6 + 2] = 0
                    linksPosition[i * 6 + 3] = d3linksRef.current[i].target.x
                    linksPosition[i * 6 + 4] = d3linksRef.current[i].target.y
                    linksPosition[i * 6 + 5] = 0
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

    // HTML stuff - like tooltips, scale slider, reset camera button
    const tooltipWidth = 120
    const tooltipXOffset = -tooltipWidth / 2;
    const tooltipYOffset = 30
    return <>
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
        <div className='resetContainer'>
            <button
                className='resetButton'
                onClick={resetCamera}>
                reset camera
            </button>
        </div>
        <div className="tooltipContainer"
            style={{
                display: selectedNode ? "flex" : "none",
                position: "absolute",
                left: mousePosition ? mousePosition[0] + tooltipXOffset : 0,
                top: mousePosition ? mousePosition[1] + tooltipYOffset : 0,
            }}
        >
            ID: {selectedNode && selectedNode.id}
            <br />
            Number: {selectedNode && selectedNode.num}
            <br />
            <div className="groupBox"
                style={{
                    color: selectedNode && selectedNode.cluster === '' ? 'white' : 'black',
                    backgroundColor: selectedNodeColor ? selectedNodeColor : 'white',
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
    </>
}

export default ForceDirectedGraphThree2