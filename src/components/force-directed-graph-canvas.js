import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import defaultColor from '../data/colors-40.json'

// workers
import SimWorker from '../workers/force-simulation.worker'

// hooks
import useWindowDimension from '../hooks/useWindowDimension';

const ForceDirectedGraphCanvas = ({
    nodes,
    links,
    colors, // an json with a 'colors' array attributes
    colorCritiria, // function to get the critiria of the color, ex: d => d.type
    isSimulated = false, // true means the nodes and links are simulated before
    isDynamicRadius = false, // true means the nodes size scale according to radiusCritiria
    radiusCritiria, // function to get a nodes attribute that determines its radius ex: d => d.num
    nodeRadius = 10, // node radius when isDynamicRadius is false
    maxRadius = 15, // maximum radius of a node when isDynamicRadius is true
    minRadius = 3, // minimum radius of a node when isDynamicRadius is false
    linkWidth = 0.2,
    linkColor = '#aaa',
    borderWidth = 0.2,
    borderColor = '#333333'

}) => {
    const canvasRef = useRef(null);
    const { width, height } = useWindowDimension();
    const [loadingProgress, setLoadingProgress] = useState(0)
    const [isCanvasReady, setIsCanvasReady] = useState(false)

    const fnColorCritiria = useCallback((d) => {
        if (colorCritiria) {
            return colorCritiria(d)
        }

        // default critiria for choosing color of a node
        return d.type !== null && d.type !== undefined ? d.type : 0
    }, [colorCritiria])
    const fnRadiusCritiria = useCallback((d) => {
        if (radiusCritiria) {
            return radiusCritiria(d)
        }
        // default critiria for deciding radius of a node
        return d.num !== null && d.num !== undefined ? d.num : 0
    }, [radiusCritiria])

    useEffect(() => {
        const canvasElement = canvasRef.current;
        const context = canvasElement.getContext("2d");

        // simulation is loading (only runs when isSimulated = false)
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
            console.log(simedNodes)
            console.log(simedLinks)
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
            let pressedNodeIndex = bnSearch(x, y, 0, simedNodes.length - 1, simedNodes, isInXRange)
            if (pressedNodeIndex !== null) {
                onClickNode(simedNodes[pressedNodeIndex])
            }
        }
        const bnSearch = (targetX, targetY, st, ed, array, compareFn) => {
            if (st > ed) {
                return null
            }
            const mid = Math.floor((ed + st) / 2);
            const midRadius = _getNodeRadius(fnRadiusCritiria(array[mid]))
            if (compareFn(targetX, array[mid].x, midRadius)) {
                let d, dx, dy, i = mid;
                do {
                    dx = Math.abs(array[i].x - targetX);
                    dy = Math.abs(array[i].y - targetY);
                    d = Math.sqrt(dx * dx + dy * dy);
                    if (d <= _getNodeRadius(fnRadiusCritiria(array[i]))) {
                        return i
                    }
                } while (dx <= maxRadius && --i >= 0);
                i = mid
                do {
                    dx = Math.abs(array[i].x - targetX);
                    dy = Math.abs(array[i].y - targetY);
                    d = Math.sqrt(dx * dx + dy * dy);
                    if (d <= _getNodeRadius(fnRadiusCritiria(array[i]))) {
                        return i
                    }
                } while (dx <= maxRadius && ++i < array.length);
                return null
            } else {
                if (targetX - midRadius > array[mid].x) {
                    // console.log("hey")
                    return bnSearch(targetX, targetY, mid + 1, ed, array, compareFn);
                } else {
                    // console.log("hi")
                    return bnSearch(targetX, targetY, st, mid - 1, array, compareFn);
                }
            }
        }
        const onClickNode = (node) => {
            console.log(node)
            //  implement your own on click function!
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
    }, [borderColor, borderWidth, colors, fnColorCritiria, fnRadiusCritiria, height, isDynamicRadius, isSimulated, linkColor, linkWidth, links, maxRadius, minRadius, nodeRadius, nodes, width]);
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

export default ForceDirectedGraphCanvas