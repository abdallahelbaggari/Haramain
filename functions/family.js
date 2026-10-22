// /family — private family groups: members see each other's last location and check-in (Cloudflare D1, binding HM_DB).
//   POST {a:'create', name}                                  -> {ok, code, uid, key}
//   POST {a:'join', code, name}                              -> {ok, code, uid, key}
//   POST {a:'update', code, uid, key, lat?, lng?, status?}
//   POST {a:'leave', code, uid, key}
//   GET  /family?code=&uid=&key=                             -> {ok, members:[{uid,name,lat,lng,status,ts,me}]}
// Only members (with their private key) can read a group. Members inactive for 7 days are removed.
const H = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
const j = (o) => new Response(JSON.stringify(o), { status: 200, headers: H });
let ready = false;
async function db(env) {
  if (!env.HM_DB) return null;
  if (!ready) {
    await env.HM_DB.exec('CREATE TABLE IF NOT EXISTS fam (code TEXT, uid TEXT, key TEXT, name TEXT, lat REAL, lng REAL, status TEXT, ts INTEGER, PRIMARY KEY (code, uid))');
    ready = true;
  }
  return env.HM_DB;
}
const rid = (n, set) => { const a = new Uint8Array(n); crypto.getRandomValues(a); set = set || 'abcdefghjkmnpqrstuvwxyz23456789'; return Array.from(a, (b) => set[b % set.length]).join(''); };
const num = (x, lo, hi) => { const v = Number(x); return Number.isFinite(v) && v >= lo && v <= hi ? v : null; };
const clean = (s, n) => String(s || '').replace(/[<>]/g, '').slice(0, n);

async function member(d, code, uid, key) {
  return d.prepare('SELECT uid FROM fam WHERE code = ? AND uid = ? AND key = ?').bind(code, uid, key).first();
}

export async function onRequestGet({ request, env }) {
  const d = await db(env); if (!d) return j({ ok: false, setup: true });
  const q = new URL(request.url).searchParams;
  const code = clean(q.get('code'), 8).toUpperCase(), uid = clean(q.get('uid'), 16), key = clean(q.get('key'), 40);
  if (!(await member(d, code, uid, key))) return j({ ok: false, error: 'not a member' });
  const rows = await d.prepare('SELECT uid, name, lat, lng, status, ts FROM fam WHERE code = ? ORDER BY ts DESC LIMIT 30').bind(code).all();
  return j({ ok: true, code, members: (rows.results || []).map((r) => ({ ...r, me: r.uid === uid })) });
}

export async function onRequestPost({ request, env }) {
  const d = await db(env); if (!d) return j({ ok: false, setup: true });
  let b = {}; try { b = await request.json(); } catch (e) {}
  const now = Date.now();
  if (b.a === 'create' || b.a === 'join') {
    let code = clean(b.code, 8).toUpperCase();
    if (b.a === 'create') code = rid(6, 'ABCDEFGHJKMNPQRSTUVWXYZ23456789');
    else {
      const exists = await d.prepare('SELECT 1 FROM fam WHERE code = ? LIMIT 1').bind(code).first();
      if (!exists) return j({ ok: false, error: 'No group with this code' });
      const count = await d.prepare('SELECT COUNT(*) AS n FROM fam WHERE code = ?').bind(code).first();
      if (count && count.n >= 30) return j({ ok: false, error: 'This group is full' });
    }
    const uid = rid(10), key = rid(28), name = clean(b.name, 40) || 'Family member';
    await d.prepare('DELETE FROM fam WHERE ts < ?').bind(now - 7 * 864e5).run();
    await d.prepare('INSERT INTO fam (code, uid, key, name, status, ts) VALUES (?, ?, ?, ?, ?, ?)').bind(code, uid, key, name, b.a === 'create' ? 'Created the group' : 'Joined the group', now).run();
    return j({ ok: true, code, uid, key });
  }
  const code = clean(b.code, 8).toUpperCase(), uid = clean(b.uid, 16), key = clean(b.key, 40);
  if (!(await member(d, code, uid, key))) return j({ ok: false, error: 'not a member' });
  if (b.a === 'update') {
    const lat = num(b.lat, -90, 90), lng = num(b.lng, -180, 180), status = b.status != null ? clean(b.status, 60) : null;
    if (lat !== null && lng !== null) await d.prepare('UPDATE fam SET lat = ?, lng = ?, ts = ?' + (status !== null ? ', status = ?' : '') + ' WHERE code = ? AND uid = ?').bind(...(status !== null ? [lat, lng, now, status, code, uid] : [lat, lng, now, code, uid])).run();
    else if (status !== null) await d.prepare('UPDATE fam SET status = ?, ts = ? WHERE code = ? AND uid = ?').bind(status, now, code, uid).run();
    return j({ ok: true });
  }
  if (b.a === 'leave') { await d.prepare('DELETE FROM fam WHERE code = ? AND uid = ?').bind(code, uid).run(); return j({ ok: true }); }
  return j({ ok: false, error: 'unknown action' });
}
