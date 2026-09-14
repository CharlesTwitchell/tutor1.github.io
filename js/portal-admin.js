function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function notConfigured() {
  return !PORTAL_API_BASE || PORTAL_API_BASE.includes('YOUR-PORTAL-WORKER-SUBDOMAIN');
}

function showLoggedIn() {
  document.getElementById('login-state').style.display = 'none';
  document.getElementById('admin-state').style.display = 'block';
  loadClasses();
}

function showLoggedOut() {
  document.getElementById('login-state').style.display = 'block';
  document.getElementById('admin-state').style.display = 'none';
}

async function checkSession() {
  if (notConfigured()) {
    document.getElementById('login-error').textContent = "The course portal isn't connected yet — set PORTAL_API_BASE in js/config.js first.";
    document.getElementById('login-error').style.display = 'block';
    return;
  }
  try {
    const res = await fetch(`${PORTAL_API_BASE}/api/portal/admin/session`, { credentials: 'include' });
    const data = await res.json();
    if (data.authenticated) showLoggedIn(); else showLoggedOut();
  } catch (err) {
    showLoggedOut();
  }
}

document.getElementById('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const errorEl = document.getElementById('login-error');
  errorEl.style.display = 'none';
  const password = document.getElementById('admin-password').value;

  try {
    const res = await fetch(`${PORTAL_API_BASE}/api/portal/admin/login`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    if (res.ok) { showLoggedIn(); }
    else { errorEl.textContent = 'Incorrect password.'; errorEl.style.display = 'block'; }
  } catch (err) {
    errorEl.textContent = "Couldn't reach the backend. Check your connection and try again.";
    errorEl.style.display = 'block';
  }
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  await fetch(`${PORTAL_API_BASE}/api/portal/admin/logout`, { method: 'POST', credentials: 'include' });
  location.reload();
});

function resetForm() {
  document.getElementById('class-form').reset();
  document.getElementById('class-id').value = '';
  document.getElementById('form-title').textContent = 'Add a new class';
  document.getElementById('save-btn').textContent = 'Add class';
  document.getElementById('cancel-edit-btn').style.display = 'none';
}

document.getElementById('cancel-edit-btn').addEventListener('click', resetForm);

function fillFormForEdit(c) {
  document.getElementById('class-id').value = c.id;
  document.getElementById('c-title').value = c.title;
  document.getElementById('c-cat').value = c.category;
  document.getElementById('c-desc').value = c.description;
  document.getElementById('c-vimeo').value = c.vimeo_id;
  document.getElementById('c-minutes').value = c.minutes;
  document.getElementById('c-sort').value = c.sort_order;
  document.getElementById('c-published').checked = !!c.published;
  document.getElementById('form-title').textContent = `Editing: ${c.title}`;
  document.getElementById('save-btn').textContent = 'Save changes';
  document.getElementById('cancel-edit-btn').style.display = 'inline-flex';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function loadClasses() {
  const listEl = document.getElementById('class-list');
  try {
    const res = await fetch(`${PORTAL_API_BASE}/api/portal/admin/classes`, { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) { listEl.innerHTML = '<p class="field-note">Could not load classes.</p>'; return; }

    if (!data.classes.length) { listEl.innerHTML = '<p class="field-note">No classes yet — add your first one.</p>'; return; }

    listEl.innerHTML = '';
    data.classes.forEach(c => {
      const row = document.createElement('div');
      row.className = 'class-row' + (c.published ? '' : ' unpublished');
      row.innerHTML = `
        <div class="meta">
          <strong>${escapeHtml(c.title)}</strong> ${c.published ? '' : '<span class="field-note">(unpublished)</span>'}<br>
          <span class="field-note">${escapeHtml(c.category)} · ${c.minutes} min</span>
        </div>
        <div class="actions">
          <button class="btn btn-ghost edit-btn">Edit</button>
          <button class="btn btn-ghost delete-btn">Delete</button>
        </div>
      `;
      row.querySelector('.edit-btn').addEventListener('click', () => fillFormForEdit(c));
      row.querySelector('.delete-btn').addEventListener('click', () => deleteClass(c.id, c.title));
      listEl.appendChild(row);
    });
  } catch (err) {
    listEl.innerHTML = '<p class="field-note">Could not load classes.</p>';
  }
}

async function deleteClass(id, title) {
  if (!confirm(`Delete "${title}"? This can't be undone.`)) return;
  await fetch(`${PORTAL_API_BASE}/api/portal/admin/classes/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'include' });
  loadClasses();
}

document.getElementById('class-form').addEventListener('submit', async e => {
  e.preventDefault();
  const errorEl = document.getElementById('form-error');
  const statusEl = document.getElementById('form-status');
  errorEl.style.display = 'none';
  statusEl.style.display = 'none';

  const id = document.getElementById('class-id').value;
  const payload = {
    title: document.getElementById('c-title').value.trim(),
    category: document.getElementById('c-cat').value.trim(),
    description: document.getElementById('c-desc').value.trim(),
    vimeoId: document.getElementById('c-vimeo').value.trim(),
    minutes: Number(document.getElementById('c-minutes').value) || 0,
    sortOrder: Number(document.getElementById('c-sort').value) || 0,
    published: document.getElementById('c-published').checked
  };

  try {
    const res = await fetch(
      id ? `${PORTAL_API_BASE}/api/portal/admin/classes/${encodeURIComponent(id)}` : `${PORTAL_API_BASE}/api/portal/admin/classes`,
      {
        method: id ? 'PUT' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }
    );
    const data = await res.json();
    if (!res.ok) { errorEl.textContent = data.error || 'Could not save this class.'; errorEl.style.display = 'block'; return; }

    statusEl.textContent = id ? 'Saved.' : 'Class added.';
    statusEl.style.display = 'block';
    resetForm();
    loadClasses();
  } catch (err) {
    errorEl.textContent = "Couldn't reach the backend. Please try again.";
    errorEl.style.display = 'block';
  }
});

checkSession();
