document.getElementById('contact-form')?.addEventListener('submit', function(e){
  e.preventDefault();

  // ---- WIRE THIS UP ----
  // Replace this whole block with a real submission, e.g.:
  //
  // fetch('https://formspree.io/f/yourFormId', {
  //   method: 'POST',
  //   headers: { 'Accept': 'application/json' },
  //   body: new FormData(e.target)
  // }).then(...)
  //
  // Until then, this just shows a confirmation message so you can see the flow.

  const status = document.getElementById('form-status');
  status.style.display = 'block';
  status.textContent = "Thanks — this is a demo confirmation. Connect a form backend (see the note below) to actually receive messages.";
  e.target.reset();
});
