const chatWindow = document.getElementById('chat-window');
const chatError = document.getElementById('chat-error');
let history = [];
let sending = false;

function addMessage(text, who){
  const div = document.createElement('div');
  div.className = 'msg ' + who;
  div.textContent = text;
  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return div;
}

function showError(text){
  chatError.style.display = 'block';
  chatError.textContent = text;
}
function clearError(){
  chatError.style.display = 'none';
}

addMessage("Hi! I'm Tutor Bot. Ask me something you're stuck on and I'll walk through it with you, step by step.", 'bot');

async function sendMessage(){
  if(sending) return;
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if(!text) return;

  clearError();
  addMessage(text, 'user');
  input.value = '';
  sending = true;

  const typingEl = addMessage('Thinking…', 'bot typing');

  try{
    if(!API_BASE || API_BASE.includes('YOUR-WORKER-SUBDOMAIN')){
      throw new Error('not-configured');
    }
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, history })
    });
    if(!res.ok){
      throw new Error('bad-response');
    }
    const data = await res.json();
    typingEl.remove();
    addMessage(data.reply, 'bot');
    history.push({ role: 'user', content: text });
    history.push({ role: 'assistant', content: data.reply });
  }catch(err){
    typingEl.remove();
    if(err.message === 'not-configured'){
      showError("Tutor Bot isn't connected yet — the site owner needs to finish the backend setup (see backend/SETUP-TUTOR-BOT.md).");
    } else {
      showError("Tutor Bot is having trouble responding right now. Please try again in a moment.");
    }
  }finally{
    sending = false;
  }
}

document.getElementById('chat-send').addEventListener('click', sendMessage);
document.getElementById('chat-input').addEventListener('keydown', e => {
  if(e.key === 'Enter') sendMessage();
});
