// Öğretmen Asistanı — kişisel görev/hatırlatıcı merkezi (DigiOps TO'daki "Yönetici Asistanı"
// modülünden uyarlandı). Öğrenciyle ilişkili olabilir ama olmak zorunda değildir.
// Not: Gerçek telefon bildirimi (push) göndermez — bu, ayrı bir sunucu/push altyapısı gerektirir.
// Görevler sadece uygulama açıldığında (Ana Sayfa'da) gösterilir.
const TASK_DURUMLAR = ['bekliyor', 'tamamlandi', 'ertelendi'];
const TASK_ONCELIKLER = ['yuksek', 'normal', 'dusuk'];

const Tasks = {
  DURUMLAR: TASK_DURUMLAR,
  ONCELIKLER: TASK_ONCELIKLER,

  async create(form) {
    if (!form.baslik || !form.baslik.trim()) return { ok: false, errors: ['Görev başlığı boş olamaz.'] };
    const record = {
      id: Utils.uid(),
      baslik: form.baslik.trim(),
      aciklama: form.aciklama || '',
      oncelik: TASK_ONCELIKLER.includes(form.oncelik) ? form.oncelik : 'normal',
      sonTarih: form.sonTarih || null,
      studentId: form.studentId || null,
      ustGorevId: form.ustGorevId || null,
      durum: 'bekliyor',
      ertelemeSayisi: 0,
      tamamlanmaZamani: null,
      olusturmaTarihi: new Date().toISOString(),
    };
    await State.save('tasks', record);
    return { ok: true, record };
  },

  async update(id, form) {
    const task = State.getTask(id);
    if (!task) return { ok: false, errors: ['Görev bulunamadı.'] };
    if (!form.baslik || !form.baslik.trim()) return { ok: false, errors: ['Görev başlığı boş olamaz.'] };
    const updated = {
      ...task,
      baslik: form.baslik.trim(),
      aciklama: form.aciklama !== undefined ? form.aciklama : task.aciklama,
      oncelik: TASK_ONCELIKLER.includes(form.oncelik) ? form.oncelik : task.oncelik,
      sonTarih: form.sonTarih !== undefined ? form.sonTarih : task.sonTarih,
      studentId: form.studentId !== undefined ? form.studentId : task.studentId,
    };
    await State.save('tasks', updated);
    return { ok: true, record: updated };
  },

  async complete(id) {
    const task = State.getTask(id);
    if (!task) return;
    await State.save('tasks', { ...task, durum: 'tamamlandi', tamamlanmaZamani: new Date().toISOString() });
  },

  async reopen(id) {
    const task = State.getTask(id);
    if (!task) return;
    await State.save('tasks', { ...task, durum: 'bekliyor', tamamlanmaZamani: null });
  },

  // tip: 'yarin' | 'haftaya' | sayı (gün)
  async postpone(id, tip) {
    const task = State.getTask(id);
    if (!task) return;
    const gun = tip === 'haftaya' ? 7 : (typeof tip === 'number' ? tip : 1);
    const base = task.sonTarih ? new Date(task.sonTarih) : new Date();
    base.setDate(base.getDate() + gun);
    await State.save('tasks', {
      ...task,
      sonTarih: Utils.dateToISO(base),
      durum: 'ertelendi',
      ertelemeSayisi: (task.ertelemeSayisi || 0) + 1,
    });
  },

  isOverdue(task) {
    return task.durum !== 'tamamlandi' && task.sonTarih && task.sonTarih < Utils.todayISO();
  },

  // Dashboard için: bugün ve geçmiş (tamamlanmamış) görevler, önceliğe göre sıralı
  getDashboardTasks() {
    const oncelikSira = { yuksek: 0, normal: 1, dusuk: 2 };
    return State.getTopLevelTasks()
      .filter((t) => t.durum !== 'tamamlandi' && t.sonTarih && t.sonTarih <= Utils.todayISO())
      .sort((a, b) => (oncelikSira[a.oncelik] - oncelikSira[b.oncelik]) || (a.sonTarih || '').localeCompare(b.sonTarih || ''));
  },

  filterAll({ durum, studentId } = {}) {
    let list = State.getTopLevelTasks();
    if (durum) list = list.filter((t) => t.durum === durum);
    if (studentId) list = list.filter((t) => t.studentId === studentId);
    return list.sort((a, b) => (a.sonTarih || '9999').localeCompare(b.sonTarih || '9999'));
  },
};
