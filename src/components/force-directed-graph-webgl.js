import React, { useRef, useEffect } from 'react';
import * as THREE from 'three'
import { WEBGL } from 'three/examples/jsm/WebGL';
import { zoom, zoomIdentity } from 'd3-zoom';
import { select } from 'd3-selection';

import defaultColor from '../data/colors-40.json'
import useWindowDimension from '../hooks/useWindowDimension';

const ForceDirectedGraphWebgl = ({
    nodes,
    links
}) => {
    const { width, height } = useWindowDimension();
    // const isWebGLSupported = WEBGL.isWebGLAvailable()
    const mountRef = useRef(null);

    useEffect(() => {
        const mount = mountRef.current;
        const fov = 75, near = 0.1, far = 10, aspect = width / height;
        const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x666666);
        const renderer = new THREE.WebGLRenderer();
        renderer.setSize(width, height );
        mount.appendChild(renderer.domElement)

        const toRadians = (angle) => angle * (Math.PI / 180);

        const getScaleFromZ = (camera_z_position) => {
            let half_fov = fov / 2;
            let half_fov_radians = toRadians(half_fov);
            let half_fov_height = Math.tan(half_fov_radians) * camera_z_position;
            let fov_height = half_fov_height * 2;
            let scale = height / fov_height; // Divide visualization height by height derived from field of view
            return scale;
        }

        const getZFromScale = (scale) => {
            let half_fov = fov / 2;
            let half_fov_radians = toRadians(half_fov);
            let scale_height = height / scale;
            let camera_z_position = scale_height / (2 * Math.tan(half_fov_radians));
            return camera_z_position;
        }

        const zoomHandler = (d3_transform) => {
            let scale = d3_transform.k;
            let x = -(d3_transform.x - width / 2) / scale;
            let y = (d3_transform.y - height / 2) / scale;
            let z = getZFromScale(scale);
            camera.position.set(x, y, z);
        }

        const d3_zoom = zoom()
            .scaleExtent([getScaleFromZ(far), getScaleFromZ(near)])
            .on('zoom', (event) => {
                let d3_transform = event.transform;
                zoomHandler(d3_transform);
            });

        const setUpZoom = () => {
            const view = select(renderer.domElement)
                .call(d3_zoom);
            const initialScale = getScaleFromZ(far);
            const initialTransform = zoomIdentity.translate(width / 2, height / 2).scale(initialScale);
            d3_zoom.transform(view, initialTransform);
            camera.position.set(0, 0, far)
        }

        // const circle_sprite_aa= new THREE.TextureLoader().load(
        //     "https://blog.fastforwardlabs.com/images/2018/02/circle_aa-1518730700478.png"
        //   )
        
        // const sprite_setting = {
        //     map: circle_sprite_aa,
        //     transparent: true,
        //     alphaTest: 0.5
        // }

        // const colors = [];
        // const vertecies = [];
        // nodes.forEach((node) => {
        //     const vertex = new THREE.Vector3(node.x, node.y, 0);
        //     vertecies.push(vertex)
        //     const color = new THREE.Color(defaultColor[node.cluster])
        //     colors.push(color);
        // })
        // const pointsGeometry = new THREE.BufferGeometry().setFromPoints(vertecies)
        // pointsGeometry.color = colors;

        // const pointsMaterial = new THREE.PointsMaterial({
        //     size: 8,
        //     sizeAttenuation: false,
        //     vertexColors: true,
        // });
        // for (let setting in sprite_setting) {
        //     pointsMaterial[setting] = sprite_setting[setting]
        // }
        // const points = new THREE.Points(pointsGeometry, pointsMaterial)
        // scene.add(points)
        

        const geometry = new THREE.BoxGeometry();
        const material = new THREE.MeshBasicMaterial({ color: 0xdd6666 });
        const cube = new THREE.Mesh(geometry, material);
        // cube.matrixAutoUpdate = false
        scene.add(cube);

        function animate() {
            requestAnimationFrame( animate );
            renderer.render( scene, camera );
            cube.rotation.x += 0.01;
            cube.rotation.y += 0.01;
        }
        animate();
        setUpZoom();

        return () => {
            mount.removeChild(renderer.domElement)
        }
    }, [width, height, nodes])
    return (
        <div
            style={{
                margin: 0,
                padding: 0,
            }}
            ref={mountRef}
        />
    )
}

export default ForceDirectedGraphWebgl