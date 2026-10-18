// Haftalık Ders Programı — Pazartesi-Cuma tekrar eden şablon (dersProgrami) + o haftaya
// özel istisnalar (dersProgramiIstisna: iptal/değişiklik), artı manuel ek ders saatleri
// (ekDersSaatleri). Haftalık görünüm VE aylık/haftalık saat analizi aynı
// getOccurrencesInRange() fonksiyonunu kullanır — tek doğru kaynak, iki ayrı hesaplama
// mantığı yok.
const Schedule = {
  GUNLER: ['', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma'], // index 1-5, JS Date.getDay() ile aynı

  // Date nesnesini ISO (yyyy-mm-dd) dizgeye LOKAL bileşenlerle çevirir — toISOString()
  // UTC'ye çevirip Türkiye (UTC+3) gibi ileri saat dilimlerinde günü bir gün geriye
  // kaydırıyor (gece yarısı yerel saat, UTC'de önceki günün akşamına denk gelir).
  _toIso(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  weekMonday(isoDate) {
    const d = new Date(isoDate + 'T00:00:00');
    const dow = d.getDay(); // 0=Pazar ... 6=Cumartesi
    const diff = dow === 0 ? -6 : 1 - dow;
    d.setDate(d.getDate() + diff);
    return this._toIso(d);
  },

  addDays(isoDate, n) {
    const d = new Date(isoDate + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return this._toIso(d);
  },

  // Mesai/saat analizinin doğruluğu önemli olduğu için not ortalamalarında kullanılan
  // 1 ondalıklı Utils.round1 yerine 2 ondalık kullanılıyor (örn. 45 dk tam olarak 0.75
  // saat olarak görünsün, 0.8'e yuvarlanıp yanlış izlenim vermesin).
  _round2(n) {
    return Math.round(n * 100) / 100;
  },

  durationHours(baslangicSaati, bitisSaati) {
    const [bh, bm] = baslangicSaati.split(':').map(Number);
    const [eh, em] = bitisSaati.split(':').map(Number);
    return this._round2(((eh * 60 + em) - (bh * 60 + bm)) / 60);
  },

  weekRange(mondayIso) {
    return { start: mondayIso, end: this.addDays(mondayIso, 4) };
  },

  monthRange(yearMonth) {
    const [y, m] = yearMonth.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    return { start: `${yearMonth}-01`, end: `${yearMonth}-${String(lastDay).padStart(2, '0')}` };
  },

  _validateSlot(form) {
    const errors = [];
    if (!form.sinif || !form.sinif.trim()) errors.push('Sınıf boş olamaz.');
    if (![1, 2, 3, 4, 5].includes(Number(form.gun))) errors.push('Geçerli bir gün seçilmeli.');
    if (!/^\d{2}:\d{2}$/.test(form.baslangicSaati || '')) errors.push('Başlangıç saati geçerli değil.');
    if (!/^\d{2}:\d{2}$/.test(form.bitisSaati || '')) errors.push('Bitiş saati geçerli değil.');
    if (form.baslangicSaati && form.bitisSaati && form.baslangicSaati >= form.bitisSaati) errors.push('Bitiş saati başlangıçtan sonra olmalı.');
    return errors;
  },

  // --- Şablon (her hafta tekrar eden ders) CRUD ---
  async createSlot(form) {
    const errors = this._validateSlot(form);
    if (errors.length) return { ok: false, errors };
    const record = {
      id: Utils.uid(),
      gun: Number(form.gun),
      baslangicSaati: form.baslangicSaati,
      bitisSaati: form.bitisSaati,
      sinif: form.sinif.trim(),
      ders: (form.ders || '').trim(),
      olusturmaTarihi: new Date().toISOString(),
    };
    await State.save('dersProgrami', record);
    return { ok: true, record };
  },

  async updateSlot(id, form) {
    const existing = State.data.dersProgrami.find((s) => s.id === id);
    if (!existing) return { ok: false, errors: ['Kayıt bulunamadı.'] };
    const errors = this._validateSlot(form);
    if (errors.length) return { ok: false, errors };
    await State.save('dersProgrami', {
      ...existing,
      gun: Number(form.gun),
      baslangicSaati: form.baslangicSaati,
      bitisSaati: form.bitisSaati,
      sinif: form.sinif.trim(),
      ders: (form.ders || '').trim(),
    });
    return { ok: true };
  },

  // --- İstisna: bu haftaya özel iptal/değişiklik (şablonu kalıcı değiştirmez) ---
  getException(templateId, haftaBaslangicTarihi) {
    return State.data.dersProgramiIstisna.find((e) => e.templateId === templateId && e.haftaBaslangicTarihi === haftaBaslangicTarihi) || null;
  },

  async setCancel(templateId, haftaBaslangicTarihi, not) {
    return this._saveException(templateId, haftaBaslangicTarihi, { tur: 'iptal', not: not || '' });
  },

  async setChange(templateId, haftaBaslangicTarihi, form) {
    if (form.baslangicSaati && form.bitisSaati && form.baslangicSaati >= form.bitisSaati) {
      return { ok: false, errors: ['Bitiş saati başlangıçtan sonra olmalı.'] };
    }
    return this._saveException(templateId, haftaBaslangicTarihi, {
      tur: 'degisiklik',
      baslangicSaati: form.baslangicSaati || null,
      bitisSaati: form.bitisSaati || null,
      sinif: form.sinif ? form.sinif.trim() : null,
      not: form.not || '',
    });
  },

  async clearException(templateId, haftaBaslangicTarihi) {
    const ex = this.getException(templateId, haftaBaslangicTarihi);
    if (ex) await State.remove('dersProgramiIstisna', ex.id);
  },

  async _saveException(templateId, haftaBaslangicTarihi, fields) {
    const existing = this.getException(templateId, haftaBaslangicTarihi);
    const record = { id: existing?.id || Utils.uid(), templateId, haftaBaslangicTarihi, ...fields };
    await State.save('dersProgramiIstisna', record);
    return { ok: true, record };
  },

  // --- Belirli tarih aralığındaki GERÇEK oluşumlar (şablon + istisna uygulanmış hali) ---
  getOccurrencesInRange(startIso, endIso) {
    const out = [];
    let cursor = startIso;
    while (cursor <= endIso) {
      const dow = new Date(cursor + 'T00:00:00').getDay();
      if (dow >= 1 && dow <= 5) {
        const haftaBasi = this.weekMonday(cursor);
        for (const tpl of State.data.dersProgrami.filter((s) => s.gun === dow)) {
          const ex = this.getException(tpl.id, haftaBasi);
          if (ex && ex.tur === 'iptal') {
            out.push({ tarih: cursor, templateId: tpl.id, iptal: true, degisti: false, sinif: tpl.sinif, ders: tpl.ders, baslangicSaati: tpl.baslangicSaati, bitisSaati: tpl.bitisSaati, saat: 0, not: ex.not });
            continue;
          }
          const baslangicSaati = ex?.baslangicSaati || tpl.baslangicSaati;
          const bitisSaati = ex?.bitisSaati || tpl.bitisSaati;
          const sinif = ex?.sinif || tpl.sinif;
          out.push({
            tarih: cursor, templateId: tpl.id, iptal: false, degisti: !!ex,
            baslangicSaati, bitisSaati, sinif, ders: tpl.ders,
            saat: this.durationHours(baslangicSaati, bitisSaati),
            not: ex?.not || '',
          });
        }
      }
      cursor = this.addDays(cursor, 1);
    }
    return out.sort((a, b) => (a.tarih + a.baslangicSaati).localeCompare(b.tarih + b.baslangicSaati));
  },

  // --- Manuel ek ders saati (telafi, nöbet vb. — düzenli programa dahil olmayan) ---
  async addEkDers(form) {
    if (!form.tarih) return { ok: false, errors: ['Tarih boş olamaz.'] };
    if (!/^\d{2}:\d{2}$/.test(form.baslangicSaati || '') || !/^\d{2}:\d{2}$/.test(form.bitisSaati || '')) {
      return { ok: false, errors: ['Geçerli başlangıç/bitiş saati girilmeli.'] };
    }
    if (form.baslangicSaati >= form.bitisSaati) return { ok: false, errors: ['Bitiş saati başlangıçtan sonra olmalı.'] };
    const record = {
      id: Utils.uid(),
      tarih: form.tarih,
      baslangicSaati: form.baslangicSaati,
      bitisSaati: form.bitisSaati,
      aciklama: (form.aciklama || '').trim(),
      saat: this.durationHours(form.baslangicSaati, form.bitisSaati),
      olusturmaTarihi: new Date().toISOString(),
    };
    await State.save('ekDersSaatleri', record);
    return { ok: true, record };
  },

  getEkDersInRange(startIso, endIso) {
    return State.data.ekDersSaatleri.filter((e) => e.tarih >= startIso && e.tarih <= endIso).sort((a, b) => a.tarih.localeCompare(b.tarih));
  },

  // --- Analiz ---
  totalHoursInRange(startIso, endIso) {
    const dersSaati = this.getOccurrencesInRange(startIso, endIso).filter((o) => !o.iptal).reduce((sum, o) => sum + o.saat, 0);
    const ekSaati = this.getEkDersInRange(startIso, endIso).reduce((sum, e) => sum + e.saat, 0);
    return this._round2(dersSaati + ekSaati);
  },
};
