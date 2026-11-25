// /transfer — in-app transfers between Haramain users.
//   GET  ?a=check-setup                     → setup self-test (yes/no only, never a secret), shown on /setup.html
//   GET  ?a=status                          → { enabled, max, fee, payments } (are transfers / payments switched on?)
//   POST {a:'payout', paymentId}            → pays the recipient for a completed transfer (idempotent; also run by /complete)
//   POST {a:'list', accessToken}            → the signed-in user's sent and received transfers
//   POST {a:'check', accessToken, to, amt}  → would this transfer be accepted? (limits, holds, first-time payee) before the Pi pop-up opens
import { keypairFromSeed } from './_lib/stellar.js';
import { H, json, me, db, payout, pub, enabled, maxTransfer, FEE, isTest, limits, rateOk, checkTransferPayment, checkLimits, userByName, paidBefore, USER_RE, walletReady } from './_lib/transfers.js';
export async function onRequestGet({ request, env }) {
  if (new URL(request.url).searchParams.get('a') === 'check-setup') return json({ ok: true, check: await checkSetup(env, request) });
  const live = enabled(env) && (await walletReady(env, request)).ok;
  return json({ ok: true, payments: !!env.PI_API_KEY, enabled: live, max: maxTransfer(env), daily: limits(env).day, fee: FEE, net: isTest(request) ? 'Pi Testnet' : 'Pi Mainnet' });
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
    const why = (await checkTransferPayment(env, pay, request)) || (await checkLimits(env, pay));
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

/* Setup self-test for the app owner: yes/no answers only, never any secret or balance. */
async function checkSetup(env, request) {
  const test = isTest(request), net = test ? 'Pi Testnet' : 'Pi Mainnet', horizon = test ? 'https://api.testnet.minepi.com' : 'https://api.mainnet.minepi.com';
  const seed = String(env.APP_WALLET_SEED || '').trim();
  const r = { net, pi_api_key: !!String(env.PI_API_KEY || '').trim(), app_wallet_seed: /^S[A-Z2-7]{55}$/.test(seed), seed_raw_present: !!seed, seed_looks_like_address: /^G[A-Z2-7]{55}$/.test(seed),
    database: !!env.HM_DB, paused: String(env.TRANSFERS_ENABLED || '').trim() === '0',
    variable_names: Object.keys(env).filter((k) => typeof env[k] === 'string' && /^[A-Z0-9_]{2,64}$/i.test(k)).sort() };
  if (r.pi_api_key) { try { const t = await fetch('https://api.minepi.com/v2/payments/incomplete_server_payments', { headers: { Authorization: 'Key ' + String(env.PI_API_KEY).trim() } }); r.pi_api_key_accepted = t.ok; try { const j = await t.clone().json(); const L = j && (j.incomplete_server_payments || j); r.incomplete_server = Array.isArray(L) ? L.length : null; } catch (e) {} r.pi_api_key_status = t.status; } catch (e) { r.pi_api_key_accepted = false; } }
  if (r.app_wallet_seed) { try { const kp = await keypairFromSeed(seed); r.app_wallet_address = kp.address; const ar = await fetch(horizon + '/accounts/' + kp.address); r.app_wallet_found = ar.ok; if (ar.ok) { try { const a = await ar.json(); const b = (a.balances || []).filter((x) => x.asset_type === 'native')[0]; r.app_wallet_balance = b ? Number(b.balance) : null; } catch (e) {} } } catch (e) { r.app_wallet_found = false; } }
  if (r.database) { try { const dd = await db(env); await dd.prepare('SELECT 1 AS x').first(); r.database_works = true; try { const q = await dd.prepare('SELECT status, err, tries, ts FROM transfers ORDER BY ts DESC LIMIT 5').all(); r.recent = (q.results || []).map((x) => ({ status: x.status, err: x.err ? String(x.err).slice(0, 160) : '', tries: x.tries || 0, min: Math.max(0, Math.round((Date.now() - Number(x.ts || 0)) / 60000)) })); } catch (e) {} } catch (e) { r.database_works = false; } }
  r.ready = enabled(env) && r.pi_api_key_accepted !== false && r.app_wallet_found !== false && r.database_works !== false;
  return r;
}
