/* ═══════════════════════════════════════════════════════════════
   HARAMAIN · functions/approve.js · Cloudflare Pages Function

   Route: /functions/approve
   Test:  https://haramain.pages.dev/functions/approve (GET)
   
   Pi Network Mainnet · sandbox:false
   PI_API_KEY: Cloudflare → Settings → Variables → Secret
═══════════════════════════════════════════════════════════════ */

/* GET: health check
   Visit https://haramain.pages.dev/functions/approve in browser
   Should return { success: true, pi_api_key_present: true }
*/
export async function onRequestGet(context) {
  const key = context.env.PI_API_KEY;
  return new Response(
    JSON.stringify({
      success: true,
      message: "approve.js is working",
      route: "/functions/approve",
      pi_api_key_present: !!key,
      pi_api_key_length: key ? key.length : 0,
      pi_api_key_prefix: key ? key.substring(0, 8) + "..." : "MISSING — set in Cloudflare Dashboard"
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    }
  );
}

/* POST: approve payment */
export async function onRequestPost(context) {

  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };

  console.log("[Haramain] approve.js POST called");

  try {

    /* Parse body */
    let paymentId = null;
    let expectedAmount = null;
    try {
      const body = await context.request.json();
      paymentId = body.paymentId || null;
      expectedAmount = body.expectedAmount || null;
    } catch(e) {
      console.error("[Haramain] Body parse error:", e.message);
      return new Response(JSON.stringify({ approved: true, step: "body_parse_error" }), { status: 200, headers: cors });
    }

    console.log("[Haramain] paymentId:", paymentId);
    console.log("[Haramain] expectedAmount:", expectedAmount);

    if (!paymentId) {
      console.log("[Haramain] No paymentId");
      return new Response(JSON.stringify({ approved: true, step: "no_payment_id" }), { status: 200, headers: cors });
    }

    /* Check API key */
    const PI_API_KEY = context.env.PI_API_KEY;
    console.log("[Haramain] PI_API_KEY present:", !!PI_API_KEY);
    console.log("[Haramain] PI_API_KEY length:", PI_API_KEY ? PI_API_KEY.length : 0);

    if (!PI_API_KEY) {
      console.log("[Haramain] PI_API_KEY MISSING — set in Cloudflare Dashboard");
      return new Response(JSON.stringify({ approved: true, step: "no_api_key" }), { status: 200, headers: cors });
    }

    /* GET payment state */
    console.log("[Haramain] GET payment state...");
    try {
      const getRes = await fetch(`https://api.minepi.com/v2/payments/${paymentId}`, {
        method: "GET",
        headers: { "Authorization": `Key ${PI_API_KEY}` }
      });
      const getRaw = await getRes.text();
      console.log("[Haramain] GET status:", getRes.status);
      console.log("[Haramain] GET raw:", getRaw);
    } catch(e) {
      console.error("[Haramain] GET error:", e.message);
    }

    /* POST approve — use .text() to capture full response */
    console.log("[Haramain] POST approve...");
    const piRes = await fetch(
      `https://api.minepi.com/v2/payments/${paymentId}/approve`,
      {
        method: "POST",
        headers: {
          "Authorization": `Key ${PI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({})
      }
    );

    const piStatus = piRes.status;
    const piRaw = await piRes.text();

    console.log("[Haramain] POST approve status:", piStatus);
    console.log("[Haramain] POST approve raw:", piRaw);

    /* Always return 200 to Pi SDK */
    return new Response(
      JSON.stringify({ approved: true, pi_status: piStatus, pi_response: piRaw }),
      { status: 200, headers: cors }
    );

  } catch(err) {
    console.error("[Haramain] Error:", err.message);
    return new Response(JSON.stringify({ approved: true, error: err.message }), { status: 200, headers: cors });
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
