let allClasses = [];
let activeCat = "All";

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function categoriesFrom(classes) {
  const cats = [...new Set(classes.map(c => c.category))];
  return ["All", ...cats];
}

function renderPills() {
  const wrap = document.getElementById('course-pills');
  wrap.innerHTML = '';
  categoriesFrom(allClasses).forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'pill' + (cat === activeCat ? ' active' : '');
    btn.textContent = cat;
    btn.addEventListener('click', () => { activeCat = cat; renderPills(); renderCourses(); });
    wrap.appendChild(btn);
  });
}

function renderCourses() {
  const grid = document.getElementById('course-grid');
  grid.innerHTML = '';
  const filtered = allClasses.filter(c => activeCat === "All" || c.category === activeCat);

  if (!filtered.length) {
    grid.innerHTML = '<div class="badge-note">No classes in this category yet.</div>';
    return;
  }

  filtered.forEach(c => {
    const card = document.createElement('a');
    card.className = 'card class-card';
    card.href = `class.html?id=${encodeURIComponent(c.id)}`;
    card.innerHTML = `
      <div>
        <span class="tag">${escapeHtml(c.category)}</span>
        ${c.locked ? '<span class="lock-badge">🔒 Subscriber only</span>' : ''}
        <h3>${escapeHtml(c.title)}</h3>
        <p>${escapeHtml(c.description)}</p>
      </div>
      <div class="spacer"></div>
      <p class="field-note" style="margin-bottom:14px;">${c.minutes} min · video course</p>
      <span class="btn ${c.locked ? 'btn-ghost' : 'btn-primary'}" style="width:100%;">${c.locked ? 'Subscribe to watch' : 'Watch now'}</span>
    `;
    grid.appendChild(card);
  });
}

async function loadClasses() {
  const statusEl = document.getElementById('course-status');
  try {
    if (!PORTAL_API_BASE || PORTAL_API_BASE.includes('YOUR-PORTAL-WORKER-SUBDOMAIN')) {
      throw new Error('not-configured');
    }
    const res = await fetch(`${PORTAL_API_BASE}/api/portal/classes`, { credentials: 'include' });
    if (!res.ok) throw new Error('bad-response');
    const data = await res.json();
    allClasses = data.classes || [];
    renderPills();
    renderCourses();
  } catch (err) {
    statusEl.style.display = 'block';
    statusEl.textContent = err.message === 'not-configured'
      ? "The course portal isn't connected yet — the site owner needs to finish the backend setup (see backend/SETUP-COURSE-PORTAL.md)."
      : "Couldn't load classes right now. Please try again in a moment.";
    document.getElementById('course-grid').innerHTML = '';
  }
}

loadClasses();
