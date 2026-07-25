const CATEGORIES = ["All", "Study strategies", "Organization", "Test anxiety", "Wins & celebrations", "Parent support"];

// In-memory only — resets on page reload. See setup note on the page for how to make this persistent.
let threads = [
  { id: 1, cat: "Study strategies", name: "Priya", title: "What actually helps with reading retention?", body: "My son can read a whole chapter and remember nothing five minutes later. Anyone found something that sticks?", replies: 4 },
  { id: 2, cat: "Organization", name: "Marcus", title: "Backpack system that finally worked", body: "One folder per class, color coded, plus a single 'home' folder for anything that needs to go back. Took a month to stick but it stuck.", replies: 7 },
  { id: 3, cat: "Wins & celebrations", name: "Devon", title: "First B+ on a math test ever 🎉", body: "We used the focus-sprint method from session 4 to study and it actually worked. Wanted to share!", replies: 12 },
  { id: 4, cat: "Test anxiety", name: "Aisha", title: "Melting down the night before tests", body: "Looking for calming strategies that don't feel babyish to a 14 year old.", replies: 3 },
  { id: 5, cat: "Parent support", name: "Sam", title: "How do you talk about ADHD with grandparents?", body: "They mean well but keep saying 'just focus.' Any scripts that helped?", replies: 6 }
];
let activeCategory = "All";
let nextId = 6;

function renderPills(){
  const wrap = document.getElementById('category-pills');
  wrap.innerHTML = '';
  CATEGORIES.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'pill' + (cat === activeCategory ? ' active' : '');
    btn.textContent = cat;
    btn.addEventListener('click', () => { activeCategory = cat; renderPills(); renderThreads(); });
    wrap.appendChild(btn);
  });
}

function renderThreads(){
  const list = document.getElementById('thread-list');
  list.innerHTML = '';
  const filtered = threads.filter(t => activeCategory === "All" || t.cat === activeCategory);

  if(!filtered.length){
    list.innerHTML = '<div class="badge-note">No threads in this category yet — be the first to post.</div>';
    return;
  }

  filtered.slice().reverse().forEach(t => {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.marginBottom = '16px';
    card.innerHTML = `
      <span class="tag">${t.cat}</span>
      <h3>${escapeHtml(t.title)}</h3>
      <p>${escapeHtml(t.body)}</p>
      <p class="field-note" style="margin-bottom:0;">Posted by ${escapeHtml(t.name)} · ${t.replies} ${t.replies === 1 ? 'reply' : 'replies'}</p>
    `;
    list.appendChild(card);
  });
}

function escapeHtml(s){
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function populateSelect(){
  const sel = document.getElementById('t-cat');
  sel.innerHTML = '';
  CATEGORIES.filter(c => c !== "All").forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat; opt.textContent = cat;
    sel.appendChild(opt);
  });
}

document.getElementById('new-thread-form').addEventListener('submit', e => {
  e.preventDefault();
  const name = document.getElementById('t-name').value.trim();
  const cat = document.getElementById('t-cat').value;
  const title = document.getElementById('t-title').value.trim();
  const body = document.getElementById('t-body').value.trim();
  if(!name || !title || !body) return;

  threads.push({ id: nextId++, cat, name, title, body, replies: 0 });
  activeCategory = cat;
  renderPills();
  renderThreads();
  e.target.reset();
});

renderPills();
populateSelect();
renderThreads();
