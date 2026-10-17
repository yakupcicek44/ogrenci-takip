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

  getSlotRecord(studentId, termId, slotKey) {
    return State.data.assessments.find(
      (a) => a.studentId === studentId && a.termId === termId && a.slot === slotKey
    ) || null;
  },

  async saveSlot(studentId, termId, slotKey, form) {
    const slotDef = SLOTS.find((s) => s.key === slotKey);
    if (!slotDef) throw new Error('Geçersiz slot: ' + slotKey);

    const existing = this.getSlotRecord(studentId, termId, slotKey);
    const puan = Utils.isEmptyGrade(form.puan) ? null : Number(form.puan);

    const record = {
      id: existing ? existing.id : Utils.uid(),
      studentId,
      termId,
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
  calcTermAverage(studentId, termId) {
    const weights = State.data.settings.agirliklar;
    let weightedSum = 0;
    let weightTotal = 0;

    for (const slotDef of SLOTS) {
      const rec = this.getSlotRecord(studentId, termId, slotDef.key);
      if (rec && !Utils.isEmptyGrade(rec.puan)) {
        const w = weights[slotDef.key] || 0;
        weightedSum += rec.puan * w;
        weightTotal += w;
      }
    }

    if (weightTotal === 0) return null;
    return Utils.round1(weightedSum / weightTotal);
  },

  // Dönem ortalamalarının ortalaması (girilmiş dönemler üzerinden)
  calcOverallAverage(studentId) {
    const terms = State.getTermsSorted();
    const vals = terms
      .map((t) => this.calcTermAverage(studentId, t.id))
      .filter((v) => v !== null);
    if (!vals.length) return null;
    return Utils.round1(vals.reduce((a, b) => a + b, 0) / vals.length);
  },

  // Bir sınıf/şube için dönem bazlı sıralama (ortalaması olmayanlar sona, '-' sıralı)
  rankInClass(sinif, termId) {
    const students = State.getActiveStudents().filter((s) => s.sinif === sinif);
    const withAvg = students.map((s) => ({
      student: s,
      average: this.calcTermAverage(s.id, termId),
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

  weightsSum(weights) {
    return Object.values(weights).reduce((a, b) => a + Number(b || 0), 0);
  },
};
