

/** @internal */
export interface WorkerMessage {
  graph: JGraph;
  samples: number;
}

/** @internal */
export interface WorkerResult {
  [nodeName: string]: JNode;
}

// Since we embed the worker script code within the web page where the module
// code is running, we need minimal versions of JNode and JGraph here
// (so we don't need to serve them separately). I fully recognize the
// awfulness of this situation.

class JNode {

  public _sampledLw?: number[];
  public wasSampled = false;
  public parents: string[] = [];
  public cpt: any[] = [];
  public value = -1;
  public dirty = false;
  public isObserved = false;
  public g?: JGraph;

  constructor(public name: string, public values: any[]) {
  }

  initSampleLw() {
    this._sampledLw = undefined;
  }
    
  sampleLw(): number {
    if (this.wasSampled) {
      return 1;
    }

    const parentNodes = this.parents.map(pName => this.g!.nodeMap[pName]);
    let fa = 1;
    parentNodes.forEach(pa => {
      fa *= pa.sampleLw();
    });

    this.wasSampled = true;

    let dh = this.cpt;
    parentNodes.forEach(pa => {
      dh = dh[pa.value];
    });

    if (this.value != -1) {
      fa *= dh[this.value];
    } else {
      let fv = Math.random();
      for (let h = 0; h < dh.length; h++) {
        fv -= dh[h];
        if (fv < 0) {
          this.value = h;
          break;
        }
      }
    }

    return fa;
  }
  
  saveSampleLw(f: number) {
    if (!this._sampledLw) {
      this._sampledLw = new Array(this.values.length);
      for (let h = this.values.length - 1; h >= 0; h--) {
        this._sampledLw[h] = 0;
      }
    }
    this._sampledLw[this.value] += f;
  }
}

class JGraph {

  public nodes: JNode[] = [];
  public nodeMap: { [nodeName: string]: JNode } = {};

  sample(samples: number): number {
    for (let h = this.nodes.length - 1; h >= 0; h--) {
      this.nodes[h].initSampleLw();
    }
    let lwSum = 0;
    for (let count = 0; count < samples; count++) {
      for (let h = this.nodes.length - 1; h >= 0; h--) {
        const n = this.nodes[h];
        if (!n.isObserved) {
          n.value = -1;
        }
        n.wasSampled = false;
      }
      const fa = this.nodes.reduceRight((prod, n) => prod * n.sampleLw(), 1);
      lwSum += fa;
      for (let h = this.nodes.length - 1; h >= 0; h--) {
        const n = this.nodes[h];
        n.saveSampleLw(fa);
      }
    }
    return lwSum;
  }
  
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