// Ortak UI bileşenleri: modal, onay diyaloğu, alt gezinme çubuğu
const Modal = {
  open(html, { onMount } = {}) {
    const root = document.getElementById('modal-root');
    root.innerHTML = `
      <div class="modal-overlay" id="modal-overlay">
        <div class="modal-box" id="modal-box">${html}</div>
      </div>`;
    root.querySelector('#modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'modal-overlay') Modal.close();
    });
    if (onMount) onMount(root);
  },
  close() {
    const root = document.getElementById('modal-root');
    root.innerHTML = '';
  },
};

const Confirm = {
  ask(message, { danger = false, confirmText = 'Evet', cancelText = 'Vazgeç' } = {}) {
    return new Promise((resolve) => {
      Modal.open(`
        <div class="modal-header">Onay</div>
        <div class="modal-body"><p>${Utils.escapeHtml(message)}</p></div>
        <div class="modal-actions">
          <button class="btn btn-secondary" id="confirm-cancel">${Utils.escapeHtml(cancelText)}</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="confirm-ok">${Utils.escapeHtml(confirmText)}</button>
        </div>
      `, {
        onMount: (root) => {
          root.querySelector('#confirm-cancel').onclick = () => { Modal.close(); resolve(false); };
          root.querySelector('#confirm-ok').onclick = () => { Modal.close(); resolve(true); };
        },
      });
    });
  },

  // İki aşamalı, yazarak onaylanan koruma — geri alınamaz işlemlerde (örn. öğrenci
  // kaydını tamamen silme) tek tıkla yanlışlıkla onaylamayı engellemek için.
  askTyped(message, matchText, { confirmText = 'Kalıcı Olarak Sil' } = {}) {
    return new Promise((resolve) => {
      Modal.open(`
        <div class="modal-header">Son Onay</div>
        <div class="modal-body">
          <p>${Utils.escapeHtml(message)}</p>
          <p class="muted small">Onaylamak için şunu tam olarak yaz: <strong>${Utils.escapeHtml(matchText)}</strong></p>
          <input type="text" id="confirm-typed-input" class="input" autocomplete="off">
          <div id="confirm-typed-error" class="form-errors"></div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" id="confirm-typed-cancel">Vazgeç</button>
          <button class="btn btn-danger" id="confirm-typed-ok">${Utils.escapeHtml(confirmText)}</button>
        </div>
      `, {
        onMount: (root) => {
          root.querySelector('#confirm-typed-cancel').onclick = () => { Modal.close(); resolve(false); };
          root.querySelector('#confirm-typed-ok').onclick = () => {
            const val = root.querySelector('#confirm-typed-input').value.trim();
            if (val.toLocaleLowerCase('tr') !== matchText.trim().toLocaleLowerCase('tr')) {
              root.querySelector('#confirm-typed-error').textContent = 'Yazdığın metin eşleşmedi.';
              return;
            }
            Modal.close();
            resolve(true);
          };
        },
      });
    });
  },
};

const NAV_ITEMS = [
  { route: '#/', label: 'Ana Sayfa', icon: '🏠' },
  { route: '#/ogrenciler', label: 'Öğrenciler', icon: '🧑‍🎓' },
  { route: '#/odev-atama', label: 'Ödevler', icon: '📝' },
  { route: '#/yoklama', label: 'Yoklama', icon: '🗓️' },
  { route: '#/asistan', label: 'Asistan', icon: '✅' },
  { route: '#/raporlar', label: 'Raporlar', icon: '📄' },
  { route: '#/ayarlar', label: 'Ayarlar', icon: '⚙️' },
];

function renderBottomNav(currentHash) {
  const nav = document.getElementById('bottom-nav');
  const activeBase = '#/' + (currentHash.split('/')[1] || '');
  nav.innerHTML = NAV_ITEMS.map((item) => {
    const isActive = item.route === activeBase || (item.route === '#/' && activeBase === '#/');
    return `<a href="${item.route}" class="nav-item ${isActive ? 'active' : ''}">
      <span class="nav-icon">${item.icon}</span>
      <span class="nav-label">${item.label}</span>
    </a>`;
  }).join('');
}

function pageWrap(title, contentHtml, { back, actions } = {}) {
  return `
    <div class="page">
      <div class="page-topbar">
        ${back ? `<a href="${back}" class="topbar-back">←</a>` : ''}
        <h1 class="page-title">${Utils.escapeHtml(title)}</h1>
        ${actions ? `<div class="topbar-actions">${actions}</div>` : ''}
      </div>
      <div class="page-content">${contentHtml}</div>
    </div>
  `;
}

function emptyState(text, icon = '📭') {
  return `<div class="empty-state"><div class="empty-icon">${icon}</div><p>${Utils.escapeHtml(text)}</p></div>`;
}
