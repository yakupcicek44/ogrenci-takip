// Router + uygulama başlangıcı
const Router = {
  routes: [
    { pattern: /^#\/$/, view: DashboardView },
    { pattern: /^#\/ogrenciler$/, view: StudentListView },
    { pattern: /^#\/ogrenci\/([^/]+)$/, view: StudentDetailView, params: ['id'] },
    { pattern: /^#\/ogrenci\/([^/]+)\/([^/]+)$/, view: StudentDetailView, params: ['id', 'tab'] },
    { pattern: /^#\/odev-atama$/, view: HomeworkView },
    { pattern: /^#\/yoklama$/, view: AttendanceView },
    { pattern: /^#\/asistan$/, view: AssistantView },
    { pattern: /^#\/asistan\/([^/]+)$/, view: AssistantView, params: ['tab'] },
    { pattern: /^#\/raporlar$/, view: ReportsView },
    { pattern: /^#\/ayarlar$/, view: SettingsView },
    { pattern: /^#\/cop-kutusu$/, view: TrashView },
  ],

  resolve(hashWithQuery) {
    const hash = hashWithQuery.split('?')[0] || '#/';
    for (const route of this.routes) {
      const match = hash.match(route.pattern);
      if (match) {
        const params = {};
        (route.params || []).forEach((name, i) => { params[name] = decodeURIComponent(match[i + 1]); });
        return { view: route.view, params };
      }
    }
    return { view: DashboardView, params: {} };
  },

  async render() {
    const hash = location.hash || '#/';
    const { view, params } = this.resolve(hash);
    const app = document.getElementById('app');
    app.innerHTML = view.html(params);
    if (view.mount) await view.mount(params);
    renderBottomNav(hash);
    window.scrollTo(0, 0);
  },
};

async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('./sw.js');
    } catch (e) {
      console.warn('Service worker kaydedilemedi:', e);
    }
  }
}

window.addEventListener('hashchange', () => {
  if (Auth.isUnlocked()) Router.render();
});

function maybeAutoDriveBackup() {
  if (!DriveBackup.isConnected()) return;
  const son = State.data.settings.drive?.sonBasariliYedek;
  const yirmiSaatGecti = !son || (Date.now() - new Date(son).getTime()) > 20 * 3600 * 1000;
  if (!yirmiSaatGecti) return;
  // Sessiz, en iyi gayret denemesi — başarısız olursa kullanıcıyı rahatsız etmez,
  // Ayarlar'daki "Şimdi Yedekle" butonu her zaman manuel çalışır.
  DriveBackup.backupNow({ interactive: false }).catch(() => {});
}

async function boot() {
  document.getElementById('bottom-nav').style.display = '';
  if (!location.hash) location.hash = '#/';
  await Trash.purgeExpired();
  await Router.render();
  registerServiceWorker();
  Utils.markSaved();
  maybeAutoDriveBackup();
}

function showLogin() {
  document.getElementById('bottom-nav').style.display = 'none';
  document.getElementById('app').innerHTML = LoginView.html();
  LoginView.mount(boot);
}

window.addEventListener('DOMContentLoaded', async () => {
  Theme.apply();
  Theme.initSystemListener();
  try {
    await State.init();
  } catch (e) {
    console.error(e);
    document.getElementById('app').innerHTML = `<div class="page"><div class="page-content">
      <div class="alert alert-error">Veritabanı başlatılamadı. Tarayıcını güncelleyip tekrar dener misin?</div>
    </div></div>`;
    return;
  }

  if (Auth.isUnlocked()) {
    await boot();
  } else {
    showLogin(); // Auth.isSetup() durumuna göre giriş veya ilk kurulum formu gösterir
  }
});
