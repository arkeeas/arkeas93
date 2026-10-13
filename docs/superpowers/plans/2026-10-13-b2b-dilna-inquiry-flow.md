# B2B to Dílna Inquiry Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make customer inquiries from B2B appear in the protected Dílna list, email ordinary inquiries to `info@skovem.cz`, and store inquiries named `test` without emailing.

**Architecture:** Add a same-origin-to-Dílna PHP API that accepts only public inquiry creation and CORS preflight from the exact B2B origin; reads and status changes remain behind Basic Authentication. Store inquiries centrally in protected JSON files, send mail server-side, and adapt the customer page and workshop page while preserving local preview behavior.

**Tech Stack:** PHP, Apache `.htaccess`, JavaScript, JSON files, WEDOS `mail()`.

**Spec:** `docs/superpowers/specs/2026-10-13-dilna-poptavky-email-design.md`

## Global Constraints

- Fixed recipient: `info@skovem.cz`.
- A trimmed customer name equal to `test` case-insensitively is stored but never emailed.
- The central server inquiry list starts empty; do not copy old localStorage test data into it.
- Preserve existing inquiry fields and status values.
- The public API may create inquiries only; reading or changing stored data requires Dílna Basic Authentication.
- Only `https://b2b.skovem.cz` and `https://arkeeas.github.io` are allowed browser origins for public creation.
- Never expose the JSON data directory over HTTP or accept client-supplied filesystem paths.
- Keep local preview behavior working without the PHP endpoint.

## Review Focus

- Name ` test ` and case variants: save but skip mail.
- Invalid, missing, or oversized form data: reject without partial writes.
- Cross-origin preflight: only exact B2B origin and POST are allowed.
- Unsafe IDs or operation names: reject before filesystem access.
- Mail failure after persistence: retain the inquiry and report the mail warning separately.

---

### Task 1: Build the private PHP API

**Files:**
- Create: `dilna_api/poptavky.php`
- Create: `dilna_api/dilna-root.htaccess` (deployment copy to the Dílna document root)
- Create: `dilna_api/data/.htaccess`
- Create: `dilna_api/README.md`

**Interfaces:**
- Public `POST` accepts one inquiry JSON object and returns only `{stored, emailAccepted, emailSkipped, id}`.
- Public `OPTIONS` responds only to the exact B2B or GitHub Pages origin and allowed JSON POST preflight.
- Authenticated `GET` lists inquiries; authenticated `PATCH` updates one inquiry status.
- Stored inquiry keeps the existing fields used by `interni.html`.

- [x] Implement bounded input validation, safe IDs, per-IP rate limiting, and locked atomic JSON persistence.
- [x] Persist before mail; skip `mail()` for trimmed case-insensitive name `test`; otherwise email fixed recipient `info@skovem.cz` with a valid company sender/return-path and validated customer `Reply-To`.
- [x] Protect data files with an explicit deny rule and configure the Dílna `.htaccess` method exception so only creation/preflight are unauthenticated; list/status operations require Basic Authentication. Preserve the existing password file and HTTPS redirect.
- [x] Inspect the access rules without calling the production endpoint. PHP CLI is unavailable here, so `php -l` could not be run.

### Task 2: Wire customer submission from GitHub Pages and B2B

**Files:**
- Modify: `lokal.js`
- Modify: `podnoze_wedos/lokal.js`

**Interfaces:**
- Consumes: Task 1 public inquiry POST contract.
- Produces: Existing inquiry writes from GitHub Pages and B2B submit to `https://dilna.skovem.cz/poptavky.php`; local preview continues using its current local adapter.

- [x] Route existing customer inquiry writes through the shared adapter for the exact allowed production origins; keep the existing inquiry data shape and submit only after current validation passes.
- [x] Confirm success only after server storage; preserve the API's separate email acceptance/skipped result so mail failure is not misreported as storage failure.
- [x] Normalize `test` on the server; client-side behavior must not determine whether mail is sent.
- [x] Run JavaScript syntax checks without adding or running automated tests.

### Task 3: Wire the protected workshop list

**Files:**
- Modify: `interni.html`
- Modify: `lokal.js`
- Package: `/tmp/dilna-only-stage/index.html`, `interni.html`, and `lokal.js`

**Interfaces:**
- Consumes: Task 1 authenticated inquiry list/status API.
- Produces: The existing workshop table and status controls backed by server data; list is empty until a new inquiry arrives.

- [x] Adapt the existing database shim to read, poll, and update server inquiries on the deployed workshop domain while retaining localStorage fallback for previews.
- [x] Update the empty-state copy to describe the shared server list, not same-browser storage.
- [x] Ensure preexisting browser test rows are not imported into the new server list.
- [x] Run JavaScript syntax checks and inspect the generated package file set.

### Task 4: Integrate and deliver

**Files:**
- Review all files in Tasks 1–3.
- Push the source change as a pull request targeting `main`; attach and squash-merge under the repository delivery instructions.
- The merge updates GitHub Pages automatically; deploy the customer configurator package to B2B and the API/workshop package to Dílna using their scoped FTP paths, after confirming the active WEDOS certificate is served for the Dílna hostname.

- [ ] Inspect the final diff and confirm the API rejects non-B2B Origin, disallows unauthenticated reads/updates, and never emits mail for `test`.
- [ ] Run PHP and JavaScript syntax checks; do not treat these as proof of HTTPS or email delivery.
- [ ] WEDOS currently shows an active Let's Encrypt certificate including `dilna.skovem.cz`; confirm the hostname in the normal browser after upload. If validation still fails, stop before enabling the B2B submission and report the blocker.
- [ ] Verify the merged remote `main` head and report separately whether production upload and mail delivery could be confirmed.
