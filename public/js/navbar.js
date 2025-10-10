document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('appNavbarToggle');
  const menu = document.getElementById('appNavbarMenu');
  const userToggle = document.getElementById('appNavbarUserToggle');
  const userMenu = document.getElementById('appNavbarUserMenu');

  const setOpen = (state) => {
    if (!toggle || !menu) return;
    const isOpen = Boolean(state);
    menu.classList.toggle('is-open', isOpen);
    toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    document.body.classList.toggle('has-navbar-menu', isOpen);
  };

  const setUserOpen = (state) => {
    if (!userToggle || !userMenu) return;
    const isOpen = Boolean(state);
    userMenu.classList.toggle('is-open', isOpen);
    userMenu.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
    userToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  };

  setOpen(false);
  setUserOpen(false);

  if (toggle && menu) {
    toggle.addEventListener('click', () => {
      const willOpen = !menu.classList.contains('is-open');
      setUserOpen(false);
      setOpen(willOpen);
    });
  }

  if (userToggle && userMenu) {
    userToggle.addEventListener('click', () => {
      const willOpen = !userMenu.classList.contains('is-open');
      setOpen(false);
      setUserOpen(willOpen);
    });
  }

  document.addEventListener('click', (event) => {
    const target = event.target;

    if (menu && menu.classList.contains('is-open')) {
      if (!menu.contains(target) && (!toggle || !toggle.contains(target))) {
        setOpen(false);
      }
    }

    if (userMenu && userMenu.classList.contains('is-open')) {
      if (!userMenu.contains(target) && (!userToggle || !userToggle.contains(target))) {
        setUserOpen(false);
      }
    }
  });

  document.addEventListener('keyup', (event) => {
    if (event.key === 'Escape') {
      setOpen(false);
      setUserOpen(false);
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 900) {
      setOpen(false);
    }
    setUserOpen(false);
  });
});
