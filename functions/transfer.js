// /transfer — in-app transfers between Haramain users.
//   GET  ?a=status                          → { enabled, max, fee, payments } (are transfers / payments switched on?)
//   POST {a:'payout', paymentId}            → pays the recipient for a completed transfer (idempotent; also run by /complete)
//   POST {a:'list', accessToken}            → the signed-in user's sent and received transfers
//   POST {a:'check', accessToken, to, amt}  → would this transfer be accepted? (limits, holds, first-time payee) before the Pi pop-up opens
import { H, json, me, db, payout, pub, enabled, maxTransfer, FEE, isTest, limits, rateOk, checkTransferPayment, checkLimits, userByName, paidBefore, USER_RE } from './_lib/transfers.js';
export async function onRequestGet({ request, env }) {
  return json({ ok: true, payments: !!env.PI_API_KEY, enabled: enabled(env), max: maxTransfer(env), daily: limits(env).day, fee: FEE, net: isTest(request) ? 'Pi Testnet' : 'Pi Mainnet' });
}
export async function onRequestPost({ request, env }) {
  const b = await request.json().catch(() => ({}));
  if (b.a === 'payout') {
    if (!(await rateOk(env, request, 'payout', 300))) return json({ ok: false, retry: true, error: 'Busy, trying again shortly' });
    return json(await payout(env, request, String(b.paymentId || '')));
  }
  if (b.a === 'check') {
    if (!(await rateOk(env, request, 'check', 120))) return json({ ok: false, error: 'Too many attempts. Please wait a while and try again.' });
    if (!enabled(env)) return json({ ok: false, error: 'Sending Pi is not available right now' });
    const u = await me(b.accessToken); if (!u) return json({ ok: false, error: 'Sign in with Pi first' });
    const to = String(b.to || '').replace(/^@/, ''), amt = Math.round(Number(b.amt) * 1e7) / 1e7;
    if (!USER_RE.test(to) || !(amt > 0)) return json({ ok: false, error: 'Check the username and amount' });
    const pay = { identifier: '', user_uid: u.uid, amount: Math.round((amt + FEE) * 1e7) / 1e7, metadata: { type: 'transfer', to, amt } };
    const why = (await checkTransferPayment(env, pay)) || (await checkLimits(env, pay));
    if (why) return json({ ok: false, error: why });
    const r = await userByName(await db(env), to);
    return json({ ok: true, to: r.username, first: !(await paidBefore(env, u.uid, r.uid)) });
  }
  if (b.a === 'list') {
    if (!(await rateOk(env, request, 'list', 240))) return json({ ok: false, error: 'Busy' });
    if (!env.HM_DB) return json({ ok: false, setup: true });
    const u = await me(b.accessToken); if (!u) return json({ ok: false, error: 'Sign in with Pi first' });
    const d = await db(env), net = { name: isTest(request) ? 'Pi Testnet' : 'Pi Mainnet' };
    const r = await d.prepare('SELECT * FROM transfers WHERE from_uid = ? OR to_uid = ? ORDER BY ts DESC LIMIT 60').bind(u.uid, u.uid).all();
    return json({ ok: true, me: u.username, items: (r.results || []).map((x) => Object.assign(pub(x, net), { dir: x.to_uid === u.uid ? 'in' : 'out' })) });
  }
  return json({ ok: false, error: 'Unknown action' });
}
export async function onRequestOptions() { return new Response(null, { status: 204, headers: H }); }
