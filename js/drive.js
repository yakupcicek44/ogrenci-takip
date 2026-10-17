// Google Drive'a otomatik yedek yükleme (Yakup'un KENDİ Drive'ı, Google Identity Services ile).
// Kapsam "drive.file" ile sınırlı: uygulama SADECE kendi oluşturduğu dosyaları görebilir,
// Yakup'un Drive'ındaki diğer dosyalara erişemez. Token hiçbir yerde kalıcı saklanmaz,
// sadece bellekte tutulur ve süresi dolunca sessizce yenilenmeye çalışılır.
const DriveConfig = {
  CLIENT_ID: '566416223155-outplgmnrfuuee09aq7sgg7r3ro0pfsu.apps.googleusercontent.com',
  SCOPE: 'https://www.googleapis.com/auth/drive.file',
};

const DriveBackup = {
  _tokenClient: null,
  _accessToken: null,
  _tokenExpiresAt: 0,

  async _loadGis() {
    if (window.google && window.google.accounts && window.google.accounts.oauth2) return;
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Google giriş betiği yüklenemedi (internet gerekir).'));
      document.head.appendChild(script);
    });
  },

  async _ensureTokenClient() {
    await this._loadGis();
    if (this._tokenClient) return;
    this._tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: DriveConfig.CLIENT_ID,
      scope: DriveConfig.SCOPE,
      callback: () => {}, // her çağrıda override edilir
    });
  },

  isConnected() {
    return !!(State.data.settings.drive && State.data.settings.drive.connected);
  },

  // Kullanıcı etkileşimiyle (buton tıklaması) açık onay ekranı gösterir.
  async connectInteractive() {
    await this._ensureTokenClient();
    return new Promise((resolve, reject) => {
      this._tokenClient.callback = async (resp) => {
        if (resp.error) { reject(new Error(resp.error)); return; }
        this._accessToken = resp.access_token;
        this._tokenExpiresAt = Date.now() + (resp.expires_in - 60) * 1000;
        await State.save('settings', { ...State.data.settings, drive: { connected: true, sonBasariliYedek: State.data.settings.drive?.sonBasariliYedek || null } });
        resolve();
      };
      this._tokenClient.requestAccessToken({ prompt: 'consent' });
    });
  },

  // Sayfa her açıldığında interaktif olmadan (sessizce) token almayı dener; başarısızsa null döner.
  async getTokenSilently() {
    if (this._accessToken && Date.now() < this._tokenExpiresAt) return this._accessToken;
    if (!this.isConnected()) return null;
    try {
      await this._ensureTokenClient();
      return await new Promise((resolve) => {
        this._tokenClient.callback = (resp) => {
          if (resp.error) { resolve(null); return; }
          this._accessToken = resp.access_token;
          this._tokenExpiresAt = Date.now() + (resp.expires_in - 60) * 1000;
          resolve(this._accessToken);
        };
        this._tokenClient.requestAccessToken({ prompt: '' });
      });
    } catch (e) {
      return null;
    }
  },

  async disconnect() {
    this._accessToken = null;
    this._tokenExpiresAt = 0;
    await State.save('settings', { ...State.data.settings, drive: { connected: false, sonBasariliYedek: null } });
  },

  async _uploadJson(token, filename, jsonString) {
    const boundary = 'ogrenci_takip_boundary';
    const metadata = { name: filename, mimeType: 'application/json' };
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n${jsonString}\r\n--${boundary}--`;

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error('Drive yükleme hatası: ' + text.slice(0, 200));
    }
    return res.json();
  },

  // Manuel ("Şimdi Yedekle" butonu) veya otomatik (açılışta) çağrılabilir.
  async backupNow({ interactive = false } = {}) {
    const token = interactive ? await this._interactiveTokenOrThrow() : await this.getTokenSilently();
    if (!token) return { ok: false, reason: 'no-token' };

    const data = await DB.exportAll();
    const payload = { backupVersion: Backup.BACKUP_VERSION, exportedAt: new Date().toISOString(), app: 'ogrenci-takip', data };
    const filename = `ogrenci-takip-yedek-${Utils.todayISO()}.json`;

    await this._uploadJson(token, filename, JSON.stringify(payload));

    const now = new Date().toISOString();
    await State.save('settings', { ...State.data.settings, drive: { connected: true, sonBasariliYedek: now } });
    return { ok: true };
  },

  async _interactiveTokenOrThrow() {
    const silent = await this.getTokenSilently();
    if (silent) return silent;
    await this.connectInteractive();
    return this._accessToken;
  },
};
