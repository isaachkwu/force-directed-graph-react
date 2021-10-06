import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import defaultColor from '../data/colors-40.json'

// workers
import SimWorker from '../workers/force-simulation.worker'

// hooks
import useWindowDimension from '../hooks/useWindowDimension';

const ForceDirectedGraphCanvas = ({ nodes, links, isSimulated = false, colors }) => {
    const canvasRef = useRef(null);
    const { width, height } = useWindowDimension();
    const [loadingProgress, setLoadingProgress] = useState(0)
    const [isCanvasReady, setIsCanvasReady] = useState(false)

    useEffect(() => {
        const canvasElement = canvasRef.current;
        const context = canvasElement.getContext("2d");

        // simulation is ongoing
        const ticked = (data) => {
            setIsCanvasReady(false);
            setLoadingProgress(data.progress)
        }

        // radius of node
        const nodeRadius = 7;
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
            simedLinks = data.links;
            // console.log(simedNodes)
            // console.log(simedLinks)
            draw();
        }
        const draw = () => {
            // console.log(simedNodes);
            // console.log(simedLinks)
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
            context.restore()
        }
        function drawLink(d) {
            context.moveTo(d.source.x, d.source.y);
            context.lineTo(d.target.x, d.target.y);
        }
        function drawNode(d) {
            if (d.pie) {
                const pie = d3.pie().value(d => d[1]);
                const genArc = d3.arc()
                    .innerRadius(0)
                    .outerRadius(nodeRadius)
                    .context(context);
                const arcs = pie(Object.entries(d.pie))
                const color = d3.scaleLinear()
                    .domain([0, d3.max(Object.entries(d.pie), d => d[1])])
                    .range(['#fff', getColor(d.cluster)])
                arcs.forEach((arc, i) => {
                    context.save();
                    context.beginPath();
                    context.translate(d.x, d.y)
                    genArc(arc);
                    console.log(arc)
                    context.fillStyle = color(arc.data[1]);
                    context.fill();
                    context.stroke();
                    context.restore();
                })
            } else {
                context.beginPath();
                if (d.cluster !== undefined || d.cluster !== null) {
                    context.fillStyle = getColor(d.cluster)
                }
                context.moveTo(d.x + nodeRadius, d.y);
                context.arc(d.x, d.y, nodeRadius, 0, 2 * Math.PI);
                context.fill();
                context.stroke();
            }
        }

        const getColor = (cluster) => {
            if (colors) {
                return colors[cluster % colors.length]
            } else {
                const color = defaultColor.colors[cluster % defaultColor.colors.length]
                // console.log(color)
                return color
            }
        }

        // zoom events
        const zoomed = (event) => {
            transform = event.transform;
            // console.log(transform)
            draw();
        }
        const zoom = d3.zoom()
            .scaleExtent([1 / 100, 8])
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
            // console.log(`validXStartIndex: ${validXStartIndex}, validXEndIndex${validXEndIndex}`)
            if (validXStartIndex !== null && validXEndIndex !== null) {
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
                    onClickNode(simedNodes[validNodeIndex].id)
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
                for (var i = mid; i >= 0 && compareFn(targetSt, targetEd, array[i].x); --i) { }
                let validStIndex = i + 1;
                for (i = mid; i < array.length && compareFn(targetSt, targetEd, array[i].x); ++i) { }
                let validEdIndex = i - 1;
                return [validStIndex, validEdIndex]
            } else {
                if (targetSt > array[mid].x) {
                    // console.log("hey")
                    return bnSearch(targetSt, targetEd, mid + 1, ed, array, compareFn);
                } else {
                    // console.log("hi")
                    return bnSearch(targetSt, targetEd, st, mid - 1, array, compareFn);
                }
            }
        }
        const onClickNode = (id) => {
            console.log(`onClickNode invoked. id = ${id}`)
        }

        // worker start simulation
        if (!isSimulated) {
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
            ended({ nodes, links })
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
    }, [colors, height, isSimulated, links, nodes, width]);
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