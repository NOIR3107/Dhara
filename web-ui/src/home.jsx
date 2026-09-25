import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

import StaggeredMenu from './components/StaggeredMenu';
import BorderGlow from './components/BorderGlow';
import GlideSelect from './components/GlideSelect';
import JellyRadio from './components/JellyRadio';
import { hexToHslTriplet, useTheme } from './theme';
import { LANGUAGES, readSession, signOut, writeSession } from './session';
import './home.css';

// ---------------------------------------------------------------------------
// Dashboards that need a sign-in. Each opens the existing officer dashboard
// on the view that role works from (or the driver photo page).
// ---------------------------------------------------------------------------
const ROLES = [
  {
    id: 'district_officer',
    cta: 'Sign in as district officer',
    title: 'District logistics officer',
    who: 'DC office · district disaster cell',
    href: '/dashboard#/decisions',
    tasks: ['Approve, change or reject pre-positioning dispatches', 'Watch cut-off countdowns for habitations', 'Log decisions to the audit trail'],
    icon: 'clipboard'
  },
  {
    id: 'state_control_room',
    cta: 'Sign in to control room',
    title: 'State control room',
    who: 'SDMA · state emergency operations centre',
    href: '/dashboard#/map',
    tasks: ['Live map with hazard layers and 3D terrain', 'Corridor risks across districts', 'Shared map notes: closures, helipads, staging'],
    icon: 'map'
  },
  {
    id: 'depot_manager',
    cta: 'Sign in as depot manager',
    title: 'Depot & warehouse manager',
    who: 'Relief hub · supply depot',
    href: '/dashboard#/depots',
    tasks: ['Stock levels for rations, medicines, water', 'Outgoing shipments and manifests', 'Dispatches assigned to this depot'],
    icon: 'warehouse'
  },
  {
    id: 'fleet_dispatcher',
    cta: 'Sign in as dispatcher',
    title: 'Fleet & transport dispatcher',
    who: 'Transport cell · contracted fleet',
    href: '/dashboard#/fleet',
    tasks: ['Vehicle positions and status', 'Safer routes and egress times', 'Reassign trucks when a road closes'],
    icon: 'truck'
  },
  {
    id: 'driver',
    cta: 'Start a photo report',
    title: 'Driver & field responder',
    who: 'Truck drivers · road gangs · field staff',
    href: '/report',
    tasks: ['Photo report of a blocked or damaged road', 'Works without signal; sends when back online', 'GPS location added automatically'],
    icon: 'camera'
  },
  {
    id: 'reviewer',
    cta: 'Sign in as reviewer',
    title: 'MDoNER review & audit',
    who: 'Ministry · evaluators (read-only)',
    href: '/dashboard#/track-record',
    tasks: ['Prediction track record and accuracy', 'Full audit trail of automated decisions', 'Data sources and provenance'],
    icon: 'shield'
  }
];

// Lucide icons (ISC licence), same set the page already inlines.
const ICONS = {
  clipboard: '<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
  map: '<path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/>',
  warehouse: '<path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z"/><path d="M6 18h12"/><path d="M6 14h12"/><rect width="12" height="12" x="6" y="10"/>',
  truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>'
};
const Icon = ({ name, size = 20 }) => (
  <svg className="icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS[name] }} />
);

// ---------------------------------------------------------------------------
// Site menu (StaggeredMenu). Its toggle is pinned over a slot in the navbar.
// ---------------------------------------------------------------------------
const MENU_ITEMS = [
  { label: 'Sign in', ariaLabel: 'Sign in to a dashboard', link: '#sign-in' },
  { label: 'Live map', ariaLabel: 'Open the live map', link: '/dashboard#/map' },
  { label: 'Photo report', ariaLabel: 'Driver photo report', link: '/report' },
  { label: 'Road issue', ariaLabel: 'Report a road issue', link: '#report-issue' },
  { label: 'System status', ariaLabel: 'System status', link: '#status' }
];

function SiteMenu({ slot }) {
  const theme = useTheme();
  const wrapRef = useRef(null);

  // Keep the fixed-position toggle on top of the navbar slot.
  useEffect(() => {
    let raf = 0;
    const place = () => {
      raf = 0;
      const r = slot.getBoundingClientRect();
      const el = wrapRef.current;
      if (!el) return;
      el.style.setProperty('--slot-top', `${r.top}px`);
      el.style.setProperty('--slot-left', `${r.left}px`);
      el.style.setProperty('--slot-w', `${r.width}px`);
      el.style.setProperty('--slot-h', `${r.height}px`);
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(place); };
    place();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      cancelAnimationFrame(raf);
    };
  }, [slot]);

  // Menu links: close the panel after navigating, and route "Road issue"
  // to the page's existing report modal.
  useEffect(() => {
    const onClick = e => {
      const link = e.target.closest('.dhara-menu .sm-panel-item');
      if (!link) return;
      const href = link.getAttribute('href');
      const toggle = document.querySelector('.dhara-menu .sm-toggle');
      if (toggle && toggle.getAttribute('aria-expanded') === 'true') toggle.click();
      if (href === '#report-issue') {
        e.preventDefault();
        document.querySelector('[data-open="report"]')?.click();
      }
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  return (
    <div ref={wrapRef} className="dhara-menu-host">
      <StaggeredMenu
        className="dhara-menu"
        isFixed
        position="right"
        items={MENU_ITEMS}
        displaySocials={false}
        displayItemNumbering
        colors={[theme.sandStrong, theme.espresso]}
        menuButtonColor={theme.ink}
        openMenuButtonColor={theme.ink}
        changeMenuColorOnOpen={false}
        accentColor={theme.crimson}
        logoUrl="/dhara-logo.png"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sign-in: one identity form, six dashboards.
// ---------------------------------------------------------------------------
function SignIn() {
  const theme = useTheme();
  const [session, setSession] = useState(readSession);
  const [name, setName] = useState(session?.name || '');
  const [staffId, setStaffId] = useState(session?.staffId || '');
  const [lang, setLang] = useState(session?.lang || 'en');
  const [error, setError] = useState('');
  const nameRef = useRef(null);

  const go = role => {
    if (!name.trim()) {
      setError('Enter your name first. It is recorded against every decision, note and report you make.');
      nameRef.current?.focus();
      return;
    }
    writeSession({ role: role.id, roleTitle: role.title, name: name.trim(), staffId: staffId.trim(), lang });
    window.location.href = role.href;
  };

  const glow = {
    backgroundColor: theme.card,
    glowColor: hexToHslTriplet(theme.crimson),
    colors: [theme.crimson, theme.amber, theme.blue],
    borderRadius: 18,
    glowRadius: 26,
    glowIntensity: theme.dark ? 0.9 : 0.6,
    edgeSensitivity: 26
  };

  return (
    <div className="signin">
      {session ? (
        <div className="signin-current" role="status">
          <span>
            Signed in as <b>{session.name}</b>
            {session.staffId ? ` (${session.staffId})` : ''} · {session.roleTitle}
          </span>
          <span className="signin-current-actions">
            <a className="btn btn-dark" href={ROLES.find(r => r.id === session.role)?.href || '/dashboard'}>
              Continue <Icon name="arrow" size={16} />
            </a>
            <button type="button" className="btn btn-outline" onClick={() => { signOut(); setSession(null); }}>
              Sign out
            </button>
          </span>
        </div>
      ) : null}

      <form className="signin-identity" onSubmit={e => e.preventDefault()} noValidate>
        <label>
          Your name
          <input ref={nameRef} value={name} onChange={e => { setName(e.target.value); setError(''); }} maxLength={60} autoComplete="name" placeholder="e.g. R. Lalthanpuia" required />
        </label>
        <label>
          Staff / officer ID <span className="optional">optional</span>
          <input value={staffId} onChange={e => setStaffId(e.target.value)} maxLength={30} autoComplete="off" placeholder="e.g. DDMA-TWG-014" />
        </label>
        <div className="signin-lang">
          <span className="signin-lang-label" id="signin-lang-label">Dashboard language</span>
          <GlideSelect
            options={LANGUAGES}
            value={lang}
            onChange={v => setLang(v)}
            ariaLabel="Dashboard language"
            showTags
            size="lg"
            menuWidth={236}
            radius={12}
            surfaceColor={theme.sandSoft}
            highlightColor={theme.sandStrong}
            textColor={theme.ink}
            accentColor={theme.crimson}
          />
        </div>
      </form>
      {error ? <p className="signin-error" role="alert">{error}</p> : null}

      <div className="role-grid">
        {ROLES.map(role => (
          <BorderGlow key={role.id} className="role-card" {...glow}>
            <div className="role-card-body">
              <div className="role-card-head">
                <span className="role-icon"><Icon name={role.icon} /></span>
                <div>
                  <h3>{role.title}</h3>
                  <small>{role.who}</small>
                </div>
              </div>
              <ul>
                {role.tasks.map(t => <li key={t}>{t}</li>)}
              </ul>
              <button type="button" className="btn btn-dark btn-full" onClick={() => go(role)}>
                {role.cta}
                <Icon name="arrow" size={16} />
              </button>
            </div>
          </BorderGlow>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Forecast-day picker for the hero map (the page's inline map script listens).
// ---------------------------------------------------------------------------
function DayPicker() {
  const theme = useTheme();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() + i * 86400000);
    return { value: String(i), label: i === 0 ? 'Today' : d.toLocaleDateString('en-IN', { weekday: 'short' }) };
  });
  return (
    <JellyRadio
      items={days}
      defaultValue="0"
      onChange={v => window.dispatchEvent(new CustomEvent('dhara-forecast-day', { detail: { day: Number(v) } }))}
      ariaLabel="Forecast day for the map"
      size="sm"
      gap={4}
      radius={14}
      swell={0.14}
      barge={3}
      chipColor={theme.sandSoft}
      activeColor={theme.espresso}
      textColor={theme.ink}
      activeTextColor={theme.onEspresso}
    />
  );
}

function mount(id, element) {
  const el = document.getElementById(id);
  if (el) createRoot(el).render(<StrictMode>{element(el)}</StrictMode>);
}

mount('dhara-menu', el => <SiteMenu slot={el} />);
mount('dhara-signin', () => <SignIn />);
mount('dhara-day-picker', () => <DayPicker />);
