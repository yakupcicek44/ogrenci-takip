// IndexedDB katmanı — tüm kalıcı veri burada tutulur (geçici bellek kullanılmaz)
const DB_NAME = 'ogrenci-takip-db';
const DB_VERSION = 2;

let dbInstance = null;

function openDB() {
  if (dbInstance) return Promise.resolve(dbInstance);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;

      if (!db.objectStoreNames.contains('students')) {
        const s = db.createObjectStore('students', { keyPath: 'id' });
        s.createIndex('okulNo', 'okulNo', { unique: true });
        s.createIndex('sinif', 'sinif', { unique: false });
      }

      if (!db.objectStoreNames.contains('terms')) {
        db.createObjectStore('terms', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('assessments')) {
        const a = db.createObjectStore('assessments', { keyPath: 'id' });
        a.createIndex('studentId', 'studentId', { unique: false });
        a.createIndex('studentTerm', ['studentId', 'termId'], { unique: false });
      }

      if (!db.objectStoreNames.contains('homeworkTasks')) {
        db.createObjectStore('homeworkTasks', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('homeworkAssignments')) {
        const h = db.createObjectStore('homeworkAssignments', { keyPath: 'id' });
        h.createIndex('studentId', 'studentId', { unique: false });
        h.createIndex('homeworkId', 'homeworkId', { unique: false });
      }

      if (!db.objectStoreNames.contains('books')) {
        const b = db.createObjectStore('books', { keyPath: 'id' });
        b.createIndex('studentId', 'studentId', { unique: false });
      }

      if (!db.objectStoreNames.contains('mockExams')) {
        const m = db.createObjectStore('mockExams', { keyPath: 'id' });
        m.createIndex('studentId', 'studentId', { unique: false });
      }

      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('scans')) {
        const sc = db.createObjectStore('scans', { keyPath: 'id' });
        sc.createIndex('studentId', 'studentId', { unique: false });
        sc.createIndex('ownerId', 'ownerId', { unique: false });
      }
    };

    req.onsuccess = (e) => {
      dbInstance = e.target.result;
      resolve(dbInstance);
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

function tx(storeName, mode = 'readonly') {
  return openDB().then((db) => db.transaction(storeName, mode).objectStore(storeName));
}

const DB = {
  async getAll(storeName) {
    const store = await tx(storeName);
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async get(storeName, id) {
    const store = await tx(storeName);
    return new Promise((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  },

  async getByIndex(storeName, indexName, value) {
    const store = await tx(storeName);
    return new Promise((resolve, reject) => {
      const req = store.index(indexName).getAll(value);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async put(storeName, value) {
    const store = await tx(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.put(value);
      req.onsuccess = () => resolve(value);
      req.onerror = () => reject(req.error);
    });
  },

  async delete(storeName, id) {
    const store = await tx(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async clear(storeName) {
    const store = await tx(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async bulkPut(storeName, values) {
    const store = await tx(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const t = store.transaction;
      values.forEach((v) => store.put(v));
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
    });
  },

  // Tüm store'ları tek bir nesnede döndürür (JSON yedekleme için)
  async exportAll() {
    const names = ['students', 'terms', 'assessments', 'homeworkTasks', 'homeworkAssignments', 'books', 'mockExams', 'scans', 'settings'];
    const result = {};
    for (const n of names) {
      result[n] = await DB.getAll(n);
    }
    return result;
  },

  // JSON yedekten tüm store'ları geri yükler (önce temizler, sonra yazar)
  async importAll(data) {
    const names = ['students', 'terms', 'assessments', 'homeworkTasks', 'homeworkAssignments', 'books', 'mockExams', 'scans', 'settings'];
    for (const n of names) {
      await DB.clear(n);
      if (Array.isArray(data[n]) && data[n].length) {
        await DB.bulkPut(n, data[n]);
      }
    }
  },
};
