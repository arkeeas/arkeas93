/*
 * lokal.js – umožní spustit konfigurátor mimo Claude (GitHub Pages, lokálně z disku).
 *
 * Stránky byly napsané pro artefakt v Claude a volají window.claude.use('db' | 'user' | 'downloads').
 * Pokud stránka běží v Claude, nic se nemění. Jinak tento soubor dodá náhradu:
 *   - db:        ukládá do localStorage prohlížeče (poptávky, ceník) – sdílí ji zákaznická stránka i dílna
 *                ve STEJNÉM prohlížeči. Jiný počítač má svoje vlastní data.
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

  const db = {
    doc(path) {
      return {
        id: path.split('/').pop(),
        async get() { return docSnap(path); },
        async set(v) { store.set(path, v); notify(); },
        async update(v) { const cur = store.get(path); if (cur === undefined) { const e = new Error('not-found'); e.code = 'not-found'; throw e; } store.set(path, Object.assign({}, cur, v)); notify(); },
        async delete() { try { localStorage.removeItem(PFX + path); } catch (e) { /* */ } delete mem[path]; notify(); },
        onSnapshot(cb) { const l = () => cb(docSnap(path)); listeners.add(l); setTimeout(l, 0); return () => listeners.delete(l); }
      };
    },
    collection(path) {
      return {
        async get() { return collSnap(path); },
        onSnapshot(cb) { const l = () => cb(collSnap(path)); listeners.add(l); setTimeout(l, 0); return () => listeners.delete(l); }
      };
    }
  };

  let uid = store.get('_uid');
  if (!uid) { uid = 'test-' + Math.random().toString(36).slice(2, 10); store.set('_uid', uid); }
  const user = { async id() { return uid; }, canEdit() { return true; }, name: 'Tester' };

  const downloads = {
    async save(o) {
      const blob = o.data instanceof Blob ? o.data : new Blob([o.data]);
      const url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = o.filename || 'soubor'; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      return { ok: true };
    }
  };

  window.claude = { lokalni: true, async use(name) { return { db, user, downloads }[name] || null; } };
})();
