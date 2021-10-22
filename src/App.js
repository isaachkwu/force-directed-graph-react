import './App.css';
// import ForceDirectedGraphSvg from './components/force-directed-graph-svg';
import ForceDirectedGraphCanvas from './components/force-directed-graph/canvas/force-directed-graph-canvas';
import ForceDirectedGraphWebgl from './components/force-directed-graph/threejs/ForceDirectedGraphThree';

// import CalculatedNodes from './data/nodes.json';
// import CalculatedLinks from './data/links.json';
// import OriginalNodesAndLinks from './data/testDataCombined.json'
import BigTestData from './data/raw/testDataCombined.json'
import SimulatedLinks from './data/simulated/links-50000-5000-30-2500.json'
import SimulatedNodes from './data/simulated/nodes-50000-5000-30-2500.json'

function App() {
  return (
    <div className="App">
      {/* <ForceDirectedGraphCanvas 
        // nodes={BigTestData.nodes}
        // links={BigTestData.links}
        // colorCritiria={d => d.cluster}
        // isDynamicRadius
        // onlyRenderOnScreenElement

        nodes={SimulatedNodes}
        links={SimulatedLinks}
        colorCritiria={d => d.cluster}
        isDynamicRadius
        isSimulated
        onlyRenderOnScreenElement // disable this to stop limited rendering
      /> */}
      <ForceDirectedGraphWebgl 
        nodes={SimulatedNodes}
        links={SimulatedLinks}
      />
    </div>
  );
}

export default App;
