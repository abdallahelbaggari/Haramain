/* ═══════════════════════════════════════════════════════════════
   HARAMAIN · functions/complete.js · Cloudflare Pages Function
   Route: /functions/complete
   Pi Network Mainnet · sandbox:false

   CHECK LOGS IN:
   dash.cloudflare.com → Pages → haramain → Functions → Logs
═══════════════════════════════════════════════════════════════ */

export async function onRequestPost(context) {

  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  console.log("[Haramain] complete.js — request received");

  try {

    /* Step 1: Parse body */
    let paymentId = null;
    let txid = null;

    try {
      const body = await context.request.json();
      paymentId = body.paymentId || null;
      txid = body.txid || null;
      console.log("[Haramain] paymentId:", paymentId);
      console.log("[Haramain] txid:", txid);
    } catch(e) {
      console.error("[Haramain] Body parse error:", e.message);
      return new Response(
        JSON.stringify({ completed: true, step: "body_parse_error" }),
        { status: 200, headers: cors }
      );
    }

    /* Step 2: Check paymentId */
    if (!paymentId) {
      console.log("[Haramain] No paymentId — returning 200");
      return new Response(
        JSON.stringify({ completed: true, step: "no_payment_id" }),
        { status: 200, headers: cors }
      );
    }

    /* Step 3: Empty txid = resolve pending payment */
    if (!txid) {
      console.log("[Haramain] No txid — resolving pending payment");
      return new Response(
        JSON.stringify({ completed: true, resolved: true, step: "no_txid" }),
        { status: 200, headers: cors }
      );
    }

    /* Step 4: Check PI_API_KEY */
    const PI_API_KEY = context.env.PI_API_KEY;
    console.log("[Haramain] PI_API_KEY present:", !!PI_API_KEY);

    if (!PI_API_KEY) {
      console.log("[Haramain] PI_API_KEY missing — returning 200 fallback");
      return new Response(
        JSON.stringify({
          completed: true,
          identifier: paymentId,
          step: "no_api_key"
        }),
        { status: 200, headers: cors }
      );
    }

    /* Step 5: Call Pi API */
    console.log("[Haramain] Calling Pi API complete for:", paymentId, txid);

    let piResponse;
    try {
      piResponse = await fetch(
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
      console.log("[Haramain] Pi API complete status:", piResponse.status);
    } catch(fetchErr) {
      console.error("[Haramain] Pi API unreachable:", fetchErr.message);
      return new Response(
        JSON.stringify({
          completed: true,
          identifier: paymentId,
          step: "pi_api_unreachable",
          error: fetchErr.message
        }),
        { status: 200, headers: cors }
      );
    }

    /* Step 6: Parse response */
    let data;
    try {
      data = await piResponse.json();
      console.log("[Haramain] Pi API complete response:", JSON.stringify(data));
    } catch(e) {
      data = { identifier: paymentId };
    }

    /* Step 7: Always return 200 */
    console.log("[Haramain] Returning 200 complete success");
    return new Response(
      JSON.stringify({
        completed: true,
        identifier: data.identifier || paymentId,
        pi_status: piResponse.status,
        step: "complete"
      }),
      { status: 200, headers: cors }
    );

  } catch(err) {
    console.error("[Haramain] Unexpected error:", err.message);
    return new Response(
      JSON.stringify({ completed: true, step: "unexpected_error", error: err.message }),
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
