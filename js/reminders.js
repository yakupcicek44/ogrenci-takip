// Hatırlatıcılar — Öğretmen Asistanı'nın zaman/saat bazlı parçası. Görevden farkı: alt görevi
// yok, önceliği yok, sadece "bu tarihte/saatte bunu unutma" notu.
// Bildirim senkronizasyonu (Push.*) her zaman "best effort" ve sessizdir: push etkin değilse
// veya cihaz çevrimdışıysa bu fonksiyonlar hiçbir şey yapmaz, yerel kayıt her durumda çalışır.
function validDate(v) { return /^\d{4}-\d{2}-\d{2}$/.test(v || ''); }
function validTime(v) { return /^\d{2}:\d{2}$/.test(v || ''); }

const Reminders = {
  async create(form) {
    if (!form.metin || !form.metin.trim()) return { ok: false, errors: ['Hatırlatıcı metni boş olamaz.'] };
    if (!validDate(form.tarih)) return { ok: false, errors: ['Geçerli bir tarih girilmeli.'] };
    if (form.saat && !validTime(form.saat)) return { ok: false, errors: ['Geçerli bir saat girilmeli (SS:DD).'] };
    const record = {
      id: Utils.uid(),
      metin: form.metin.trim(),
      tarih: form.tarih,
      saat: form.saat || null,
      studentId: form.studentId || null,
      tamamlandi: false,
      olusturmaTarihi: new Date().toISOString(),
    };
    await State.save('reminders', record);
    Push.syncReminder(record);
    return { ok: true, record };
  },

  async toggle(id) {
    const r = State.getReminder(id);
    if (!r) return;
    const updated = { ...r, tamamlandi: !r.tamamlandi };
    await State.save('reminders', updated);
    if (updated.tamamlandi) Push.deleteReminderSync(id);
    else Push.syncReminder(updated);
  },

  async remove(id) {
    await State.remove('reminders', id);
    Push.deleteReminderSync(id);
  },

  getToday() {
    const today = Utils.todayISO();
    return State.data.reminders
      .filter((r) => !r.tamamlandi && r.tarih <= today)
      .sort((a, b) => (a.tarih + (a.saat || '00:00')).localeCompare(b.tarih + (b.saat || '00:00')));
  },

  filterAll({ tamamlandi } = {}) {
    let list = [...State.data.reminders];
    if (tamamlandi !== undefined) list = list.filter((r) => r.tamamlandi === tamamlandi);
    return list.sort((a, b) => (a.tarih + (a.saat || '00:00')).localeCompare(b.tarih + (b.saat || '00:00')));
  },
};
