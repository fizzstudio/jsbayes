class NodeError extends Error {
}
/**
 * Initializes a conditional probability table.
 * @param numValues - Number of values.
 * @returns Array of doubles that sum to 1.0.
 */
function initCpt(numValues) {
    const cpt = [];
    let sum = 0;
    for (let i = 0; i < numValues; i++) {
        cpt[i] = Math.random();
        sum += cpt[i];
    }
    for (let i = 0; i < numValues; i++) {
        cpt[i] = cpt[i] / sum;
    }
    return cpt;
}
/**
 * Initializes a CPT with fake and normalized values using recursion.
 * @param values - Values of variables (array of values).
 * @param parents - Array of nodes that are parents of the variable.
 * @param paIndex - The current parent index.
 * @returns An array of nested arrays representing the CPT.
 * @internal
 */
function initCptWithParents(values, parents, paIndex) {
    if (parents && parents.length > 0) {
        const cpts = [];
        if (parents.length === 1 || paIndex === parents.length - 1) {
            const idx = parents.length === 1 ? 0 : paIndex;
            const numPaVals = parents[idx].values.length;
            for (let i = 0; i < numPaVals; i++) {
                const cpt = initCpt(values.length);
                cpts.push(cpt);
            }
        }
        else {
            const numPaVals = parents[paIndex].values.length;
            for (let i = 0; i < numPaVals; i++) {
                const cpt = initCptWithParents(values, parents, paIndex + 1);
                cpts.push(cpt);
            }
        }
        return cpts;
    }
    else {
        return initCpt(values.length);
    }
}
/**
 * Initializes a node's CPT.
 * @param values - Array of values.
 * @param parents - Array of parents.
 * @param probs - Array of arrays of probabilities.
 * @returns Array of nested arrays representing a CPT.
 */
function initNodeCpt(values, parents, probs) {
    const cpt = initCptWithParents(values, parents, 0);
    setNodeCptProbs(cpt, probs, 0);
    return cpt;
}
/**
 * Checks if an object is an array.
 * @param o  - Object.
 * @returns A boolean to indicate if the object is an array object.
 */
function isArray(o) {
    return (o.constructor === Array);
}
/**
 * Checks if an object is an array of arrays.
 * @param o - Object.
 * @returns A boolean to indicate if the object is array of arrays.
 */
function isArrayOfArray(o) {
    if (isArray(o)) {
        if (o.length > 0) {
            if (isArray(o[0])) {
                return true;
            }
        }
    }
    return false;
}
/**
 * Sets the CPT entries to the specified probabilities.
 * @param cpt - Array of nested arrays representing a CPT.
 * @param probs - Array of arrays of probabilities representing a CPT.
 * @param index - The current index.
 * @returns The next index.
 */
function setNodeCptProbs(cpt, probs, index) {
    if (!isArrayOfArray(cpt)) {
        for (let i = 0; i < cpt.length; i++) {
            cpt[i] = probs[index][i];
        }
        const nextIndex = index + 1;
        return nextIndex;
    }
    else {
        let next = index;
        for (let i = 0; i < cpt.length; i++) {
            next = setNodeCptProbs(cpt[i], probs, next);
        }
        return next;
    }
}
/**
 * Normalizes a CPT.
 * @param cpts - Array of arrays (matrix) representing a CPT.
 * @returns Normalized CPT.
 */
function normalizeCpts(cpts) {
    const probs = [];
    for (let i = 0; i < cpts.length; i++) {
        probs.push(normalizeProbs(cpts[i]));
    }
    return probs;
}
/**
 * Normalizes an array of values such that the elements sum to 1.0. Note that
 * 0.001 is added to every value to avoid 0.0 probabilities. This adjustment
 * helps with visualization downstream.
 * @param arr - Array of probabilities.
 * @returns Normalized probabilities.
 */
function normalizeProbs(arr) {
    const probs = [];
    let sum = 0.0;
    for (let i = 0; i < arr.length; i++) {
        probs[i] = arr[i] + 0.001;
        sum += probs[i];
    }
    for (let i = 0; i < arr.length; i++) {
        probs[i] = probs[i] / sum;
    }
    return probs;
}
/** @public */
class JNode {
    name;
    values;
    _sampledLw;
    wasSampled = false;
    // keeping parent names here rather than references works better
    // for using worker threads
    parents = [];
    cpt = [];
    value = -1;
    dirty = false;
    isObserved = false;
    // XXX better to use Map
    valueIndexMap;
    g;
    constructor(name, values) {
        this.name = name;
        this.values = values;
    }
    initSampleLw() {
        this._sampledLw = undefined;
    }
    sampleLw() {
        if (this.wasSampled) {
            return 1;
        }
        const parentNodes = this.parents.map(pName => this.g.nodeMap[pName]);
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
        }
        else {
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
    saveSampleLw(f) {
        if (!this._sampledLw) {
            this._sampledLw = new Array(this.values.length);
            for (let h = this.values.length - 1; h >= 0; h--) {
                this._sampledLw[h] = 0;
            }
        }
        this._sampledLw[this.value] += f;
    }
    addParent(parent) {
        this.parents.push(parent);
        this.dirty = true;
        return this;
    }
    valueIndex(v) {
        if (!this.valueIndexMap) {
            this.valueIndexMap = {};
            for (let i = 0; i < this.values.length; i++) {
                const value = this.values[i];
                this.valueIndexMap[value] = i;
            }
        }
        return this.valueIndexMap[v];
    }
    observe(value) {
        const index = this.valueIndex(value);
        if (index >= 0) {
            this.isObserved = true;
            this.value = index;
        }
        else {
            console.error('could not find value ' + value + ' for node ' + this.name);
        }
    }
    unobserve() {
        this.isObserved = false;
        this.value = -1;
    }
    setCpt(probs) {
        if (this.parents.length === 0) {
            this.cpt = normalizeProbs(probs);
        }
        else {
            if (!this.g) {
                throw new NodeError('must add node to graph before calling setCpt()');
            }
            const parentNodes = this.parents.map(pName => this.g.nodeMap[pName]);
            this.cpt = initNodeCpt(this.values, parentNodes, normalizeCpts(probs));
        }
    }
    probs() {
        if (!this._sampledLw) {
            return [];
        }
        const sum = this._sampledLw.reduce((acc, s) => acc + s, 0);
        return this._sampledLw.map(s => s / sum);
    }
}

// This function will never be executed! It simply serves as a wrapper
// for the worker module source code. 
function workerCodeWrapper() {
    // Since we embed the worker script code within the web page where the module
    // code is running, we need minimal versions of JNode and JGraph here
    // (so we don't need to serve them separately). I fully recognize the
    // awfulness of this situation.
    class JNode {
        name;
        values;
        _sampledLw;
        wasSampled = false;
        parents = [];
        cpt = [];
        value = -1;
        dirty = false;
        isObserved = false;
        g;
        constructor(name, values) {
            this.name = name;
            this.values = values;
        }
        initSampleLw() {
            this._sampledLw = undefined;
        }
        sampleLw() {
            if (this.wasSampled) {
                return 1;
            }
            const parentNodes = this.parents.map(pName => this.g.nodeMap[pName]);
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
            }
            else {
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
        saveSampleLw(f) {
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
        nodes = [];
        nodeMap = {};
        sample(samples) {
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
    function toGraph(msg) {
        // The structured clone algorithm ensures that all nodes we receive here
        // point to the same graph instance. However, none of these objects
        // (nodes or the graph) are hooked up to their proper prototypes.
        // So we simply create new instances that do have the correct prototypes,
        // and give them the same values we got here.
        const g = Object.create(JGraph.prototype, Object.getOwnPropertyDescriptors(msg.graph));
        const nodes = g.nodes.map(n => {
            const newNode = Object.create(JNode.prototype, Object.getOwnPropertyDescriptors(n));
            newNode.g = g;
            g.nodeMap[n.name] = newNode;
            return newNode;
        });
        g.nodes = nodes;
        return g;
    }
    function sample(msg) {
        const g = toGraph(msg);
        g.sample(msg.samples);
        const result = {};
        for (let i = 0; i < g.nodes.length; i++) {
            result[g.nodes[i].name] = g.nodes[i];
        }
        self.postMessage(result);
    }
    self.onmessage = function (e) {
        sample(e.data);
    };
}

//import workerCode from './worker_code.js';
// Remove the code lines declaring the wrapper function from the
// worker module source code
const workerCode = workerCodeWrapper.toString().trim().split('\n').slice(1, -1).join('\n');
console.log('worker code', workerCode);
const workerBlob = new Blob([workerCode], { type: 'text/javascript' });
const workerURL = URL.createObjectURL(workerBlob);
//const workerDivId = '__jsbayes_web_worker__';
/** @public */
class JGraph {
    nodes = [];
    saveSamples = false;
    samples = [];
    nodeMap = {};
    /*constructor() {
      if (!document.getElementById(workerDivId)) {
        const div = document.createElement('div');
        div.id = workerDivId;
        div.style.display = 'none';
        div.textContent = workerCode;
        document.body.append(div);
      }
    }*/
    reinit() {
        this.nodes.forEach(n => {
            if (n.dirty === undefined || n.dirty) {
                const parentNodes = n.parents.map(pName => this.nodeMap[pName]);
                n.cpt = initCptWithParents(n.values, parentNodes, 0);
                n.dirty = false;
            }
        });
    }
    sample(samples) {
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
                const sample = {};
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
    node(name) {
        //if (!this.nodeMap) {
        //  this.createNodeMap();
        //}
        return this.nodeMap[name];
    }
    observe(name, value) {
        const node = this.node(name);
        if (node) {
            node.observe(value);
        }
        else {
            console.error('could not find node with name ' + name);
        }
    }
    unobserve(name) {
        const node = this.node(name);
        if (node) {
            node.unobserve();
        }
    }
    newNode(name, values) {
        const node = new JNode(name, values);
        this.addNodes(node);
        return node;
    }
    addNodes(...nodes) {
        nodes.forEach(n => {
            n.g = this;
            this.nodeMap[n.name] = n;
        });
        this.nodes.push(...nodes);
    }
    samplesAsCsv(options) {
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
    toWorkerMessage(samples) {
        const msg = {
            samples,
            graph: this
        };
        return msg;
    }
    async sampleWithWorker(samples) {
        return new Promise(res => {
            //const blob = new Blob([document.getElementById(workerDivId)!.textContent!],
            //const blob = new Blob([workerCode],
            //  { type: 'text/javascript' }
            //);
            const worker = new Worker(workerURL, { type: 'module' });
            worker.onerror = e => {
                console.error(e);
            };
            worker.onmessage = e => {
                const nodeMap = e.data;
                this.updateFromWorker(nodeMap);
                res();
            };
            worker.postMessage(this.toWorkerMessage(samples));
        });
    }
    updateFromWorker(nodeMap) {
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

window.addEventListener('load', () => new IntegrationTest());

class IntegrationTest {

  constructor() {
    this._init();
  }

  /**
   * Initializes the integration test.
   */
  async _init() {
    const g = new JGraph();
    const nodeNames = [
      'storm', 'lightning', 'thunder', 'campfire',
      'forest-fire', 'bus-tour-group'];
    for (const name of nodeNames) {
      g.newNode(name, ['true', 'false']);
      const obs = document.getElementById(`${name}-obs-cbox`);
      const val = document.getElementById(`${name}-val-cbox`);
      val.disabled = true;
      obs.addEventListener('change', async () => {
        if (obs.checked) {
          g.observe(name, val.checked ? 'true' : 'false');
          val.disabled = false;
        } else {
          g.unobserve(name);
          val.disabled = true;
        }
        await g.sampleWithWorker(10000);
        this.updateProbs(g);
      });
      val.addEventListener('change', async () => {
        g.observe(name, val.checked ? 'true' : 'false');
        //await g.sample(10000);
        await g.sampleWithWorker(10000);
        this.updateProbs(g);
      });
    }

    g.node('lightning').addParent('storm');
    g.node('forest-fire').addParent('storm');
    g.node('campfire').addParent('storm');
    g.node('campfire').addParent('bus-tour-group');
    g.node('thunder').addParent('lightning');
    g.node('forest-fire').addParent('lightning');
    g.node('forest-fire').addParent('campfire');

    g.node('storm').cpt = [0.2, 0.8];
    g.node('bus-tour-group').cpt = [0.5, 0.5];
    g.node('lightning').cpt = [
      [0.9, 0.1],      // p(l=1|s=1), p(l=0|s=1)
      [0.01, 0.99]     // p(l=1|s=0), p(l=0|s=0)
    ];
    g.node('thunder').cpt = [
      [0.95, 0.05],    // p(t=1|l=1), p(t=0|l=1)
      [0.1, 0.9]       // p(t=1|l=0), p(t=0|l=0)
    ];
    g.node('campfire').setCpt([   
      // storm=1
      //   busTourGroup=1
      [0.01, 0.99],  // p(c=1|s=1,b=1), p(c=0|s=1,b=1)
      //   busTourGroup=0
      [0, 1],         // p(c=1|s=1,b=0), p(c=0|s=1,b=0)
      // storm = 0
      //   busTourGroup=1
      [0.99, 0.01],  // p(c=1|s=0,b=1), p(c=0|s=0,b=1)
      //   busTourGroup=0
      [0, 1]         // p(c=1|s=0,b=0), p(c=0|s=0,b=0)
    ]);
    g.node('forest-fire').setCpt([ 
      // storm=1
      //   lightning=1
      //     campfire=1
      [0.75, 0.25],// p(f=1|s=1,l=1,c=1), p(f=0|s=1,l=1,c=1)
      //     campfire=0
      [0.5, 0.5],   // p(f=1|s=1,l=1,c=0), p(f=0|s=1,l=1,c=0)
      //   lightning=0
      //     campfire=1
      [0.6, 0.4],  // p(f=1|s=1,l=0,c=1), p(f=0|s=1,l=0,c=1)
      //     campfire=0
      [0.2, 0.8],   // p(f=1|s=1,l=0,c=0), p(f=0|s=1,l=0,c=0)
      // storm=0
      //   lightning=1
      //     campfire=1
      [0.7, 0.3],  // p(f=1|s=0,l=1,c=1), p(f=0|s=0,l=1,c=1)
      [0.4, 0.6],   // p(f=1|s=0,l=1,c=0), p(f=0|s=0,l=1,c=0)
      //   lightning=0
      //     campfire=0
      [0.3, 0.7],  // p(f=1|s=0,l=0,c=1), p(f=0|s=0,l=0,c=1)
      [0.01, 0.99] // p(f=1|s=0,l=0,c=0), p(f=0|s=0,l=0,c=0)
    ]);

    this._format = new Intl.NumberFormat('en-US', {maximumFractionDigits: 2});
    await g.sampleWithWorker(10000); //likelihood weight sampling aka the inference
    this.updateProbs(g);
  }

  updateProbs(g) {
    for (const node of g.nodes) {
      const spans = [
        document.getElementById(`${node.name}-t`),
        document.getElementById(`${node.name}-f`)];
      node.probs().map((p, i) => {
        spans[i].textContent = this._format.format(p);
      });
    }
  }

}

export { IntegrationTest };
