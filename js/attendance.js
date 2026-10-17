// Devamsızlık/Yoklama takibi. Bir öğrenci+tarih için en fazla bir kayıt olur
// (id = studentId_tarih ile doğal olarak üzerine yazılır, mükerrer kayıt oluşmaz).
const ATTENDANCE_DURUMLAR = ['var', 'yok', 'izinli'];

const Attendance = {
  DURUMLAR: ATTENDANCE_DURUMLAR,

  _id(studentId, tarih) {
    return `${studentId}_${tarih}`;
  },

  async mark(studentId, tarih, durum) {
    if (!ATTENDANCE_DURUMLAR.includes(durum)) throw new Error('Geçersiz devamsızlık durumu: ' + durum);
    const record = { id: this._id(studentId, tarih), studentId, tarih, durum };
    await State.save('attendance', record);
    return record;
  },

  async unmark(studentId, tarih) {
    await State.remove('attendance', this._id(studentId, tarih));
  },

  // markMap: { studentId: 'var'|'yok'|'izinli' }
  async bulkMark(tarih, markMap) {
    for (const [studentId, durum] of Object.entries(markMap)) {
      if (durum) await this.mark(studentId, tarih, durum);
    }
  },

  getStudentSummary(studentId, { baslangic, bitis } = {}) {
    let records = State.getStudentAttendance(studentId);
    if (baslangic) records = records.filter((r) => r.tarih >= baslangic);
    if (bitis) records = records.filter((r) => r.tarih <= bitis);
    const toplam = records.length;
    const sayac = { var: 0, yok: 0, izinli: 0 };
    records.forEach((r) => { sayac[r.durum] = (sayac[r.durum] || 0) + 1; });
    const devamsizlikOrani = toplam ? Utils.round1((sayac.yok / toplam) * 100) : null;
    return { toplam, ...sayac, devamsizlikOrani };
  },
};
