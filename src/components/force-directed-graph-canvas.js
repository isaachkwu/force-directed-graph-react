import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import defaultColor from '../data/colors-40.json'

// workers
import SimWorker from '../workers/force-simulation.worker'

// hooks
import useWindowDimension from '../hooks/useWindowDimension';

const ForceDirectedGraphCanvas = ({ 
    nodes, 
    links, 
    colors,
    colorCritiria = d => d.type,
    isSimulated = false, 
    isDynamicRadius = false,
    radiusCritiria = (d) => d.num,
    nodeRadius = 10,
    maxRadius = 15,
    minRadius = 3,
    linkWidth = 0.5,
    linkColor = '#aaa',
    borderWidth = 1,
    borderColor = '#333333'

}) => {
    const canvasRef = useRef(null);
    const { width, height } = useWindowDimension();
    const [loadingProgress, setLoadingProgress] = useState(0)
    const [isCanvasReady, setIsCanvasReady] = useState(false)

    const fnColorCritiria = useCallback(colorCritiria, [colorCritiria])
    const fnRadiusCritiria = useCallback(radiusCritiria, [radiusCritiria])

    useEffect(() => {
        const canvasElement = canvasRef.current;
        const context = canvasElement.getContext("2d");

        // simulation is ongoing
        const ticked = (data) => {
            setIsCanvasReady(false);
            setLoadingProgress(data.progress)
        }

        const _getNodeRadius = isDynamicRadius ?
            d3.scaleLinear()
                .domain([d3.min(nodes, fnRadiusCritiria), d3.max(nodes, fnRadiusCritiria)])
                .range([minRadius, maxRadius])
            :
            () => nodeRadius 
        
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
            context.strokeStyle = linkColor;
            context.lineWidth = linkWidth;
            context.stroke();

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
                    .outerRadius(_getNodeRadius(fnRadiusCritiria(d)))
                    .context(context);
                const arcs = pie(Object.entries(d.pie))
                const color = d3.scaleLinear()
                    .domain([0, d3.max(Object.entries(d.pie), d => d[1])])
                    .range(['#fff', getColor(d)])
                arcs.forEach((arc, i) => {
                    context.save();
                    context.beginPath();
                    context.translate(d.x, d.y)
                    genArc(arc);
                    // console.log(arc)
                    context.fillStyle = color(arc.data[1]);
                    context.strokeStyle = borderColor;
                    context.lineWidth = borderWidth;
                    context.fill();
                    context.stroke();
                    context.restore();
                })
            } else {
                context.beginPath();
                context.fillStyle = getColor(d)
                context.strokeStyle = borderColor;
                context.lineWidth = borderWidth;
                const radius = _getNodeRadius(fnRadiusCritiria(d))
                context.moveTo(d.x + radius, d.y);
                context.arc(d.x, d.y, radius, 0, 2 * Math.PI);
                context.fill();
                context.stroke();
            }
        }

        const getColor = (d) => {
            // console.log(d)
            if (fnColorCritiria(d) === undefined) {
                return '#999999'
            }
            if (colors) {
                return colors[fnColorCritiria(d) % colors.length]
            } else {
                const color = defaultColor.colors[fnColorCritiria(d) % defaultColor.colors.length]
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
        const isInXRange = (x, target, radius) => {
            // console.log(start, end, target)
            return x - radius <= target && target <= x + radius
        };
        const onClickGraph = (event) => {
            const x = transform.invertX(event.x),
                y = transform.invertY(event.y);
            let [validXStartIndex, validXEndIndex] = bnSearch(x, 0, simedNodes.length - 1, simedNodes, isInXRange)
            // console.log(`validXStartIndex: ${validXStartIndex}, validXEndIndex${validXEndIndex}`)
            if (validXStartIndex !== null && validXEndIndex !== null) {
                let validNodeIndex = null, dx, dy, d, tempNode;
                while (validXStartIndex <= validXEndIndex && validNodeIndex === null) {
                    tempNode = simedNodes[validXStartIndex];
                    dx = Math.abs(tempNode.x - x);
                    dy = Math.abs(tempNode.y - y);
                    d = Math.sqrt(dx * dx + dy * dy);
                    if (d <= _getNodeRadius(fnRadiusCritiria(tempNode))) {
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
        const bnSearch = (targetX, st, ed, array, compareFn) => {
            if (st > ed) {
                return [null, null]
            }
            const mid = Math.floor((ed + st) / 2);
            const midRadius = _getNodeRadius(fnRadiusCritiria(array[mid]))
            if (compareFn(targetX, array[mid].x, midRadius)) {
                // valid X is between validStIndex and validEdIndex
                for (var i = mid; i >= 0 && compareFn(targetX, array[i].x, midRadius); --i) { }
                let validStIndex = i + 1;
                for (i = mid; i < array.length && compareFn(targetX, array[i].x, midRadius); ++i) { }
                let validEdIndex = i - 1;
                return [validStIndex, validEdIndex]
            } else {
                if (targetX - midRadius > array[mid].x) {
                    // console.log("hey")
                    return bnSearch(targetX, mid + 1, ed, array, compareFn);
                } else {
                    // console.log("hi")
                    return bnSearch(targetX, st, mid - 1, array, compareFn);
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
    }, [borderColor, borderWidth, colors, height, isDynamicRadius, isSimulated, linkColor, linkWidth, links, maxRadius, minRadius, nodeRadius, nodes, width]);
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