// /live — share your live location with a link (Cloudflare D1, binding HM_DB).
//   POST {a:'start', name}                 -> {ok, id, token}
//   POST {a:'update', id, token, lat, lng, acc}
//   POST {a:'stop', id, token}             -> location deleted at once
//   GET  /live?id=XXXX                     -> {ok, active, name, lat, lng, acc, ts}
// A share ends after 12 hours or when the owner stops it; then the row is deleted.
const H = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
const j = (o) => new Response(JSON.stringify(o), { status: 200, headers: H });
let ready = false;
async function db(env) {
  if (!env.HM_DB) return null;
  if (!ready) {
    await env.HM_DB.exec('CREATE TABLE IF NOT EXISTS live (id TEXT PRIMARY KEY, token TEXT, name TEXT, lat REAL, lng REAL, acc REAL, ts INTEGER, until INTEGER)');
    ready = true;
  }
  return env.HM_DB;
}
const rid = (n) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return Array.from(a, (b) => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join(''); };
const num = (x, lo, hi) => { const v = Number(x); return Number.isFinite(v) && v >= lo && v <= hi ? v : null; };

export async function onRequestGet({ request, env }) {
  const d = await db(env); if (!d) return j({ ok: false, setup: true });
  const id = (new URL(request.url).searchParams.get('id') || '').slice(0, 16);
  const row = await d.prepare('SELECT name, lat, lng, acc, ts, until FROM live WHERE id = ?').bind(id).first();
  const now = Date.now();
  if (!row || row.until < now) { if (row) await d.prepare('DELETE FROM live WHERE id = ?').bind(id).run(); return j({ ok: true, active: false }); }
  return j({ ok: true, active: true, name: row.name, lat: row.lat, lng: row.lng, acc: row.acc, ts: row.ts });
}

export async function onRequestPost({ request, env }) {
  const d = await db(env); if (!d) return j({ ok: false, setup: true });
  let b = {}; try { b = await request.json(); } catch (e) {}
  const now = Date.now();
  if (b.a === 'start') {
    const id = rid(10), token = rid(24), name = String(b.name || 'A pilgrim').slice(0, 40);
    await d.prepare('DELETE FROM live WHERE until < ?').bind(now).run();
    await d.prepare('INSERT INTO live (id, token, name, ts, until) VALUES (?, ?, ?, ?, ?)').bind(id, token, name, now, now + 12 * 3600e3).run();
    return j({ ok: true, id, token });
  }
  const id = String(b.id || '').slice(0, 16), token = String(b.token || '');
  if (b.a === 'update') {
    const lat = num(b.lat, -90, 90), lng = num(b.lng, -180, 180), acc = num(b.acc, 0, 100000);
    if (lat === null || lng === null) return j({ ok: false, error: 'bad position' });
    const r = await d.prepare('UPDATE live SET lat = ?, lng = ?, acc = ?, ts = ? WHERE id = ? AND token = ? AND until > ?').bind(lat, lng, acc, now, id, token, now).run();
    return j({ ok: !!(r.meta && r.meta.changes) });
  }
  if (b.a === 'stop') {
    await d.prepare('DELETE FROM live WHERE id = ? AND token = ?').bind(id, token).run();
    return j({ ok: true });
  }
  return j({ ok: false, error: 'unknown action' });
}
