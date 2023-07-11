
import { JGraph } from '../dist/main.js';


window.addEventListener('load', () => new IntegrationTest());

export class IntegrationTest {

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
