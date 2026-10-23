// Haramain in-app transfers: a sender pays Haramain (U2A, approved in Pi's own pop-up inside the app),
// then Haramain's app wallet pays the recipient (A2U, official Pi flow). Server-side only.
// Secrets (Cloudflare → Settings → Variables and Secrets): PI_API_KEY, APP_WALLET_SEED ('S…').
// Switch: TRANSFERS_ENABLED = 1. Optional: MAX_TRANSFER (π, default 500). D1 binding: HM_DB.
import { keypairFromSeed, buildPayment, accountToBytes } from './stellar.js';

export const FEE = 0.01;                 // added to the sender's payment, covers the payout's blockchain fee
const PI = 'https://api.minepi.com/v2';
export const H = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Cache-Control': 'no-store' };
export const json = (o) => new Response(JSON.stringify(o), { status: 200, headers: H });
export const isTest = (request) => /(^|[.-])testnet[.-]/i.test(new URL(request.url).hostname);
const NET = (t) => t ? { passphrase: 'Pi Testnet', horizon: 'https://api.testnet.minepi.com', name: 'Pi Testnet' } : { passphrase: 'Pi Network', horizon: 'https://api.mainnet.minepi.com', name: 'Pi Mainnet' };
export const USER_RE = /^[A-Za-z0-9_.-]{2,40}$/;
const round7 = (n) => Math.round(Number(n) * 1e7) / 1e7;

export function enabled(env) { return String(env.TRANSFERS_ENABLED || '') === '1' && !!env.APP_WALLET_SEED && !!env.PI_API_KEY && !!env.HM_DB; }
export function maxTransfer(env) { const m = Number(env.MAX_TRANSFER); return m > 0 ? m : 500; }

export async function piApi(env, path, method, body) {
  const r = await fetch(PI + path, { method: method || 'GET', headers: { Authorization: 'Key ' + env.PI_API_KEY, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  let d = null; try { d = await r.json(); } catch (e) {}
  return { ok: r.ok, status: r.status, d };
}
export async function me(token) {
  if (!token || String(token).length > 2000) return null;
  try { const r = await fetch(PI + '/me', { headers: { Authorization: 'Bearer ' + token } }); if (!r.ok) return null; const d = await r.json(); return d && d.uid && d.username ? { uid: String(d.uid), username: String(d.username) } : null; } catch (e) { return null; }
}
export async function db(env) {
  const d = env.HM_DB;
  await d.exec('CREATE TABLE IF NOT EXISTS users (uid TEXT PRIMARY KEY, username TEXT, ts INTEGER)');
  await d.exec('CREATE UNIQUE INDEX IF NOT EXISTS users_name ON users (username COLLATE NOCASE)');
  await d.exec('CREATE TABLE IF NOT EXISTS transfers (pid TEXT PRIMARY KEY, from_uid TEXT, from_user TEXT, to_uid TEXT, to_user TEXT, amount TEXT, narr TEXT, status TEXT, a2u_id TEXT, a2u_txid TEXT, to_addr TEXT, err TEXT, ts INTEGER, done_ts INTEGER)');
  return d;
}
export async function userByName(d, name) { return d.prepare('SELECT uid, username FROM users WHERE username = ? COLLATE NOCASE').bind(String(name || '').replace(/^@/, '')).first(); }

/* Checks a transfer payment before Haramain approves it. Returns '' if fine, or the reason to refuse. */
export async function checkTransferPayment(env, pay) {
  if (!enabled(env)) return 'Transfers are not switched on';
  const md = (pay && pay.metadata) || {}, amt = round7(md.amt), paid = Number(pay && pay.amount);
  if (!(amt >= 0.01) || amt > maxTransfer(env)) return 'Amount out of range';
  if (!(paid + 1e-9 >= round7(amt + FEE))) return 'Payment does not cover the amount and fee';
  if (!USER_RE.test(String(md.to || ''))) return 'Bad recipient';
  const d = await db(env), to = await userByName(d, md.to);
  if (!to) return 'Recipient is not a Haramain user';
  if (to.uid === String(pay.user_uid)) return 'You cannot send to yourself';
  return '';
}

/* Pays the recipient for a completed transfer payment. Safe to call many times: pays once. */
export async function payout(env, request, pid) {
  if (!/^[A-Za-z0-9_-]{6,80}$/.test(String(pid || ''))) return { ok: false, error: 'Bad payment id' };
  if (!enabled(env)) return { ok: false, error: 'Transfers are not switched on' };
  const d = await db(env), net = NET(isTest(request)), now = Date.now();
  let row = await d.prepare('SELECT * FROM transfers WHERE pid = ?').bind(pid).first();
  if (row && row.status === 'paid') return { ok: true, row: pub(row, net) };

  // 1. The sender's payment must be real, ours, a transfer, and completed on the blockchain
  const u = await piApi(env, '/payments/' + encodeURIComponent(pid));
  if (!u.ok || !u.d) return { ok: false, error: 'Payment not found' };
  const pay = u.d, md = pay.metadata || {}, st = pay.status || {};
  if (md.type !== 'transfer') return { ok: false, error: 'Not a transfer' };
  if (!st.developer_completed || !st.transaction_verified || st.cancelled || st.user_cancelled) return { ok: false, error: 'The payment is not completed yet' };
  const bad = await checkTransferPayment(env, pay);
  const to = await userByName(d, md.to), fromU = await d.prepare('SELECT username FROM users WHERE uid = ?').bind(String(pay.user_uid)).first();
  if (!row) {
    await d.prepare('INSERT OR IGNORE INTO transfers (pid, from_uid, from_user, to_uid, to_user, amount, narr, status, ts) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(pid, String(pay.user_uid), fromU ? fromU.username : '', to ? to.uid : '', to ? to.username : String(md.to), String(round7(md.amt)), String(md.narr || '').slice(0, 80), bad ? 'refund_needed' : 'received', now).run();
    row = await d.prepare('SELECT * FROM transfers WHERE pid = ?').bind(pid).first();
  }
  if (bad || row.status === 'refund_needed') return { ok: false, error: bad || 'Needs a refund', row: pub(row, net) };

  // 2. Take the job (one worker at a time per transfer)
  const lock = await d.prepare("UPDATE transfers SET status = 'paying', err = NULL WHERE pid = ? AND (status IN ('received', 'failed') OR (status = 'paying' AND ts < ?))").bind(pid, now - 120000).run();
  if (!lock.meta || !lock.meta.changes) { row = await d.prepare('SELECT * FROM transfers WHERE pid = ?').bind(pid).first(); return { ok: row.status === 'paid', pending: row.status === 'paying', row: pub(row, net) }; }
  await d.prepare('UPDATE transfers SET ts = ? WHERE pid = ?').bind(now, pid).run();

  try {
    // 3. The A2U payment (create once, reuse on retries)
    let a2u = row.a2u_id, toAddr = row.to_addr;
    if (a2u) {
      const g = await piApi(env, '/payments/' + encodeURIComponent(a2u));
      if (g.ok && g.d) {
        if (g.d.status && g.d.status.developer_completed) return await done(d, pid, g.d.transaction && g.d.transaction.txid, g.d.to_address || toAddr, net);
        if (g.d.transaction && g.d.transaction.txid) { await piApi(env, '/payments/' + encodeURIComponent(a2u) + '/complete', 'POST', { txid: g.d.transaction.txid }); return await done(d, pid, g.d.transaction.txid, g.d.to_address || toAddr, net); }
        toAddr = g.d.to_address || toAddr;
      }
    } else {
      const body = { payment: { amount: round7(md.amt), memo: ('Haramain transfer' + (fromU ? ' from @' + fromU.username : '')).slice(0, 60), metadata: { type: 'transfer_out', u2a: pid }, uid: to.uid } };
      let c = await piApi(env, '/payments', 'POST', body);
      if (!c.ok && c.d && /ongoing|incomplete/i.test(JSON.stringify(c.d))) { await clearIncomplete(env, net); c = await piApi(env, '/payments', 'POST', body); }
      if (!c.ok || !c.d || !c.d.identifier) throw new Error('Pi could not create the payout' + (c.d && c.d.error_message ? ': ' + c.d.error_message : ''));
      a2u = c.d.identifier; toAddr = c.d.to_address || c.d.recipient;
      await d.prepare('UPDATE transfers SET a2u_id = ?, to_addr = ? WHERE pid = ?').bind(a2u, toAddr, pid).run();
    }
    if (!toAddr) throw new Error('Recipient wallet unknown');
    accountToBytes(toAddr);
    // 4. Build, sign and submit from the app wallet
    const txid = await submitPayment(env, net, toAddr, round7(md.amt), a2u);
    // 5. Tell Pi it is done
    await piApi(env, '/payments/' + encodeURIComponent(a2u) + '/complete', 'POST', { txid });
    return await done(d, pid, txid, toAddr, net);
  } catch (e) {
    await d.prepare("UPDATE transfers SET status = 'failed', err = ? WHERE pid = ?").bind(String(e && e.message || e).slice(0, 300), pid).run();
    return { ok: false, retry: true, error: 'The payout did not go through yet. Haramain will try again.' };
  }
}

async function submitPayment(env, net, dest, amount, memo) {
  const kp = await keypairFromSeed(String(env.APP_WALLET_SEED).trim());
  const acc = await fetch(net.horizon + '/accounts/' + kp.address); if (!acc.ok) throw new Error('App wallet not found on ' + net.name);
  const a = await acc.json();
  let fee = 100000; try { const f = await (await fetch(net.horizon + '/fee_stats')).json(); fee = Math.max(Number(f.last_ledger_base_fee) || 0, 100000); } catch (e) {}
  const { xdr } = await buildPayment({ kp, sequence: a.sequence, fee, destination: dest, amount: String(amount), memo, passphrase: net.passphrase });
  const r = await fetch(net.horizon + '/transactions', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'tx=' + encodeURIComponent(xdr) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.hash) { const codes = d && d.extras && d.extras.result_codes ? JSON.stringify(d.extras.result_codes) : r.status; throw new Error('Blockchain refused the payout: ' + codes); }
  return d.hash;
}
async function clearIncomplete(env) {
  const r = await piApi(env, '/payments/incomplete_server_payments');
  const list = (r.d && (r.d.incomplete_server_payments || r.d)) || [];
  for (const p of Array.isArray(list) ? list : []) {
    if (p.transaction && p.transaction.txid) await piApi(env, '/payments/' + encodeURIComponent(p.identifier) + '/complete', 'POST', { txid: p.transaction.txid });
    else await piApi(env, '/payments/' + encodeURIComponent(p.identifier) + '/cancel', 'POST', {});
  }
}
async function done(d, pid, txid, toAddr, net) {
  await d.prepare("UPDATE transfers SET status = 'paid', a2u_txid = ?, to_addr = ?, done_ts = ?, err = NULL WHERE pid = ?").bind(txid || '', toAddr || '', Date.now(), pid).run();
  return { ok: true, row: pub(await d.prepare('SELECT * FROM transfers WHERE pid = ?').bind(pid).first(), net) };
}
export function pub(r, net) {
  return r && { pid: r.pid, from: r.from_user, to: r.to_user, amount: Number(r.amount), narr: r.narr, status: r.status, txid: r.a2u_txid || '', to_addr: r.to_addr || '', ts: r.ts, done_ts: r.done_ts, net: net ? net.name : '' };
}
