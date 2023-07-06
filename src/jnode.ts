
import { type JGraph } from "./jgraph.js";

class NodeError extends Error {}

/**
 * Initializes a conditional probability table.
 * @param numValues - Number of values.
 * @returns Array of doubles that sum to 1.0.
 */
function initCpt(numValues: number): number[] {
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
export function initCptWithParents(values: any[], parents: JNode[], paIndex: number): any[] {
  if (parents && parents.length > 0) {
    const cpts = [];
    if (parents.length === 1 || paIndex === parents.length - 1) {
      const idx = parents.length === 1 ? 0 : paIndex;
      const numPaVals = parents[idx].values.length;
      for (let i = 0; i < numPaVals; i++) {
        const cpt = initCpt(values.length);
        cpts.push(cpt);
      }
    } else {
      const numPaVals = parents[paIndex].values.length;
      for (let i = 0; i < numPaVals; i++) {
        const cpt = initCptWithParents(values, parents, paIndex+1);
        cpts.push(cpt);
      }
    }
    return cpts;
  } else {
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
function initNodeCpt(values: any[], parents: JNode[], probs: number[][]): any[] {
  const cpt = initCptWithParents(values, parents, 0);
  setNodeCptProbs(cpt, probs, 0);
  return cpt;
}

/**
 * Checks if an object is an array.
 * @param o  - Object.
 * @returns A boolean to indicate if the object is an array object.
 */
function isArray(o: any): boolean {
  return (o.constructor === Array);
}

/**
 * Checks if an object is an array of arrays.
 * @param o - Object.
 * @returns A boolean to indicate if the object is array of arrays.
 */
function isArrayOfArray(o: any): boolean {
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
function setNodeCptProbs(cpt: any[], probs: number[][], index: number): number {
  if (!isArrayOfArray(cpt)) {
    for (let i = 0; i < cpt.length; i++) {
      cpt[i] = probs[index][i];
    }
    const nextIndex = index + 1;
    return nextIndex;
  } else {
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
function normalizeCpts(cpts: number[][]): number[][] {
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
function normalizeProbs(arr: number[]): number[] {
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
export class JNode {

  public _sampledLw?: number[];
  public wasSampled = false;
  // keeping parent names here rather than references works better
  // for using worker threads
  public parents: string[] = [];
  public cpt: any[] = [];
  public value = -1;
  public dirty = false;
  public isObserved = false;
  // XXX better to use Map
  public valueIndexMap?: {[value: string]: number};
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

  addParent(parent: string): JNode {
    this.parents.push(parent);
    this.dirty = true;
    return this;
  }
  
  valueIndex(v: any): number {
    if (!this.valueIndexMap) {
      this.valueIndexMap = {};
      for (let i = 0; i < this.values.length; i++) {
        const value = this.values[i];
        this.valueIndexMap[value] = i;
      }
    }
    return this.valueIndexMap[v];
  }

  observe(value: any) {
    const index = this.valueIndex(value);
    if (index >= 0) {
      this.isObserved = true;
      this.value = index;
    } else {
      console.error('could not find value ' + value + ' for node ' + this.name);
    }
  }

  unobserve() {
    this.isObserved = false;
    this.value = -1;
  }
  
  setCpt(probs: number[] | number[][]) {
    if (this.parents.length === 0) {
      this.cpt = normalizeProbs(probs as number[]);
    } else {
      if (!this.g) {
        throw new NodeError('must add node to graph before calling setCpt()');
      }
      const parentNodes = this.parents.map(pName => this.g!.nodeMap[pName]);
      this.cpt = initNodeCpt(this.values, parentNodes, 
        normalizeCpts(probs as number[][]));
    }
  }

  probs(): number[] {
    if (!this._sampledLw) {
      return [];
    }
    const sum = this._sampledLw.reduce((acc, s) => acc + s, 0);
    return this._sampledLw.map(s => s/sum);
  }  
}
  