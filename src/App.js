import './App.css';
// import ForceDirectedGraphSvg from './components/force-directed-graph-svg';
import ForceDirectedGraphCanvas from './components/force-directed-graph-canvas';

// import CalculatedNodes from './data/nodes.json';
// import CalculatedLinks from './data/links.json';
// import OriginalNodesAndLinks from './data/testDataCombined.json'
import BigTestData from './data/bigTestData3.json'

function App() {
  return (
    <div className="App">
      <ForceDirectedGraphCanvas 
        nodes={BigTestData.nodes}
        links={BigTestData.links}
      />
    </div>
  );
}

export default App;
