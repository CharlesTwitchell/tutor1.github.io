// ============================================================
// Steady Focus Tutoring — Course Portal backend (Cloudflare Worker)
// ============================================================
// Paste this whole file into its own Cloudflare Worker (separate from
// the Tutor Bot worker). Setup steps (dashboard only, no command line)
// are in SETUP-COURSE-PORTAL.md in this same folder.
//
// Requires:
//  - A D1 database bound to this Worker as: PORTAL_DB
//    (run portal-schema.sql in its Console tab first)
//  - A KV namespace bound to this Worker as: PORTAL_KV
//  - Secrets set on this Worker: ADMIN_PASSWORD, STRIPE_SECRET_KEY,
//    STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID
// ============================================================

// ---- CHANGE THIS: your real GitHub Pages URL, no trailing slash ----
const ALLOWED_ORIGIN = "https://charlestwitchell.github.io";

// ---- CHANGE THIS: the full base URL of your live site, no trailing
// slash. Check your repo's Settings -> Pages for the exact URL —
// if this repo isn't named "yourusername.github.io" exactly, GitHub
// serves it at https://yourusername.github.io/repo-name (with the
// repo name in the path). Stripe redirects students back here after
// checkout, so this has to be exactly right. ----
const SITE_URL = "https://charlestwitchell.github.io/tutor1.github.io";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const corsHeaders = {
      "Access-Control-Allow-Origin": origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Credentials": "true",
      "Vary": "Origin"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Stripe calls this server-to-server — no CORS needed, and it must
    // see the raw request body untouched for signature verification.
    if (url.pathname === "/api/portal/stripe-webhook" && request.method === "POST") {
      try {
        return await handleStripeWebhook(request, env);
      } catch (err) {
        return new Response("Webhook error", { status: 400 });
      }
    }

    try {
      const path = url.pathname;
      const method = request.method;

      if (path === "/api/portal/signup" && method === "POST") return await handleSignup(request, env, corsHeaders);
      if (path === "/api/portal/login" && method === "POST") return await handleLogin(request, env, corsHeaders);
      if (path === "/api/portal/logout" && method === "POST") return await handleLogout(request, env, corsHeaders);
      if (path === "/api/portal/me" && method === "GET") return await handleMe(request, env, corsHeaders);
      if (path === "/api/portal/checkout" && method === "POST") return await handleCheckout(request, env, corsHeaders);
      if (path === "/api/portal/billing-portal" && method === "POST") return await handleBillingPortal(request, env, corsHeaders);

      if (path === "/api/portal/classes" && method === "GET") return await handleListClasses(request, env, corsHeaders);
      const classMatch = path.match(/^\/api\/portal\/classes\/([^/]+)$/);
      if (classMatch && method === "GET") return await handleGetClass(request, env, corsHeaders, classMatch[1]);

      if (path === "/api/portal/admin/login" && method === "POST") return await handleAdminLogin(request, env, corsHeaders);
      if (path === "/api/portal/admin/logout" && method === "POST") return await handleAdminLogout(request, env, corsHeaders);
      if (path === "/api/portal/admin/session" && method === "GET") return await handleAdminSession(request, env, corsHeaders);
      if (path === "/api/portal/admin/classes" && method === "GET") return await handleAdminListClasses(request, env, corsHeaders);
      if (path === "/api/portal/admin/classes" && method === "POST") return await handleAdminCreateClass(request, env, corsHeaders);
      const adminClassMatch = path.match(/^\/api\/portal\/admin\/classes\/([^/]+)$/);
      if (adminClassMatch && method === "PUT") return await handleAdminUpdateClass(request, env, corsHeaders, adminClassMatch[1]);
      if (adminClassMatch && method === "DELETE") return await handleAdminDeleteClass(request, env, corsHeaders, adminClassMatch[1]);
      if (path === "/api/portal/admin/students" && method === "GET") return await handleAdminListStudents(request, env, corsHeaders);

      return json({ error: "Not found" }, 404, corsHeaders);
    } catch (err) {
      return json({ error: "Server error" }, 500, corsHeaders);
    }
  }
};

// ---- helpers ----

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

function setCookieHeader(name, value, maxAgeSeconds) {
  return `${name}=${encodeURIComponent(value)}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${maxAgeSeconds}`;
}

function toHex(buf) {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex) {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) arr[i] = parseInt(hex.substr(i * 2, 2), 16);
  return arr;
}

async function hashPassword(password, saltHex) {
  const salt = saltHex ? fromHex(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, keyMaterial, 256);
  return { hash: toHex(bits), salt: toHex(salt) };
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

async function verifyPassword(password, hash, salt) {
  const check = await hashPassword(password, salt);
  return timingSafeEqual(check.hash, hash);
}

function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function hasAccess(status) {
  return status === "active" || status === "trialing";
}

async function getStudent(request, env) {
  const sessionId = getCookie(request, "portal_session");
  if (!sessionId) return null;
  const userId = await env.PORTAL_KV.get(`portal_session:${sessionId}`);
  if (!userId) return null;
  const user = await env.PORTAL_DB.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first();
  return user || null;
}

async function requireAdmin(request, env) {
  const sessionId = getCookie(request, "portal_admin");
  if (!sessionId) return false;
  const valid = await env.PORTAL_KV.get(`portal_admin:${sessionId}`);
  return valid === "valid";
}

function classToPublic(row, unlocked) {
  const base = {
    id: row.id,
    title: row.title,
    category: row.category,
    description: row.description,
    minutes: row.minutes,
    locked: !unlocked
  };
  if (unlocked) base.vimeoId = row.vimeo_id;
  return base;
}

// ---- Stripe ----

async function stripeRequest(env, method, path, params) {
  const body = params ? buildFormBody(params) : undefined;
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      "Authorization": `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Stripe request failed");
  return data;
}

function buildFormBody(params) {
  return Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
}

async function verifyStripeSignature(payload, sigHeader, secret) {
  const parts = Object.fromEntries(sigHeader.split(",").map(kv => kv.split("=")));
  if (!parts.t || !parts.v1) return false;
  const signedPayload = `${parts.t}.${payload}`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
  return timingSafeEqual(toHex(sigBuf), parts.v1);
}

async function handleStripeWebhook(request, env) {
  const payload = await request.text();
  const sig = request.headers.get("Stripe-Signature") || "";
  const valid = await verifyStripeSignature(payload, sig, env.STRIPE_WEBHOOK_SECRET);
  if (!valid) return new Response("Invalid signature", { status: 400 });

  const event = JSON.parse(payload);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    await env.PORTAL_DB.prepare(
      "UPDATE users SET stripe_subscription_id = ?, subscription_status = 'active' WHERE id = ? OR stripe_customer_id = ?"
    ).bind(session.subscription, session.client_reference_id || "", session.customer).run();
  } else if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const sub = event.data.object;
    const status = event.type === "customer.subscription.deleted" ? "canceled" : sub.status;
    await env.PORTAL_DB.prepare(
      "UPDATE users SET subscription_status = ?, stripe_subscription_id = ? WHERE stripe_customer_id = ?"
    ).bind(status, sub.id, sub.customer).run();
  }

  return new Response("ok", { status: 200 });
}

// ---- Student auth ----

async function handleSignup(request, env, corsHeaders) {
  let body;
  try { body = await request.json(); } catch { body = {}; }
  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";

  if (!isValidEmail(email)) return json({ error: "Enter a valid email address." }, 400, corsHeaders);
  if (password.length < 8) return json({ error: "Password must be at least 8 characters." }, 400, corsHeaders);

  const existing = await env.PORTAL_DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
  if (existing) return json({ error: "An account with that email already exists." }, 409, corsHeaders);

  let customer;
  try {
    customer = await stripeRequest(env, "POST", "customers", { email });
  } catch (err) {
    return json({ error: "Could not create your account right now. Please try again shortly." }, 502, corsHeaders);
  }

  const { hash, salt } = await hashPassword(password);
  const id = crypto.randomUUID();
  await env.PORTAL_DB.prepare(
    "INSERT INTO users (id, email, password_hash, password_salt, stripe_customer_id, subscription_status, created_at) VALUES (?, ?, ?, ?, ?, 'none', ?)"
  ).bind(id, email, hash, salt, customer.id, Date.now()).run();

  const sessionId = crypto.randomUUID();
  await env.PORTAL_KV.put(`portal_session:${sessionId}`, id, { expirationTtl: SESSION_TTL_SECONDS });

  const headers = { ...corsHeaders, "Set-Cookie": setCookieHeader("portal_session", sessionId, SESSION_TTL_SECONDS) };
  return json({ ok: true, email, subscriptionStatus: "none" }, 200, headers);
}

async function handleLogin(request, env, corsHeaders) {
  let body;
  try { body = await request.json(); } catch { body = {}; }
  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";

  const user = await env.PORTAL_DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
  if (!user || !(await verifyPassword(password, user.password_hash, user.password_salt))) {
    return json({ error: "Incorrect email or password." }, 401, corsHeaders);
  }

  const sessionId = crypto.randomUUID();
  await env.PORTAL_KV.put(`portal_session:${sessionId}`, user.id, { expirationTtl: SESSION_TTL_SECONDS });

  const headers = { ...corsHeaders, "Set-Cookie": setCookieHeader("portal_session", sessionId, SESSION_TTL_SECONDS) };
  return json({ ok: true, email: user.email, subscriptionStatus: user.subscription_status }, 200, headers);
}

async function handleLogout(request, env, corsHeaders) {
  const sessionId = getCookie(request, "portal_session");
  if (sessionId) await env.PORTAL_KV.delete(`portal_session:${sessionId}`);
  const headers = { ...corsHeaders, "Set-Cookie": setCookieHeader("portal_session", "", 0) };
  return json({ ok: true }, 200, headers);
}

async function handleMe(request, env, corsHeaders) {
  const user = await getStudent(request, env);
  if (!user) return json({ authenticated: false }, 200, corsHeaders);
  return json({
    authenticated: true,
    email: user.email,
    subscriptionStatus: user.subscription_status,
    hasAccess: hasAccess(user.subscription_status)
  }, 200, corsHeaders);
}

async function handleCheckout(request, env, corsHeaders) {
  const user = await getStudent(request, env);
  if (!user) return json({ error: "Please log in first." }, 401, corsHeaders);

  try {
    const session = await stripeRequest(env, "POST", "checkout/sessions", {
      mode: "subscription",
      customer: user.stripe_customer_id,
      "line_items[0][price]": env.STRIPE_PRICE_ID,
      "line_items[0][quantity]": "1",
      success_url: `${SITE_URL}/account.html?checkout=success`,
      cancel_url: `${SITE_URL}/account.html?checkout=cancel`,
      client_reference_id: user.id
    });
    return json({ url: session.url }, 200, corsHeaders);
  } catch (err) {
    return json({ error: "Could not start checkout. Please try again shortly." }, 502, corsHeaders);
  }
}

async function handleBillingPortal(request, env, corsHeaders) {
  const user = await getStudent(request, env);
  if (!user) return json({ error: "Please log in first." }, 401, corsHeaders);
  if (!user.stripe_customer_id) return json({ error: "No billing account on file yet." }, 400, corsHeaders);

  try {
    const session = await stripeRequest(env, "POST", "billing_portal/sessions", {
      customer: user.stripe_customer_id,
      return_url: `${SITE_URL}/account.html`
    });
    return json({ url: session.url }, 200, corsHeaders);
  } catch (err) {
    return json({ error: "Could not open the billing portal. Please try again shortly." }, 502, corsHeaders);
  }
}

// ---- Public class catalog ----

async function handleListClasses(request, env, corsHeaders) {
  const { results } = await env.PORTAL_DB.prepare(
    "SELECT * FROM classes WHERE published = 1 ORDER BY sort_order ASC, created_at ASC"
  ).all();
  const user = await getStudent(request, env);
  const unlocked = user ? hasAccess(user.subscription_status) : false;
  return json({ classes: results.map(r => classToPublic(r, unlocked)) }, 200, corsHeaders);
}

async function handleGetClass(request, env, corsHeaders, id) {
  const row = await env.PORTAL_DB.prepare("SELECT * FROM classes WHERE id = ? AND published = 1").bind(id).first();
  if (!row) return json({ error: "Class not found." }, 404, corsHeaders);
  const user = await getStudent(request, env);
  const unlocked = user ? hasAccess(user.subscription_status) : false;
  return json({ class: classToPublic(row, unlocked) }, 200, corsHeaders);
}

// ---- Admin auth ----

async function handleAdminLogin(request, env, corsHeaders) {
  let body;
  try { body = await request.json(); } catch { body = {}; }
  const password = body.password;

  if (!password || password !== env.ADMIN_PASSWORD) {
    return json({ error: "Incorrect password" }, 401, corsHeaders);
  }

  const sessionId = crypto.randomUUID();
  await env.PORTAL_KV.put(`portal_admin:${sessionId}`, "valid", { expirationTtl: 60 * 60 * 12 });

  const headers = { ...corsHeaders, "Set-Cookie": setCookieHeader("portal_admin", sessionId, 60 * 60 * 12) };
  return json({ ok: true }, 200, headers);
}

async function handleAdminLogout(request, env, corsHeaders) {
  const sessionId = getCookie(request, "portal_admin");
  if (sessionId) await env.PORTAL_KV.delete(`portal_admin:${sessionId}`);
  const headers = { ...corsHeaders, "Set-Cookie": setCookieHeader("portal_admin", "", 0) };
  return json({ ok: true }, 200, headers);
}

async function handleAdminSession(request, env, corsHeaders) {
  const ok = await requireAdmin(request, env);
  return json({ authenticated: ok }, 200, corsHeaders);
}

// ---- Admin class management ----

async function handleAdminListClasses(request, env, corsHeaders) {
  if (!(await requireAdmin(request, env))) return json({ error: "Not authenticated" }, 401, corsHeaders);
  const { results } = await env.PORTAL_DB.prepare("SELECT * FROM classes ORDER BY sort_order ASC, created_at ASC").all();
  return json({ classes: results }, 200, corsHeaders);
}

function validateClassInput(body) {
  if (typeof body.title !== "string" || !body.title.trim()) return "Title is required.";
  if (body.title.length > 200) return "Title is too long.";
  if (typeof body.description !== "string" || body.description.length > 4000) return "Description is too long.";
  if (typeof body.vimeoId !== "string" || body.vimeoId.length > 60) return "Vimeo ID looks invalid.";
  if (body.minutes !== undefined && (typeof body.minutes !== "number" || body.minutes < 0)) return "Minutes must be a positive number.";
  return null;
}

async function handleAdminCreateClass(request, env, corsHeaders) {
  if (!(await requireAdmin(request, env))) return json({ error: "Not authenticated" }, 401, corsHeaders);
  let body;
  try { body = await request.json(); } catch { body = {}; }

  const error = validateClassInput(body);
  if (error) return json({ error }, 400, corsHeaders);

  const id = crypto.randomUUID();
  await env.PORTAL_DB.prepare(
    "INSERT INTO classes (id, title, category, description, vimeo_id, minutes, published, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(
    id,
    body.title.trim(),
    (body.category || "General").trim(),
    body.description || "",
    body.vimeoId || "",
    body.minutes || 0,
    body.published ? 1 : 0,
    body.sortOrder || 0,
    Date.now()
  ).run();

  return json({ ok: true, id }, 200, corsHeaders);
}

async function handleAdminUpdateClass(request, env, corsHeaders, id) {
  if (!(await requireAdmin(request, env))) return json({ error: "Not authenticated" }, 401, corsHeaders);
  let body;
  try { body = await request.json(); } catch { body = {}; }

  const error = validateClassInput(body);
  if (error) return json({ error }, 400, corsHeaders);

  const result = await env.PORTAL_DB.prepare(
    "UPDATE classes SET title = ?, category = ?, description = ?, vimeo_id = ?, minutes = ?, published = ?, sort_order = ? WHERE id = ?"
  ).bind(
    body.title.trim(),
    (body.category || "General").trim(),
    body.description || "",
    body.vimeoId || "",
    body.minutes || 0,
    body.published ? 1 : 0,
    body.sortOrder || 0,
    id
  ).run();

  if (result.meta.changes === 0) return json({ error: "Class not found." }, 404, corsHeaders);
  return json({ ok: true }, 200, corsHeaders);
}

async function handleAdminDeleteClass(request, env, corsHeaders, id) {
  if (!(await requireAdmin(request, env))) return json({ error: "Not authenticated" }, 401, corsHeaders);
  await env.PORTAL_DB.prepare("DELETE FROM classes WHERE id = ?").bind(id).run();
  return json({ ok: true }, 200, corsHeaders);
}

async function handleAdminListStudents(request, env, corsHeaders) {
  if (!(await requireAdmin(request, env))) return json({ error: "Not authenticated" }, 401, corsHeaders);
  const { results } = await env.PORTAL_DB.prepare(
    "SELECT email, subscription_status, created_at FROM users ORDER BY created_at DESC"
  ).all();
  return json({ students: results }, 200, corsHeaders);
}
