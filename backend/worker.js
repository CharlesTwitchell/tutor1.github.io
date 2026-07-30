// ============================================================
// Steady Focus Tutoring — Tutor Bot backend (Cloudflare Worker)
// ============================================================
// Paste this whole file into the Cloudflare Worker code editor.
// Setup steps (dashboard only, no command line) are in
// SETUP-TUTOR-BOT.md in this same folder.
//
// Requires:
//  - A KV namespace bound to this Worker as: TUTOR_KV
//  - Two secrets set on this Worker: ANTHROPIC_API_KEY, TUTOR_PASSWORD
// ============================================================

// ---- CHANGE THIS: your real GitHub Pages URL, no trailing slash ----
const ALLOWED_ORIGIN = "https://charlestwitchell.github.io";

const DEFAULT_STYLE = `You are Tutor Bot, an ADHD-friendly tutoring assistant.
- Never just give the final answer. Ask a guiding question first.
- Break every problem into the smallest next step.
- Keep replies short: 3-4 sentences max.
- Use encouraging, plain, warm language. No jargon.
- If a student seems overwhelmed, gently suggest a short break before continuing.
- Stay focused on schoolwork and study strategies.`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const corsHeaders = {
      "Access-Control-Allow-Origin": origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Credentials": "true",
      "Vary": "Origin"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      if (url.pathname === "/api/login" && request.method === "POST") {
        return await handleLogin(request, env, corsHeaders);
      }
      if (url.pathname === "/api/logout" && request.method === "POST") {
        return await handleLogout(request, env, corsHeaders);
      }
      if (url.pathname === "/api/session" && request.method === "GET") {
        return await handleSessionCheck(request, env, corsHeaders);
      }
      if (url.pathname === "/api/style" && request.method === "GET") {
        return await handleGetStyle(request, env, corsHeaders);
      }
      if (url.pathname === "/api/style" && request.method === "POST") {
        return await handleSaveStyle(request, env, corsHeaders);
      }
      if (url.pathname === "/api/chat" && request.method === "POST") {
        return await handleChat(request, env, corsHeaders);
      }
      return json({ error: "Not found" }, 404, corsHeaders);
    } catch (err) {
      return json({ error: "Server error" }, 500, corsHeaders);
    }
  }
};

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, "Content-Type": "application/json" }
  });
}

function getCookie(request, name) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function requireAuth(request, env) {
  const sessionId = getCookie(request, "session");
  if (!sessionId) return false;
  const valid = await env.TUTOR_KV.get(`session:${sessionId}`);
  return valid === "valid";
}

// ---- Auth ----

async function handleLogin(request, env, corsHeaders) {
  let body;
  try { body = await request.json(); } catch { body = {}; }
  const password = body.password;

  if (!password || password !== env.TUTOR_PASSWORD) {
    return json({ error: "Incorrect password" }, 401, corsHeaders);
  }

  const sessionId = crypto.randomUUID();
  await env.TUTOR_KV.put(`session:${sessionId}`, "valid", { expirationTtl: 60 * 60 * 12 }); // 12 hours

  const headers = {
    ...corsHeaders,
    "Set-Cookie": `session=${sessionId}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=43200`
  };
  return json({ ok: true }, 200, headers);
}

async function handleLogout(request, env, corsHeaders) {
  const sessionId = getCookie(request, "session");
  if (sessionId) await env.TUTOR_KV.delete(`session:${sessionId}`);
  const headers = {
    ...corsHeaders,
    "Set-Cookie": `session=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0`
  };
  return json({ ok: true }, 200, headers);
}

async function handleSessionCheck(request, env, corsHeaders) {
  const ok = await requireAuth(request, env);
  return json({ authenticated: ok }, 200, corsHeaders);
}

// ---- Style (the "training") ----

async function handleGetStyle(request, env, corsHeaders) {
  const ok = await requireAuth(request, env);
  if (!ok) return json({ error: "Not authenticated" }, 401, corsHeaders);
  const style = (await env.TUTOR_KV.get("tutor_style")) || DEFAULT_STYLE;
  return json({ style }, 200, corsHeaders);
}

async function handleSaveStyle(request, env, corsHeaders) {
  const ok = await requireAuth(request, env);
  if (!ok) return json({ error: "Not authenticated" }, 401, corsHeaders);

  let body;
  try { body = await request.json(); } catch { body = {}; }
  const style = body.style;

  if (typeof style !== "string" || style.length < 1 || style.length > 4000) {
    return json({ error: "Style text must be under 4000 characters." }, 400, corsHeaders);
  }
  await env.TUTOR_KV.put("tutor_style", style);
  return json({ ok: true }, 200, corsHeaders);
}

// ---- Chat (public, talks to the real Claude API) ----

async function handleChat(request, env, corsHeaders) {
  let body;
  try { body = await request.json(); } catch { body = {}; }
  const message = body.message;
  const history = body.history;

  if (!message || typeof message !== "string" || message.length > 1500) {
    return json({ error: "Message is missing or too long." }, 400, corsHeaders);
  }

  const style = (await env.TUTOR_KV.get("tutor_style")) || DEFAULT_STYLE;

  const safeHistory = Array.isArray(history) ? history.slice(-10) : [];
  const messages = [
    ...safeHistory
      .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map(m => ({ role: m.role, content: m.content.slice(0, 1500) })),
    { role: "user", content: message }
  ];

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 400,
      system: style,
      messages
    })
  });

  if (!response.ok) {
    return json({ error: "Tutor Bot is temporarily unavailable. Please try again shortly." }, 502, corsHeaders);
  }

  const data = await response.json();
  const reply = (data.content || [])
    .filter(b => b.type === "text")
    .map(b => b.text)
    .join("\n");

  return json({ reply: reply || "Sorry, I didn't catch that — can you try rephrasing?" }, 200, corsHeaders);
}
