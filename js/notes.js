// Notlar — Öğretmen Asistanı'nın serbest/tarihsiz parçası. Görev değil, hatırlatıcı değil;
// sadece aklında tutmak istediğin bir şeyi yazman için (genel bir fikir, bir gözlem taslağı,
// bir öğrenciyle ilgili kısa not vb.). Tamamlanma durumu yoktur.
const Notes = {
  async save(form, existingId) {
    if (!form.metin || !form.metin.trim()) return { ok: false, errors: ['Not metni boş olamaz.'] };
    const now = new Date().toISOString();
    const existing = existingId ? State.getNote(existingId) : null;
    const record = {
      id: existingId || Utils.uid(),
      baslik: form.baslik || '',
      metin: form.metin.trim(),
      studentId: form.studentId || null,
      olusturmaTarihi: existing ? existing.olusturmaTarihi : now,
      guncellemeTarihi: now,
    };
    await State.save('notes', record);
    return { ok: true, record };
  },

  async remove(id) {
    await State.remove('notes', id);
  },
};
