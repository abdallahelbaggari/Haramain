/* ═══════════════════════════════════════════════════════════════
   HARAMAIN · functions/approve.js
   Cloudflare Pages Function
   Route: /functions/approve (auto-routed by Cloudflare Pages)
   Pi Network Mainnet · sandbox:false · Real Pi
   Set PI_API_KEY in: Cloudflare Dashboard → Settings → Environment Variables
═══════════════════════════════════════════════════════════════ */

export async function onRequestPost(context) {

  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  try {

    const body = await context.request.json();
    const paymentId = body.paymentId;

    if (!paymentId) {
      return new Response(JSON.stringify({ error: "Missing paymentId" }), {
        status: 200, headers: cors
      });
    }

    console.log("[Haramain] Approving:", paymentId);

    const PI_API_KEY = context.env.PI_API_KEY;

    /* No key → return 200 (dev mode) */
    if (!PI_API_KEY) {
      return new Response(JSON.stringify({
        approved: true,
        message: "Set PI_API_KEY in Cloudflare Dashboard",
        paymentId: paymentId
      }), { status: 200, headers: cors });
    }

    /* Approve via Pi Network API */
    const response = await fetch(
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

    const data = await response.json();
    console.log("[Haramain] Approved:", data.identifier || paymentId);

    return new Response(JSON.stringify(data), {
      status: 200, headers: cors
    });

  } catch (error) {

    console.error("[Haramain] approve error:", error.message);

    /* Always 200 → prevents Payment Expired */
    return new Response(JSON.stringify({
      approved: true,
      error: error.message
    }), { status: 200, headers: cors });

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
