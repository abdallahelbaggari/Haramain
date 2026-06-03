/* ═══════════════════════════════════════════════════════════════
   HARAMAIN · functions/complete.js · Cloudflare Pages Function
   Route: /functions/complete
   Test:  https://haramain.pages.dev/functions/complete (GET)
   Pi Network Mainnet · sandbox:false
═══════════════════════════════════════════════════════════════ */

export async function onRequestGet(context) {
  const key = context.env.PI_API_KEY;
  return new Response(
    JSON.stringify({
      success: true,
      message: "complete.js is working",
      route: "/functions/complete",
      pi_api_key_present: !!key,
      pi_api_key_length: key ? key.length : 0,
      pi_api_key_prefix: key ? key.substring(0, 8) + "..." : "MISSING"
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

export async function onRequestPost(context) {

  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };

  console.log("[Haramain] complete.js POST called");

  try {

    const body = await context.request.json();
    const paymentId = body.paymentId;
    const txid = body.txid;

    console.log("[Haramain] paymentId:", paymentId);
    console.log("[Haramain] txid:", txid);

    /* Return 400 so failures are visible in logs */
    if (!paymentId || !txid) {
      return new Response(
        JSON.stringify({
          completed: false,
          error: "missing paymentId or txid"
        }),
        { status: 400, headers: cors }
      );
    }

    const PI_API_KEY = context.env.PI_API_KEY;
    console.log("[Haramain] PI_API_KEY present:", !!PI_API_KEY);
    console.log("[Haramain] PI_API_KEY length:", PI_API_KEY ? PI_API_KEY.length : 0);

    if (!PI_API_KEY) {
      return new Response(
        JSON.stringify({ completed: false, error: "PI_API_KEY missing in Cloudflare" }),
        { status: 500, headers: cors }
      );
    }

    const res = await fetch(
      `https://api.minepi.com/v2/payments/${paymentId}/complete`,
      {
        method: "POST",
        headers: {
          "Authorization": `Key ${PI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ txid })
      }
    );

    const text = await res.text();

    console.log("[Haramain] complete status:", res.status);
    console.log("[Haramain] complete raw:", text);

    return new Response(
      JSON.stringify({
        completed: true,
        pi_status: res.status,
        response: text
      }),
      { status: 200, headers: cors }
    );

  } catch(err) {
    console.error("[Haramain] complete error:", err.message);
    return new Response(
      JSON.stringify({ completed: false, error: err.message }),
      { status: 500, headers: cors }
    );
  }
}

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
