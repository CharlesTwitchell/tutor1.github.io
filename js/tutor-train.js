const loadingState = document.getElementById('loading-state');
const editorState = document.getElementById('editor-state');

async function init(){
  if(!API_BASE || API_BASE.includes('YOUR-WORKER-SUBDOMAIN')){
    loadingState.innerHTML = '<div class="badge-note">Backend isn\'t connected yet — set API_BASE in js/config.js first, then reload this page.</div>';
    return;
  }

  try{
    const sessionRes = await fetch(`${API_BASE}/api/session`, { credentials: 'include' });
    const sessionData = await sessionRes.json();

    if(!sessionData.authenticated){
      window.location.href = 'tutor-login.html';
      return;
    }

    const styleRes = await fetch(`${API_BASE}/api/style`, { credentials: 'include' });
    if(!styleRes.ok){
      window.location.href = 'tutor-login.html';
      return;
    }
    const styleData = await styleRes.json();
    document.getElementById('style-text').value = styleData.style;

    loadingState.style.display = 'none';
    editorState.style.display = 'block';
  }catch(err){
    loadingState.innerHTML = '<div class="badge-note">Couldn\'t reach the backend. Check your connection and reload.</div>';
  }
}

document.getElementById('save-btn')?.addEventListener('click', async () => {
  const status = document.getElementById('save-status');
  const style = document.getElementById('style-text').value;

  try{
    const res = await fetch(`${API_BASE}/api/style`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ style })
    });
    status.style.display = 'inline';
    if(res.ok){
      status.style.color = 'var(--mint)';
      status.textContent = 'Saved — students will see this style right away.';
    } else if(res.status === 401){
      window.location.href = 'tutor-login.html';
    } else {
      status.style.color = 'var(--danger)';
      status.textContent = 'Could not save. Please try again.';
    }
  }catch(err){
    status.style.display = 'inline';
    status.style.color = 'var(--danger)';
    status.textContent = "Couldn't reach the backend.";
  }
  setTimeout(() => { status.style.display = 'none'; }, 4000);
});

document.getElementById('logout-btn')?.addEventListener('click', async () => {
  try{
    await fetch(`${API_BASE}/api/logout`, { method: 'POST', credentials: 'include' });
  }finally{
    window.location.href = 'tutor-login.html';
  }
});

init();
