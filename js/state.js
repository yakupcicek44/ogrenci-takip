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
