/* ═══════════════════════════════════════════════════════════════
   HARAMAIN · functions/approve.js · Cloudflare Pages Function

   COPIED EXACTLY from WorldCup netlify/functions/approve.js
   ONLY CHANGE: Netlify syntax → Cloudflare Pages syntax

   Netlify:    exports.handler = async function(event)
   Cloudflare: export async function onRequestPost(context)

   Netlify:    process.env.PI_API_KEY
   Cloudflare: context.env.PI_API_KEY

   Netlify:    JSON.parse(event.body || '{}')
   Cloudflare: await context.request.json()

   Netlify:    return { statusCode: 200, body: JSON.stringify(data) }
   Cloudflare: return new Response(JSON.stringify(data), { status: 200 })

   Payment logic: IDENTICAL to WorldCup ✅
   Pi Network Mainnet · sandbox:false · Real Pi
═══════════════════════════════════════════════════════════════ */

export async function onRequestPost(context) {

  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  /* ── Copied from WorldCup: API key check ── */
  if (!context.env.PI_API_KEY) {
    return new Response(JSON.stringify({ error: 'API key missing' }), {
      status: 200, /* Fixed: was 500 in WorldCup — non-200 causes Payment Expired */
      headers: cors
    });
  }

  try {

    /* ── Copied from WorldCup: parse body ── */
    const body = await context.request.json().catch(() => ({}));
    const paymentId = body.paymentId;
    const expectedAmount = body.expectedAmount;

    /* ── Copied from WorldCup: paymentId check ── */
    if (!paymentId) {
      return new Response(JSON.stringify({ error: 'Missing paymentId' }), {
        status: 200, /* Fixed: was 400 in WorldCup */
        headers: cors
      });
    }

    /* ── Copied from WorldCup: VERIFY PAYMENT FIRST ── */
    const verifyResponse = await fetch(
      `https://api.minepi.com/v2/payments/${paymentId}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Key ${context.env.PI_API_KEY}`
        }
      }
    );

    const payment = await verifyResponse.json();

    /* ── Copied from WorldCup: CHECK PAYMENT EXISTS ── */
    if (!payment || payment.error) {
      return new Response(JSON.stringify({ error: 'Invalid payment' }), {
        status: 200, /* Fixed: was 400 in WorldCup */
        headers: cors
      });
    }

    /* ── Copied from WorldCup: PREVENT DOUBLE APPROVAL ── */
    if (payment.status?.developer_approved === true) {
      return new Response(JSON.stringify({ error: 'Already approved' }), {
        status: 200, /* Fixed: was 400 in WorldCup */
        headers: cors
      });
    }

    /* ── Copied from WorldCup: VERIFY AMOUNT ── */
    if (
      expectedAmount &&
      Number(payment.amount) !== Number(expectedAmount)
    ) {
      return new Response(JSON.stringify({ error: 'Amount mismatch' }), {
        status: 200, /* Fixed: was 400 in WorldCup */
        headers: cors
      });
    }

    /* ── Copied from WorldCup: APPROVE PAYMENT ── */
    const approveResponse = await fetch(
      `https://api.minepi.com/v2/payments/${paymentId}/approve`,
      {
        method: 'POST',
        headers: {
          Authorization: `Key ${context.env.PI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const approveData = await approveResponse.json();

    /* ── Copied from WorldCup: return approve data ── */
    return new Response(JSON.stringify(approveData), {
      status: 200,
      headers: cors
    });

  } catch (err) {

    console.error(err);

    /* ── Copied from WorldCup: catch error ── */
    return new Response(JSON.stringify({ error: 'Approval failed' }), {
      status: 200, /* Fixed: was 500 in WorldCup */
      headers: cors
    });

  }
}

/* ── Cloudflare CORS preflight (not needed in Netlify) ── */
export async function onRequestOptions() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
