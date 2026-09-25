// Reports wait here (IndexedDB, photos as Blobs) until the DHARA API accepts
// them, so nothing is lost when a driver has no signal or closes the page.
import { API_BASE } from './theme';

const DB_NAME = 'dhara-field';
const STORE = 'photoOutbox';
const SENT_KEY = 'dhara.photoReportsSent';

let dbPromise = null;
function db() {
  if (!('indexedDB' in window)) return Promise.reject(new Error('no IndexedDB'));
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'clientRef' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => { dbPromise = null; reject(req.error); };
    });
  }
  return dbPromise;
}

function tx(mode, fn) {
  return db().then(d => new Promise((resolve, reject) => {
    const t = d.transaction(STORE, mode);
    const result = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(result && 'result' in result ? result.result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

export const outbox = {
  add: report => tx('readwrite', s => s.put(report)),
  all: () => tx('readonly', s => s.getAll()).then(list => (list || []).sort((a, b) => a.createdAt.localeCompare(b.createdAt))),
  remove: ref => tx('readwrite', s => s.delete(ref)),
  update: (ref, patch) => db().then(d => new Promise((resolve, reject) => {
    const t = d.transaction(STORE, 'readwrite');
    const s = t.objectStore(STORE);
    const req = s.get(ref);
    req.onsuccess = () => { if (req.result) s.put({ ...req.result, ...patch }); };
    t.oncomplete = resolve;
    t.onerror = () => reject(t.error);
  }))
};

export function readSent() {
  try { return JSON.parse(localStorage.getItem(SENT_KEY) || '[]'); } catch { return []; }
}
function remember(entry) {
  const list = [entry, ...readSent()].slice(0, 20);
  try { localStorage.setItem(SENT_KEY, JSON.stringify(list)); } catch { /* storage full or blocked */ }
}

// Send one report. Resolves 'sent' | 'retry' | 'rejected'.
async function send(report) {
  const form = new FormData();
  Object.entries(report.fields).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') form.append(k, String(v));
  });
  report.photos.forEach((p, i) => form.append('photos', p.blob, `photo-${i + 1}.jpg`));
  let res;
  try {
    res = await fetch(`${API_BASE}/field-photos`, { method: 'POST', body: form });
  } catch {
    return { status: 'retry', error: 'No connection to DHARA' };
  }
  let body = {};
  try { body = await res.json(); } catch { /* non-JSON error page */ }
  if (res.ok) {
    remember({ ref: body.ref, clientRef: report.clientRef, type: report.fields.incident_type, photos: report.photos.length, at: new Date().toISOString() });
    return { status: 'sent', ref: body.ref };
  }
  // Server or gateway trouble: try again later. Anything else needs the driver.
  if (res.status >= 500 || res.status === 408 || res.status === 429) {
    return { status: 'retry', error: body.error || `Server busy (${res.status})` };
  }
  return { status: 'rejected', error: body.error || `Rejected (${res.status})` };
}

let syncing = null;
export function syncOutbox(onProgress) {
  if (syncing) return syncing;
  syncing = (async () => {
    const results = [];
    for (const report of await outbox.all()) {
      if (report.rejected) continue;
      const r = await send(report);
      results.push({ clientRef: report.clientRef, ...r });
      if (r.status === 'sent') await outbox.remove(report.clientRef);
      else await outbox.update(report.clientRef, { lastError: r.error, rejected: r.status === 'rejected', attempts: (report.attempts || 0) + 1 });
      onProgress?.();
      if (r.status === 'retry') break; // still offline; stop hammering
    }
    return results;
  })().finally(() => { syncing = null; });
  return syncing;
}
