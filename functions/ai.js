// /ai — the app's AI assistant, answered on the server (Cloudflare Pages Function).
// The phone never holds an AI key. Add ONE of these secrets in Cloudflare → Settings → Variables and Secrets:
//   GEMINI_API_KEY     (Google AI Studio, free tier)   — tried first
//   ANTHROPIC_API_KEY  (Anthropic)                      — used if Gemini is not set or fails
// Request:  POST /ai { system, messages:[{role:'user'|'assistant', content}] }  (same shape the app already sends)
// Answer:   { content:[{ type:'text', text }] }  — or { error } so the app falls back to its built-in answers.

const H = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Cache-Control': 'no-store' };
const json = (o) => new Response(JSON.stringify(o), { status: 200, headers: H });
const GEMINI_MODELS = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.0-flash'];

function clean(messages) {
  return (Array.isArray(messages) ? messages : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-10)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
}

async function gemini(key, system, msgs) {
  for (const model of GEMINI_MODELS) {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: msgs.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        generationConfig: { maxOutputTokens: 700, temperature: 0.4 }
      })
    });
    if (!r.ok) continue;
    const d = await r.json();
    const text = (((d.candidates || [])[0] || {}).content || {}).parts?.map((p) => p.text || '').join('').trim();
    if (text) return text;
  }
  return '';
}

async function anthropic(key, system, msgs) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 700, system, messages: msgs })
  });
  if (!r.ok) return '';
  const d = await r.json();
  return ((d.content || [])[0] || {}).text || '';
}

/* Abuse protection: only this app's pages may call /ai, and each visitor gets a fair hourly allowance.
   IP addresses are never stored: only a salted hash, kept for one hour. */
const LIMIT_HOUR = 40;
async function allowed(context) {
  const req = context.request, env = context.env || {};
  const origin = req.headers.get('Origin');
  if (origin) { try { if (new URL(origin).host !== new URL(req.url).host) return 'This assistant only works inside the app.'; } catch (e) { return 'Bad request'; } }
  const db = env.HM_DB; if (!db) return '';
  try {
    const ip = req.headers.get('CF-Connecting-IP') || '0';
    const hour = Math.floor(Date.now() / 3600e3);
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('hm-ai|' + hour + '|' + ip));
    const k = Array.from(new Uint8Array(buf).slice(0, 12), (b) => b.toString(16).padStart(2, '0')).join('');
    await db.exec('CREATE TABLE IF NOT EXISTS ai_rl (k TEXT PRIMARY KEY, n INTEGER, hour INTEGER)');
    await db.prepare('INSERT INTO ai_rl (k, n, hour) VALUES (?, 1, ?) ON CONFLICT(k) DO UPDATE SET n = n + 1').bind(k, hour).run();
    const row = await db.prepare('SELECT n FROM ai_rl WHERE k = ?').bind(k).first();
    if (Math.random() < 0.02) await db.prepare('DELETE FROM ai_rl WHERE hour < ?').bind(hour - 1).run();
    if (row && row.n > LIMIT_HOUR) return 'You have asked a lot this hour. Please try again a little later.';
  } catch (e) {}
  return '';
}

export async function onRequestPost(context) {
  try {
    const env = context.env || {};
    const block = await allowed(context);
    if (block) return json({ error: block });
    const b = await context.request.json().catch(() => ({}));
    const msgs = clean(b.messages);
    if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return json({ error: 'No question' });
    const system = String(b.system || 'You are a helpful, concise assistant.').slice(0, 1500);
    let text = '';
    if (env.GEMINI_API_KEY) text = await gemini(String(env.GEMINI_API_KEY).trim(), system, msgs);
    if (!text && env.ANTHROPIC_API_KEY) text = await anthropic(String(env.ANTHROPIC_API_KEY).trim(), system, msgs);
    if (!text) return json({ error: env.GEMINI_API_KEY || env.ANTHROPIC_API_KEY ? 'AI is busy, try again' : 'AI key not set' });
    return json({ content: [{ type: 'text', text }] });
  } catch (e) {
    return json({ error: String((e && e.message) || e) });
  }
}

export async function onRequestOptions() { return new Response(null, { status: 204, headers: H }); }
