const STATUS_TEXT = {
  none: "You don't have an active subscription yet.",
  active: "Your subscription is active — enjoy the full course library.",
  trialing: "You're in your trial period — enjoy the full course library.",
  past_due: "Your last payment didn't go through. Please update your billing details.",
  canceled: "Your subscription has been canceled. Resubscribe any time."
};

function notConfigured() {
  return !PORTAL_API_BASE || PORTAL_API_BASE.includes('YOUR-PORTAL-WORKER-SUBDOMAIN');
}

function showCheckoutBanner() {
  const params = new URLSearchParams(location.search);
  const checkout = params.get('checkout');
  const banner = document.getElementById('checkout-banner');
  if (checkout === 'success') {
    banner.style.display = 'block';
    banner.textContent = "Payment received! It may take a few seconds for your subscription to show as active — refresh if needed.";
  } else if (checkout === 'cancel') {
    banner.style.display = 'block';
    banner.textContent = "Checkout was canceled — no charge was made.";
  }
}

function setTab(tab) {
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-signup').classList.toggle('active', tab === 'signup');
  document.getElementById('login-card').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('signup-card').style.display = tab === 'signup' ? 'block' : 'none';
}

document.getElementById('tab-login').addEventListener('click', () => setTab('login'));
document.getElementById('tab-signup').addEventListener('click', () => setTab('signup'));
if (location.hash === '#signup') setTab('signup');

function renderLoggedIn(data) {
  document.getElementById('loading-state').style.display = 'none';
  document.getElementById('logged-out-state').style.display = 'none';
  document.getElementById('logged-in-state').style.display = 'block';

  document.getElementById('account-email').textContent = data.email;
  document.getElementById('status-tag').textContent = data.subscriptionStatus;
  document.getElementById('account-status-desc').textContent = STATUS_TEXT[data.subscriptionStatus] || STATUS_TEXT.none;

  const subscribeBtn = document.getElementById('subscribe-btn');
  const billingBtn = document.getElementById('billing-btn');
  subscribeBtn.style.display = data.hasAccess ? 'none' : 'inline-flex';
  billingBtn.style.display = data.subscriptionStatus === 'none' ? 'none' : 'inline-flex';
}

function renderLoggedOut() {
  document.getElementById('loading-state').style.display = 'none';
  document.getElementById('logged-in-state').style.display = 'none';
  document.getElementById('logged-out-state').style.display = 'block';
}

async function refreshMe() {
  const res = await fetch(`${PORTAL_API_BASE}/api/portal/me`, { credentials: 'include' });
  const data = await res.json();
  if (data.authenticated) renderLoggedIn(data);
  else renderLoggedOut();
  return data;
}

async function init() {
  showCheckoutBanner();
  if (notConfigured()) {
    document.getElementById('loading-state').textContent = "The course portal isn't connected yet — the site owner needs to finish the backend setup.";
    return;
  }
  try {
    await refreshMe();
  } catch (err) {
    document.getElementById('loading-state').textContent = "Couldn't reach the account system. Please try again in a moment.";
  }
}

document.getElementById('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const errorEl = document.getElementById('login-error');
  errorEl.style.display = 'none';
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  try {
    const res = await fetch(`${PORTAL_API_BASE}/api/portal/login`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) { errorEl.textContent = data.error || 'Incorrect email or password.'; errorEl.style.display = 'block'; return; }
    renderLoggedIn({ email: data.email, subscriptionStatus: data.subscriptionStatus, hasAccess: data.subscriptionStatus === 'active' || data.subscriptionStatus === 'trialing' });
  } catch (err) {
    errorEl.textContent = "Couldn't reach the account system. Please try again.";
    errorEl.style.display = 'block';
  }
});

document.getElementById('signup-form').addEventListener('submit', async e => {
  e.preventDefault();
  const errorEl = document.getElementById('signup-error');
  errorEl.style.display = 'none';
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;

  try {
    const res = await fetch(`${PORTAL_API_BASE}/api/portal/signup`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) { errorEl.textContent = data.error || 'Could not create your account.'; errorEl.style.display = 'block'; return; }
    renderLoggedIn({ email: data.email, subscriptionStatus: data.subscriptionStatus, hasAccess: false });
  } catch (err) {
    errorEl.textContent = "Couldn't reach the account system. Please try again.";
    errorEl.style.display = 'block';
  }
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  await fetch(`${PORTAL_API_BASE}/api/portal/logout`, { method: 'POST', credentials: 'include' });
  location.reload();
});

document.getElementById('subscribe-btn').addEventListener('click', async () => {
  const errorEl = document.getElementById('account-action-error');
  errorEl.style.display = 'none';
  try {
    const res = await fetch(`${PORTAL_API_BASE}/api/portal/checkout`, { method: 'POST', credentials: 'include' });
    const data = await res.json();
    if (!res.ok || !data.url) { errorEl.textContent = data.error || 'Could not start checkout.'; errorEl.style.display = 'block'; return; }
    location.href = data.url;
  } catch (err) {
    errorEl.textContent = "Couldn't reach the checkout system. Please try again.";
    errorEl.style.display = 'block';
  }
});

document.getElementById('billing-btn').addEventListener('click', async () => {
  const errorEl = document.getElementById('account-action-error');
  errorEl.style.display = 'none';
  try {
    const res = await fetch(`${PORTAL_API_BASE}/api/portal/billing-portal`, { method: 'POST', credentials: 'include' });
    const data = await res.json();
    if (!res.ok || !data.url) { errorEl.textContent = data.error || 'Could not open billing portal.'; errorEl.style.display = 'block'; return; }
    location.href = data.url;
  } catch (err) {
    errorEl.textContent = "Couldn't reach the billing system. Please try again.";
    errorEl.style.display = 'block';
  }
});

init();
