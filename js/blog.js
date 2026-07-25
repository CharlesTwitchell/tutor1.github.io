// ---- WIRE THIS UP ----
// Set this to your real Substack address, no trailing slash.
const SUBSTACK_URL = "https://YOURNAME.substack.com";

const FEED_URL = `${SUBSTACK_URL}/feed`;
const PROXY_URL = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(FEED_URL)}`;

const SAMPLE_POSTS = [
  {
    title: "Why 'just start' doesn't work for ADHD brains",
    pubDate: "2026-06-02",
    link: "#",
    description: "Task initiation isn't a motivation problem — it's a starting-friction problem. Here's the three-step trick I use with every new student."
  },
  {
    title: "The two-minute planner check-in",
    pubDate: "2026-05-19",
    link: "#",
    description: "A planner only works if it takes less energy to open than to ignore. Here's the version that's actually stuck for my students."
  },
  {
    title: "What 'body doubling' actually looks like in a tutoring session",
    pubDate: "2026-05-05",
    link: "#",
    description: "It's not just 'working near someone.' Here's how I structure body-doubling so it builds independence instead of dependence."
  }
];

function formatDate(d){
  try{
    return new Date(d).toLocaleDateString(undefined, { year:'numeric', month:'long', day:'numeric' });
  }catch(e){ return d; }
}

function renderPosts(posts, isSample){
  const grid = document.getElementById('blog-grid');
  const status = document.getElementById('blog-status');
  grid.innerHTML = '';

  posts.slice(0, 9).forEach(post => {
    const card = document.createElement('a');
    card.href = post.link;
    card.target = "_blank";
    card.rel = "noopener";
    card.className = "card";
    card.style.textDecoration = "none";
    card.style.display = "block";
    const desc = (post.description || '').replace(/<[^>]*>/g, '').slice(0, 140);
    card.innerHTML = `
      <span class="tag">${formatDate(post.pubDate)}</span>
      <h3>${post.title}</h3>
      <p>${desc}${desc.length >= 140 ? '…' : ''}</p>
    `;
    grid.appendChild(card);
  });

  if(isSample){
    status.style.display = 'block';
    status.innerHTML = "Showing sample posts — connect your real Substack feed in <code>js/blog.js</code> to replace these.";
  } else {
    status.style.display = 'none';
  }
}

async function loadPosts(){
  if(SUBSTACK_URL.includes('YOURNAME')){
    renderPosts(SAMPLE_POSTS, true);
    return;
  }
  try{
    const res = await fetch(PROXY_URL);
    const data = await res.json();
    if(data.status === 'ok' && data.items && data.items.length){
      renderPosts(data.items, false);
    } else {
      throw new Error('empty feed');
    }
  }catch(err){
    renderPosts(SAMPLE_POSTS, true);
  }
}

loadPosts();
