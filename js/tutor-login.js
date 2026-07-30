document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('login-error');
  errorEl.style.display = 'none';
  const password = document.getElementById('password').value;

  if(!API_BASE || API_BASE.includes('YOUR-WORKER-SUBDOMAIN')){
    errorEl.style.display = 'block';
    errorEl.textContent = "Backend isn't connected yet — set API_BASE in js/config.js first.";
    return;
  }

  try{
    const res = await fetch(`${API_BASE}/api/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    if(res.ok){
      window.location.href = 'tutor-train.html';
    } else {
      errorEl.style.display = 'block';
      errorEl.textContent = 'Incorrect password.';
    }
  }catch(err){
    errorEl.style.display = 'block';
    errorEl.textContent = "Couldn't reach the backend. Check your connection and try again.";
  }
});
