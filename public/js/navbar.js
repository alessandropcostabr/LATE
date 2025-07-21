document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('menu-toggle');
  const menu = document.getElementById('navbar-menu');

  toggle.addEventListener('click', () => {
    menu.classList.toggle('show');
  });
});
