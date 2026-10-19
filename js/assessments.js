// Sınav ve Performans Ödevi takibi — ağırlıklı ortalama ve sıralama
// NOT: Ağırlıklar Ayarlar'dan değiştirilebilir varsayılan değerlerdir, resmi bir notlandırma kuralı değildir.
const SLOTS = [
  { key: 'sinav1', tur: 'sinav', etiket: '1. Sınav' },
  { key: 'sinav2', tur: 'sinav', etiket: '2. Sınav' },
  { key: 'performans1', tur: 'performans', etiket: '1. Performans Ödevi' },
  { key: 'performans2', tur: 'performans', etiket: '2. Performans Ödevi' },
];

const Assessments = {
  SLOTS,

  getSlotRecord(studentId, termId, dersId, slotKey) {
    return State.data.assessments.find(
      (a) => a.studentId === studentId && a.termId === termId && a.dersId === dersId && a.slot === slotKey
    ) || null;
  },

  async saveSlot(studentId, termId, dersId, slotKey, form) {
    const slotDef = SLOTS.find((s) => s.key === slotKey);
    if (!slotDef) throw new Error('Geçersiz slot: ' + slotKey);

    const existing = this.getSlotRecord(studentId, termId, dersId, slotKey);
    const puan = Utils.isEmptyGrade(form.puan) ? null : Number(form.puan);

    const record = {
      id: existing ? existing.id : Utils.uid(),
      studentId,
      termId,
      dersId,
      slot: slotKey,
      tur: slotDef.tur,
      puan: puan === null ? null : puan,
      tarih: form.tarih || null,
      aciklama: form.aciklama || '',
    };
    await State.save('assessments', record);
    return record;
  },

  // Girilen notlar üzerinden ağırlıklı ortalama. Boş notlar sıfır sayılmaz, hesaba hiç girmez.
  calcTermAverage(studentId, termId, dersId) {
    const weights = State.data.settings.agirliklar;
    let weightedSum = 0;
    let weightTotal = 0;

    for (const slotDef of SLOTS) {
      const rec = this.getSlotRecord(studentId, termId, dersId, slotDef.key);
      if (rec && !Utils.isEmptyGrade(rec.puan)) {
        const w = weights[slotDef.key] || 0;
        weightedSum += rec.puan * w;
        weightTotal += w;
      }
    }

    if (weightTotal === 0) return null;
    return Utils.round1(weightedSum / weightTotal);
  },

  // Dönem ortalamalarının ortalaması (girilmiş dönemler üzerinden), bir ders için
  calcOverallAverage(studentId, dersId) {
    const terms = State.getTermsSorted();
    const vals = terms
      .map((t) => this.calcTermAverage(studentId, t.id, dersId))
      .filter((v) => v !== null);
    if (!vals.length) return null;
    return Utils.round1(vals.reduce((a, b) => a + b, 0) / vals.length);
  },

  // Bir sınıf/şube + ders için dönem bazlı sıralama (ortalaması olmayanlar sona, '-' sıralı)
  rankInClass(sinif, termId, dersId) {
    const students = State.getActiveStudents().filter((s) => s.sinif === sinif);
    const withAvg = students.map((s) => ({
      student: s,
      average: this.calcTermAverage(s.id, termId, dersId),
    }));

    withAvg.sort((a, b) => {
      if (a.average === null && b.average === null) return a.student.ad.localeCompare(b.student.ad, 'tr');
      if (a.average === null) return 1;
      if (b.average === null) return -1;
      return b.average - a.average;
    });

    let rank = 0;
    let lastAvg = undefined;
    return withAvg.map((row, idx) => {
      if (row.average === null) {
        return { ...row, rank: '-' };
      }
      if (row.average !== lastAvg) {
        rank = idx + 1;
        lastAvg = row.average;
      }
      return { ...row, rank };
    });
  },

  // Sınıfın o dönem+ders için genel ortalaması — notu olan öğrenciler üzerinden (boş
  // notlu öğrenciler ortalamayı aşağı çekmesin diye hesaba hiç katılmaz).
  classAverage(sinif, termId, dersId) {
    const vals = this.rankInClass(sinif, termId, dersId).map((r) => r.average).filter((v) => v !== null);
    if (!vals.length) return null;
    return Utils.round1(vals.reduce((a, b) => a + b, 0) / vals.length);
  },

  weightsSum(weights) {
    return Object.values(weights).reduce((a, b) => a + Number(b || 0), 0);
  },

  EXCEL_HEADER_ALIASES: {
    okulNo: ['okul no', 'okul numarası', 'okul numarasi', 'no', 'öğrenci no', 'ogrenci no', 'numara'],
    sinav1: ['1. sınav', '1.sınav', '1 sınav', '1. sinav', '1.sinav', 'sinav1', '1. sınav notu'],
    sinav2: ['2. sınav', '2.sınav', '2 sınav', '2. sinav', '2.sinav', 'sinav2', '2. sınav notu'],
    performans1: ['1. performans ödevi', '1.performans ödevi', '1. performans', '1.performans', 'performans1'],
    performans2: ['2. performans ödevi', '2.performans ödevi', '2. performans', '2.performans', 'performans2'],
  },

  // XLSX.utils.sheet_to_json çıktısındaki bir satırı slot bazlı not değerlerine eşler.
  // Başlıklar Türkçe varyasyonlara karşı esnek eşleştirilir (bkz. Students.mapExcelRow).
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
    const result = { okulNo: pick(this.EXCEL_HEADER_ALIASES.okulNo) };
    for (const slotDef of SLOTS) {
      result[slotDef.key] = pick(this.EXCEL_HEADER_ALIASES[slotDef.key]);
    }
    return result;
  },

  // rawRows: XLSX.utils.sheet_to_json(sheet, {defval:''}) çıktısı. Okul No ile eşleşen
  // öğrencinin notu güncellenir. Boş bırakılan not hücreleri mevcut notu DEĞİŞTİRMEZ —
  // yanlışlıkla üzerine boş not yazıp mevcut veriyi silmeyi önlemek için bilinçli tasarım.
  async bulkImportFromSheetRows(rawRows, termId, dersId) {
    let guncellenenOgrenci = 0;
    let guncellenenNot = 0;
    const atlananlar = [];

    for (let i = 0; i < rawRows.length; i++) {
      const satirNo = i + 2; // 1. satır başlık
      const form = this.mapExcelRow(rawRows[i]);
      const tamamenBos = !form.okulNo && SLOTS.every((s) => !form[s.key]);
      if (tamamenBos) continue;

      if (!form.okulNo) {
        atlananlar.push({ satir: satirNo, sebep: 'Okul No sütunu boş.' });
        continue;
      }
      const student = State.data.students.find((s) => String(s.okulNo) === form.okulNo);
      if (!student) {
        atlananlar.push({ satir: satirNo, sebep: `Okul No "${form.okulNo}" ile eşleşen öğrenci bulunamadı.` });
        continue;
      }

      let satirdaDegisenNot = 0;
      for (const slotDef of SLOTS) {
        const raw = form[slotDef.key];
        if (!raw) continue; // boş hücre — mevcut not dokunulmaz
        const puan = Number(String(raw).replace(',', '.'));
        if (Number.isNaN(puan)) {
          atlananlar.push({ satir: satirNo, sebep: `${slotDef.etiket}: "${raw}" geçerli bir not değil.` });
          continue;
        }
        const existing = this.getSlotRecord(student.id, termId, dersId, slotDef.key);
        await this.saveSlot(student.id, termId, dersId, slotDef.key, {
          puan,
          tarih: existing?.tarih || Utils.todayISO(),
          aciklama: existing?.aciklama || '',
        });
        satirdaDegisenNot++;
      }
      if (satirdaDegisenNot > 0) {
        guncellenenOgrenci++;
        guncellenenNot += satirdaDegisenNot;
      }
    }
    return { guncellenenOgrenci, guncellenenNot, atlananlar };
  },
};
