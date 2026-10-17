// Kitap okuma takibi
const BOOK_DURUMLAR = ['okunuyor', 'tamamlandı', 'bırakıldı'];

const Books = {
  DURUMLAR: BOOK_DURUMLAR,

  async save(studentId, form, existingId) {
    if (!form.kitapAdi || !form.kitapAdi.trim()) return { ok: false, errors: ['Kitap adı boş olamaz.'] };

    const record = {
      id: existingId || Utils.uid(),
      studentId,
      kitapAdi: form.kitapAdi.trim(),
      yazar: form.yazar || '',
      sayfaSayisi: Utils.isEmptyGrade(form.sayfaSayisi) ? null : Number(form.sayfaSayisi),
      baslangicTarihi: form.baslangicTarihi || null,
      bitisTarihi: form.bitisTarihi || null,
      durum: form.durum || 'okunuyor',
      ogrenciOzeti: form.ogrenciOzeti || '',
      ogretmenDegerlendirmesi: form.ogretmenDegerlendirmesi || '',
    };
    await State.save('books', record);
    return { ok: true, record };
  },

  async remove(id) {
    await State.remove('books', id);
  },
};
