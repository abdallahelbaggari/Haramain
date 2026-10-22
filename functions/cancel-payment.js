// HARAMAIN — /cancel-payment  (Cloudflare Pages Function)
// Clears an unfinished Pi payment so the pilgrim can pay again.
// It first asks Pi for the payment's real state, then:
//   • already on the blockchain (has a txid)  → completes it (the user paid, so we finish it)
//   • already completed or cancelled          → nothing to do
//   • not paid and older than 2 minutes       → cancels it (no Pi was taken)
// Always returns HTTP 200 with { ok, action, detail }.

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store'
};
const json = (o) => new Response(JSON.stringify(o), { status: 200, headers: cors });
const PI = 'https://api.minepi.com/v2/payments/';

async function pi(key, path, method, body) {
  const r = await fetch(PI + path, {
    method: method || 'GET',
    headers: { 'Authorization': `Key ${key}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await r.text();
  let data = null; try { data = JSON.parse(text); } catch (e) {}
  return { ok: r.ok, status: r.status, data, text: text.slice(0, 300) };
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json().catch(() => ({}));
    const paymentId = String(body.paymentId || '');
    if (!/^[A-Za-z0-9_-]{6,128}$/.test(paymentId)) return json({ ok: false, error: 'Invalid paymentId' });
    const key = context.env.PI_API_KEY ? String(context.env.PI_API_KEY).trim() : '';
    if (!key) return json({ ok: false, error: 'PI_API_KEY not set' });

    const look = await pi(key, encodeURIComponent(paymentId));
    if (!look.ok) return json({ ok: false, action: 'lookup', status: look.status, detail: look.text });
    const p = look.data || {}, st = p.status || {};
    const txid = (p.transaction && p.transaction.txid) || '';

    if (st.developer_completed) return json({ ok: true, action: 'none', detail: 'Payment was already completed' });
    if (st.cancelled || st.user_cancelled) return json({ ok: true, action: 'none', detail: 'Payment was already cancelled' });

    if (txid) {
      const r = await pi(key, encodeURIComponent(paymentId) + '/complete', 'POST', { txid });
      return json({ ok: r.ok, action: 'complete', status: r.status, detail: r.ok ? 'Payment completed' : r.text });
    }

    // don't interrupt a payment someone is making right now
    const created = Date.parse(p.created_at || '') || 0;
    if (created && Date.now() - created < 2 * 60 * 1000) return json({ ok: false, action: 'wait', detail: 'Payment is still in progress' });

    const r = await pi(key, encodeURIComponent(paymentId) + '/cancel', 'POST', {});
    return json({ ok: r.ok, action: 'cancel', status: r.status, detail: r.ok ? 'Payment cancelled' : r.text });
  } catch (err) {
    return json({ ok: false, error: String((err && err.message) || err) });
  }
}

export async function onRequestGet() {
  return json({ ok: true, endpoint: '/cancel-payment', app: 'HARAMAIN' });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: cors });
}
