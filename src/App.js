import './App.css';
// import ForceDirectedGraphSvg from './components/force-directed-graph-svg';
import ForceDirectedGraphCanvas from './components/force-directed-graph-canvas';

// import CalculatedNodes from './data/nodes.json';
// import CalculatedLinks from './data/links.json';
import OriginalNodesAndLinks from './data/testDataCombined.json'

function App() {
  return (
    <div className="App">
      <ForceDirectedGraphCanvas 
        nodes={OriginalNodesAndLinks.nodes}
        links={OriginalNodesAndLinks.links}
      />
    </div>
  );
}

export default App;
