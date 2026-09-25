import { StrictMode, useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

import BorderGlow from './components/BorderGlow';
import GlideSelect from './components/GlideSelect';
import JellyRadio from './components/JellyRadio';
import { hexToHslTriplet, useTheme } from './theme';
import { readSession } from './session';
import { formatBytes, shrinkPhoto, uuid } from './photos';
import { outbox, readSent, syncOutbox } from './outbox';
import './report.css';

const MAX_PHOTOS = 4;
const DRIVER_KEY = 'dhara.driver';

const INCIDENTS = [
  { value: 'landslide', label: 'Landslide / debris', tag: 'slope' },
  { value: 'flooding', label: 'Water over road', tag: 'flood' },
  { value: 'washout', label: 'Road washed out', tag: 'surface' },
  { value: 'tree_fall', label: 'Fallen tree', tag: 'obstacle' },
  { value: 'accident', label: 'Accident / stuck vehicle', tag: 'traffic' },
  { value: 'other', label: 'Something else', tag: 'describe' }
];
const PASSABILITY = [
  { value: 'blocked', label: 'Blocked', tag: 'no vehicles' },
  { value: 'one_lane', label: 'One lane only', tag: 'alternate' },
  { value: 'slow', label: 'Passable, slow', tag: 'caution' },
  { value: 'open', label: 'Open', tag: 'clear' }
];
const STUCK = [
  { value: 'none', label: 'None' },
  { value: '1_5', label: '1–5' },
  { value: '6_20', label: '6–20' },
  { value: '20_plus', label: '20+' }
];
const labelOf = (list, v) => list.find(o => o.value === v)?.label || v;

function loadDriver() {
  try {
    const saved = JSON.parse(localStorage.getItem(DRIVER_KEY) || 'null');
    if (saved) return saved;
  } catch { /* ignore */ }
  const s = readSession();
  return { name: s?.name || '', vehicle: '' };
}

function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}

function App() {
  const theme = useTheme();
  const online = useOnline();
  const secure = window.isSecureContext;

  const [photos, setPhotos] = useState([]);
  const [photoError, setPhotoError] = useState('');
  const [busyPhotos, setBusyPhotos] = useState(0);
  const [gps, setGps] = useState({ status: 'idle' });
  const [landmark, setLandmark] = useState('');
  const [incident, setIncident] = useState('');
  const [passability, setPassability] = useState('');
  const [stuck, setStuck] = useState('none');
  const [note, setNote] = useState('');
  const [driver, setDriver] = useState(loadDriver);
  const [errors, setErrors] = useState({});
  const [pending, setPending] = useState([]);
  const [sent, setSent] = useState(readSent);
  const [flash, setFlash] = useState(null);
  const [outboxOk, setOutboxOk] = useState(true);
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  const formKey = useRef(0);

  const refreshLists = useCallback(async () => {
    try {
      setPending(await outbox.all());
      setOutboxOk(true);
    } catch {
      setOutboxOk(false);
    }
    setSent(readSent());
  }, []);

  const trySync = useCallback(async () => {
    const results = await syncOutbox(refreshLists).catch(() => []);
    await refreshLists();
    const ok = results.filter(r => r.status === 'sent');
    if (ok.length) setFlash({ kind: 'ok', text: ok.length === 1 ? `Report ${ok[0].ref} received by DHARA.` : `${ok.length} reports received by DHARA.` });
  }, [refreshLists]);

  useEffect(() => {
    refreshLists().then(trySync);
    window.addEventListener('online', trySync);
    const timer = setInterval(() => { if (navigator.onLine) trySync(); }, 30000);
    return () => { window.removeEventListener('online', trySync); clearInterval(timer); };
  }, [refreshLists, trySync]);

  useEffect(() => () => photos.forEach(p => URL.revokeObjectURL(p.url)), []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- location ----------
  const locate = useCallback(() => {
    if (!secure || !('geolocation' in navigator)) {
      setGps({ status: 'unavailable' });
      return;
    }
    setGps(g => ({ ...g, status: 'locating' }));
    navigator.geolocation.getCurrentPosition(
      pos => setGps({
        status: 'ok',
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        at: new Date(pos.timestamp).toISOString()
      }),
      err => setGps({ status: err.code === err.PERMISSION_DENIED ? 'denied' : 'failed' }),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 }
    );
  }, [secure]);

  // ---------- photos ----------
  const addFiles = async fileList => {
    const files = [...(fileList || [])].filter(f => f.type.startsWith('image/') || /\.(jpe?g|png|webp|heic)$/i.test(f.name));
    if (!files.length) return;
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) {
      setPhotoError(`Up to ${MAX_PHOTOS} photos per report.`);
      return;
    }
    setPhotoError(files.length > room ? `Only the first ${room} photo(s) were added (limit ${MAX_PHOTOS}).` : '');
    if (gps.status === 'idle') locate();
    setBusyPhotos(n => n + Math.min(room, files.length));
    for (const file of files.slice(0, room)) {
      try {
        const shrunk = await shrinkPhoto(file);
        setPhotos(list => [...list, { id: uuid(), ...shrunk, url: URL.createObjectURL(shrunk.blob) }]);
      } catch (e) {
        setPhotoError(e.message);
      } finally {
        setBusyPhotos(n => n - 1);
      }
    }
    setErrors(e => ({ ...e, photos: undefined }));
  };
  const removePhoto = id => setPhotos(list => {
    const gone = list.find(p => p.id === id);
    if (gone) URL.revokeObjectURL(gone.url);
    return list.filter(p => p.id !== id);
  });

  // ---------- submit ----------
  const submit = async e => {
    e.preventDefault();
    const errs = {};
    if (!photos.length) errs.photos = 'Add at least one photo of the scene.';
    if (gps.status !== 'ok' && landmark.trim().length < 3) errs.where = 'No GPS fix: describe where you are (nearest village, km stone, bridge).';
    if (!incident) errs.incident = 'Choose what happened.';
    if (!passability) errs.passability = 'Choose whether vehicles can get through.';
    if (!driver.name.trim()) errs.name = 'Enter your name.';
    setErrors(errs);
    if (Object.keys(errs).length) {
      document.querySelector('[data-error="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    try { localStorage.setItem(DRIVER_KEY, JSON.stringify(driver)); } catch { /* ignore */ }

    const report = {
      clientRef: uuid(),
      createdAt: new Date().toISOString(),
      fields: {
        client_ref: undefined,
        reporter_name: driver.name.trim(),
        vehicle_id: driver.vehicle.trim().toUpperCase(),
        incident_type: incident,
        passability,
        vehicles_stuck: stuck,
        note: note.trim(),
        landmark: landmark.trim(),
        lat: gps.status === 'ok' ? gps.lat.toFixed(6) : '',
        lon: gps.status === 'ok' ? gps.lon.toFixed(6) : '',
        accuracy_m: gps.status === 'ok' ? Math.round(gps.accuracy) : '',
        captured_at: new Date().toISOString()
      },
      photos: photos.map(p => ({ blob: p.blob, width: p.width, height: p.height }))
    };
    report.fields.client_ref = report.clientRef;

    try {
      await outbox.add(report);
    } catch {
      setFlash({ kind: 'warn', text: 'This browser cannot store reports offline. Keep the page open until it sends.' });
    }
    photos.forEach(p => URL.revokeObjectURL(p.url));
    setPhotos([]);
    setNote('');
    setLandmark('');
    setIncident('');
    setPassability('');
    setStuck('none');
    formKey.current += 1;
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (!outboxOk) return;
    setFlash({ kind: 'queued', text: navigator.onLine ? 'Sending…' : 'Saved on this phone. It will send automatically when you have signal.' });
    await refreshLists();
    if (navigator.onLine) {
      const results = await syncOutbox(refreshLists).catch(() => []);
      await refreshLists();
      const mine = results.find(r => r.clientRef === report.clientRef);
      if (mine?.status === 'sent') setFlash({ kind: 'ok', text: `Report ${mine.ref} received by DHARA. Thank you.` });
      else if (mine?.status === 'rejected') setFlash({ kind: 'error', text: `Not accepted: ${mine.error}` });
      else setFlash({ kind: 'queued', text: 'Saved on this phone. It will send automatically when the connection improves.' });
    }
  };

  const glow = {
    backgroundColor: theme.card,
    glowColor: hexToHslTriplet(theme.crimson),
    colors: [theme.crimson, theme.amber, theme.blue],
    borderRadius: 18,
    glowRadius: 22,
    glowIntensity: theme.dark ? 0.9 : 0.55
  };
  const selectTheme = {
    size: 'lg',
    radius: 12,
    menuWidth: 280,
    surfaceColor: theme.sandSoft,
    highlightColor: theme.sandStrong,
    textColor: theme.ink,
    accentColor: theme.crimson
  };
  const rejected = pending.filter(p => p.rejected);
  const waiting = pending.filter(p => !p.rejected);

  return (
    <div className="rp">
      <header className="rp-bar">
        <a className="rp-brand" href="/">
          <img src="/dhara-logo.png" alt="" width="32" height="32" />
          <span><strong>DHARA</strong><small>Road photo report</small></span>
        </a>
        <span className={`rp-net ${online ? 'on' : 'off'}`} role="status">{online ? 'Online' : 'No signal: saving on phone'}</span>
      </header>

      <main className="rp-main">
        {flash ? (
          <div className={`rp-flash ${flash.kind}`} role="status">
            <span>{flash.text}</span>
            <button type="button" aria-label="Dismiss" onClick={() => setFlash(null)}>✕</button>
          </div>
        ) : null}

        {!secure ? (
          <p className="rp-note warn">
            This page is not on HTTPS, so the phone will not share GPS and cannot work offline after closing.
            Describe the location below. Ask your control room for the HTTPS link.
          </p>
        ) : null}

        <form onSubmit={submit} noValidate key={formKey.current}>
          <BorderGlow className="rp-card" {...glow}>
            <section className="rp-section" data-error={!!errors.photos}>
              <h2><span>1</span>Photos of the scene</h2>
              <div className="rp-photo-actions">
                <button type="button" className="rp-btn primary" onClick={() => cameraRef.current?.click()} disabled={photos.length >= MAX_PHOTOS}>
                  Take photo
                </button>
                <button type="button" className="rp-btn" onClick={() => galleryRef.current?.click()} disabled={photos.length >= MAX_PHOTOS}>
                  From gallery
                </button>
                <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
                <input ref={galleryRef} type="file" accept="image/*" multiple hidden onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
              </div>
              {photos.length || busyPhotos ? (
                <ul className="rp-thumbs">
                  {photos.map(p => (
                    <li key={p.id}>
                      <img src={p.url} alt="Report photo" />
                      <span>{formatBytes(p.blob.size)}</span>
                      <button type="button" aria-label="Remove photo" onClick={() => removePhoto(p.id)}>✕</button>
                    </li>
                  ))}
                  {Array.from({ length: busyPhotos }, (_, i) => <li key={`busy${i}`} className="busy">Preparing…</li>)}
                </ul>
              ) : null}
              <p className="rp-hint">Up to {MAX_PHOTOS}. Photos are shrunk to about 0.3 MB and hidden camera data is removed before sending.</p>
              {photoError ? <p className="rp-error">{photoError}</p> : null}
              {errors.photos ? <p className="rp-error">{errors.photos}</p> : null}
            </section>

            <section className="rp-section" data-error={!!errors.where}>
              <h2><span>2</span>Where</h2>
              <div className="rp-gps">
                {gps.status === 'ok' ? (
                  <p>
                    <b>{gps.lat.toFixed(5)}, {gps.lon.toFixed(5)}</b>
                    <small>± {Math.round(gps.accuracy)} m · {new Date(gps.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</small>
                  </p>
                ) : (
                  <p className="rp-muted">
                    {{
                      idle: 'Location not captured yet.',
                      locating: 'Finding your location…',
                      denied: 'Location permission was refused. Describe the place below.',
                      failed: 'Could not get a GPS fix. Try again in the open, or describe the place below.',
                      unavailable: 'GPS is not available on this page. Describe the place below.'
                    }[gps.status]}
                  </p>
                )}
                {secure ? (
                  <button type="button" className="rp-btn" onClick={locate} disabled={gps.status === 'locating'}>
                    {gps.status === 'ok' ? 'Update' : 'Use my location'}
                  </button>
                ) : null}
              </div>
              <label className="rp-field">
                Nearest landmark {gps.status === 'ok' ? <em>optional</em> : <em>required without GPS</em>}
                <input value={landmark} onChange={e => setLandmark(e.target.value)} maxLength={120} placeholder="e.g. 2 km after Dirang bridge, km stone 42" />
              </label>
              {errors.where ? <p className="rp-error">{errors.where}</p> : null}
            </section>

            <section className="rp-section">
              <h2><span>3</span>What you see</h2>
              <div className="rp-row" data-error={!!errors.incident}>
                <span className="rp-label">What happened</span>
                <GlideSelect options={INCIDENTS} value={incident} onChange={v => { setIncident(v); setErrors(e => ({ ...e, incident: undefined })); }} placeholder="Choose…" ariaLabel="What happened" {...selectTheme} />
              </div>
              {errors.incident ? <p className="rp-error">{errors.incident}</p> : null}
              <div className="rp-row" data-error={!!errors.passability}>
                <span className="rp-label">Can vehicles pass?</span>
                <GlideSelect options={PASSABILITY} value={passability} onChange={v => { setPassability(v); setErrors(e => ({ ...e, passability: undefined })); }} placeholder="Choose…" ariaLabel="Can vehicles pass" {...selectTheme} />
              </div>
              {errors.passability ? <p className="rp-error">{errors.passability}</p> : null}
              <div className="rp-row stacked">
                <span className="rp-label" id="stuck-label">Vehicles stuck here</span>
                <div className="rp-jelly">
                  <JellyRadio
                    items={STUCK}
                    value={stuck}
                    onChange={v => setStuck(v)}
                    ariaLabel="Vehicles stuck here"
                    size="lg"
                    gap={6}
                    radius={20}
                    swell={0.12}
                    barge={4}
                    chipColor={theme.sandSoft}
                    activeColor={theme.espresso}
                    textColor={theme.ink}
                    activeTextColor={theme.onEspresso}
                  />
                </div>
              </div>
              <label className="rp-field">
                Anything else <em>optional</em>
                <textarea value={note} onChange={e => setNote(e.target.value)} maxLength={500} rows={3} placeholder="Size of the slide, water depth, people needing help…" />
              </label>
            </section>

            <section className="rp-section" data-error={!!errors.name}>
              <h2><span>4</span>You</h2>
              <div className="rp-two">
                <label className="rp-field">
                  Your name
                  <input value={driver.name} onChange={e => setDriver(d => ({ ...d, name: e.target.value }))} maxLength={60} autoComplete="name" />
                </label>
                <label className="rp-field">
                  Vehicle number <em>optional</em>
                  <input value={driver.vehicle} onChange={e => setDriver(d => ({ ...d, vehicle: e.target.value }))} maxLength={20} placeholder="AS-01-AB-1234" autoCapitalize="characters" />
                </label>
              </div>
              {errors.name ? <p className="rp-error">{errors.name}</p> : null}
            </section>

            <div className="rp-submit">
              <button type="submit" className="rp-btn primary big" disabled={busyPhotos > 0}>
                {online ? 'Send report' : 'Save report (sends when online)'}
              </button>
              <p className="rp-hint">Reports are shown to the district control room as <b>unverified</b> until checked.</p>
            </div>
          </BorderGlow>
        </form>

        {waiting.length || rejected.length ? (
          <section className="rp-list">
            <h2>Waiting to send ({waiting.length})</h2>
            <ul>
              {waiting.map(r => (
                <li key={r.clientRef}>
                  <b>{labelOf(INCIDENTS, r.fields.incident_type)}</b> · {r.photos.length} photo(s)
                  <small>Saved {new Date(r.createdAt).toLocaleString('en-IN')}{r.lastError ? ` · ${r.lastError}` : ''}</small>
                </li>
              ))}
              {rejected.map(r => (
                <li key={r.clientRef} className="bad">
                  <b>{labelOf(INCIDENTS, r.fields.incident_type)}</b> was not accepted
                  <small>{r.lastError}</small>
                  <button type="button" className="rp-btn small" onClick={async () => { await outbox.remove(r.clientRef); refreshLists(); }}>Delete</button>
                </li>
              ))}
            </ul>
            {waiting.length && online ? <button type="button" className="rp-btn" onClick={trySync}>Send now</button> : null}
          </section>
        ) : null}

        {sent.length ? (
          <section className="rp-list">
            <h2>Sent from this phone</h2>
            <ul>
              {sent.slice(0, 8).map(s => (
                <li key={s.clientRef || s.ref}>
                  <b>{s.ref}</b> · {labelOf(INCIDENTS, s.type)} · {s.photos} photo(s)
                  <small>{new Date(s.at).toLocaleString('en-IN')}</small>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    </div>
  );
}

// Offline support: cache this page and its files after the first visit.
if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('/report-sw.js', { scope: '/report' }).then(reg => {
    const urls = [
      window.location.pathname,
      ...performance.getEntriesByType('resource')
        .map(e => e.name)
        .filter(u => u.startsWith(window.location.origin) && !u.includes('/field-photos'))
    ];
    const post = worker => worker && worker.postMessage({ type: 'cache-urls', urls });
    post(reg.active || reg.waiting || reg.installing);
    navigator.serviceWorker.ready.then(r => post(r.active));
  }).catch(() => { /* offline caching unavailable; the outbox still works while the page is open */ });
}

createRoot(document.getElementById('report-root')).render(<StrictMode><App /></StrictMode>);
