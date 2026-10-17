// JSON yedekleme / geri yükleme
// Önemli: Bu yalnızca cihaz içi bir yedektir. Telefon kaybolur/kırılırsa bu dosya da
// cihazdaydıysa kaybolur. Yedeği ayrıca bulutta (e-posta, Drive, iCloud vb.) saklamak gerekir.
const Backup = {
  BACKUP_VERSION: 1,

  async exportToFile() {
    const data = await DB.exportAll();
    const payload = {
      backupVersion: this.BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      app: 'ogrenci-takip',
      data,
    };
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const tarih = Utils.todayISO();
    a.href = url;
    a.download = `ogrenci-takip-yedek-${tarih}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    const settings = { ...State.data.settings, sonYedekTarihi: new Date().toISOString() };
    await State.save('settings', settings);
    return payload;
  },

  readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result);
          resolve(parsed);
        } catch (e) {
          reject(new Error('Dosya okunamadı — geçerli bir yedek dosyası değil.'));
        }
      };
      reader.onerror = () => reject(new Error('Dosya okunamadı.'));
      reader.readAsText(file);
    });
  },

  validate(payload) {
    if (!payload || typeof payload !== 'object') return 'Geçersiz dosya.';
    if (!payload.data || typeof payload.data !== 'object') return 'Geçersiz yedek içeriği.';
    if (!Array.isArray(payload.data.students)) return 'Yedek içinde öğrenci verisi bulunamadı.';
    return null;
  },

  // Gerçek geri yükleme — çağıran taraf (UI) önce kullanıcıdan onay almalı.
  async restore(payload) {
    const err = this.validate(payload);
    if (err) return { ok: false, error: err };
    await DB.importAll(payload.data);
    await State.init();
    return { ok: true };
  },
};
