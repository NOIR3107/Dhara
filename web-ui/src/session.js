// Who is using this browser. There is no password check yet: DHARA records
// the name against decisions, map notes and field reports, but does not
// verify it. Replace with the state SSO (e.g. NIC Parichay) before deployment.
const SESSION_KEY = 'dhara.session';

// Same codes the dashboard's language menu uses (web/app.js reads dhara_lang).
export const LANGUAGES = [
  { value: 'en', label: 'English', tag: 'EN' },
  { value: 'hi', label: 'हिंदी', tag: 'Hindi' },
  { value: 'as', label: 'অসমীয়া', tag: 'Assamese' },
  { value: 'bn', label: 'বাংলা', tag: 'Bengali' },
  { value: 'mni', label: 'মৈতৈলোন্', tag: 'Manipuri' },
  { value: 'brx', label: 'बड़ो', tag: 'Bodo' },
  { value: 'ne', label: 'नेपाली', tag: 'Nepali' },
  { value: 'lus', label: 'Mizo ṭawng', tag: 'draft' },
  { value: 'kha', label: 'Khasi', tag: 'draft' },
  { value: 'nag', label: 'Nagamese', tag: 'draft' }
];

function get(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function set(key, value) {
  try { localStorage.setItem(key, value); } catch { /* private mode: session lasts this page only */ }
}
function remove(key) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

export function readSession() {
  try {
    const s = JSON.parse(get(SESSION_KEY) || 'null');
    return s && s.name ? s : null;
  } catch {
    return null;
  }
}

export function writeSession({ role, roleTitle, name, staffId, lang }) {
  const session = { role, roleTitle, name, staffId, lang, signedInAt: new Date().toISOString() };
  set(SESSION_KEY, JSON.stringify(session));
  set('dhara_lang', lang); // dashboard language
  set('dhara.author', staffId ? `${name} (${staffId})` : name); // map-note author
  return session;
}

export function signOut() {
  remove(SESSION_KEY);
  remove('dhara.author');
}
