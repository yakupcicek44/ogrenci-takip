// Service Worker — çevrimdışı çalışma için uygulama kabuğunu ve kütüphaneleri önbelleğe alır.
// Veri (öğrenci kayıtları vb.) burada DEĞİL, cihazdaki IndexedDB'de tutulur.
const CACHE_NAME = 'ogrenci-takip-v6';

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/db.js',
  './js/utils.js',
  './js/state.js',
  './js/auth.js',
  './js/students.js',
  './js/assessments.js',
  './js/homework.js',
  './js/books.js',
  './js/exams.js',
  './js/backup.js',
  './js/observations.js',
  './js/tasks.js',
  './js/reminders.js',
  './js/notes.js',
  './js/scan.js',
  './js/drive.js',
  './js/reports.js',
  './js/ui-common.js',
  './js/ui-auth.js',
  './js/ui-dashboard.js',
  './js/ui-students.js',
  './js/ui-homework.js',
  './js/ui-assistant.js',
  './js/ui-reports.js',
  './js/ui-settings.js',
  './js/app.js',
  './vendor/jspdf.umd.min.js',
  './vendor/jspdf.plugin.autotable.min.js',
  './vendor/xlsx.full.min.js',
  './vendor/chart.umd.min.js',
  './vendor/lato-font.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        if (event.request.mode === 'navigate') return caches.match('./index.html');
        return new Response('', { status: 504, statusText: 'Çevrimdışı ve önbellekte yok' });
      });
    })
  );
});
