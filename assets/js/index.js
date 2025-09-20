document.addEventListener('DOMContentLoaded', () => {
  const yearSpan = document.getElementById('year');
  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }

  activatePage();
  setupLinkTransitions();
});

function activatePage() {
  if (document.body && document.body.classList.contains('page--transition')) {
    requestAnimationFrame(() => {
      document.body.classList.add('page--ready');
      document.body.classList.remove('page--exit');
    });
  }
}

function setupLinkTransitions() {
  const links = document.querySelectorAll('a[data-transition]');
  links.forEach((link) => {
    link.addEventListener('click', (event) => {
      const href = link.getAttribute('href');
      if (!href || href.startsWith('#') || link.target === '_blank') {
        return;
      }

      event.preventDefault();
      triggerPageExit(() => {
        window.location.href = href;
      });
    });
  });
}

function triggerPageExit(callback) {
  if (!document.body) {
    callback();
    return;
  }

  document.body.classList.add('page--exit');

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    callback();
    return;
  }

  setTimeout(callback, 350);
}
