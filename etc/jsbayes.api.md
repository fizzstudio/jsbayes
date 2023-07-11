## API Report File for "@fizz/jsbayes"

> Do not edit this file. It is a report generated by [API Extractor](https://api-extractor.com/).

```ts

// @public (undocumented)
export class JGraph {
    // (undocumented)
    addNodes(...nodes: JNode[]): void;
    // (undocumented)
    newNode(name: string, values: any[]): JNode;
    // (undocumented)
    node(name: string): JNode;
    // (undocumented)
    nodeMap: {
        [nodeName: string]: JNode;
    };
    // (undocumented)
    nodes: JNode[];
    // (undocumented)
    observe(name: string, value: any): void;
    // (undocumented)
    reinit(): void;
    // (undocumented)
    sample(samples: number): number;
    // (undocumented)
    samples: {
        [nodeName: string]: any;
    }[];
    // (undocumented)
    samplesAsCsv(options: any): string;
    // (undocumented)
    sampleWithWorker(samples: number): Promise<void>;
    // (undocumented)
    saveSamples: boolean;
    // (undocumented)
    unobserve(name: string): void;
}

// @public (undocumented)
export class JNode {
    constructor(name: string, values: any[]);
    // (undocumented)
    addParent(parent: string): JNode;
    // (undocumented)
    cpt: any[];
    // (undocumented)
    dirty: boolean;
    // (undocumented)
    g?: JGraph;
    // (undocumented)
    initSampleLw(): void;
    // (undocumented)
    isObserved: boolean;
    // (undocumented)
    name: string;
    // (undocumented)
    observe(value: any): void;
    // (undocumented)
    parents: string[];
    // (undocumented)
    probs(): number[];
    // (undocumented)
    _sampledLw?: number[];
    // (undocumented)
    sampleLw(): number;
    // (undocumented)
    saveSampleLw(f: number): void;
    // (undocumented)
    setCpt(probs: number[] | number[][]): void;
    // (undocumented)
    unobserve(): void;
    // (undocumented)
    value: number;
    // (undocumented)
    valueIndex(v: any): number;
    // (undocumented)
    valueIndexMap?: {
        [value: string]: number;
    };
    // (undocumented)
    values: any[];
    // (undocumented)
    wasSampled: boolean;
}

// (No @packageDocumentation comment for this package)

```