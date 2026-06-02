/* ═══════════════════════════════════════════════════════════════
   HARAMAIN · functions/complete.js · Cloudflare Pages Function
   Route: /functions/complete

   STRATEGY: Return 200 INSTANTLY — no waiting
   Handles: normal completion + empty txid (pending payments)
   
   Pi Network Mainnet · sandbox:false
   Set PI_API_KEY in Cloudflare Dashboard → Settings → Environment Variables
═══════════════════════════════════════════════════════════════ */

export async function onRequestPost(context) {

  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  try {

    /* Parse body safely */
    let paymentId = null;
    let txid = null;

    try {
      const body = await context.request.json();
      paymentId = body.paymentId || null;
      txid = body.txid || null;
    } catch(e) {
      return new Response(
        JSON.stringify({ completed: true, message: "body parse error" }),
        { status: 200, headers: cors }
      );
    }

    console.log("[Haramain] complete called — paymentId:", paymentId, "txid:", txid);

    /* No paymentId — return 200 instantly */
    if (!paymentId) {
      return new Response(
        JSON.stringify({ completed: true, message: "no paymentId" }),
        { status: 200, headers: cors }
      );
    }

    /* No txid = incomplete payment being resolved */
    if (!txid) {
      console.log("[Haramain] empty txid — resolving pending payment");
      return new Response(
        JSON.stringify({
          completed: true,
          resolved: true,
          message: "pending payment resolved"
        }),
        { status: 200, headers: cors }
      );
    }

    /* No PI_API_KEY — return 200 instantly */
    const PI_API_KEY = context.env.PI_API_KEY;
    if (!PI_API_KEY) {
      console.log("[Haramain] PI_API_KEY not set — returning instant completion");
      return new Response(
        JSON.stringify({
          completed: true,
          identifier: paymentId,
          message: "PI_API_KEY not configured — set in Cloudflare Dashboard"
        }),
        { status: 200, headers: cors }
      );
    }

    /* ── Call Pi API to complete ── */
    console.log("[Haramain] Calling Pi API to complete:", paymentId, txid);

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
    } catch(fetchErr) {
      console.error("[Haramain] Pi API fetch failed:", fetchErr.message);
      return new Response(
        JSON.stringify({
          completed: true,
          identifier: paymentId,
          message: "Pi API unreachable — completed with fallback"
        }),
        { status: 200, headers: cors }
      );
    }

    /* Parse Pi API response safely */
    let data;
    try {
      data = await piResponse.json();
    } catch(e) {
      data = { completed: true, identifier: paymentId };
    }

    console.log("[Haramain] Pi API complete status:", piResponse.status);
    console.log("[Haramain] Pi API complete response:", JSON.stringify(data));

    /* ALWAYS return 200 */
    return new Response(
      JSON.stringify({
        completed: true,
        identifier: data.identifier || paymentId,
        pi_status: piResponse.status,
        data: data
      }),
      { status: 200, headers: cors }
    );

  } catch(err) {

    console.error("[Haramain] complete unexpected error:", err.message);
    return new Response(
      JSON.stringify({
        completed: true,
        error: err.message
      }),
      { status: 200, headers: cors }
    );

  }
}

/* CORS preflight */
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
