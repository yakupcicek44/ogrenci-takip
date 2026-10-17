// Basit cihaz-içi kilit: kullanıcı adı/şifre sadece bu telefonu eline alan birinin
// uygulamayı açmasını geciktirir. Bu bir sunucu/şifreleme güvenliği DEĞİLDİR —
// tarayıcı geliştirici araçlarına erişimi olan biri veriye yine de ulaşabilir.
const Auth = {
  SESSION_KEY: 'ogrenciTakipUnlocked',

  async _hash(password, saltHex) {
    const enc = new TextEncoder();
    const data = enc.encode(saltHex + ':' + password);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  },

  _randomSalt() {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  },

  isSetup() {
    return !!(State.data.settings.auth && State.data.settings.auth.username);
  },

  async setup(username, password) {
    if (!username || !username.trim()) return { ok: false, error: 'Kullanıcı adı boş olamaz.' };
    if (!password || password.length < 4) return { ok: false, error: 'Şifre en az 4 karakter olmalı.' };
    const saltHex = this._randomSalt();
    const hashHex = await this._hash(password, saltHex);
    const settings = { ...State.data.settings, auth: { username: username.trim(), saltHex, hashHex } };
    await State.save('settings', settings);
    this.unlock();
    return { ok: true };
  },

  async verify(username, password) {
    const auth = State.data.settings.auth;
    if (!auth) return false;
    if (username.trim().toLowerCase() !== auth.username.toLowerCase()) return false;
    const hashHex = await this._hash(password, auth.saltHex);
    return hashHex === auth.hashHex;
  },

  async changePassword(currentPassword, newUsername, newPassword) {
    const auth = State.data.settings.auth;
    const ok = await this.verify(auth.username, currentPassword);
    if (!ok) return { ok: false, error: 'Mevcut şifre yanlış.' };
    return this.setup(newUsername || auth.username, newPassword);
  },

  isUnlocked() {
    try { return sessionStorage.getItem(this.SESSION_KEY) === '1'; } catch (e) { return false; }
  },

  unlock() {
    try { sessionStorage.setItem(this.SESSION_KEY, '1'); } catch (e) { /* no-op */ }
  },

  lock() {
    try { sessionStorage.removeItem(this.SESSION_KEY); } catch (e) { /* no-op */ }
  },

  // Şifre unutulduğunda: kurtarma yöntemi yoktur (backend yok). Tüm veriyi ve
  // kilidi sıfırlar — kullanıcı daha sonra bir JSON yedekten geri yükleyebilir.
  async resetEverything() {
    for (const store of ['students', 'terms', 'assessments', 'homeworkTasks', 'homeworkAssignments', 'books', 'mockExams', 'scans', 'observations', 'tasks', 'reminders', 'notes', 'settings']) {
      await DB.clear(store);
    }
    await State.init();
    this.lock();
  },
};
