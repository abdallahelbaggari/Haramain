/* ═══════════════════════════════════════════════════════════════
   HARAMAIN · approve.js · TESTNET
   Copied EXACTLY from FinPi working testnet payment system
   Uses axios — same as FinPi proven working
═══════════════════════════════════════════════════════════════ */
const axios = require("axios");

exports.handler = async (event, context) => {

  try {

    const data = JSON.parse(event.body);
    const paymentId = data.paymentId;

    const response = await axios.post(
      `https://api.minepi.com/v2/payments/${paymentId}/approve`,
      {},
      {
        headers: {
          Authorization: `Key ${process.env.PI_API_KEY}`
        }
      }
    );

    return {
      statusCode: 200,
      body: JSON.stringify(response.data)
    };

  } catch (error) {

    console.error(error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Approval failed"
      })
    };

  }

};
