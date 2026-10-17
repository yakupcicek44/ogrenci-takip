// Gözlem Günlüğü — Maarif Modeli'nin süreç/kanıt temelli değerlendirme anlayışına uygun olarak
// tek bir metin kutusu yerine tarihli, biriken bir günlük. "Ön Değerlendirme" de aynı günlüğün
// bir türü olarak tutulur (dönem başı seviye/ilgi/ihtiyaç belirleme notu).
const OBSERVATION_TYPES = [
  { key: 'onDegerlendirme', etiket: 'Ön Değerlendirme' },
  { key: 'gozlem', etiket: 'Gözlem' },
  { key: 'degerlendirme', etiket: 'Öğretmen Değerlendirmesi' },
];

// Serbest etiketler — resmi "yetkinlik alanı" sayısı/isimleri kaynaklar arası farklılaştığı için
// sabit/resmi bir liste olarak sunulmuyor, sadece öneri niteliğinde kısayollar.
// Ayarlar'dan düzenlenebilir (settings.beceriEtiketleri) — bu, değiştirilmemişse kullanılan varsayılandır.
const DEFAULT_BECERI_ONERILERI = ['Eleştirel Düşünme', 'İletişim', 'Problem Çözme', 'Sorumluluk', 'İş Birliği', 'Araştırma'];

const Observations = {
  TYPES: OBSERVATION_TYPES,
  DEFAULT_BECERI_ONERILERI,

  getBeceriEtiketleri() {
    const custom = State.data.settings.beceriEtiketleri;
    return Array.isArray(custom) && custom.length ? custom : DEFAULT_BECERI_ONERILERI;
  },

  async save(studentId, form, existingId) {
    if (!form.metin || !form.metin.trim()) return { ok: false, errors: ['Gözlem metni boş olamaz.'] };
    const record = {
      id: existingId || Utils.uid(),
      studentId,
      tarih: form.tarih || Utils.todayISO(),
      tur: form.tur || 'gozlem',
      metin: form.metin.trim(),
      beceriEtiketi: form.beceriEtiketi || '',
    };
    await State.save('observations', record);
    return { ok: true, record };
  },

  async remove(id) {
    await State.remove('observations', id);
  },
};
