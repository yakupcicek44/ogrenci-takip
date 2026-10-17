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
    for (const a of assignments) await State.remove('homeworkAssignments', a.id);
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
    const now = new Date();
    const limit = new Date();
    limit.setDate(limit.getDate() + days);
    return State.data.homeworkTasks.filter((t) => {
      if (!t.teslimTarihi) return false;
      const d = new Date(t.teslimTarihi);
      return d >= now && d <= limit;
    });
  },
};
