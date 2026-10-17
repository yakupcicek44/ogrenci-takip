// Dönem sonu AI değerlendirme yazısı taslağı. Görsel YOK, sadece sayısal/metin özet
// Gemini'ye gönderilir. Taslak öğretmen onaylamadan hiçbir yere kaydedilmez; onaylanınca
// Gözlem Günlüğü'ne "Öğretmen Değerlendirmesi" türünde kaydedilir ve Karne'de otomatik görünür.
const Narrative = {
  buildContext(studentId, termId) {
    const student = State.getStudent(studentId);
    const term = State.data.terms.find((t) => t.id === termId);
    const range = { baslangic: term?.baslangicTarihi, bitis: term?.bitisTarihi };

    const ortalama = Assessments.calcTermAverage(studentId, termId);
    const ranking = Assessments.rankInClass(student.sinif, termId);
    const kendiSira = ranking.find((r) => r.student.id === studentId);
    const att = Attendance.getStudentSummary(studentId, range);
    const hw = State.getStudentHomeworkInRange(studentId, range);
    const hwTamamlanan = hw.filter((a) => a.durum === 'teslim edildi').length;
    const obs = State.getStudentObservationsInRange(studentId, range).filter((o) => o.tur !== 'degerlendirme');

    const parts = [
      `Ad: ${student.ad}, Sınıf: ${student.sinif}, Dönem: ${term?.ad || ''}`,
      `Dönem ortalaması: ${ortalama !== null ? ortalama : 'girilmedi'}${kendiSira ? `, sınıf sıralaması: ${kendiSira.rank}/${ranking.length}` : ''}`,
      att.toplam ? `Devamsızlık: ${att.toplam} gün kayıtlı, ${att.yok} gün yok, devamsızlık oranı %${att.devamsizlikOrani}` : 'Devamsızlık kaydı yok.',
      hw.length ? `Ödev tamamlama: ${hwTamamlanan}/${hw.length}` : 'Ödev kaydı yok.',
    ];
    if (obs.length) {
      parts.push('Öğretmen gözlemleri: ' + obs.map((o) => o.metin).join(' | '));
    }
    return parts.join('\n');
  },

  async generate(studentId, termId) {
    const context = this.buildContext(studentId, termId);
    const res = await fetch(ScanConfig.WORKER_URL + '/narrative', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-App-Secret': ScanConfig.APP_SHARED_SECRET },
      body: JSON.stringify({ context }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'Değerlendirme yazısı oluşturulamadı.');
    return data.metin;
  },

  async approve(studentId, termId, metin) {
    const term = State.data.terms.find((t) => t.id === termId);
    return Observations.save(studentId, {
      tur: 'degerlendirme',
      tarih: term?.bitisTarihi || Utils.todayISO(),
      metin,
    }, `degerlendirme_${studentId}_${termId}`);
  },
};
