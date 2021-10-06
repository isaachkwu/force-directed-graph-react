import './App.css';
// import ForceDirectedGraphSvg from './components/force-directed-graph-svg';
import ForceDirectedGraphCanvas from './components/force-directed-graph-canvas';

// import CalculatedNodes from './data/nodes.json';
// import CalculatedLinks from './data/links.json';
// import OriginalNodesAndLinks from './data/testDataCombined.json'
import BigTestData from './data/raw/testData-20000.json'
import SimulatedLinks from './data/simulated/links-10-10-5-5.json'
import SimulatedNodes from './data/simulated/nodes-10-10-5-5.json'

function App() {
  return (
    <div className="App">
      <ForceDirectedGraphCanvas 
        nodes={BigTestData.nodes}
        links={BigTestData.links}
        colorCritiria={d => d.type}
        isDynamicRadius

        // nodes={SimulatedNodes}
        // links={SimulatedLinks}
        // colorCritiria={d => d.cluster}
        // isSimulated
      />
    </div>
  );
}

export default App;
