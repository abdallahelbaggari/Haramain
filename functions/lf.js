// /lf — shared Lost & Found board for every Haramain user (Cloudflare D1, binding HM_DB).
//   GET  /lf?kind=lost|found&q=word        -> {ok, items:[...]}  (open notices from the last 30 days)
//   POST {a:'add', kind, item, descr, place, contact, accessToken}   -> posting needs Pi sign-in (checked with Pi)
//   POST {a:'done', id, accessToken}       -> the person who posted marks it resolved
//   POST {a:'report', id}                  -> notices reported 3 times are hidden
const H = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
const j = (o) => new Response(JSON.stringify(o), { status: 200, headers: H });
let ready = false;
async function db(env) {
  if (!env.HM_DB) return null;
  if (!ready) {
    await env.HM_DB.exec("CREATE TABLE IF NOT EXISTS lf (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT, item TEXT, descr TEXT, place TEXT, contact TEXT, user TEXT, ts INTEGER, done INTEGER DEFAULT 0, reports INTEGER DEFAULT 0)");
    ready = true;
  }
  return env.HM_DB;
}
const clean = (s, n) => String(s || '').replace(/[<>]/g, '').trim().slice(0, n);
async function piUser(token) {
  if (!token) return null;
  try {
    const r = await fetch('https://api.minepi.com/v2/me', { headers: { Authorization: 'Bearer ' + token } });
    if (!r.ok) return null; const u = await r.json(); return u && u.username ? u.username : null;
  } catch (e) { return null; }
}

export async function onRequestGet({ request, env }) {
  const d = await db(env); if (!d) return j({ ok: false, setup: true });
  const q = new URL(request.url).searchParams, kind = q.get('kind'), w = clean(q.get('q'), 40);
  const since = Date.now() - 30 * 864e5;
  let sql = 'SELECT id, kind, item, descr, place, contact, user, ts FROM lf WHERE done = 0 AND reports < 3 AND ts > ?', args = [since];
  if (kind === 'lost' || kind === 'found') { sql += ' AND kind = ?'; args.push(kind); }
  if (w) { sql += ' AND (item LIKE ? OR descr LIKE ? OR place LIKE ?)'; args.push('%' + w + '%', '%' + w + '%', '%' + w + '%'); }
  const rows = await d.prepare(sql + ' ORDER BY ts DESC LIMIT 60').bind(...args).all();
  return j({ ok: true, items: rows.results || [] });
}

export async function onRequestPost({ request, env }) {
  const d = await db(env); if (!d) return j({ ok: false, setup: true });
  let b = {}; try { b = await request.json(); } catch (e) {}
  const now = Date.now();
  if (b.a === 'report') { await d.prepare('UPDATE lf SET reports = reports + 1 WHERE id = ?').bind(Number(b.id) || 0).run(); return j({ ok: true }); }
  const user = await piUser(b.accessToken);
  if (!user) return j({ ok: false, error: 'Please sign in with Pi to post' });
  if (b.a === 'add') {
    const kind = b.kind === 'found' ? 'found' : 'lost', item = clean(b.item, 80);
    if (!item) return j({ ok: false, error: 'Describe the item' });
    const recent = await d.prepare('SELECT COUNT(*) AS n FROM lf WHERE user = ? AND ts > ?').bind(user, now - 864e5).first();
    if (recent && recent.n >= 5) return j({ ok: false, error: 'You can post up to 5 notices a day' });
    await d.prepare('INSERT INTO lf (kind, item, descr, place, contact, user, ts) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(kind, item, clean(b.descr, 300), clean(b.place, 80), clean(b.contact, 60), user, now).run();
    return j({ ok: true });
  }
  if (b.a === 'done') { await d.prepare('UPDATE lf SET done = 1 WHERE id = ? AND user = ?').bind(Number(b.id) || 0, user).run(); return j({ ok: true }); }
  return j({ ok: false, error: 'unknown action' });
}
