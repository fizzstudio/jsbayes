
import { initCptWithParents, JNode } from "./jnode.js";
import { type WorkerMessage, type WorkerResult } from "./worker.js";
import workerCode from './worker_code.js';


const workerDivId = '__jsbayes_web_worker__';

/** @public */
export class JGraph {

  public nodes: JNode[] = [];
  public saveSamples = false;
  public samples: { [nodeName: string]: any }[] = [];
  public nodeMap: { [nodeName: string]: JNode } = {};

  constructor() {
    if (!document.getElementById(workerDivId)) {
      const div = document.createElement('div');
      div.id = workerDivId;
      div.style.display = 'none';
      div.textContent = workerCode;
      document.body.append(div);
    }
  }

  reinit() {
    this.nodes.forEach(n => {
      if (n.dirty === undefined || n.dirty) {
        const parentNodes = n.parents.map(pName => this.nodeMap[pName]);
        n.cpt = initCptWithParents(n.values, parentNodes, 0);
        n.dirty = false;
      }
    });
  }

  sample(samples: number): number {
    if (this.saveSamples) {
      // reset the samples if we want to save them
      this.samples = [];
    }

    /*if (!this.nodeMap) {
      this.createNodeMap();
    }*/

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

      if (this.saveSamples) {
        const sample: { [nodeName: string]: any } = {};
        for (let h = this.nodes.length - 1; h >= 0; h--) {
          const n = this.nodes[h];
          sample[n.name] = n.values[n.value];
        }
        this.samples.push(sample);
      }
    }

    return lwSum;
  }

  /*private createNodeMap() {
    this.nodeMap = {};
    for (let i = 0; i < this.nodes.length; i++) {
      const node = this.nodes[i];
      this.nodeMap[node.name] = node;
    }
  }*/

  node(name: string): JNode {
    //if (!this.nodeMap) {
    //  this.createNodeMap();
    //}
    return this.nodeMap[name];
  }

  observe(name: string, value: any) {
    const node = this.node(name);
    if (node) {
      node.observe(value);
    } else {
      console.error('could not find node with name ' + name);
    }
  }

  unobserve(name: string) {
    const node = this.node(name);
    if (node) {
      node.unobserve();
    }
  }

  newNode(name: string, values: any[]): JNode {
    const node = new JNode(name, values);
    this.addNodes(node);
    return node;
  }

  addNodes(...nodes: JNode[]) {
    nodes.forEach(n => {
      n.g = this;
      this.nodeMap[n.name] = n;
    });
    this.nodes.push(...nodes);
  }

  samplesAsCsv(options: any) {
    const opts = options || {};
    const D_ROW = opts.rowDelimiter || '\n';
    const D_FIELD = opts.fieldDelimiter || ',';
    let csv = '';
    let row = '';
    for (let i = 0; i < this.nodes.length; i++) {
      row += this.nodes[i].name;
      if (i < this.nodes.length - 1) {
        row += D_FIELD;
      }
    }
    csv += row + D_ROW;

    for (let i = 0; i < this.samples.length; i++) {
      const sample = this.samples[i];
      row = '';
      for (let j = 0; j < this.nodes.length; j++) {
        const node = this.nodes[j];
        row += sample[node.name];
        if (j < this.nodes.length - 1) {
          row += D_FIELD;
        }
      }
      csv += row;
      if (i < this.samples.length - 1) {
        csv += D_ROW;
      }
    }

    return csv;
  }

  private toWorkerMessage(samples: number): WorkerMessage {
    const msg = {
      samples,
      graph: this   
    };
    return msg;
  }

  async sampleWithWorker(samples: number): Promise<void> {
    return new Promise((res, rej) => {
      const blob = new Blob([
        document.getElementById(workerDivId)!.textContent!],
        { type: 'text/javascript' }
      );
      const worker = new Worker(URL.createObjectURL(blob), {type: 'module'});
      worker.onerror = e => {
        console.error(e);
      };
      worker.onmessage = e => {
        const nodeMap = e.data as WorkerResult;
        this.updateFromWorker(nodeMap);
        res();
      };
      worker.postMessage(this.toWorkerMessage(samples));
    });
  }

  private updateFromWorker(nodeMap: WorkerResult) {
    for (let i = 0; i < this.nodes.length; i++) {
      const tnode = this.nodes[i]; // 'this' node
      const unode = nodeMap[tnode.name]; // updated node
      if (!unode) {
        continue;
      }
      tnode.value = unode.value;
      tnode.wasSampled = unode.wasSampled;
      tnode._sampledLw = unode._sampledLw;
    }
  }

}
