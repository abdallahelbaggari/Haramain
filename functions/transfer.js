// /transfer — in-app transfers between Haramain users.
//   GET  ?a=status                          → { enabled, max, fee } (is the feature switched on?)
//   POST {a:'payout', paymentId}            → pays the recipient for a completed transfer (idempotent; also run by /complete)
//   POST {a:'list', accessToken}            → the signed-in user's sent and received transfers
import { H, json, me, db, payout, pub, enabled, maxTransfer, FEE, isTest } from './_lib/transfers.js';
export async function onRequestGet({ request, env }) {
  return json({ ok: true, enabled: enabled(env), max: maxTransfer(env), fee: FEE, net: isTest(request) ? 'Pi Testnet' : 'Pi Mainnet' });
}
export async function onRequestPost({ request, env }) {
  const b = await request.json().catch(() => ({}));
  if (b.a === 'payout') return json(await payout(env, request, String(b.paymentId || '')));
  if (b.a === 'list') {
    if (!env.HM_DB) return json({ ok: false, setup: true });
    const u = await me(b.accessToken); if (!u) return json({ ok: false, error: 'Sign in with Pi first' });
    const d = await db(env), net = { name: isTest(request) ? 'Pi Testnet' : 'Pi Mainnet' };
    const r = await d.prepare('SELECT * FROM transfers WHERE from_uid = ? OR to_uid = ? ORDER BY ts DESC LIMIT 60').bind(u.uid, u.uid).all();
    return json({ ok: true, me: u.username, items: (r.results || []).map((x) => Object.assign(pub(x, net), { dir: x.to_uid === u.uid ? 'in' : 'out' })) });
  }
  return json({ ok: false, error: 'Unknown action' });
}
export async function onRequestOptions() { return new Response(null, { status: 204, headers: H }); }
