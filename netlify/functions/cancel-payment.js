/* ═══════════════════════════════════════════════════════════════
   HARAMAIN · cancel-payment.js · TESTNET
   Handles cancelled payments from Pi.createPayment onCancel
   Also resolves stuck/incomplete payments
   Uses same axios pattern as approve.js and complete.js
═══════════════════════════════════════════════════════════════ */
const axios = require("axios");

exports.handler = async (event, context) => {

  /* ── CORS preflight ── */
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS"
      },
      body: ""
    };
  }

  try {

    /* ── Get paymentId from body OR query string ── */
    let paymentId = null;

    /* From POST body (onCancel callback) */
    if (event.body) {
      const data = JSON.parse(event.body);
      paymentId = data.paymentId || data.txId || data.payment_id || null;
    }

    /* From GET query string */
    if (!paymentId && event.queryStringParameters) {
      paymentId = event.queryStringParameters.paymentId
               || event.queryStringParameters.txId
               || null;
    }

    console.log("[Haramain TESTNET] Cancel request | paymentId:", paymentId);

    /* ── No paymentId — still return success ── */
    /* Pi sometimes calls cancel without an ID */
    if (!paymentId) {
      return {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          success: true,
          cancelled: true,
          testnet: true,
          message: "Payment cancelled — no ID provided"
        })
      };
    }

    /* ── No PI_API_KEY — return success for testnet ── */
    if (!process.env.PI_API_KEY) {
      console.log("[Haramain TESTNET] No PI_API_KEY — mock cancel success");
      return {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          success: true,
          cancelled: true,
          testnet: true,
          paymentId: paymentId,
          message: "Payment cancelled successfully (testnet)"
        })
      };
    }

    /* ── With PI_API_KEY — check payment status ── */
    /* Pi Network does NOT have a cancel endpoint */
    /* We verify the payment was not completed */
    /* then mark it as handled in our records     */

    const verifyResponse = await axios.get(
      `https://api.minepi.com/v2/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Key ${process.env.PI_API_KEY}`
        }
      }
    );

    const payment = verifyResponse.data;

    console.log("[Haramain TESTNET] Payment status:", payment.status);

    /* If already completed — do not cancel */
    if (payment.status && payment.status.developer_completed === true) {
      return {
        statusCode: 200,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          success: false,
          cancelled: false,
          message: "Payment already completed — cannot cancel",
          paymentId: paymentId
        })
      };
    }

    /* Payment not completed — safe to treat as cancelled */
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        success: true,
        cancelled: true,
        testnet: true,
        paymentId: paymentId,
        status: payment.status,
        message: "Payment cancelled successfully"
      })
    };

  } catch (error) {

    console.error("[Haramain TESTNET] cancel-payment error:", error.message);

    /* Always return 200 — cancel should never crash the app */
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        success: true,
        cancelled: true,
        testnet: true,
        error: error.message,
        message: "Payment cancelled (with error)"
      })
    };

  }

};
