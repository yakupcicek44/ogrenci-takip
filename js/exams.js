// Deneme sonuçları takibi
// Not: Net hesabı (yanlış katsayısı) denemeden denemeye değiştiği için otomatik hesaplanmaz,
// öğretmen net değerini doğrudan girer (isteğe bağlı).
const MockExams = {
  async save(studentId, form, existingId) {
    if (!form.denemeAdi || !form.denemeAdi.trim()) return { ok: false, errors: ['Deneme adı boş olamaz.'] };
    if (!form.tarih) return { ok: false, errors: ['Tarih boş olamaz.'] };

    const record = {
      id: existingId || Utils.uid(),
      studentId,
      denemeAdi: form.denemeAdi.trim(),
      tarih: form.tarih,
      puan: Utils.isEmptyGrade(form.puan) ? null : Number(form.puan),
      dogru: Utils.isEmptyGrade(form.dogru) ? null : Number(form.dogru),
      yanlis: Utils.isEmptyGrade(form.yanlis) ? null : Number(form.yanlis),
      bos: Utils.isEmptyGrade(form.bos) ? null : Number(form.bos),
      net: Utils.isEmptyGrade(form.net) ? null : Number(form.net),
    };
    await State.save('mockExams', record);
    return { ok: true, record };
  },

  async remove(id) {
    await State.remove('mockExams', id);
  },

  // Chart.js için sıralı veri (puan ve net trend)
  chartData(studentId) {
    const list = State.getStudentMockExams(studentId);
    return {
      labels: list.map((m) => Utils.formatDateTR(m.tarih) + ' · ' + m.denemeAdi),
      puanlar: list.map((m) => m.puan),
      netler: list.map((m) => m.net),
    };
  },
};
