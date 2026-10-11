'use strict';
const assert = require('node:assert/strict');
const Z = require('../zasteny-core.js');

assert.deepEqual(Z.normalize({}), { width: 800, height: 2000, finish: 'black', qty: 1 });
assert.deepEqual(Z.normalize({ finish: 'purple', qty: 0 }), { width: 800, height: 2000, finish: 'black', qty: 1 });
assert.equal(Z.validate({ width: 900, height: 2100, finish: 'white', qty: 2 }).ok, true);
assert.equal(Z.validate({ width: 800, height: 2000, finish: 'black', qty: 0 }).ok, false);
for (const width of [0, -1, 900.5, NaN, Infinity]) {
  assert.equal(Z.validate({ width, height: 2000, finish: 'black', qty: 1 }).ok, false, `reject width ${width}`);
}
for (const height of [0, -1, 2000.5, NaN, Infinity]) {
  assert.equal(Z.validate({ width: 800, height, finish: 'black', qty: 1 }).ok, false, `reject height ${height}`);
}
const L = Z.layout({ width: 900, height: 2100, finish: 'black', qty: 1 });
assert.equal(L.outer.width, 900);
assert.equal(L.outer.height, 2100);
assert.ok(L.motif.width <= L.panel.width && L.motif.height <= L.panel.height);
assert.ok(L.panel.x >= 0 && L.panel.x + L.panel.width <= L.outer.width);
assert.match(Z.describe({ width: 800, height: 2000, finish: 'black', qty: 1 }), /800.*2000/);
console.log('kontrola-zasteny: core OK');
