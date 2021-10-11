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
    borderColor = '#333333',
    onlyRenderOnScreenElement = false,
}) => {
    const canvasRef = useRef(null);
    const { width, height } = useWindowDimension();
    const [loadingProgress, setLoadingProgress] = useState(0)
    const [isCanvasReady, setIsCanvasReady] = useState(false)
    const transform = useRef(d3.zoomIdentity)

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

        // zoom events
        const zoomed = (event) => {
            transform.current = event.transform;
            // console.log(transform)
            draw();
        }
        const zoom = d3.zoom()
            .scaleExtent([1 / 100, 8])
            .on("zoom", zoomed)

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

        const isVectorOnViewport = (source, target, x1, y1, x2, y2) => {
            if ((((target.x - x1) * (target.x - x2) <= 0) && ((target.y - y1) * (target.y - y2) <= 0))||
            (((source.x - x1) * (source.x - x2) <= 0) && ((source.y - y1) * (source.y - y2) <= 0))
            ) { // either source or target is located inside the viewport
                return true
            }
            if (target.x - source.x === 0) { // if line is vertical (gradient = infty)
                return ((target.x - x1) * (target.x - x2) <= 0) &&
                    (!((y1 > target.y && y1 > source.y) || (y2 < target.y && y2 < source.y)));
            }
            if (target.y - source.y === 0) { // if line is horizontal (gradient = 0)
                return ((target.y - y1) * (target.y - y2) <= 0) &&
                    (!((x1 > target.x && x1 > source.x) || (x2 < target.x && x2 < source.x)));
            }
            const gradient = (target.y - source.y) / (target.x - source.x);
            const yLineEqn = (x) => gradient * (x - target.x) + target.y;
            const xLineEqn = (y) => (y - target.y) / gradient + target.x;
            const yHit1 = yLineEqn(x1),
                yHit2 = yLineEqn(x2),
                xHit1 = xLineEqn(y1),
                xHit2 = xLineEqn(y2);
            return (((y1 - yHit1) * (y2 - yHit1) <= 0) && ((target.x - x1) * (source.x - x1) <= 0)) ||
                (((y1 - yHit2) * (y2 - yHit2) <= 0) && ((target.x - x2) * (source.x - x2) <= 0)) ||
                (((x2 - xHit1) * (x1 - xHit1) <= 0) && ((target.y - y1) * (source.y - y1) <= 0)) ||
                (((x2 - xHit2) * (x1 - xHit2) <= 0) && ((target.y - y2) * (source.y - y2) <= 0));
        }

        const isNodeOnViewport = (nodeX, nodeY, nodeRadius, x1, y1, x2, y2) => {
            if ((nodeX - x1) * (nodeX - x2) <= 0 && (nodeY - y1) * (nodeY - y2) <= 0) {
                return true
            }
            // find amount of intersection when x / y is constant
            const xDiscriminant = (y) => 4 * Math.pow(nodeX, 2) - 4 * (Math.pow(y, 2) + Math.pow(nodeX, 2) + Math.pow(nodeY, 2) - Math.pow(nodeRadius, 2) - 2 * y * nodeY);
            const yDiscriminant = (x) => 4 * Math.pow(nodeY, 2) - 4 * (Math.pow(x, 2) + Math.pow(nodeY, 2) + Math.pow(nodeX, 2) - Math.pow(nodeRadius, 2) - 2 * x * nodeX);
            // find the exact intersactions (provided the discriminant > 0)
            const xIntersections = (xDiscriminant) => {
                const rootDiscriminant = Math.sqrt(xDiscriminant) / 2;
                return [nodeX + rootDiscriminant, nodeX - rootDiscriminant]
            }
            const yIntersections = (yDiscriminant) => {
                const rootDiscriminant = Math.sqrt(yDiscriminant) / 2;
                return [nodeY + rootDiscriminant, nodeY - rootDiscriminant]
            }
            // find intersections within the viewport length
            const isIntersectOnRange = (intersections, start, end) => {
                // console.log(`intersections: ${intersections}, start: ${start}, end: ${end}`)
                return (intersections[0]-start)*(intersections[0]-end) <= 0 ||
                (intersections[1]-start)*(intersections[1]-end) <= 0
            }
            const yHit1 = yDiscriminant(x1),
                yHit2 = yDiscriminant(x2),
                xHit1 = xDiscriminant(y1),
                xHit2 = xDiscriminant(y2);
            // console.log(`y1I: ${yIntersections(yHit1, y1, y2)}, y2I: ${yIntersections(yHit2, y1, y2)}, xH1: ${xIntersections(xHit1, x1, x2)}, xH2: ${isIntersectOnRange(xIntersections(xHit2, x1, x2))}`)
            
            return (yHit1 > 0 && isIntersectOnRange(yIntersections(yHit1), y1, y2)) ||
                (yHit2 > 0 && isIntersectOnRange(yIntersections(yHit2), y1, y2)) ||
                (xHit1 > 0 && isIntersectOnRange(xIntersections(xHit1), x1, x2)) ||
                (xHit2 > 0 && isIntersectOnRange(xIntersections(xHit2), x1, x2));
        }

        const isNodeOnViewport2 = (nodeX, nodeY, maxRadius, x1, y1, x2, y2) => {
            return ((nodeX - (x1 - maxRadius)) * (nodeX - (x2 + maxRadius)) <= 0 && (nodeY - (y1 - maxRadius)) * (nodeY - (y2 + maxRadius)) <= 0)
        }

        const draw = () => {
            context.clearRect(0, 0, width, height);
            context.save();
            context.translate(transform.current.x, transform.current.y);
            context.scale(transform.current.k, transform.current.k);
            // console.log(simedLinks)
            // console.log(simedNodes)
            context.beginPath();
            if (onlyRenderOnScreenElement) {
                const filteredLinks = simedLinks.filter(link => isVectorOnViewport(link.source, link.target, transform.current.invertX(0), transform.current.invertY(0), transform.current.invertX(width), transform.current.invertY(height)));
                filteredLinks.forEach(drawLink)
            } else {
                simedLinks.forEach(drawLink)
            }
            context.strokeStyle = linkColor;
            context.lineWidth = linkWidth;
            context.stroke();
            if (onlyRenderOnScreenElement) {
                // const filteredNodes = simedNodes.filter(node => isNodeOnViewport(node.x, node.y, _getNodeRadius(fnRadiusCritiria(node)), transform.current.invertX(0), transform.current.invertY(0), transform.current.invertX(width), transform.current.invertY(height)))
                const filteredNodes = simedNodes.filter(node => isNodeOnViewport2(
                    node.x, 
                    node.y,
                    isDynamicRadius ? maxRadius : nodeRadius,
                    transform.current.invertX(0), 
                    transform.current.invertY(0), 
                    transform.current.invertX(width), 
                    transform.current.invertY(height)
                ))
                // console.log(filteredNodes)
                filteredNodes.forEach(drawNode);
            } else {
                simedNodes.forEach(drawNode)
            }
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
                arcs.forEach((arc) => {
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
                return color
            }
        }

        // onClick events
        const isInXRange = (x, target, radius) => {
            return x - radius <= target && target <= x + radius
        };
        const onClickGraph = (event) => {
            const x = transform.current.invertX(event.x),
                y = transform.current.invertY(event.y);
            let pressedNodeIndex = bnSearch(x, y, 0, simedNodes.length - 1, simedNodes, isInXRange)
            if (pressedNodeIndex !== null) {
                onClickNode(simedNodes[pressedNodeIndex])
            }
        }
        // !! assuming all nodes are not stacked
        const bnSearch = (targetX, targetY, st, ed, array, compareFn) => {
            if (st > ed) {
                return null
            }
            const mid = Math.floor((ed + st) / 2);
            const midRadius = _getNodeRadius(fnRadiusCritiria(array[mid]))
            if (compareFn(targetX, array[mid].x, midRadius)) {
                let d, dx, dy, i = mid;
                do { // 
                    dx = Math.abs(array[i].x - targetX);
                    dy = Math.abs(array[i].y - targetY);
                    d = Math.sqrt(dx * dx + dy * dy);
                    if (d <= _getNodeRadius(fnRadiusCritiria(array[i]))) {
                        return i
                    }
                } while (dx <= maxRadius && --i >= 0);
                i = mid
                dx = 0
                while (dx <= maxRadius && ++i < array.length) {
                    dx = Math.abs(array[i].x - targetX);
                    dy = Math.abs(array[i].y - targetY);
                    d = Math.sqrt(dx * dx + dy * dy);
                    if (d <= _getNodeRadius(fnRadiusCritiria(array[i]))) {
                        return i
                    }
                }
                return null
            } else {
                if (targetX - midRadius > array[mid].x) {
                    return bnSearch(targetX, targetY, mid + 1, ed, array, compareFn);
                } else {
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
    }, [borderColor, borderWidth, colors, fnColorCritiria, fnRadiusCritiria, height, isDynamicRadius, isSimulated, linkColor, linkWidth, links, maxRadius, minRadius, nodeRadius, nodes, onlyRenderOnScreenElement, width]);
    return <>
        {!isCanvasReady &&
            <h1>Loading... {(loadingProgress * 100).toFixed(2)}</h1>
        }
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            style={{
                margin: 0,
                padding: 0,
                display: isCanvasReady ? 'block' : 'none'
            }}
        />
    </>
}

export default ForceDirectedGraphCanvas