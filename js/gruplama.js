// Akıllı Grup/Kura Yöneticisi — sınıf içi etkinlikler (tartışma, beyin fırtınası, grup
// çalışması) için adil öğrenci gruplama ve rastgele seçim. Hiçbir veri KAYDEDİLMEZ,
// her çağrıda yeniden üretilir (ephemeral) — kalıcı bir "grup" kaydı tutulmuyor.
const Gruplama = {
  // Fisher-Yates karıştırma (yan etkisiz, yeni dizi döner).
  _shuffle(list) {
    const arr = [...list];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },

  // students: {id, ad, ...} dizisi. grupSayisi: kaç gruba bölünecek.
  // dengele=true ise dönem ortalamasına göre "yılan" (snake) dağıtımla güçlü/zayıf
  // öğrenciler gruplar arasında dengelenir; notu olmayanlar en sona (en zayıf) sayılır.
  // dengele=false ise tamamen rastgele dağıtılır.
  olustur(students, grupSayisi, { dengele = false, termId = null, dersId = null } = {}) {
    const n = Math.max(1, Math.min(grupSayisi, students.length || 1));
    const gruplar = Array.from({ length: n }, () => []);
    if (!students.length) return gruplar;

    let siralı;
    if (dengele) {
      const withAvg = students.map((s) => ({
        student: s,
        ortalama: Assessments.calcTermAverage(s.id, termId, dersId),
      }));
      // Aynı ortalamadaki öğrencilerin sırası her seferinde değişsin diye önce karıştırıp
      // sonra STABİL sırala (karıştırma, eşit ortalamalı öğrenciler arasındaki göreli
      // sırayı rastgeleleştirir; sort sonrası o göreli sıra korunur).
      const shuffled = this._shuffle(withAvg);
      shuffled.sort((a, b) => {
        if (a.ortalama === null && b.ortalama === null) return 0;
        if (a.ortalama === null) return 1;
        if (b.ortalama === null) return -1;
        return b.ortalama - a.ortalama;
      });
      siralı = shuffled.map((x) => x.student);
    } else {
      siralı = this._shuffle(students);
    }

    // Yılan (snake) dağıtım: 0,1,2,...,n-1,n-1,...,2,1,0,0,1,2,... — dengeli modda
    // güçlü/zayıf öğrencileri gruplar arasında eşitler; rastgele modda da zararsızdır.
    let grupIdx = 0;
    let yon = 1;
    for (const s of siralı) {
      gruplar[grupIdx].push(s);
      if (n > 1) {
        if (grupIdx + yon >= n || grupIdx + yon < 0) yon *= -1;
        else grupIdx += yon;
      }
    }
    return gruplar;
  },

  // Tekrarsız rastgele seçim havuzu — tüm öğrenciler bir kez seçilene kadar aynı öğrenci
  // tekrar çıkmaz (adil "kura" için). Havuz dışarıda (UI state olarak) tutulur, bu sadece
  // saf fonksiyonlardır.
  yeniHavuz(students) {
    return this._shuffle(students).map((s) => s.id);
  },

  // havuz: kalan id listesi. Boşsa null döner (çağıran taraf sıfırlayıp tekrar dener).
  sec(students, havuz) {
    if (!havuz.length) return { secilen: null, kalanHavuz: [] };
    const id = havuz[0];
    const kalanHavuz = havuz.slice(1);
    const secilen = students.find((s) => s.id === id) || null;
    return { secilen, kalanHavuz };
  },
};
