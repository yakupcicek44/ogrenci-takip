// Her gerçek deploy'da elle artırılır — Ayarlar'daki Sistem Durumu'nda görünür,
// yeni sürümün telefona gerçekten indiğini doğrulamanın en kolay yolu budur.
const APP_VERSION = '2026.10.17-13';

// Ortak yardımcı fonksiyonlar
const Utils = {
  uid() {
    return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
  },

  todayISO() {
    return new Date().toISOString().slice(0, 10);
  },

  formatDateTR(isoStr) {
    if (!isoStr) return '-';
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('tr-TR');
  },

  formatDateTimeTR(isoStr) {
    if (!isoStr) return '-';
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleString('tr-TR');
  },

  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  debounce(fn, ms) {
    let t = null;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  },

  // Boş olmayan sayısal değer kontrolü (0 geçerli bir nottur, boş değildir)
  isEmptyGrade(v) {
    return v === null || v === undefined || v === '';
  },

  round1(n) {
    return Math.round(n * 10) / 10;
  },

  toast(msg, type = 'info') {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'toast toast-' + type + ' show';
    clearTimeout(el._hideTimer);
    el._hideTimer = setTimeout(() => el.classList.remove('show'), 2600);
    this.haptic(type);
  },

  // Dokunsal geri bildirim — sadece destekleyen cihazlarda (çoğunlukla Android Chrome),
  // iOS Safari'de Vibration API yok, sessizce hiçbir şey yapmaz.
  haptic(type) {
    try {
      if (!navigator.vibrate) return;
      if (type === 'error') navigator.vibrate([12, 40, 12]);
      else if (type === 'success') navigator.vibrate(12);
      else navigator.vibrate(8);
    } catch (e) { /* no-op */ }
  },

  // Son kayıt zamanı göstergesini güncelle
  markSaved() {
    const el = document.getElementById('save-indicator');
    if (!el) return;
    const now = new Date();
    el.textContent = 'Kaydedildi · ' + now.toLocaleTimeString('tr-TR');
    el.classList.remove('save-pending');
    el.classList.add('save-ok');
  },

  markSaving() {
    const el = document.getElementById('save-indicator');
    if (!el) return;
    el.textContent = 'Kaydediliyor…';
    el.classList.remove('save-ok');
    el.classList.add('save-pending');
  },
};
