import './App.css';
// import ForceDirectedGraphSvg from './components/force-directed-graph-svg';
import ForceDirectedGraphCanvas from './components/force-directed-graph-canvas';

// import CalculatedNodes from './data/nodes.json';
// import CalculatedLinks from './data/links.json';
// import OriginalNodesAndLinks from './data/testDataCombined.json'
import BigTestData from './data/raw/testData-40000.json'
import SimulatedLinks from './data/simulated/links-10000.json'
import SimulatedNodes from './data/simulated/nodes-10000.json'

function App() {
  return (
    <div className="App">
      <ForceDirectedGraphCanvas 
        nodes={SimulatedNodes}
        links={SimulatedLinks}
        isSimulated
      />
    </div>
  );
}

export default App;
