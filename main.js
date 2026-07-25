document.addEventListener('DOMContentLoaded', () => {

  // ---- mobile menu ----
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('nav.links');
  if(toggle && links){
    toggle.addEventListener('click', () => {
      const isOpen = links.classList.toggle('open');
      toggle.classList.toggle('open', isOpen);
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
    links.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        links.classList.remove('open');
        toggle.classList.remove('open');
      });
    });
  }

  // ---- header shadow on scroll ----
  const header = document.querySelector('header.site');
  if(header){
    const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // ---- scroll reveal ----
  const revealSelectors = '.card, .section-head, .hero-grid > div, .badge-note, .grid-2 > *';
  const revealEls = document.querySelectorAll(revealSelectors);

  if('IntersectionObserver' in window && revealEls.length){
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if(entry.isIntersecting){
          setTimeout(() => entry.target.classList.add('in-view'), i * 60 % 240);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    revealEls.forEach(el => {
      el.classList.add('reveal');
      observer.observe(el);
    });
  }
});
