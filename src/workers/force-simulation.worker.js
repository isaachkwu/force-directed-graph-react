import * as d3 from 'd3';

onmessage = (event) => {
  // console.log(event.data);
  let nodes = event.data.nodes,
      links = event.data.links,
      width = event.data.width,
      height = event.data.height;

  let simulation = d3.forceSimulation(nodes)
      .force("charge", d3.forceManyBody())
      .force("link", d3.forceLink(links).id(d => d.id).distance(40).strength(1))
      .force("center", d3.forceCenter(width / 2, height / 2))
      // .force("x", d3.forceX())
      // .force("y", d3.forceY())
      .stop();

  for (let i = 0, n = Math.ceil(Math.log(simulation.alphaMin()) / Math.log(1 - simulation.alphaDecay())); i < n; ++i) {
    postMessage({type: "tick", progress: i / n});
    simulation.tick();
  }

  postMessage({type: "end", nodes: nodes, links: links});
}