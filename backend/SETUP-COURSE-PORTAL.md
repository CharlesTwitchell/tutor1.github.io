# Course Portal setup

This wires up real accounts, Stripe subscriptions, and gated video classes.
Everything below is done in web dashboards — no command line needed. Budget
about 30–45 minutes the first time.

The portal runs as its **own** Cloudflare Worker, separate from the Tutor
Bot worker, so you'll end up with two Workers total. That keeps them
independent — you can redeploy or debug one without touching the other.

## 1. Create the database (Cloudflare D1)

1. Cloudflare dashboard → **Workers & Pages → D1**.
2. Create a database, name it something like `steady-focus-portal`.
3. Open it → **Console** tab → paste in the entire contents of
   `backend/portal-schema.sql` from this repo → **Execute**.
   This creates the `users` and `classes` tables.

## 2. Create a KV namespace

1. **Workers & Pages → KV** → create a namespace, e.g. `PORTAL_KV`.
   (This holds login sessions — separate from the Tutor Bot's KV namespace.)

## 3. Set up Stripe

1. Create a free account at stripe.com if you don't have one. Start in
   **test mode** (toggle in the dashboard) until everything works, then
   switch to live keys.
2. **Product catalog → Add product.** Name it (e.g. "Course Portal
   Subscription"), set a **recurring** price (e.g. $19/month). Save, then
   copy the **Price ID** (starts with `price_`).
3. **Developers → API keys.** Copy the **Secret key** (starts with `sk_`).
4. **Developers → Webhooks → Add endpoint.** You'll fill in the URL after
   step 5 (once you know the Worker's address) — come back to this. Select
   these events: `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted`. After creating it, copy the **Signing
   secret** (starts with `whsec_`).

## 4. Deploy the Worker

1. **Workers & Pages → Create → Worker.** Name it e.g. `steady-focus-portal`.
2. Open its code editor, delete the placeholder code, and paste in the
   entire contents of `backend/portal-worker.js` from this repo.
3. Near the top of the file, update these two lines to match your real
   site:
   - `ALLOWED_ORIGIN` — your GitHub Pages origin, e.g.
     `https://charlestwitchell.github.io` (no path, no trailing slash).
   - `SITE_URL` — the full base URL of your live site, including any
     repo-name path. Check **your repo's Settings → Pages** for the exact
     published URL. This matters: Stripe redirects students back here
     after checkout, so a wrong value breaks that redirect.
4. **Settings → Bindings**, add:
   - D1 database binding named `PORTAL_DB` → your database from step 1.
   - KV namespace binding named `PORTAL_KV` → your namespace from step 2.
5. **Settings → Variables and Secrets**, add these as **secrets** (encrypted):
   - `ADMIN_PASSWORD` — the password you'll use to log into the class admin
     panel (`portal-admin.html`). Pick something you don't use elsewhere.
   - `STRIPE_SECRET_KEY` — from step 3.3.
   - `STRIPE_WEBHOOK_SECRET` — from step 3.4.
   - `STRIPE_PRICE_ID` — from step 3.2.
6. Save and deploy. Copy the Worker's URL
   (`https://your-worker-name.your-subdomain.workers.dev`).
7. Go back to Stripe's webhook endpoint from step 3.4 and set its URL to
   `<your-worker-url>/api/portal/stripe-webhook`.

## 5. Point the site at the Worker

In `js/config.js`, set `PORTAL_API_BASE` to the Worker URL from step 4.6
(no trailing slash).

## 6. Set up video hosting (Vimeo)

1. Upload your class videos to a Vimeo account (a Plus or Pro plan gives
   you domain-restricted privacy, which real access control needs).
2. Per video: **Privacy settings → Where can this be embedded?** → restrict
   to your site's domain only.
3. Copy the numeric video ID from the video's URL
   (`vimeo.com/`**`123456789`**) — you'll paste this into the admin panel
   per class.

## 7. Add your classes

Go to `portal-admin.html` on your live site, log in with `ADMIN_PASSWORD`,
and add each class: title, category, description, Vimeo ID, length, and
check "Published" when it's ready for students to see.

## 8. Test the whole flow

1. On `account.html`, sign up a test account.
2. Click **Subscribe now** — you'll land on Stripe Checkout. In test mode,
   use Stripe's test card `4242 4242 4242 4242`, any future expiry, any CVC.
3. After paying, you're redirected back to `account.html?checkout=success`.
   Refresh — your status should flip to `active` within a few seconds (that
   comes from Stripe's webhook hitting the Worker).
4. Go to `portal.html` — the class should now be unlocked and playable.
5. Try **Manage billing** — it should open Stripe's hosted billing portal.

Once this all works in test mode, switch Stripe to live mode, generate live
keys, and re-set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and
`STRIPE_PRICE_ID` on the Worker to the live versions (they're different
values in live mode, including a new webhook endpoint + signing secret).

## Notes

- Passwords are hashed (PBKDF2) before storage — never stored in plain text.
- A subscription status of `active` or `trialing` unlocks classes;
  `past_due` and `canceled` do not (the student sees a "subscribe" prompt
  again, and can use "Manage billing" to fix a failed payment).
- The admin panel (`portal-admin.html`) uses a single shared password, the
  same pattern as the Tutor Bot's training page — there's no per-admin
  login here.
