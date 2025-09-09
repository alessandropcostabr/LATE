document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('navbarToggler');
  const menu = document.getElementById('navbarNav');
  if (!btn || !menu) return;
  btn.addEventListener('click', () => {
    menu.classList.toggle('show');
  });
});
