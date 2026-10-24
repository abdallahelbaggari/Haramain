// Haramain in-app transfers — fully automatic, no human decisions.
// The sender pays Haramain in Pi's own pop-up (U2A); Haramain's code then pays the recipient through Pi Network's official
// App-to-User flow (A2U). If delivery cannot be done, the code refunds the sender automatically on the Pi blockchain.
// Nobody reviews, approves, holds or reverses individual transfers: published rules are applied the same way to everyone.
// Secrets (Cloudflare → Settings → Variables and Secrets): PI_API_KEY, APP_WALLET_SEED ('S…'). D1 binding: HM_DB.
// Optional fixed rules: MAX_TRANSFER, DAILY_LIMIT, DAILY_COUNT, GLOBAL_DAILY_LIMIT. TRANSFERS_ENABLED = 0 pauses new transfers for everyone
// (transfers already paid are still delivered or refunded automatically).
import { keypairFromSeed, buildPayment, accountToBytes } from './stellar.js';

export const FEE = 0.01;                 // added to the sender's payment, covers the payout's blockchain fee
const PI = 'https://api.minepi.com/v2';
export const H = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Cache-Control': 'no-store' };
export const json = (o) => new Response(JSON.stringify(o), { status: 200, headers: H });
export const isTest = (request) => /(^|[.-])testnet[.-]/i.test(new URL(request.url).hostname);
const NET = (t) => t ? { passphrase: 'Pi Testnet', horizon: 'https://api.testnet.minepi.com', name: 'Pi Testnet' } : { passphrase: 'Pi Network', horizon: 'https://api.mainnet.minepi.com', name: 'Pi Mainnet' };
export const USER_RE = /^[A-Za-z0-9_.-]{2,40}$/;
const round7 = (n) => Math.round(Number(n) * 1e7) / 1e7;

// On automatically once the app wallet key is added; TRANSFERS_ENABLED = 0 pauses transfers at any time.
export function enabled(env) { return String(env.TRANSFERS_ENABLED || '') !== '0' && !!env.APP_WALLET_SEED && !!env.PI_API_KEY && !!env.HM_DB; }
// Starts at 50 π per transfer for safety; raise it with MAX_TRANSFER (for example 500).
export function maxTransfer(env) { const m = Number(env.MAX_TRANSFER); return m > 0 ? m : 50; }
const numEnv = (v, d) => { const n = Number(v); return n > 0 ? n : d; };
// Safety limits, all adjustable in Cloudflare without code: DAILY_LIMIT (π per sender per 24 h), DAILY_COUNT (transfers per sender per 24 h),
// GLOBAL_DAILY_LIMIT (π paid out by Haramain per 24 h, caps any loss from a bug or abuse).
export function limits(env) { return { max: maxTransfer(env), day: numEnv(env.DAILY_LIMIT, 200), count: numEnv(env.DAILY_COUNT, 20), global: numEnv(env.GLOBAL_DAILY_LIMIT, 2000) }; }
const DAY = 86400000, LIVE = "(status IN ('received', 'paying', 'paid', 'failed') OR (status = 'approved' AND ts > ?))";

/* Per-sender and app-wide 24-hour limits. Returns '' if fine, or the reason to refuse. */
export async function checkLimits(env, pay) {
  const L = limits(env), d = await db(env), now = Date.now(), amt = round7((pay.metadata || {}).amt), uid = String(pay.user_uid || ''), pid = String(pay.identifier || '');
  const mine = await d.prepare('SELECT COALESCE(SUM(CAST(amount AS REAL)), 0) AS s, COUNT(*) AS n FROM transfers WHERE from_uid = ? AND pid <> ? AND ts > ? AND ' + LIVE).bind(uid, pid, now - DAY, now - 3600000).first();
  if (mine.n >= L.count) return 'You have reached today’s limit of ' + L.count + (L.count === 1 ? ' transfer.' : ' transfers.') + ' Please try again tomorrow.';
  if (mine.s + amt > L.day + 1e-9) { const left = Math.max(0, round7(L.day - mine.s)); return 'The daily limit is ' + L.day + ' π per person. You can still send ' + left + ' π today.'; }
  const all = await d.prepare('SELECT COALESCE(SUM(CAST(amount AS REAL)), 0) AS s FROM transfers WHERE pid <> ? AND ts > ? AND ' + LIVE).bind(pid, now - DAY, now - 3600000).first();
  if (all.s + amt > L.global + 1e-9) return 'Haramain has reached today’s transfer capacity. Please try again tomorrow.';
  return '';
}
/* Called when Haramain approves a transfer: records it at once so limits count it before it completes. */
export async function reserve(env, pay) {
  const d = await db(env), md = pay.metadata || {}, to = await userByName(d, md.to), fromU = await d.prepare('SELECT username FROM users WHERE uid = ?').bind(String(pay.user_uid)).first();
  await d.prepare('INSERT OR IGNORE INTO transfers (pid, from_uid, from_user, to_uid, to_user, amount, narr, status, ts) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(String(pay.identifier), String(pay.user_uid), fromU ? fromU.username : '', to ? to.uid : '', to ? to.username : String(md.to), String(round7(md.amt)), String(md.narr || '').slice(0, 80), 'approved', Date.now()).run();
}
/* Has this sender paid this recipient before? (to warn about first-time payees, a common scam pattern) */
export async function paidBefore(env, fromUid, toUid) {
  const r = await (await db(env)).prepare("SELECT 1 AS x FROM transfers WHERE from_uid = ? AND to_uid = ? AND status = 'paid' LIMIT 1").bind(String(fromUid), String(toUid)).first();
  return !!r;
}
/* Light abuse protection: at most `max` calls per hour per bucket from one network. The IP is never stored, only a salted one-way hash. */
export async function rateOk(env, request, bucket, max) {
  try {
    const d = env.HM_DB; if (!d) return true;
    await d.exec('CREATE TABLE IF NOT EXISTS rl (k TEXT PRIMARY KEY, n INTEGER, w INTEGER)');
    const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('x-forwarded-for') || 'x', w = Math.floor(Date.now() / 3600000);
    const h = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(bucket + '|' + ip + '|' + (env.PI_API_KEY || 'hm'))))].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
    await d.prepare('INSERT INTO rl (k, n, w) VALUES (?, 1, ?) ON CONFLICT(k) DO UPDATE SET n = CASE WHEN rl.w = excluded.w THEN rl.n + 1 ELSE 1 END, w = excluded.w').bind(bucket + ':' + h, w).run();
    const r = await d.prepare('SELECT n FROM rl WHERE k = ?').bind(bucket + ':' + h).first();
    if (Math.random() < 0.02) await d.prepare('DELETE FROM rl WHERE w < ?').bind(w - 1).run();
    return !r || r.n <= max;
  } catch (e) { return true; }
}
/* Tells Pi to cancel a payment Haramain refused, so it never blocks the user's next payment. */
export async function cancelPayment(env, pid) { try { await piApi(env, '/payments/' + encodeURIComponent(pid) + '/cancel', 'POST', {}); } catch (e) {} }

export async function piApi(env, path, method, body) {
  const r = await fetch(PI + path, { method: method || 'GET', headers: { Authorization: 'Key ' + env.PI_API_KEY, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  let d = null; try { d = await r.json(); } catch (e) {}
  return { ok: r.ok, status: r.status, d };
}
export async function me(token) {
  if (!token || String(token).length > 2000) return null;
  try { const r = await fetch(PI + '/me', { headers: { Authorization: 'Bearer ' + token } }); if (!r.ok) return null; const d = await r.json(); return d && d.uid && d.username ? { uid: String(d.uid), username: String(d.username) } : null; } catch (e) { return null; }
}
let migrated = false;
export async function db(env) {
  const d = env.HM_DB;
  await d.exec('CREATE TABLE IF NOT EXISTS users (uid TEXT PRIMARY KEY, username TEXT, ts INTEGER)');
  await d.exec('CREATE UNIQUE INDEX IF NOT EXISTS users_name ON users (username COLLATE NOCASE)');
  await d.exec('CREATE TABLE IF NOT EXISTS transfers (pid TEXT PRIMARY KEY, from_uid TEXT, from_user TEXT, to_uid TEXT, to_user TEXT, amount TEXT, narr TEXT, status TEXT, a2u_id TEXT, a2u_txid TEXT, to_addr TEXT, err TEXT, ts INTEGER, done_ts INTEGER)');
  if (!migrated) { for (const c of ['refund_id TEXT', 'refund_txid TEXT', 'refund_addr TEXT', 'tries INTEGER DEFAULT 0', 'fail_ts INTEGER']) { try { await d.exec('ALTER TABLE transfers ADD COLUMN ' + c); } catch (e) {} } migrated = true; }
  return d;
}
export async function userByName(d, name) { return d.prepare('SELECT uid, username FROM users WHERE username = ? COLLATE NOCASE').bind(String(name || '').replace(/^@/, '')).first(); }

/* Checks a transfer payment before Haramain approves it. Returns '' if fine, or the reason to refuse. */
export async function checkTransferPayment(env, pay) {
  if (!enabled(env)) return 'Transfers are not switched on';
  const md = (pay && pay.metadata) || {}, amt = round7(md.amt), paid = Number(pay && pay.amount);
  if (!(amt >= 0.01)) return 'The smallest transfer is 0.01 π';
  if (amt > maxTransfer(env)) return 'The most you can send at once is ' + maxTransfer(env) + ' π';
  if (!(paid + 1e-9 >= round7(amt + FEE))) return 'Payment does not cover the amount and fee';
  if (!USER_RE.test(String(md.to || ''))) return 'Bad recipient';
  const d = await db(env), to = await userByName(d, md.to);
  if (!to) return 'Recipient is not a Haramain user';
  if (to.uid === String(pay.user_uid)) return 'You cannot send to yourself';
  return '';
}

/* After the sender's payment is confirmed: deliver it to the recipient, or refund the sender. Automatic and idempotent:
   safe to call any number of times, from anywhere; each transfer ends exactly once, as 'paid' or 'refunded'. */
const STALE = 300000;            // a job left running this long is taken over (longer than a transaction's 180 s life on the blockchain)
const WAIT_UNCERTAIN = 200000;   // after an attempt whose result is unknown, wait until its transaction can no longer land
const REFUND_AFTER = { tries: 6, ms: 3600000 };   // delivery keeps failing: refund automatically
export function configured(env) { return !!env.APP_WALLET_SEED && !!env.PI_API_KEY && !!env.HM_DB; }
export async function payout(env, request, pid) {
  if (!/^[A-Za-z0-9_-]{6,80}$/.test(String(pid || ''))) return { ok: false, error: 'Bad payment id' };
  if (!configured(env)) return { ok: false, error: 'Transfers are not set up' };
  const d = await db(env), net = NET(isTest(request)), now = Date.now();
  const get = () => d.prepare('SELECT * FROM transfers WHERE pid = ?').bind(pid).first();
  let row = await get();
  if (row && (row.status === 'paid' || row.status === 'refunded')) return { ok: row.status === 'paid', refunded: row.status === 'refunded', row: pub(row, net) };

  // 1. The sender's payment must be real, ours, a transfer, and completed on the blockchain
  const u = await piApi(env, '/payments/' + encodeURIComponent(pid));
  if (!u.ok || !u.d) return { ok: false, error: 'Payment not found' };
  const pay = u.d, md = pay.metadata || {}, st = pay.status || {};
  if (md.type !== 'transfer') return { ok: false, error: 'Not a transfer' };
  if (!st.developer_completed || !st.transaction_verified || st.cancelled || st.user_cancelled) return { ok: false, error: 'The payment is not completed yet' };
  const to = await userByName(d, md.to), fromU = await d.prepare('SELECT username FROM users WHERE uid = ?').bind(String(pay.user_uid)).first();
  if (!row) {
    await d.prepare('INSERT OR IGNORE INTO transfers (pid, from_uid, from_user, to_uid, to_user, amount, narr, status, ts) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(pid, String(pay.user_uid), fromU ? fromU.username : '', to ? to.uid : '', to ? to.username : String(md.to), String(round7(md.amt)), String(md.narr || '').slice(0, 80), 'received', now - STALE).run();
    row = await get();
  }
  if (row.status === 'approved') { await d.prepare("UPDATE transfers SET status = 'received', ts = ? WHERE pid = ? AND status = 'approved'").bind(now - STALE, pid).run(); row = await get(); }

  // 2. Fixed rule: deliver if the transfer is still valid, otherwise (or if delivery keeps failing) refund
  const amt = round7(md.amt), paid = Number(pay.amount);
  const invalid = !to ? 'The recipient is no longer a Haramain user' : to.uid === String(pay.user_uid) ? 'Sender and recipient are the same' : !(amt >= 0.01) || paid + 1e-9 < round7(amt + FEE) ? 'Amounts do not match' : '';
  const refund = !!invalid || /^refund/.test(row.status) || ((row.tries || 0) >= REFUND_AFTER.tries && row.fail_ts && now - row.fail_ts > REFUND_AFTER.ms);
  const job = refund ? 'refunding' : 'paying';

  // 3. Take the job: one worker at a time, and never while an earlier attempt could still land on the blockchain
  const lock = await d.prepare("UPDATE transfers SET status = ?, ts = ?, err = NULL WHERE pid = ? AND (status IN ('received', 'refund_needed') OR (status IN ('failed', 'refund_failed') AND ts < ?) OR (status IN ('paying', 'refunding') AND ts < ?))")
    .bind(job, now, pid, now - WAIT_UNCERTAIN, now - STALE).run();
  if (!lock.meta || !lock.meta.changes) { row = await get(); return { ok: row.status === 'paid', refunded: row.status === 'refunded', pending: true, row: pub(row, net) }; }
  row = await get();

  const kp = await keypairFromSeed(String(env.APP_WALLET_SEED).trim());
  let sure = true;   // false once a transaction was sent and its result is unknown
  try {
    // Safety first: if an earlier payout reached the blockchain, it counts as paid — never pay twice, never refund a delivered transfer
    if (row.a2u_id) {
      const hash = await findTx(net, kp.address, row.a2u_id);
      if (hash) { await piApi(env, '/payments/' + encodeURIComponent(row.a2u_id) + '/complete', 'POST', { txid: hash }); return await finish(d, pid, 'paid', hash, row.to_addr, net); }
    }
    if (refund) {
      if (row.a2u_id) await piApi(env, '/payments/' + encodeURIComponent(row.a2u_id) + '/cancel', 'POST', {});
      const r = await sendA2U(env, net, kp, d, pid, row, { idCol: 'refund_id', addrCol: 'refund_addr', uid: row.from_uid, amount: round7(row.amount),
        memo: 'Haramain refund' + (row.to_user ? ' (to @' + row.to_user + ')' : ''), metadata: { type: 'transfer_refund', u2a: pid } }, () => { sure = false; });
      await d.prepare('UPDATE transfers SET err = ? WHERE pid = ?').bind(invalid || 'Delivery failed repeatedly', pid).run();
      return await finish(d, pid, 'refunded', r.hash, r.addr, net);
    }
    const r = await sendA2U(env, net, kp, d, pid, row, { idCol: 'a2u_id', addrCol: 'to_addr', uid: to.uid, amount: amt,
      memo: 'Haramain transfer' + (fromU ? ' from @' + fromU.username : ''), metadata: { type: 'transfer_out', u2a: pid } }, () => { sure = false; });
    return await finish(d, pid, 'paid', r.hash, r.addr, net);
  } catch (e) {
    // a clear refusal (nothing reached the blockchain) can be retried at once; an unknown result waits until it can no longer land
    const definite = sure || (e && e.definite);
    await d.prepare('UPDATE transfers SET status = ?, err = ?, tries = COALESCE(tries, 0) + 1, fail_ts = COALESCE(fail_ts, ?), ts = ? WHERE pid = ?')
      .bind(refund ? 'refund_failed' : 'failed', String(e && e.message || e).slice(0, 300), now, definite ? now - WAIT_UNCERTAIN - 1 : now, pid).run();
    return { ok: false, retry: true, error: refund ? 'The refund did not go through yet. Haramain will try again automatically.' : 'The payout did not go through yet. Haramain will try again automatically.' };
  }
}

/* Creates (or reuses) one A2U payment, checks the blockchain for it, then signs, submits and completes it. */
async function sendA2U(env, net, kp, d, pid, row, o, onSent) {
  let id = row[o.idCol], addr = row[o.addrCol];
  if (id) {
    const hash = await findTx(net, kp.address, id);
    if (hash) { await piApi(env, '/payments/' + encodeURIComponent(id) + '/complete', 'POST', { txid: hash }); return { hash, addr }; }
    const g = await piApi(env, '/payments/' + encodeURIComponent(id));
    if (g.ok && g.d) {
      const tx = g.d.transaction && g.d.transaction.txid;
      if (tx) { await piApi(env, '/payments/' + encodeURIComponent(id) + '/complete', 'POST', { txid: tx }); return { hash: tx, addr: g.d.to_address || addr }; }
      if (g.d.status && g.d.status.cancelled) id = null;
      else addr = g.d.to_address || addr;
    } else id = null;
  }
  if (!id) {
    const body = { payment: { amount: o.amount, memo: o.memo.slice(0, 60), metadata: o.metadata, uid: o.uid } };
    let c = await piApi(env, '/payments', 'POST', body);
    if (!c.ok && c.d && /ongoing|incomplete/i.test(JSON.stringify(c.d))) { await clearIncomplete(env, net, kp); c = await piApi(env, '/payments', 'POST', body); }
    if (!c.ok || !c.d || !c.d.identifier) throw new Error('Pi could not create the payment' + (c.d && c.d.error_message ? ': ' + c.d.error_message : ''));
    id = c.d.identifier; addr = c.d.to_address || c.d.recipient;
    await d.prepare('UPDATE transfers SET ' + o.idCol + ' = ?, ' + o.addrCol + ' = ? WHERE pid = ?').bind(id, addr, pid).run();
  }
  if (!addr) throw new Error('Wallet address unknown');
  accountToBytes(addr);
  const hash = await submitPayment(env, net, kp, addr, o.amount, id, onSent);
  await piApi(env, '/payments/' + encodeURIComponent(id) + '/complete', 'POST', { txid: hash });
  return { hash, addr };
}

async function submitPayment(env, net, kp, dest, amount, memo, onSent) {
  const acc = await fetch(net.horizon + '/accounts/' + kp.address); if (!acc.ok) throw new Error('App wallet not found on ' + net.name);
  const a = await acc.json();
  let fee = 100000; try { const f = await (await fetch(net.horizon + '/fee_stats')).json(); fee = Math.max(Number(f.last_ledger_base_fee) || 0, 100000); } catch (e) {}
  const { xdr } = await buildPayment({ kp, sequence: a.sequence, fee, destination: dest, amount: String(amount), memo, passphrase: net.passphrase });
  onSent && onSent();
  const r = await fetch(net.horizon + '/transactions', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'tx=' + encodeURIComponent(xdr) });
  const d = await r.json().catch(() => ({}));
  if (r.ok && d.hash) return d.hash;
  const codes = d && d.extras && d.extras.result_codes;
  const err = new Error('Blockchain refused the payment: ' + (codes ? JSON.stringify(codes) : r.status));
  err.definite = !!codes;   // the network rejected it: nothing was paid
  throw err;
}
/* Looks on the Pi blockchain for a payment from the app wallet carrying this memo (the A2U payment id). Fails closed. */
export async function findTx(net, from, memo) {
  const r = await fetch(net.horizon + '/accounts/' + from + '/transactions?order=desc&limit=200');
  if (r.status === 404) return '';
  if (!r.ok) throw new Error('Could not check the blockchain');
  const d = await r.json();
  const t = ((d._embedded && d._embedded.records) || []).find((x) => x.memo === memo && x.successful !== false);
  return t ? t.hash : '';
}
async function clearIncomplete(env, net, kp) {
  const r = await piApi(env, '/payments/incomplete_server_payments');
  const list = (r.d && (r.d.incomplete_server_payments || r.d)) || [];
  for (const p of Array.isArray(list) ? list : []) {
    const hash = (p.transaction && p.transaction.txid) || (await findTx(net, kp.address, p.identifier));
    if (hash) await piApi(env, '/payments/' + encodeURIComponent(p.identifier) + '/complete', 'POST', { txid: hash });
    else await piApi(env, '/payments/' + encodeURIComponent(p.identifier) + '/cancel', 'POST', {});
  }
}
async function finish(d, pid, status, txid, addr, net) {
  if (status === 'paid') await d.prepare("UPDATE transfers SET status = 'paid', a2u_txid = ?, to_addr = COALESCE(?, to_addr), done_ts = ?, err = NULL WHERE pid = ?").bind(txid || '', addr || null, Date.now(), pid).run();
  else await d.prepare("UPDATE transfers SET status = 'refunded', refund_txid = ?, refund_addr = COALESCE(?, refund_addr), done_ts = ? WHERE pid = ?").bind(txid || '', addr || null, Date.now(), pid).run();
  const row = await d.prepare('SELECT * FROM transfers WHERE pid = ?').bind(pid).first();
  return { ok: status === 'paid', refunded: status === 'refunded', row: pub(row, net) };
}
export function pub(r, net) {
  return r && { pid: r.pid, from: r.from_user, to: r.to_user, amount: Number(r.amount), narr: r.narr, status: r.status, txid: r.a2u_txid || '', to_addr: r.to_addr || '', refund_txid: r.refund_txid || '', refund_addr: r.refund_addr || '', ts: r.ts, done_ts: r.done_ts, net: net ? net.name : '' };
}
