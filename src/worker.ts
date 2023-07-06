
import { JNode } from "./jnode.js";
import { JGraph } from "./jgraph.js";

/** @internal */
export interface WorkerMessage {
  graph: JGraph;
  samples: number;
}

/** @internal */
export interface WorkerResult {
  [nodeName: string]: JNode;
}

function toGraph(msg: WorkerMessage) {
  // The structured clone algorithm ensures that all nodes we receive here
  // point to the same graph instance. However, none of these objects
  // (nodes or the graph) are hooked up to their proper prototypes.
  // So we simply create new instances that do have the correct prototypes,
  // and give them the same values we got here.
  const g: JGraph = Object.create(
    JGraph.prototype, Object.getOwnPropertyDescriptors(msg.graph));
  const nodes = g.nodes.map(n => { 
    const newNode: JNode = Object.create(
      JNode.prototype, Object.getOwnPropertyDescriptors(n));
    newNode.g = g;
    g.nodeMap[n.name] = newNode;
    return newNode;
  });
  g.nodes = nodes;    
  //console.log(nodes[0].g);
  //console.log(nodes[1].g);
  //console.log('equal', Object.is(nodes[0], nodes[0].g.nodes[0]));
  //const g = new JGraph();
  return g;
}

function sample(msg: WorkerMessage) {
  const g = toGraph(msg);
  g.sample(msg.samples);
  
  const result: WorkerResult = {};
  for (let i=0; i < g.nodes.length; i++) {
    result[g.nodes[i].name] = g.nodes[i];
  }
  self.postMessage(result);
}

self.onmessage = function(e) {
  sample(e.data);
}