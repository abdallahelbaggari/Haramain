/* ═══════════════════════════════════════════════════════════════
   HARAMAIN · functions/complete.js · Cloudflare Pages Function

   Route: /functions/complete
   Test:  https://haramain.pages.dev/functions/complete (GET)

   Pi Network Mainnet · sandbox:false
═══════════════════════════════════════════════════════════════ */

/* GET: health check */
export async function onRequestGet(context) {
  const key = context.env.PI_API_KEY;
  return new Response(
    JSON.stringify({
      success: true,
      message: "complete.js is working",
      route: "/functions/complete",
      pi_api_key_present: !!key
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    }
  );
}

/* POST: complete payment */
export async function onRequestPost(context) {

  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };

  console.log("[Haramain] complete.js POST called");

  try {

    let paymentId = null;
    let txid = null;
    try {
      const body = await context.request.json();
      paymentId = body.paymentId || null;
      txid = body.txid || null;
    } catch(e) {
      console.error("[Haramain] Body parse error:", e.message);
      return new Response(JSON.stringify({ completed: true, step: "body_parse_error" }), { status: 200, headers: cors });
    }

    console.log("[Haramain] paymentId:", paymentId);
    console.log("[Haramain] txid:", txid);

    if (!paymentId) {
      return new Response(JSON.stringify({ completed: true, step: "no_payment_id" }), { status: 200, headers: cors });
    }

    if (!txid) {
      console.log("[Haramain] No txid — resolving pending payment");
      return new Response(JSON.stringify({ completed: true, resolved: true, step: "no_txid" }), { status: 200, headers: cors });
    }

    const PI_API_KEY = context.env.PI_API_KEY;
    console.log("[Haramain] PI_API_KEY present:", !!PI_API_KEY);

    if (!PI_API_KEY) {
      return new Response(JSON.stringify({ completed: true, step: "no_api_key" }), { status: 200, headers: cors });
    }

    /* POST complete — use .text() */
    const piRes = await fetch(
      `https://api.minepi.com/v2/payments/${paymentId}/complete`,
      {
        method: "POST",
        headers: {
          "Authorization": `Key ${PI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ txid: txid })
      }
    );

    const piStatus = piRes.status;
    const piRaw = await piRes.text();

    console.log("[Haramain] complete status:", piStatus);
    console.log("[Haramain] complete raw:", piRaw);

    return new Response(
      JSON.stringify({ completed: true, pi_status: piStatus, pi_response: piRaw }),
      { status: 200, headers: cors }
    );

  } catch(err) {
    console.error("[Haramain] Error:", err.message);
    return new Response(JSON.stringify({ completed: true, error: err.message }), { status: 200, headers: cors });
  }
}

/* OPTIONS: CORS preflight */
export async function onRequestOptions() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
