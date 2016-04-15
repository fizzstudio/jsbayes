(function(window) {
  'use strict';

  function initCpt(numValues) {
    var cpt = [];
    var sum = 0;
    for(var i=0; i < numValues; i++) {
      cpt[i] = Math.random();
      sum += cpt[i];
    }
    for(var i=0; i < numValues; i++) {
      cpt[i] = cpt[i] / sum;
    }
    return cpt;
  }

  function initCptWithParents(values, parents, paIndex) {
    if(parents && parents.length > 0) {
      if(parents.length === 1 || paIndex === parents.length -1) {
        var cpts = [];
        for(var i=0; i < parents[0].values.length; i++) {
          var cpt = initCpt(values.length);
          cpts.push(cpt);
        }
        return cpts;
      } else {
        var cpts = [];
        for(var i=0; i < parents[paIndex].values.length; i++) {
          var cpt = initCptWithParents(values, parents, paIndex+1);
          cpts.push(cpt);
        }
        return cpts;
      }
    } else {
      return initCpt(values.length);
    }
  }

  function async(f, args) {
    return new Promise(
      function(resolve, reject) {
        try {
          var r = f.apply(undefined, args);
          resolve(r);
        } catch(e) {
          reject(e);
        }
      }
    );
  }

  function isArray(o) {
    return (o.constructor === Array);
  }

  function isArrayOfArray(o) {
    if(isArray(o)) {
      if(o.length > 0) {
        if(isArray(o[0])) {
          return true;
        }
      }
    }
    return false;
  }

  function setNodeCptProbs(cpt, probs, index) {
    if(!isArrayOfArray(cpt)) {
      for(var i=0; i < cpt.length; i++) {
        cpt[i] = probs[index][i];
      }
      var nextIndex = index + 1;
      return nextIndex;
    } else {
      var next = index;
      for(var i=0; i < cpt.length; i++) {
        next = setNodeCptProbs(cpt[i], probs, next);
      }
      return next;
    }
  }

  function initNodeCpt(values, parents, probs) {
    var cpt = initCptWithParents(values, parents, 0);
    setNodeCptProbs(cpt, probs, 0);
    return cpt;
  }

  function defineLib() {
    var jsbayes = {};
    jsbayes.newGraph = function() {
      return {
        nodes: [],
        reinit: function() {
          var f = function(g) {
            for(var i=0; i < g.nodes.length; i++) {
              var node = g.nodes[i];
              if(node.dirty === undefined || node.dirty) {
                node.cpt = initCptWithParents(node.values, node.parents, 0);
                node.dirty = false;
              }
            }
          };
          return async(f, [this]);
        },
        sample: function(samples) {
          var f = function(g, samples) {
            for(var h=g.nodes.length-1; h >= 0; h--) {
              g.nodes[h].initSampleLw();
            }

            var lwSum = 0;
            for(var count=0; count < samples; count++) {
              for(var h=g.nodes.length-1; h >= 0; h--) {
                var n = g.nodes[h];
                if(!n.isObserved) {
                  n.value = -1;
                }
                n.wasSampled = false;
              }

              var fa = 1;
              for(var h=g.nodes.length-1; h >= 0; h--) {
                var n = g.nodes[h];
                fa *= n.sampleLw();
              }
              lwSum += fa;
              for(var h=g.nodes.length-1; h >= 0; h--) {
                var n = g.nodes[h];
                n.saveSampleLw(fa);
              }
            }

            return lwSum;
          };
          return async(f, [this, samples]);
        },
        update: function(m) {
          for(var i=0; i < this.nodes.length; i++) {
            var tnode = this.nodes[i]; //'this' node
            var unode = m[tnode.name]; //update node

            if(!unode) {
              continue;
            }

            tnode.value = unode.value;
            tnode.wasSampled = unode.wasSampled;
            tnode.sampledLw = unode.sampledLw;
          }
        },
        addNode: function(name, values) {
          var node = {
            name: name,
            values: values,
            value: -1,
            parents: [],
            wasSampled: false,
            sampledLw: undefined,
            addParent: function(parent) {
              this.parents.push(parent);
              this.dirty = true;
              return this;
            },
            initSampleLw: function() {
              this.sampledLw = undefined;
            },
            sampleLw: function() {
              if(this.wasSampled) {
                return 1;
              }

              var fa = 1;
              for(var h=0; h < this.parents.length; h++) {
                var pa = this.parents[h];
                var pSampleLw = pa.sampleLw();
                fa *= pSampleLw;
              }

              this.wasSampled = true;

              var dh = this.cpt;
              for(var h=0; h < this.parents.length; h++) {
                var p = this.parents[h];
                var v = p.value;
                dh = dh[v];
              }

              if(this.value != -1) {
                var v = dh[this.value];
                fa *= v;
              } else {
                var fv = Math.random();
                for(var h=0; h < dh.length; h++) {
                  var v = dh[h];
                  fv -= v;
                  if(fv < 0) {
                    this.value = h;
                    break;
                  }
                }
              }

              return fa;
            },
            saveSampleLw: function(f) {
              if(!this.sampledLw) {
                this.sampledLw = new Array(this.values.length);
                for(var h=this.values.length-1; h >= 0; h--) {
                  this.sampledLw[h] = 0;
                }
              }
              this.sampledLw[this.value] += f;
            },
            setCpt: function(probs) {
              if(this.parents.length === 0) {
                this.cpt = probs;
              } else {
                this.cpt = initNodeCpt(this.values, this.parents, probs);
              }
            }
          }
          this.nodes.push(node);
          return node;
        }
      };
    }

    jsbayes.toMessage = function(g) {
      var nodes = {};
      var parents = {};

      for(var i=0; i < g.nodes.length; i++) {
        var n = g.nodes[i];
        var node = {
          name: n.name,
          values: n.values,
          value: n.value,
          parents: [],
          wasSampled: n.wasSampled,
          sampledLw: n.sampledLw,
          cpt: n.cpt
        };
        nodes[n.name] = node;

        var pas = [];
        for(var j=0; j < n.parents.length; j++) {
          var pa = n.parents[j];
          pas.push(pa.name);
        }
        parents[n.name] = pas;
      }

      var msg = {
        samples: 10000,
        nodes: nodes,
        parents: parents
      };

      return JSON.stringify(msg);
    }

    return jsbayes;
  }

  if(typeof module === 'object' && module && typeof module.exports === 'object') {
    module.exports = defineLib();
  } else {
    if(typeof(jsbayes) === 'undefined') {
      window.jsbayes = defineLib();
    }

    if(typeof define === 'function' && define.amd) {
      define('jsbayes', [], defineLib());
    }
  }
}
)(this);