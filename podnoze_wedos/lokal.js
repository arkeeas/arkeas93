/*
 * lokal.js – umožní spustit konfigurátor mimo Claude (GitHub Pages, lokálně z disku).
 *
 * Stránky byly napsané pro artefakt v Claude a volají window.claude.use('db' | 'user' | 'downloads').
 * Pokud stránka běží v Claude, nic se nemění. Jinak tento soubor dodá náhradu:
 *   - db:        poptávky na produkčních doménách ukládá na server Dílna; ostatní data zůstávají lokálně.
 *   - user:      každý je „editor“ (vidí dílnu, může ukládat ceník).
 *   - downloads: normální stažení souboru.
 * Až bude skutečný server, nahradí se jen tento soubor.
 */
(function () {
  'use strict';
  if (window.claude && window.claude.use) return;

  const PFX = 'konfigurator:';
  const mem = {};
  const store = {
    get(k) { try { const s = localStorage.getItem(PFX + k); return s == null ? undefined : JSON.parse(s); } catch (e) { return mem[k]; } },
    set(k, v) { const s = JSON.stringify(v); try { localStorage.setItem(PFX + k, s); } catch (e) { /* bez úložiště */ } mem[k] = JSON.parse(s); },
    keys(prefix) {
      const out = new Set(Object.keys(mem).filter((k) => k.startsWith(prefix)));
      try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(PFX + prefix)) out.add(k.slice(PFX.length)); } } catch (e) { /* bez úložiště */ }
      return [...out];
    }
  };

  const listeners = new Set();
  const notify = () => listeners.forEach((l) => { try { l(); } catch (e) { console.error(e); } });
  window.addEventListener('storage', (e) => { if (!e.key || e.key.startsWith(PFX)) notify(); });

  const docSnap = (path) => { const d = store.get(path); return { id: path.split('/').pop(), exists: d !== undefined, data: () => (d === undefined ? undefined : JSON.parse(JSON.stringify(d))) }; };
  const collSnap = (path) => {
    const pre = path.replace(/\/$/, '') + '/';
    const ids = store.keys(pre).filter((k) => k.slice(pre.length).indexOf('/') < 0);
    return { docs: ids.sort().map(docSnap), size: ids.length, empty: !ids.length };
  };

  const API = 'https://dilna.skovem.cz/poptavky.php';
  const host = location.hostname.toLowerCase();
  const isWorkshop = host === 'dilna.skovem.cz';
  const isPublicForm = host === 'b2b.skovem.cz' || host === 'arkeeas.github.io';
  if (isWorkshop) document.documentElement.classList.add('dilna-live');
  const inquiryPath = (path) => /^poptavky\/[A-Za-z0-9_-]{1,64}$/.test(path);
  async function api(url, options) {
    const response = await fetch(url, Object.assign({ credentials: 'same-origin', cache: 'no-store' }, options || {}));
    if (!response.ok) { const error = new Error('api-' + response.status); error.code = 'api-' + response.status; throw error; }
    return response.status === 204 ? null : response.json();
  }
  function remoteDoc(path, payload) {
    return { id: path.split('/').pop(), exists: !!(payload && payload.exists), data: () => payload && payload.data ? JSON.parse(JSON.stringify(payload.data)) : undefined };
  }
  async function readRemoteDoc(path) {
    const uid = encodeURIComponent(path.split('/').pop());
    return remoteDoc(path, await api(API + '?op=doc&uid=' + uid));
  }
  async function readRemoteCollection() {
    const payload = await api(API);
    const docs = (payload.docs || []).map((entry) => ({ id: entry.id, exists: true, data: () => JSON.parse(JSON.stringify(entry.data)) }));
    return { docs, size: docs.length, empty: docs.length === 0 };
  }

  const db = {
    doc(path) {
      return {
        id: path.split('/').pop(),
        async get() { return (isWorkshop && inquiryPath(path)) ? readRemoteDoc(path) : ((isPublicForm && inquiryPath(path)) ? { id: path.split('/').pop(), exists: false, data: () => undefined } : docSnap(path)); },
        async set(v) {
          if (isPublicForm && inquiryPath(path)) {
            const items = v && Array.isArray(v.items) ? v.items : [];
            if (!items.length) throw Object.assign(new Error('empty-inquiry'), { code: 'empty-inquiry' });
            return api(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uid: path.split('/').pop(), item: items[items.length - 1] }) });
          }
          store.set(path, v); notify();
        },
        async update(v) {
          if (isWorkshop && inquiryPath(path)) {
            await api(API, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uid: path.split('/').pop(), items: v.items }) });
            notify(); return;
          }
          const cur = store.get(path); if (cur === undefined) { const e = new Error('not-found'); e.code = 'not-found'; throw e; } store.set(path, Object.assign({}, cur, v)); notify();
        },
        async delete() { try { localStorage.removeItem(PFX + path); } catch (e) { /* */ } delete mem[path]; notify(); },
        onSnapshot(cb) {
          if (isWorkshop && inquiryPath(path)) {
            let active = true;
            const load = () => readRemoteDoc(path).then((snap) => { if (active) cb(snap); }).catch((e) => console.error('Dílna API:', e));
            load(); const timer = setInterval(load, 5000); return () => { active = false; clearInterval(timer); };
          }
          const l = () => cb(docSnap(path)); listeners.add(l); setTimeout(l, 0); return () => listeners.delete(l);
        }
      };
    },
    collection(path) {
      return {
        async get() { return (isWorkshop && path.replace(/\/$/, '') === 'poptavky') ? readRemoteCollection() : collSnap(path); },
        onSnapshot(cb) {
          if (isWorkshop && path.replace(/\/$/, '') === 'poptavky') {
            let active = true;
            const load = () => readRemoteCollection().then((snap) => { if (active) cb(snap); }).catch((e) => console.error('Dílna API:', e));
            load(); const timer = setInterval(load, 5000); return () => { active = false; clearInterval(timer); };
          }
          const l = () => cb(collSnap(path)); listeners.add(l); setTimeout(l, 0); return () => listeners.delete(l);
        }
      };
    }
  };

  let uid = store.get('_uid');
  if (!uid) { uid = 'test-' + Math.random().toString(36).slice(2, 10); store.set('_uid', uid); }
  const user = { async id() { return uid; }, canEdit() { return isWorkshop || !isPublicForm; }, name: 'Tester' };

  const downloads = {
    async save(o) {
      const blob = o.data instanceof Blob ? o.data : new Blob([o.data]);
      const url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = o.filename || 'soubor'; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      return { ok: true };
    }
  };

  window.claude = { lokalni: !isWorkshop && !isPublicForm, async use(name) { return { db, user, downloads }[name] || null; } };
})();
