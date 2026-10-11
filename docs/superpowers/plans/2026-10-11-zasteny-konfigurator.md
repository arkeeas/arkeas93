# Zástěny Configurator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a custom-size butterfly screen configurator that sends quote requests to the existing workshop flow and exposes the supplied 800 × 2000 mm CAD package as a reference.

**Architecture:** Follow the existing static HTML, vanilla JavaScript, Three.js and `poptavky/{uid}` patterns. Keep screen configuration and preview logic in product-specific modules, add request handling to the existing workshop page, and store the delivered CAD reference under `assets/zasteny/`.

**Tech Stack:** HTML, CSS, vanilla JavaScript, Three.js r147, existing `lokal.js` database adapter, existing product pages and workshop UI.

**Spec:** `docs/superpowers/specs/2026-10-11-zasteny-design.md`

## Global Constraints

- The first product is the butterfly screen from the supplied CAD materials.
- Customers enter width and height, select a finish and quantity, and can submit their contact details and a note.
- The 3D preview adapts to the requested dimensions.
- The page displays no price and does not claim that custom dimensions are production-approved; the workshop confirms feasibility and price.
- Requests use the existing database abstraction and appear in the workshop.
- The workshop displays the request and links the supplied production materials as a reference **only for 800 × 2000 mm**.
- Custom dimensions do not receive automatically generated price, STEP or cutting DXF files.

## Review Focus

- Width or height is empty, zero, negative, non-numeric, non-finite, or not a whole number: invalid values must not enter the preview or quote payload.
- Quantity is missing or less than one: the normalized configuration and request summary must use a valid quantity.
- Customer text contains HTML: the workshop list and detail must escape it before rendering.
- A screen request is opened from the shared inquiry list: it must route to screen details instead of the default table-leg formatter.
- A custom size is submitted: the quote summary and workshop detail must show the manual review warning and identify all downloadable CAD as the 800 × 2000 mm reference.

---

### Task 1: Package the supplied CAD reference

**Files:**
- Create: `assets/zasteny/motyli_800x2000/README.md`
- Create: `assets/zasteny/motyli_800x2000/nahled.png`
- Create: `assets/zasteny/motyli_800x2000/zastena_motyli_800x2000.FCStd`
- Create: `assets/zasteny/motyli_800x2000/zastena_motyli_800x2000.step`
- Create: `assets/zasteny/motyli_800x2000/vypln_720x1770_t2_C2.dxf`
- Create: `assets/zasteny/motyli_800x2000/patka_40x100_t6_2xD14.dxf`
- Create: `assets/zasteny/motyli_800x2000/kusovnik.csv`
- Create: `assets/zasteny/motyli_800x2000/kontrola.json`
- Create: `assets/zasteny/motyli_800x2000/kontrola_step.json`
- Create: `assets/zasteny/motyli_800x2000/motiv_vyrez.png`
- Create: `assets/zasteny/motyli_800x2000/artwork.json`
- Create: `assets/zasteny/motyli_800x2000/artwork.js`
- Create: `assets/zasteny/motyli_800x2000/build_panel.py`
- Create: `assets/zasteny/motyli_800x2000/trace_reference.py`
- Create: `assets/zasteny/motyli_800x2000/verify_step.py`
- Create: `assets/zasteny/motyli_800x2000/reference.png`

**Interfaces:**
- Consumes: user-supplied source folder `/home/arkeas/Desktop/cad_worker/dobre/zastena_motyli_800x2000/`.
- Produces: a public, versioned product reference directory; `artwork.js` exposes `window.ZastenyArtwork` for the page to work when opened from a local file.

- [ ] Copy the named source files, omitting `.FCBak` and `__pycache__`.
- [ ] Wrap `artwork.json` in a script assignment for `artwork.js`, preserving the contour data exactly.
- [ ] Review the directory listing and file sizes against the supplied files.

### Task 2: Add screen configuration and 3D preview modules

**Files:**
- Create: `zasteny-core.js`
- Create: `zasteny-viewer.js`
- Create: `tests/kontrola-zasteny.js`
- Consume: `assets/zasteny/motyli_800x2000/artwork.js`

**Interfaces:**
- `Zasteny.normalize(config) -> { width, height, finish, qty }`
- `Zasteny.validate(config) -> { ok: boolean, errors: string[] }`
- `Zasteny.layout(config) -> { outer: { width, height, depth }, panel: { x, z, width, height }, frame: [{ x, z, width, height }], motif: { scale, x, z, width, height } }`, with all dimensions in millimetres
- `Zasteny.describe(config) -> string`
- `ZastenyViewer.create(host) -> { update(config), view(name) }`
- `ZastenyViewer.update` uses the supplied contours for the fixed motif and scales the motif uniformly to fit the preview's panel.

- [ ] Write `tests/kontrola-zasteny.js` checks for the 800 × 2000 defaults, valid custom dimensions, rejected zero/negative/decimal/non-finite dimensions, finish fallback, quantity fallback, layout bounds and description values.

```js
assert.deepEqual(Z.normalize({}), { width: 800, height: 2000, finish: 'black', qty: 1 });
assert.deepEqual(Z.normalize({ finish: 'purple', qty: 0 }), { width: 800, height: 2000, finish: 'black', qty: 1 });
assert.equal(Z.validate({ width: 900, height: 2100, finish: 'white', qty: 2 }).ok, true);
assert.equal(Z.validate({ width: 800, height: 2000, finish: 'black', qty: 0 }).ok, false);
for (const width of [0, -1, 900.5, NaN, Infinity]) {
  assert.equal(Z.validate({ width, height: 2000, finish: 'black', qty: 1 }).ok, false);
}
const L = Z.layout({ width: 900, height: 2100, finish: 'black', qty: 1 });
assert.equal(L.outer.width, 900);
assert.equal(L.outer.height, 2100);
assert.ok(L.motif.width <= L.panel.width && L.motif.height <= L.panel.height);
assert.match(Z.describe({ width: 800, height: 2000, finish: 'black', qty: 1 }), /800.*2000/);
```

- [ ] Run `node tests/kontrola-zasteny.js` and confirm it fails because the `Zasteny` API is not implemented.
- [ ] Implement `normalize`, `validate`, `layout` and `describe` in `zasteny-core.js` without price calculations or production-file generation.
- [ ] Run `node tests/kontrola-zasteny.js` and confirm the core configuration checks pass.
- [ ] Implement `ZastenyViewer.create(host)` using the frame, panel, bases and supplied cutout contours; resize the camera and geometry when the configuration changes.
- [ ] Keep 800 × 2000 mm as the default and label the viewer as illustrative for custom dimensions.
- [ ] Review contour loading, the motif fit within the panel and camera framing in the viewer code.

### Task 3: Create the customer page and inquiry submission

**Files:**
- Create: `zasteny.html`
- Modify: `index.html` — product menu at line 134
- Modify: `vyvoj.html` — product menu at line 140
- Modify: `zabradli.html` — product menu at line 200
- Modify: `stolecky.html` — product menu at line 164

**Interfaces:**
- Consumes: `Zasteny.normalize`, `Zasteny.describe`, `ZastenyViewer.create`, and the same `window.claude.use('db')` / `use('user')` adapter pattern as existing product forms.
- Produces: new product page `zasteny.html`; submitted item format `{ id, product: 'zastena', created, status: 'nova', customer, note, config }`, appended to the existing `poptavky/{uid}.items` array.

- [ ] Add page structure, responsive controls, rotatable viewer, manual-review notice and no-price quote action to `zasteny.html`.
- [ ] Add the **Zástěny** link to all customer product menus and mark it current on the new page.
- [ ] Add the quote modal and reject invalid dimensions, quantity, missing name and invalid e-mail before submission.
- [ ] Save `{ id, product, created, status, customer, note, config }` through the existing adapter and show an encoded fallback request code when the adapter is unavailable.
- [ ] Review that the quote summary includes configuration and manual-review notice, and never implies an automatic price or production output.

### Task 4: Show screen requests and reference files in the workshop

**Files:**
- Create: `zasteny-dilna.js`
- Modify: `interni.html` — add workshop tab/panel, script, request summary routing and `openPop` dispatch near lines 90–95, 229, 340–344, 455–466, and 320–327.

**Interfaces:**
- `ZasDilna.init(options) -> void`
- `ZasDilna.open(item) -> void`
- `ZasDilna.render() -> void`
- `ZasDilna.describe(config) -> string`
- `ZasDilna.accepts(item) -> boolean`
- `ZasDilna.escape(text) -> safe HTML string`
- `ZasDilna.manualReviewNotice(config) -> string`
- `ZasDilna.referenceFiles() -> [{ label, path }]`
- Request input matches the `product: 'zastena'` item created in Task 3; the view links the fixed-size STEP, DXF, FreeCAD and BOM references from Task 1.

- [ ] Add a workshop tab and panel for screen inquiries.
- [ ] Add screen-specific text to the shared inquiry summary and route its open action to `ZasDilna`.
- [ ] Implement `ZasDilna.open` and `render` to show configuration and contact data safely, preserve the shared status update behavior, and label custom sizes as requiring manual review.
- [ ] Implement `referenceFiles()` with links to supplied files labeled as references for 800 × 2000 mm only.
- [ ] Extend `tests/kontrola-zasteny.js` to check screen request acceptance/routing, request description, HTML escaping, manual-review text and reference-file links.

```js
assert.equal(D.accepts({ product: 'zastena' }), true);
assert.equal(D.accepts({ product: 'stolecek' }), false);
assert.match(D.describe({ width: 900, height: 2100, finish: 'black', qty: 1 }), /900.*2100/);
assert.match(D.escape('<script>'), /&lt;script&gt;/);
assert.match(D.manualReviewNotice({ width: 900, height: 2100 }), /800 × 2000/);
assert.ok(D.referenceFiles().every((file) => file.label.includes('800 × 2000')));
```

- [ ] Run `node tests/kontrola-zasteny.js` and confirm both the core and workshop checks pass.
- [ ] Review every request branch in the shared list/open flow so existing product handlers remain the fallback only for their own products.

### Task 5: Update project documentation and review the change

**Files:**
- Modify: `README.md`
- Review: all files from Tasks 1–4

- [ ] Document the customer page, workshop view, local storage behavior, and the fixed-size limits of the supplied CAD reference.
- [ ] Run `git diff --check` and inspect the complete diff for unsafe rendering, incorrect navigation, misleading price/manufacturing claims, or missing source files.
- [ ] Prepare the feature branch for a non-draft pull request to `main`, then follow the repository's configured squash-merge workflow after the pull request is reviewable.
