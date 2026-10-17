// Gece/Gündüz modu. Cihaz bazlı bir görüntü tercihi olduğu için (veri değil) kasıtlı
// olarak localStorage'da tutulur — IndexedDB yedeğine dahil edilmez, başka bir cihazdan
// geri yüklense bile her cihaz kendi görünüm tercihini korur.
const Theme = {
  KEY: 'ogrenciTakipTema',
  OPTIONS: [
    { key: 'light', label: 'Açık', icon: '☀️' },
    { key: 'dark', label: 'Koyu', icon: '🌙' },
    { key: 'system', label: 'Sistem', icon: '⚙️' },
  ],

  get() {
    try {
      const v = localStorage.getItem(this.KEY);
      return v === 'light' || v === 'dark' ? v : 'system';
    } catch (e) {
      return 'system';
    }
  },

  set(mode) {
    try {
      if (mode === 'system') localStorage.removeItem(this.KEY);
      else localStorage.setItem(this.KEY, mode);
    } catch (e) { /* no-op */ }
    this.apply();
  },

  apply() {
    const mode = this.get();
    if (mode === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', mode);

    const resolved = mode === 'system'
      ? (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : mode;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', resolved === 'dark' ? '#0b1220' : '#2563eb');
  },

  initSystemListener() {
    if (!window.matchMedia) return;
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (this.get() === 'system') this.apply();
    });
  },
};
