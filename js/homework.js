// Ödev takibi — toplu atama + öğrenci bazlı durum güncelleme
const HOMEWORK_DURUMLAR = ['bekliyor', 'teslim edildi', 'eksik', 'geç teslim'];

const Homework = {
  DURUMLAR: HOMEWORK_DURUMLAR,

  // Bir ödevi seçilen öğrenci listesine atar (tek öğrenci de olabilir -> bireysel atama)
  async assign(form, studentIds) {
    if (!form.ad || !form.ad.trim()) return { ok: false, errors: ['Ödev adı boş olamaz.'] };
    if (!studentIds || !studentIds.length) return { ok: false, errors: ['En az bir öğrenci seçilmeli.'] };

    const task = {
      id: Utils.uid(),
      ad: form.ad.trim(),
      aciklama: form.aciklama || '',
      cevapAnahtari: form.cevapAnahtari || '',
      verilisTarihi: form.verilisTarihi || Utils.todayISO(),
      teslimTarihi: form.teslimTarihi || null,
      olusturmaTarihi: new Date().toISOString(),
    };
    await State.save('homeworkTasks', task);

    for (const studentId of studentIds) {
      const assignment = {
        id: Utils.uid(),
        homeworkId: task.id,
        studentId,
        durum: 'bekliyor',
        puan: null,
        ogretmenNotu: '',
      };
      await State.save('homeworkAssignments', assignment);
    }

    return { ok: true, task };
  },

  // Ödev TANIMINI (başlık/tarihler/cevap anahtarı) düzenler — tüm öğrencilerin
  // atamasını etkiler, çünkü hepsi aynı tanıma bağlıdır.
  async updateTask(taskId, form) {
    const task = State.getHomeworkTask(taskId);
    if (!task) return { ok: false, errors: ['Ödev bulunamadı.'] };
    if (!form.ad || !form.ad.trim()) return { ok: false, errors: ['Ödev adı boş olamaz.'] };
    const updated = {
      ...task,
      ad: form.ad.trim(),
      aciklama: form.aciklama !== undefined ? form.aciklama : task.aciklama,
      cevapAnahtari: form.cevapAnahtari !== undefined ? form.cevapAnahtari : task.cevapAnahtari,
      verilisTarihi: form.verilisTarihi || task.verilisTarihi,
      teslimTarihi: form.teslimTarihi !== undefined ? (form.teslimTarihi || null) : task.teslimTarihi,
    };
    await State.save('homeworkTasks', updated);
    return { ok: true, task: updated };
  },

  async updateAssignment(id, form) {
    const assignment = State.data.homeworkAssignments.find((a) => a.id === id);
    if (!assignment) return { ok: false, errors: ['Kayıt bulunamadı.'] };

    const updated = {
      ...assignment,
      durum: form.durum || assignment.durum,
      puan: Utils.isEmptyGrade(form.puan) ? null : Number(form.puan),
      ogretmenNotu: form.ogretmenNotu !== undefined ? form.ogretmenNotu : assignment.ogretmenNotu,
    };
    await State.save('homeworkAssignments', updated);
    return { ok: true, assignment: updated };
  },

  async deleteTask(taskId) {
    const assignments = State.data.homeworkAssignments.filter((a) => a.homeworkId === taskId);
    for (const a of assignments) {
      for (const scan of State.getOwnerScans(a.id)) await State.remove('scans', scan.id);
      await State.remove('homeworkAssignments', a.id);
    }
    await State.remove('homeworkTasks', taskId);
  },

  getTaskAssignments(taskId) {
    return State.data.homeworkAssignments.filter((a) => a.homeworkId === taskId);
  },

  getTaskStats(taskId) {
    const list = this.getTaskAssignments(taskId);
    const stats = { toplam: list.length };
    for (const d of HOMEWORK_DURUMLAR) {
      stats[d] = list.filter((a) => a.durum === d).length;
    }
    return stats;
  },

  // Tüm ödev atamalarını filtreler (görev adı, sınıf, durum birlikte gösterilir)
  filterAll({ durum, sinif, homeworkId } = {}) {
    let list = State.data.homeworkAssignments.map((a) => ({
      ...a,
      task: State.getHomeworkTask(a.homeworkId),
      student: State.getStudent(a.studentId),
    })).filter((row) => row.task && row.student);

    if (durum) list = list.filter((r) => r.durum === durum);
    if (sinif) list = list.filter((r) => r.student.sinif === sinif);
    if (homeworkId) list = list.filter((r) => r.homeworkId === homeworkId);

    return list.sort((a, b) => (b.task.verilisTarihi || '').localeCompare(a.task.verilisTarihi || ''));
  },

  getUpcoming(days = 7) {
    // Tarih-sadece dizge karşılaştırması kullanılıyor (Date nesnesine çevirmek, tarih-sadece
    // bir dizgeyi UTC gece yarısı sayıp Türkiye'de günü 3 saat kaydırıyordu — bir ödev,
    // teslim günü boyunca "yaklaşan" listesinden sabah 03:00'ten sonra düşüyordu).
    const today = Utils.todayISO();
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() + days);
    const limit = Utils.dateToISO(limitDate);
    return State.data.homeworkTasks.filter((t) => t.teslimTarihi && t.teslimTarihi >= today && t.teslimTarihi <= limit);
  },
};
