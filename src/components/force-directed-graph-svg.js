import React, { useState, useEffect, useRef } from 'react';
import d3 from 'd3';

const ForceDirectedGraphSvg = () => {
    const svgRef = useRef(null);
    useEffect(() => {
        // TODO: create graph in svg
        const svgElement = svgRef.current;

        return () => {
            // clean up
            d3.select(svgElement).selectAll("*").remove();
        }
    }, []);
    return <svg ref={svgRef}/>
}

export default ForceDirectedGraphSvg;