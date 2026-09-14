function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function showError(message) {
  document.getElementById('class-header').innerHTML = `<div class="badge-note">${escapeHtml(message)}</div>`;
  document.getElementById('class-body').innerHTML = '';
}

async function loadClass() {
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  if (!id) return showError("No class specified.");

  if (!PORTAL_API_BASE || PORTAL_API_BASE.includes('YOUR-PORTAL-WORKER-SUBDOMAIN')) {
    return showError("The course portal isn't connected yet — the site owner needs to finish the backend setup.");
  }

  let res, data;
  try {
    res = await fetch(`${PORTAL_API_BASE}/api/portal/classes/${encodeURIComponent(id)}`, { credentials: 'include' });
    data = await res.json();
  } catch (err) {
    return showError("Couldn't load this class right now. Please try again in a moment.");
  }

  if (!res.ok) return showError(data.error || "This class couldn't be found.");

  const c = data.class;
  document.getElementById('class-header').innerHTML = `
    <div class="eyebrow">${escapeHtml(c.category)}</div>
    <h1>${escapeHtml(c.title)}</h1>
    <p class="lede">${escapeHtml(c.description)}</p>
    <p class="field-note">${c.minutes} min · video course</p>
  `;

  const body = document.getElementById('class-body');
  if (c.locked) {
    body.innerHTML = `
      <div class="card" style="text-align:center;">
        <span class="tag">🔒 Subscriber only</span>
        <h3>Subscribe to watch this class</h3>
        <p>Log in if you already have an account, or sign up to start your subscription.</p>
        <div style="display:flex; gap:12px; justify-content:center; flex-wrap:wrap; margin-top:10px;">
          <a href="account.html" class="btn btn-primary">Log in</a>
          <a href="account.html#signup" class="btn btn-ghost">Sign up &amp; subscribe</a>
        </div>
      </div>
    `;
  } else {
    body.innerHTML = `
      <div class="video-wrap">
        <iframe src="https://player.vimeo.com/video/${encodeURIComponent(c.vimeoId)}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen title="${escapeHtml(c.title)}"></iframe>
      </div>
    `;
  }
}

loadClass();
