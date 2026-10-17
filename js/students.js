// Öğrenci CRUD + sınıf geçmişi + mükerrer okul no kontrolü
const Students = {
  validate(form, excludeId) {
    const errors = [];
    if (!form.ad || !form.ad.trim()) errors.push('Ad soyad boş olamaz.');
    if (!form.okulNo || !String(form.okulNo).trim()) errors.push('Okul numarası boş olamaz.');
    else if (State.isOkulNoDuplicate(String(form.okulNo).trim(), excludeId)) {
      errors.push('Bu okul numarası başka bir öğrencide zaten kayıtlı.');
    }
    if (!form.sinif || !form.sinif.trim()) errors.push('Sınıf/şube boş olamaz.');
    return errors;
  },

  async create(form) {
    const errors = this.validate(form, null);
    if (errors.length) return { ok: false, errors };

    const now = new Date().toISOString();
    const student = {
      id: Utils.uid(),
      ad: form.ad.trim(),
      okulNo: String(form.okulNo).trim(),
      sinif: form.sinif.trim(),
      aciklama: form.aciklama || '',
      gozlemNotlari: form.gozlemNotlari || '',
      durum: 'aktif',
      sinifGecmisi: [{ sinif: form.sinif.trim(), tarih: now }],
      olusturmaTarihi: now,
    };
    await State.save('students', student);
    return { ok: true, student };
  },

  async update(id, form) {
    const student = State.getStudent(id);
    if (!student) return { ok: false, errors: ['Öğrenci bulunamadı.'] };

    const errors = this.validate(form, id);
    if (errors.length) return { ok: false, errors };

    const yeniSinif = form.sinif.trim();
    const sinifDegisti = yeniSinif !== student.sinif;

    const updated = {
      ...student,
      ad: form.ad.trim(),
      okulNo: String(form.okulNo).trim(),
      sinif: yeniSinif,
      aciklama: form.aciklama || '',
      gozlemNotlari: form.gozlemNotlari || '',
    };

    if (sinifDegisti) {
      updated.sinifGecmisi = [...(student.sinifGecmisi || []), { sinif: yeniSinif, tarih: new Date().toISOString() }];
    }

    await State.save('students', updated);
    return { ok: true, student: updated };
  },

  // Öğrenciyi pasif yapar (geçmiş kayıtları korumak için gerçek silme yerine bu kullanılmalı)
  async setPasif(id, pasif) {
    const student = State.getStudent(id);
    if (!student) return;
    await State.save('students', { ...student, durum: pasif ? 'pasif' : 'aktif' });
  },

  // Tam silme — ilişkili tüm kayıtları da siler. Geri alınamaz, UI'da onay istenmeli.
  async hardDelete(id) {
    const related = [
      ['assessments', State.data.assessments.filter((a) => a.studentId === id)],
      ['homeworkAssignments', State.data.homeworkAssignments.filter((a) => a.studentId === id)],
      ['books', State.data.books.filter((b) => b.studentId === id)],
      ['mockExams', State.data.mockExams.filter((m) => m.studentId === id)],
      ['scans', State.data.scans.filter((s) => s.studentId === id)],
    ];
    for (const [store, rows] of related) {
      for (const row of rows) {
        await State.remove(store, row.id);
      }
    }
    await State.remove('students', id);
  },

  EXCEL_HEADER_ALIASES: {
    ad: ['ad soyad', 'ad-soyad', 'adsoyad', 'ad', 'isim', 'öğrenci adı', 'ogrenci adi'],
    okulNo: ['okul no', 'okul numarası', 'okul numarasi', 'no', 'öğrenci no', 'ogrenci no', 'numara'],
    sinif: ['sınıf/şube', 'sinif/sube', 'sınıf', 'sinif', 'şube', 'sube', 'sınıf-şube'],
    aciklama: ['açıklama', 'aciklama'],
    gozlemNotlari: ['gözlem notu', 'gözlem notları', 'gozlem notu', 'gozlem notlari', 'öğretmen gözlem notları'],
  },

  // XLSX.utils.sheet_to_json çıktısındaki bir satırı (başlık->değer) uygulamanın
  // alan adlarına eşler. Başlıklar Türkçe varyasyonlara karşı esnek eşleştirilir.
  mapExcelRow(rawRow) {
    const lowerKeys = {};
    for (const key of Object.keys(rawRow)) {
      lowerKeys[key.trim().toLocaleLowerCase('tr')] = key;
    }
    const pick = (aliases) => {
      for (const alias of aliases) {
        if (lowerKeys[alias] !== undefined) {
          const v = rawRow[lowerKeys[alias]];
          return v === undefined || v === null ? '' : String(v).trim();
        }
      }
      return '';
    };
    return {
      ad: pick(this.EXCEL_HEADER_ALIASES.ad),
      okulNo: pick(this.EXCEL_HEADER_ALIASES.okulNo),
      sinif: pick(this.EXCEL_HEADER_ALIASES.sinif),
      aciklama: pick(this.EXCEL_HEADER_ALIASES.aciklama),
      gozlemNotlari: pick(this.EXCEL_HEADER_ALIASES.gozlemNotlari),
    };
  },

  // rawRows: XLSX.utils.sheet_to_json(sheet, {defval:''}) çıktısı.
  // Tamamen boş satırlar sessizce atlanır (şablon/örnek kalıntıları için).
  async bulkImportFromSheetRows(rawRows) {
    let eklenen = 0;
    const atlananlar = [];
    for (let i = 0; i < rawRows.length; i++) {
      const satirNo = i + 2; // 1. satır başlık
      const form = this.mapExcelRow(rawRows[i]);
      const tamamenBos = !form.ad && !form.okulNo && !form.sinif;
      if (tamamenBos) continue;

      const result = await this.create(form);
      if (result.ok) {
        eklenen++;
      } else {
        atlananlar.push({ satir: satirNo, sebep: result.errors.join(' ') });
      }
    }
    return { eklenen, atlananlar };
  },

  search(query, sinifFilter) {
    let list = State.data.students;
    if (sinifFilter) list = list.filter((s) => s.sinif === sinifFilter);
    if (query && query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((s) => s.ad.toLowerCase().includes(q) || String(s.okulNo).includes(q));
    }
    return [...list].sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));
  },
};
