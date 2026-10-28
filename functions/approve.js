/* HARAMAIN · /approve · Cloudflare Pages Function
   Checks every Pi payment with Pi Network before approving it. Fails closed: if a payment cannot be checked,
   it is not approved, and any refused payment is cancelled at once so it never blocks the user's next payment.
   Secret: PI_API_KEY (Cloudflare → Settings → Variables and Secrets). */
import { checkTransferPayment, checkLimits, reserve, cancelPayment, rateOk } from './_lib/transfers.js';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const out = (o) => new Response(JSON.stringify(o), { status: 200, headers: cors });
const PRICES = { pilgrim_pass: 1, copa_pass: 1, spl_pass: 1, fan_pass: 1 };

/* Health check: is the server ready to approve payments? (never reveals anything about the key) */
export async function onRequestGet({ env }) { return out({ success: true, ready: !!env.PI_API_KEY }); }

export async function onRequestPost({ request, env }) {
  let b = {}; try { b = await request.json(); } catch (e) { return out({ approved: false, error: 'Bad request' }); }
  const pid = String(b.paymentId || '');
  if (!/^[A-Za-z0-9_-]{6,80}$/.test(pid)) return out({ approved: false, error: 'Invalid payment id' });
  if (!env.PI_API_KEY) return out({ approved: false, error: 'Payments are not switched on yet' });
  if (!(await rateOk(env, request, 'approve', 120))) return out({ approved: false, error: 'Too many attempts. Please wait a while and try again.' });
  const K = { Authorization: 'Key ' + env.PI_API_KEY };
  try {
    const chk = await fetch('https://api.minepi.com/v2/payments/' + encodeURIComponent(pid), { headers: K });
    if (!chk.ok) return out({ approved: false, error: 'Pi could not confirm this payment. Please try again.' });
    const pay = await chk.json(), md = (pay && pay.metadata) || {}, st = (pay && pay.status) || {}, amt = Number(pay && pay.amount);
    if (st.developer_approved) return out({ approved: true, step: 'already_approved' });
    if (st.cancelled || st.user_cancelled) return out({ approved: false, error: 'This payment was cancelled' });
    let why = '';
    if (!(amt > 0) || amt > 100000) why = 'Payment amount is not valid';
    else if (PRICES[md.type] && amt + 1e-9 < PRICES[md.type]) why = 'Payment amount does not match the price';
    else if (md.type === 'transfer') why = (await checkTransferPayment(env, pay, request)) || (await checkLimits(env, pay));
    if (why) { await cancelPayment(env, pid); return out({ approved: false, error: why }); }
    if (md.type === 'transfer') await reserve(env, pay);
    const r = await fetch('https://api.minepi.com/v2/payments/' + encodeURIComponent(pid) + '/approve', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, K), body: '{}' });
    return out({ approved: r.ok, pi_status: r.status });
  } catch (e) {
    console.error('approve failed', pid, e && e.message);
    await cancelPayment(env, pid);
    return out({ approved: false, error: 'Could not check this payment. Please try again.' });
  }
}

export async function onRequestOptions() { return new Response(null, { status: 204, headers: cors }); }
