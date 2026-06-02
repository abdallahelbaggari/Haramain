/* ═══════════════════════════════════════════════════════════════
   HARAMAIN · functions/approve.js · Cloudflare Pages Function
   Route: /functions/approve
   Pi Network Mainnet · sandbox:false

   DEBUG VERSION — logs everything including raw Pi API response
   Check logs: dash.cloudflare.com → Pages → haramain → Observability → Logs
═══════════════════════════════════════════════════════════════ */

export async function onRequestPost(context) {

  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  console.log("[Haramain] approve.js called");

  try {

    /* Step 1: Parse body */
    let paymentId = null;
    let expectedAmount = null;

    try {
      const body = await context.request.json();
      paymentId = body.paymentId || null;
      expectedAmount = body.expectedAmount || null;
      console.log("[Haramain] paymentId:", paymentId);
      console.log("[Haramain] expectedAmount:", expectedAmount);
    } catch(e) {
      console.error("[Haramain] Body parse error:", e.message);
      return new Response(
        JSON.stringify({ approved: true, step: "body_parse_error" }),
        { status: 200, headers: cors }
      );
    }

    /* Step 2: Validate paymentId */
    if (!paymentId) {
      console.log("[Haramain] No paymentId received");
      return new Response(
        JSON.stringify({ approved: true, step: "no_payment_id" }),
        { status: 200, headers: cors }
      );
    }

    /* Step 3: Check PI_API_KEY */
    const PI_API_KEY = context.env.PI_API_KEY;
    console.log("[Haramain] PI_API_KEY present:", !!PI_API_KEY);
    console.log("[Haramain] PI_API_KEY length:", PI_API_KEY ? PI_API_KEY.length : 0);
    console.log("[Haramain] PI_API_KEY prefix:", PI_API_KEY ? PI_API_KEY.substring(0, 8) + "..." : "MISSING");

    if (!PI_API_KEY) {
      console.log("[Haramain] PI_API_KEY missing — set in Cloudflare Dashboard");
      return new Response(
        JSON.stringify({ approved: true, step: "no_api_key" }),
        { status: 200, headers: cors }
      );
    }

    /* Step 4: GET payment first to check state */
    console.log("[Haramain] Getting payment state from Pi API...");
    try {
      const getResponse = await fetch(
        `https://api.minepi.com/v2/payments/${paymentId}`,
        {
          method: "GET",
          headers: {
            "Authorization": `Key ${PI_API_KEY}`
          }
        }
      );
      const getStatus = getResponse.status;
      const getText = await getResponse.text();
      console.log("[Haramain] GET payment status:", getStatus);
      console.log("[Haramain] GET payment raw:", getText);
    } catch(getErr) {
      console.error("[Haramain] GET payment error:", getErr.message);
    }

    /* Step 5: POST approve */
    console.log("[Haramain] Calling Pi API approve...");
    const piResponse = await fetch(
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

    /* Step 6: Log raw response using .text() */
    const piStatus = piResponse.status;
    const piRaw = await piResponse.text();

    console.log("[Haramain] Pi API status:", piStatus);
    console.log("[Haramain] Pi API raw:", piRaw);

    /* Step 7: Always return 200 to Pi SDK */
    return new Response(
      JSON.stringify({
        approved: true,
        pi_status: piStatus,
        pi_response: piRaw
      }),
      { status: 200, headers: cors }
    );

  } catch(err) {
    console.error("[Haramain] Unexpected error:", err.message);
    console.error("[Haramain] Stack:", err.stack);
    return new Response(
      JSON.stringify({ approved: true, error: err.message }),
      { status: 200, headers: cors }
    );
  }
}

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
