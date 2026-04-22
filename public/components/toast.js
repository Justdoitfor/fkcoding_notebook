export function renderToastContainer(container) {
  window.showToast = (msg, type = '') => {
    const tc = container;
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.textContent = msg;
    tc.appendChild(t);
    requestAnimationFrame(() => { requestAnimationFrame(() => t.classList.add('show')); });
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 300);
    }, 2800);
  };
}
