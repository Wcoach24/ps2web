// PS2WEB(F5 W1 / Sprint 1): compatibility catalog + verified-in-browser overlay.
// Serves the official Play! tracker snapshot (bench/compat.json, 1302 state-playable
// games) as a static asset and matches imported discs by serial. verified.json is the
// ps2web-owned list of games confirmed to run in a browser (protocol: docs/COMPAT-BROWSER.md).

export interface CompatGame {
  serial: string;
  title: string;
  region: string;
  labels: string[];
  issue?: number;
  url?: string;
}

export interface VerifiedGame {
  serial: string;
  title?: string;
  verifiedOn?: string; // ISO date
  minutes?: number;    // minutes played without hang
  notes?: string;
}

let _compat: CompatGame[] | null = null;
let _compatBySerial: Map<string, CompatGame> | null = null;
let _verified: Map<string, VerifiedGame> | null = null;

// Strip a serial to a comparable canonical form: "SLUS_212.58" / "SLUS-21258" -> "SLUS21258".
export function canonSerial(s: string): string {
  return (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// Pull a PS2-style serial token out of an arbitrary filename, if present.
const SERIAL_RE = /S[LC][A-Z]{2}[\s\-_]?\d{3}[.\-_]?\d{2}/i;
export function serialFromFilename(name: string): string | null {
  const m = (name || '').match(SERIAL_RE);
  return m ? canonSerial(m[0]) : null;
}

export async function loadCompat(): Promise<CompatGame[]> {
  if (_compat) return _compat;
  try {
    const res = await fetch('compat.json', { cache: 'force-cache' });
    if (!res.ok) throw new Error(`compat.json ${res.status}`);
    const data = await res.json();
    _compat = (data && data.games ? data.games : data) as CompatGame[];
  } catch (e) {
    console.warn('[ps2web] compat.json unavailable:', e);
    _compat = [];
  }
  _compatBySerial = new Map();
  for (const g of _compat) _compatBySerial.set(canonSerial(g.serial), g);
  return _compat;
}

export async function loadVerified(): Promise<Map<string, VerifiedGame>> {
  if (_verified) return _verified;
  _verified = new Map();
  try {
    const res = await fetch('verified.json', { cache: 'no-cache' });
    if (res.ok) {
      const data = await res.json();
      const list: VerifiedGame[] = data && data.games ? data.games : data;
      for (const v of list || []) _verified.set(canonSerial(v.serial), v);
    }
  } catch (e) {
    // verified.json is optional; absence just means no badges yet.
  }
  return _verified;
}

// Match an imported disc (by filename) against the tracker. Returns the tracker
// entry + whether ps2web has independently verified it in-browser.
export interface MatchResult {
  serial: string | null;
  tracker: CompatGame | null;
  verified: VerifiedGame | null;
}
export async function matchImported(filename: string): Promise<MatchResult> {
  await loadCompat();
  const verified = await loadVerified();
  const serial = serialFromFilename(filename);
  if (!serial) return { serial: null, tracker: null, verified: null };
  return {
    serial,
    tracker: _compatBySerial ? _compatBySerial.get(serial) || null : null,
    verified: verified.get(serial) || null,
  };
}

// Free-text search over the tracker (title or serial), capped for UI responsiveness.
export async function searchGames(query: string, limit = 40): Promise<CompatGame[]> {
  const compat = await loadCompat();
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const qs = canonSerial(query);
  const out: CompatGame[] = [];
  for (const g of compat) {
    const titleHit = g.title.toLowerCase().includes(q);
    const serialHit = qs.length >= 3 && canonSerial(g.serial).includes(qs);
    if (titleHit || serialHit) {
      out.push(g);
      if (out.length >= limit) break;
    }
  }
  return out;
}

export async function compatCount(): Promise<number> {
  return (await loadCompat()).length;
}
