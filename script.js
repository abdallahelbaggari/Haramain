/* ═══════════════════════════════════════════════════════════════
   HARAMAIN · script.js
   Reference file only — all JavaScript is inline in index.html
   
   Pi Browser requires all scripts inline.
   External .js files may be blocked in Pi Browser WebView.
   
   See: index.html last <script> block (213KB of JS)
   
   DO NOT link this file in index.html
   This file is for developer reference only.
═══════════════════════════════════════════════════════════════ */

/*
  KEY CONFIGURATION:
  ─────────────────
  Pi.init({ version: "2.0", sandbox: false })
  → sandbox: false = Pi Network MAINNET
  → Real Pi payments
  → x.minepi.com/app/haramain
  
  PAYMENT ENDPOINTS:
  ─────────────────
  approve:  fetch("/functions/approve",  { method: "POST", ... })
  complete: fetch("/functions/complete", { method: "POST", ... })
  
  These route to:
  functions/approve.js  → Cloudflare Pages Function
  functions/complete.js → Cloudflare Pages Function
  
  ENVIRONMENT VARIABLE:
  ─────────────────────
  PI_API_KEY = your Pi Developer Portal API key
  Set in: Cloudflare Dashboard → Pages → Settings → Environment Variables
*/
