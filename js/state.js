// Uygulama durumu — DB'den yüklenen verinin bellekteki kopyası (render hızlı olsun diye)
// Tek kaynak-of-truth DB'dir; buradaki kopya her yazmadan sonra güncellenir.
const State = {
  data: {
    students: [],
    terms: [],
    assessments: [],
    homeworkTasks: [],
    homeworkAssignments: [],
    books: [],
    mockExams: [],
    scans: [],
    observations: [],
    tasks: [],
    reminders: [],
    notes: [],
    attendance: [],
    settings: null,
  },

  DEFAULT_WEIGHTS: { sinav1: 30, sinav2: 30, performans1: 20, performans2: 20 },

  async init() {
    const d = this.data;
    d.students = await DB.getAll('students');
    d.terms = await DB.getAll('terms');
    d.assessments = await DB.getAll('assessments');
    d.homeworkTasks = await DB.getAll('homeworkTasks');
    d.homeworkAssignments = await DB.getAll('homeworkAssignments');
    d.books = await DB.getAll('books');
    d.mockExams = await DB.getAll('mockExams');
    d.scans = await DB.getAll('scans');
    d.observations = await DB.getAll('observations');
    d.tasks = await DB.getAll('tasks');
    d.reminders = await DB.getAll('reminders');
    d.notes = await DB.getAll('notes');
    d.attendance = await DB.getAll('attendance');
    const settingsRows = await DB.getAll('settings');
    d.settings = settingsRows.find((s) => s.id === 'main') || null;

    if (!d.terms.length) {
      const t1 = { id: Utils.uid(), ad: '1. Dönem', sira: 1 };
      const t2 = { id: Utils.uid(), ad: '2. Dönem', sira: 2 };
      await DB.put('terms', t1);
      await DB.put('terms', t2);
      d.terms = [t1, t2];
    }

    if (!d.settings) {
      d.settings = {
        id: 'main',
        agirliklar: { ...this.DEFAULT_WEIGHTS },
        agirlikVarsayilanUyarisiKapatildi: false,
      };
      await DB.put('settings', d.settings);
    }
  },

  async save(storeName, value) {
    Utils.markSaving();
    await DB.put(storeName, value);
    const arr = this.data[storeName];
    if (Array.isArray(arr)) {
      const idx = arr.findIndex((x) => x.id === value.id);
      if (idx >= 0) arr[idx] = value;
      else arr.push(value);
    } else if (storeName === 'settings') {
      this.data.settings = value;
    }
    Utils.markSaved();
    return value;
  },

  async remove(storeName, id) {
    Utils.markSaving();
    await DB.delete(storeName, id);
    const arr = this.data[storeName];
    if (Array.isArray(arr)) {
      const idx = arr.findIndex((x) => x.id === id);
      if (idx >= 0) arr.splice(idx, 1);
    }
    Utils.markSaved();
  },

  getStudent(id) {
    return this.data.students.find((s) => s.id === id) || null;
  },

  getActiveStudents() {
    return this.data.students.filter((s) => s.durum !== 'pasif');
  },

  getTermsSorted() {
    return [...this.data.terms].sort((a, b) => a.sira - b.sira);
  },

  getStudentAssessments(studentId, termId) {
    return this.data.assessments.filter((a) => a.studentId === studentId && a.termId === termId);
  },

  getStudentHomework(studentId) {
    return this.data.homeworkAssignments.filter((a) => a.studentId === studentId);
  },

  getStudentHomeworkInRange(studentId, { baslangic, bitis } = {}) {
    return this.getStudentHomework(studentId).filter((a) => {
      const task = this.getHomeworkTask(a.homeworkId);
      if (!task) return false;
      if (baslangic && task.verilisTarihi && task.verilisTarihi < baslangic) return false;
      if (bitis && task.verilisTarihi && task.verilisTarihi > bitis) return false;
      return true;
    });
  },

  getStudentBooks(studentId) {
    return this.data.books.filter((b) => b.studentId === studentId);
  },

  getStudentMockExams(studentId) {
    return this.data.mockExams.filter((m) => m.studentId === studentId).sort((a, b) => (a.tarih || '').localeCompare(b.tarih || ''));
  },

  getStudentScans(studentId) {
    return this.data.scans.filter((s) => s.studentId === studentId).sort((a, b) => (b.olusturmaTarihi || '').localeCompare(a.olusturmaTarihi || ''));
  },

  getOwnerScans(ownerId) {
    return this.data.scans.filter((s) => s.ownerId === ownerId);
  },

  getStudentObservations(studentId) {
    return this.data.observations.filter((o) => o.studentId === studentId).sort((a, b) => (b.tarih || '').localeCompare(a.tarih || ''));
  },

  getStudentObservationsInRange(studentId, { baslangic, bitis } = {}) {
    let list = this.getStudentObservations(studentId);
    if (baslangic) list = list.filter((o) => o.tarih >= baslangic);
    if (bitis) list = list.filter((o) => o.tarih <= bitis);
    return list;
  },

  getTask(id) {
    return this.data.tasks.find((t) => t.id === id) || null;
  },

  getSubtasks(taskId) {
    return this.data.tasks.filter((t) => t.ustGorevId === taskId);
  },

  getTopLevelTasks() {
    return this.data.tasks.filter((t) => !t.ustGorevId);
  },

  getReminder(id) {
    return this.data.reminders.find((r) => r.id === id) || null;
  },

  getStudentReminders(studentId) {
    return this.data.reminders.filter((r) => r.studentId === studentId);
  },

  getNote(id) {
    return this.data.notes.find((n) => n.id === id) || null;
  },

  getStudentNotes(studentId) {
    return this.data.notes.filter((n) => n.studentId === studentId).sort((a, b) => (b.guncellemeTarihi || '').localeCompare(a.guncellemeTarihi || ''));
  },

  getStudentAttendance(studentId) {
    return this.data.attendance.filter((a) => a.studentId === studentId).sort((a, b) => (b.tarih || '').localeCompare(a.tarih || ''));
  },

  getAttendanceForDate(sinif, tarih) {
    const ids = new Set(this.data.students.filter((s) => s.sinif === sinif).map((s) => s.id));
    const map = {};
    this.data.attendance.filter((a) => a.tarih === tarih && ids.has(a.studentId)).forEach((a) => { map[a.studentId] = a.durum; });
    return map;
  },

  getHomeworkTask(id) {
    return this.data.homeworkTasks.find((t) => t.id === id) || null;
  },

  // Mükerrer okul numarası kontrolü (kendi id'si hariç)
  isOkulNoDuplicate(okulNo, excludeId) {
    return this.data.students.some((s) => s.okulNo === okulNo && s.id !== excludeId);
  },

  getSiniflar() {
    const set = new Set(this.data.students.map((s) => s.sinif).filter(Boolean));
    return [...set].sort();
  },
};
