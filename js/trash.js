// Çöp Kutusu — gözlem, kitap, deneme, görev, hatırlatıcı, not ve belge silmeleri
// kalıcı olmadan önce buraya düşer. 30 gün içinde geri yüklenebilir, sonra sessizce
// kalıcı olarak temizlenir. Öğrenci silme ve toplu veri sıfırlama gibi büyük/kademeli
// işlemler buna dahil değildir — onlar zaten yazarak teyitli/çift onaylı korumalıdır.
const Trash = {
  SAKLAMA_GUNU: 30,

  async moveToTrash(storeName, kayit, ozet) {
    const record = {
      id: Utils.uid(),
      store: storeName,
      kayit,
      ozet: ozet || '',
      silinmeTarihi: new Date().toISOString(),
    };
    await State.save('trash', record);
    await State.remove(storeName, kayit.id);
    return record;
  },

  async restore(trashId) {
    const entry = State.data.trash.find((t) => t.id === trashId);
    if (!entry) return { ok: false, errors: ['Kayıt bulunamadı.'] };
    await State.save(entry.store, entry.kayit);
    await State.remove('trash', trashId);
    return { ok: true, entry };
  },

  async purgeOne(trashId) {
    await State.remove('trash', trashId);
  },

  async purgeAll() {
    for (const t of [...State.data.trash]) await State.remove('trash', t.id);
  },

  // Saklama süresini geçen kayıtları sessizce temizler — app açılışında çağrılır.
  async purgeExpired() {
    const esik = Date.now() - this.SAKLAMA_GUNU * 24 * 3600 * 1000;
    const expired = State.data.trash.filter((t) => new Date(t.silinmeTarihi).getTime() < esik);
    for (const t of expired) await State.remove('trash', t.id);
    return expired.length;
  },

  list() {
    return [...State.data.trash].sort((a, b) => (b.silinmeTarihi || '').localeCompare(a.silinmeTarihi || ''));
  },
};
