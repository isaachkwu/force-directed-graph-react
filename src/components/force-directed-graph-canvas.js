import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

// workers
import SimWorker from '../workers/force-simulation.worker'

// hooks
import useWindowDimension from '../hooks/useWindowDimension';

const ForceDirectedGraphCanvas = ({ nodes, links }) => {
    const canvasRef = useRef(null);
    const { width, height } = useWindowDimension();

    useEffect(() => {
        const simWorker = new SimWorker();
        const canvasElement = canvasRef.current;
        const context = canvasElement.getContext("2d");

        // worker start simulation
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

        // simulation is ongoing
        const ticked = (data) => {
            console.log(`loading... ${data.progress}`);
        }

        // radius of node
        const nodeRadius = 3;
        // transform object for zoom
        let transform = d3.zoomIdentity;
        // simulated nodes, and links, with x, y, and id
        let simedNodes, simedLinks;

        // simulation is done, time to draw
        const ended = (data) => {
            simedNodes = data.nodes;
            // sort by x for faster onClick 
            simedNodes.sort((a,b) => (a.x - b.x));
            console.log(simedNodes);
            // console.log(simedNodes)
            simedLinks = data.links;
            draw();
        }
        const draw = () => {
            context.clearRect(0, 0, width, height);
            context.save();
            context.translate(transform.x, transform.y);
            context.scale(transform.k, transform.k);

            context.beginPath();
            simedLinks.forEach(drawLink);
            context.strokeStyle = "#aaa";
            context.stroke();

            context.beginPath();
            simedNodes.forEach(drawNode);
            context.fill();

            context.restore()
        }
        function drawLink(d) {
            context.moveTo(d.source.x, d.source.y);
            context.lineTo(d.target.x, d.target.y);
        }
        function drawNode(d) {
            context.moveTo(d.x + 3, d.y);
            context.arc(d.x, d.y, nodeRadius, 0, 2 * Math.PI);
        }

        // zoom events
        const zoomed = (event) => {
            transform = event.transform;
            console.log(transform)
            draw();
        }
        const zoom = d3.zoom()
            .scaleExtent([1 / 10, 8])
            .on("zoom", zoomed)

        
        // onClick events
        const isInXRange = (start, end, target) => {
            // console.log(start, end, target)
            return start <= target && target <= end
        };
        const onClickGraph = (event) => {
            const x = transform.invertX(event.x),
                y = transform.invertY(event.y);
            // console.log(bnSearch(x - nodeRadius, x + nodeRadius, 0, simedNodes.length - 1, simedNodes, isInXRange))
            for(const node of simedNodes) {
                const dx = Math.abs(node.x - x), 
                    dy = Math.abs(node.y - y),
                    d = Math.sqrt(dx * dx + dy + dy);
                if (d <= nodeRadius) {
                    onClickNode(node.id);
                    break;
                }
            }
        }
        const bnSearch = (targetSt, targetEd, st, ed, array, compareFn) => {
            // FIXME: a have bug
            if (st > ed) {
                return NaN
            }
            const mid = Math.floor((ed + st) / 2);
            // console.log(`mid: ${mid}`)
            if (compareFn(targetSt, targetEd, array[mid].x)) {
                return mid
            } else {
                if(targetSt > array[mid].x) {
                    return bnSearch(targetSt, targetEd, mid + 1, ed, array, compareFn);
                } else {
                    return bnSearch(targetSt, targetEd, st, mid - 1, array, compareFn);
                }
            }
        } 
        const onClickNode = (key) => {
            console.log(key)
        }

        // hanging events in the canvas
        d3.select(canvasElement)
            .call(zoom)
            .on("dblclick.zoom", null)
            .on("click", onClickGraph);

        return () => {
            // clean up
            d3.select(canvasElement).selectAll("*").remove();
        }
    }, [height, links, nodes, width]);
    return <>
        <canvas ref={canvasRef} width={width} height={height}/>
    </>
}

export default ForceDirectedGraphCanvas;