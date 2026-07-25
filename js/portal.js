const COURSE_CATS = ["All", "Study skills", "Executive function", "Math", "Reading & writing"];

// In-memory only — resets on reload. See setup note on the page for real hosting options.
let courses = [
  { id: 1, cat: "Executive function", title: "Building a planner system that sticks", desc: "A 4-part video series on choosing and actually using a planner, from someone who's tried them all.", minutes: 42 },
  { id: 2, cat: "Study skills", title: "The 2-minute start", desc: "Why the hardest part of homework is opening the laptop, and five ways to shrink that first step.", minutes: 18 },
  { id: 3, cat: "Math", title: "Algebra 1 foundations refresher", desc: "A self-paced refresher covering the building blocks that make everything after Algebra 1 click.", minutes: 96 },
  { id: 4, cat: "Reading & writing", title: "Five-paragraph essays without the dread", desc: "A step-by-step framework for essay writing that removes the blank-page freeze.", minutes: 55 },
  { id: 5, cat: "Executive function", title: "Time-blindness 101", desc: "Practical tools for estimating how long things actually take — and building in buffer without guilt.", minutes: 30 }
];
let activeCat = "All";
let nextId = 6;

function renderPills(){
  const wrap = document.getElementById('course-pills');
  wrap.innerHTML = '';
  COURSE_CATS.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'pill' + (cat === activeCat ? ' active' : '');
    btn.textContent = cat;
    btn.addEventListener('click', () => { activeCat = cat; renderPills(); renderCourses(); });
    wrap.appendChild(btn);
  });
}

function renderCourses(){
  const grid = document.getElementById('course-grid');
  grid.innerHTML = '';
  const filtered = courses.filter(c => activeCat === "All" || c.cat === activeCat);

  if(!filtered.length){
    grid.innerHTML = '<div class="badge-note">No courses in this category yet.</div>';
    return;
  }

  filtered.forEach(c => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <span class="tag">${escapeHtml(c.cat)}</span>
      <h3>${escapeHtml(c.title)}</h3>
      <p>${escapeHtml(c.desc)}</p>
      <p class="field-note" style="margin-bottom:14px;">${c.minutes} min · video course</p>
      <button class="btn btn-ghost" style="width:100%;" disabled>Start course (demo)</button>
    `;
    grid.appendChild(card);
  });
}

function escapeHtml(s){
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function populateSelect(){
  const sel = document.getElementById('c-cat');
  sel.innerHTML = '';
  COURSE_CATS.filter(c => c !== "All").forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat; opt.textContent = cat;
    sel.appendChild(opt);
  });
}

document.getElementById('upload-form').addEventListener('submit', e => {
  e.preventDefault();
  const title = document.getElementById('c-title').value.trim();
  const cat = document.getElementById('c-cat').value;
  const desc = document.getElementById('c-desc').value.trim();
  if(!title || !desc) return;

  courses.push({ id: nextId++, cat, title, desc, minutes: 0 });
  activeCat = cat;
  renderPills();
  renderCourses();
  e.target.reset();
});

renderPills();
populateSelect();
renderCourses();
