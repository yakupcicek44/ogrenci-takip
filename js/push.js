// Telefon kilitliyken/uygulama kapalıyken de gelen gerçek push bildirimleri.
// ÖNEMLİ SINIRLAR:
//  - Bu bir ÇALAR SAAT değildir: telefonun sessiz modunu/Rahatsız Etmeyin ayarını AŞAMAZ,
//    ekranı tam kaplamaz, durdurulana kadar çalmaz. Normal bir bildirim gibi davranır
//    (WhatsApp mesajı geldiğinde ne oluyorsa onun aynısı).
//  - Açıldığında SADECE hatırlatıcı metni+zamanı (öğrenci adı geçebilir) Yakup'un kendi
//    Cloudflare hesabına senkronize olur — başka hiçbir öğrenci verisi (not, sınav, kitap vb.)
//    cihaz dışına çıkmaz.
const PushConfig = {
  VAPID_PUBLIC_KEY: 'BD7fTG79XDQeOqceS3xYdLDPuusr36mCqgfl9-UbPA3HzYiYztE8MH3o17u-YzJrpJhYdzOEVQJY_KR5KYM6U-c',
};

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

const Push = {
  isSupported() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  },

  getPermission() {
    return this.isSupported() ? Notification.permission : 'unsupported';
  },

  async isEnabled() {
    if (!this.isSupported()) return false;
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return false;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  },

  async enable() {
    if (!this.isSupported()) return { ok: false, error: 'Bu tarayıcı bildirim desteklemiyor.' };
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { ok: false, error: 'Bildirim izni verilmedi. Telefon ayarlarından bu uygulamaya bildirim izni vermen gerekir.' };
    }
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(PushConfig.VAPID_PUBLIC_KEY),
      });
    }
    try {
      await fetch(ScanConfig.WORKER_URL + '/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-App-Secret': ScanConfig.APP_SHARED_SECRET },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
    } catch (e) {
      return { ok: false, error: 'Sunucuya kaydedilemedi: ' + e.message };
    }

    // Zaten var olan (tamamlanmamış) hatırlatıcıları da senkronize et.
    for (const r of State.data.reminders.filter((x) => !x.tamamlandi)) {
      await Push.syncReminder(r);
    }
    return { ok: true };
  },

  async disable() {
    if (!this.isSupported()) return;
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    try {
      await fetch(ScanConfig.WORKER_URL + '/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-App-Secret': ScanConfig.APP_SHARED_SECRET },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
    } catch (e) { /* no-op — yerel aboneliği yine de kaldır */ }
    await sub.unsubscribe();
  },

  // Sunucuya sadece ETKİNLEŞTİRİLMİŞSE gönderir (best-effort, çevrimdışıysa sessizce geçer).
  async syncReminder(reminder) {
    if (!(await this.isEnabled())) return;
    try {
      await fetch(ScanConfig.WORKER_URL + '/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-App-Secret': ScanConfig.APP_SHARED_SECRET },
        body: JSON.stringify({ id: reminder.id, metin: reminder.metin, tarih: reminder.tarih, saat: reminder.saat, tamamlandi: reminder.tamamlandi }),
      });
    } catch (e) { /* no-op */ }
  },

  async deleteReminderSync(id) {
    if (!(await this.isEnabled())) return;
    try {
      await fetch(ScanConfig.WORKER_URL + '/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-App-Secret': ScanConfig.APP_SHARED_SECRET },
        body: JSON.stringify({ action: 'delete', id }),
      });
    } catch (e) { /* no-op */ }
  },
};
