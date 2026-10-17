// Belge Kütüphanesi — yıllık plan, toplantı tutanağı gibi PDF/Word dosyaları.
// Öğrenciye bağlı değildir; Asistan'ın "Belgeler" sekmesinden yönetilir.
// İçerik scans.imageDataUrl ile aynı desende base64 dataUrl olarak saklanır,
// böylece ayrı bir mekanizma gerekmeden JSON yedeğe otomatik dahil olur.
const Documents = {
  KATEGORILER: [
    { key: 'yillikPlan', etiket: 'Yıllık Plan' },
    { key: 'toplantiTutanagi', etiket: 'Toplantı Tutanağı' },
    { key: 'diger', etiket: 'Diğer' },
  ],

  // Cihaz depolamasını ve JSON yedek dosyasının boyutunu korumak için üst sınır.
  MAX_BOYUT: 20 * 1024 * 1024,
  ALLOWED_EXT: /\.(pdf|docx?|DOCX?|PDF)$/,

  async upload(file, { ad, kategori, not } = {}) {
    if (!file || !file.name) return { ok: false, errors: ['Dosya seçilmedi.'] };
    if (!this.ALLOWED_EXT.test(file.name)) {
      return { ok: false, errors: ['Sadece PDF ve Word (.doc/.docx) dosyaları desteklenir.'] };
    }
    if (file.size > this.MAX_BOYUT) {
      return { ok: false, errors: [`Dosya çok büyük (${(file.size / 1024 / 1024).toFixed(1)} MB). En fazla ${this.MAX_BOYUT / 1024 / 1024} MB olabilir.`] };
    }

    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

    const kategoriKey = this.KATEGORILER.some((k) => k.key === kategori) ? kategori : 'diger';
    const record = {
      id: Utils.uid(),
      ad: (ad && ad.trim()) || file.name.replace(/\.[^.]+$/, ''),
      kategori: kategoriKey,
      dosyaAdi: file.name,
      mimeType: file.type || '',
      boyut: file.size,
      dataUrl,
      not: (not || '').trim(),
      olusturmaTarihi: new Date().toISOString(),
    };
    await State.save('documents', record);
    return { ok: true, document: record };
  },

  async update(id, { ad, kategori, not }) {
    const doc = State.data.documents.find((d) => d.id === id);
    if (!doc) return { ok: false, errors: ['Belge bulunamadı.'] };
    const kategoriKey = this.KATEGORILER.some((k) => k.key === kategori) ? kategori : doc.kategori;
    await State.save('documents', {
      ...doc,
      ad: (ad && ad.trim()) || doc.ad,
      kategori: kategoriKey,
      not: not !== undefined ? not.trim() : doc.not,
    });
    return { ok: true };
  },

  async remove(id) {
    await State.remove('documents', id);
  },

  filterByKategori(kategori) {
    const list = kategori ? State.data.documents.filter((d) => d.kategori === kategori) : State.data.documents;
    return [...list].sort((a, b) => (b.olusturmaTarihi || '').localeCompare(a.olusturmaTarihi || ''));
  },

  dataUrlToBlob(dataUrl) {
    const match = dataUrl.match(/^data:(.*?);base64,(.*)$/);
    if (!match) return new Blob();
    const [, mime, base64] = match;
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  },

  download(doc) {
    const blob = this.dataUrlToBlob(doc.dataUrl);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.dosyaAdi || doc.ad;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};
