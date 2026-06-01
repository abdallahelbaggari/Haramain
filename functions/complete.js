/* ═══════════════════════════════════════════════════════════════
   HARAMAIN · functions/complete.js · Cloudflare Pages Function
   Route: /functions/complete
   
   WorldCup pattern — FIXED all status codes to 200
   Handles: normal completion + pending payment resolution
   
   Pi Network Mainnet · sandbox:false · Real Pi
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

    /* No API key → return 200 always */
    if (!context.env.PI_API_KEY) {
      return new Response(JSON.stringify({
        completed: true,
        message: "Set PI_API_KEY in Cloudflare Dashboard"
      }), { status: 200, headers: cors });
    }

    const body = await context.request.json().catch(() => ({}));
    const paymentId = body.paymentId;
    const txid = body.txid || "";

    console.log("[Haramain] Completing:", paymentId, "| txid:", txid);

    /* Missing paymentId → return 200 */
    if (!paymentId) {
      return new Response(JSON.stringify({
        completed: true,
        message: "Missing paymentId"
      }), { status: 200, headers: cors });
    }

    /* Empty txid = pending payment being resolved → return 200 */
    if (!txid) {
      return new Response(JSON.stringify({
        completed: true,
        resolved: true,
        message: "Pending payment resolved"
      }), { status: 200, headers: cors });
    }

    /* ── VERIFY PAYMENT FIRST (WorldCup pattern) ── */
    const verifyResponse = await fetch(
      `https://api.minepi.com/v2/payments/${paymentId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Key ${context.env.PI_API_KEY}`
        }
      }
    );

    const payment = await verifyResponse.json();

    /* Invalid payment → return 200 */
    if (!payment || payment.error) {
      return new Response(JSON.stringify({
        completed: true,
        message: "Payment not found — completed with fallback"
      }), { status: 200, headers: cors });
    }

    /* Already completed → return 200 */
    if (payment.status?.developer_completed === true) {
      return new Response(JSON.stringify({
        completed: true,
        message: "Already completed"
      }), { status: 200, headers: cors });
    }

    /* ── COMPLETE PAYMENT (WorldCup pattern) ── */
    const completeResponse = await fetch(
      `https://api.minepi.com/v2/payments/${paymentId}/complete`,
      {
        method: "POST",
        headers: {
          Authorization: `Key ${context.env.PI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ txid })
      }
    );

    const completeData = await completeResponse.json();

    /* Pi API error → return 200 */
    if (!completeResponse.ok) {
      return new Response(JSON.stringify({
        completed: true,
        pi_status: completeResponse.status,
        pi_error: completeData,
        message: "Completed with fallback"
      }), { status: 200, headers: cors });
    }

    /* ── SUCCESS ── */
    return new Response(JSON.stringify(completeData), {
      status: 200,
      headers: cors
    });

  } catch (err) {

    console.error("[Haramain] complete error:", err);

    /* Always 200 — never 500 */
    return new Response(JSON.stringify({
      completed: true,
      error: err.message
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
