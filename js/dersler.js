// Ders/Branş yönetimi — bir öğretmen aynı sınıfa birden fazla ders verebiliyor
// (örn. Felsefe + Seçmeli Felsefe). Her ders kendi bağımsız not takibini
// (Assessments, dersId ile) taşır. Tek dersli kullanım için hiçbir şey değişmez —
// UI'da ders seçimi sadece birden fazla ders varken gösterilir.
const Dersler = {
  async create(ad) {
    const trimmed = (ad || '').trim();
    if (!trimmed) return { ok: false, errors: ['Ders adı boş olamaz.'] };
    if (State.data.dersler.some((d) => d.ad.toLocaleLowerCase('tr') === trimmed.toLocaleLowerCase('tr'))) {
      return { ok: false, errors: ['Bu ders adı zaten var.'] };
    }
    const record = { id: Utils.uid(), ad: trimmed, olusturmaTarihi: new Date().toISOString() };
    await State.save('dersler', record);
    return { ok: true, record };
  },

  async rename(id, yeniAd) {
    const trimmed = (yeniAd || '').trim();
    if (!trimmed) return { ok: false, errors: ['Ders adı boş olamaz.'] };
    const existing = State.data.dersler.find((d) => d.id === id);
    if (!existing) return { ok: false, errors: ['Ders bulunamadı.'] };
    if (State.data.dersler.some((d) => d.id !== id && d.ad.toLocaleLowerCase('tr') === trimmed.toLocaleLowerCase('tr'))) {
      return { ok: false, errors: ['Bu ders adı zaten var.'] };
    }
    await State.save('dersler', { ...existing, ad: trimmed });
    return { ok: true };
  },

  // Dersi VE ona ait tüm not kayıtlarını kalıcı siler — UI'da ayrıca onay istenmeli
  // (dönem silmeyle aynı mantık, çünkü kademeli/kapsamlı bir silme).
  async remove(id) {
    const related = State.data.assessments.filter((a) => a.dersId === id);
    for (const r of related) await State.remove('assessments', r.id);
    await State.remove('dersler', id);
    return { ok: true, silinenNotSayisi: related.length };
  },

  countAssessments(id) {
    return State.data.assessments.filter((a) => a.dersId === id && !Utils.isEmptyGrade(a.puan)).length;
  },
};
