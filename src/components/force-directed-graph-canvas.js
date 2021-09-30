import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

// workers
import SimWorker from '../workers/force-simulation.worker'

// hooks
import useWindowDimension from '../hooks/useWindowDimension';

const ForceDirectedGraphCanvas = ({ nodes, links }) => {
    const canvasRef = useRef(null);
    const { width, height } = useWindowDimension();
    const [loadingProgress, setLoadingProgress] = useState(0)
    const [isCanvasReady, setIsCanvasReady] = useState(false)

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
            setIsCanvasReady(false);
            setLoadingProgress(data.progress)
        }

        // radius of node
        const nodeRadius = 3;
        // transform object for zoom
        let transform = d3.zoomIdentity;
        // simulated nodes, and links, with x, y, and id
        let simedNodes, simedLinks;

        // simulation is done, time to draw
        const ended = (data) => {
            setIsCanvasReady(true);
            simedNodes = data.nodes;
            // sort by x for faster onClick 
            simedNodes.sort((a, b) => (a.x - b.x));
            // console.log(simedNodes);
            simedLinks = data.links;
            // console.log(simedLinks)
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
            // console.log(transform)
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
            let [validXStartIndex, validXEndIndex] = bnSearch(x - nodeRadius, x + nodeRadius, 0, simedNodes.length - 1, simedNodes, isInXRange)
            if (validXStartIndex && validXEndIndex) {
                let validNodeIndex = null, dx, dy, d, tempNode;
                while (validXStartIndex <= validXEndIndex && validNodeIndex === null) {
                    tempNode = simedNodes[validXStartIndex];
                    dx = Math.abs(tempNode.x - x);
                    dy = Math.abs(tempNode.y - y);
                    d = Math.sqrt(dx * dx + dy * dy);
                    if (d <= nodeRadius) {
                        validNodeIndex = validXStartIndex;
                    }
                    validXStartIndex++;
                }
                if (validNodeIndex !== null) {
                    console.log(`Node id: ${simedNodes[validNodeIndex].id} index: ${validNodeIndex}`)
                }
            }
        }
        const bnSearch = (targetSt, targetEd, st, ed, array, compareFn) => {
            if (st > ed) {
                return [null, null]
            }
            const mid = Math.floor((ed + st) / 2);
            if (compareFn(targetSt, targetEd, array[mid].x)) {
                // valid X is between validStIndex and validEdIndex
                for (var i = mid; compareFn(targetSt, targetEd, array[i].x); --i) { }
                let validStIndex = i + 1;
                for (i = mid; compareFn(targetSt, targetEd, array[i].x); ++i) { }
                let validEdIndex = i - 1;
                return [validStIndex, validEdIndex]
                // find node with valid y from valid x nodes
                // let validNodeIndex = null, dx, dy, d, tempNode;
                // while(validStIndex <= validEdIndex || validNodeIndex === null) {
                //     tempNode = array[validStIndex];
                //     dx = Math.abs(tempNode.x - );
                // }
            } else {
                if (targetSt > array[mid].x) {
                    return bnSearch(targetSt, targetEd, mid + 1, ed, array, compareFn);
                } else {
                    return bnSearch(targetSt, targetEd, st, mid - 1, array, compareFn);
                }
            }
        }
        const onClickNode = (key) => {
            // console.log(key)
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
        {!isCanvasReady &&
            <h1>Loading... {(loadingProgress * 100).toFixed(2)}</h1>
        }
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            style={{
                display: isCanvasReady ? 'initial' : 'none'
            }}
        />
    </>
}

export default ForceDirectedGraphCanvas;