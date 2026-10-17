// PDF (jsPDF) ve Excel (SheetJS) rapor üretimi — tamamen yerelde çalışır, harici servis kullanmaz
const Reports = {
  _newDoc() {
    const doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'a4' });
    doc.setFont('Lato', 'normal');
    return doc;
  },

  _header(doc, title) {
    doc.setFont('Lato', 'bold');
    doc.setFontSize(16);
    doc.text(title, 40, 40);
    doc.setFont('Lato', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text('Oluşturulma: ' + Utils.formatDateTimeTR(new Date().toISOString()), 40, 58);
    doc.setTextColor(0);
    return 78;
  },

  _sectionTitle(doc, text, y) {
    doc.setFont('Lato', 'bold');
    doc.setFontSize(12);
    doc.text(text, 40, y);
    doc.setFont('Lato', 'normal');
    return y + 14;
  },

  DEFAULT_STUDENT_SECTIONS: { assessments: true, homework: true, books: true, exams: true, observations: true, attendance: true },

  studentPDF(studentId, sections) {
    const opt = { ...this.DEFAULT_STUDENT_SECTIONS, ...(sections || {}) };
    const student = State.getStudent(studentId);
    if (!student) return;
    const doc = this._newDoc();
    let y = this._header(doc, 'Öğrenci Raporu — ' + student.ad);

    doc.setFontSize(10);
    doc.text(`Okul No: ${student.okulNo}    Sınıf/Şube: ${student.sinif}`, 40, y);
    y += 22;

    if (student.aciklama) {
      doc.text('Açıklama: ' + student.aciklama, 40, y, { maxWidth: 515 });
      y += 20;
    }

    const ensureSpace = (limit) => { if (y > limit) { doc.addPage(); y = 40; } };

    if (opt.assessments) {
      y = this._sectionTitle(doc, 'Sınav ve Performans Ödevi', y + 6);
      const terms = State.getTermsSorted();
      const rows = [];
      for (const term of terms) {
        for (const slotDef of Assessments.SLOTS) {
          const rec = Assessments.getSlotRecord(studentId, term.id, slotDef.key);
          rows.push([
            term.ad,
            slotDef.etiket,
            rec && !Utils.isEmptyGrade(rec.puan) ? rec.puan : '-',
            rec && rec.tarih ? Utils.formatDateTR(rec.tarih) : '-',
            rec && rec.aciklama ? rec.aciklama : '',
          ]);
        }
        const ort = Assessments.calcTermAverage(studentId, term.id);
        rows.push([term.ad, 'Dönem Ortalaması', ort !== null ? ort : '-', '', '']);
      }
      doc.autoTable({
        startY: y,
        head: [['Dönem', 'Değerlendirme', 'Not', 'Tarih', 'Açıklama']],
        body: rows,
        styles: { font: 'Lato', fontSize: 9 },
        headStyles: { font: 'Lato', fontStyle: 'bold', fillColor: [37, 99, 235] },
        margin: { left: 40, right: 40 },
      });
      y = doc.lastAutoTable.finalY + 20;
    }

    if (opt.attendance) {
      const att = Attendance.getStudentSummary(studentId);
      ensureSpace(700);
      y = this._sectionTitle(doc, 'Devamsızlık', y);
      doc.setFontSize(9);
      doc.text(
        att.toplam ? `Toplam ${att.toplam} gün · Var: ${att.var} · Yok: ${att.yok} · İzinli: ${att.izinli} · Devamsızlık oranı: %${att.devamsizlikOrani}` : 'Kayıt yok.',
        40, y
      );
      y += 22;
    }

    if (opt.homework) {
      const homework = State.getStudentHomework(studentId).map((a) => {
        const task = State.getHomeworkTask(a.homeworkId);
        return [task ? task.ad : '-', task ? Utils.formatDateTR(task.teslimTarihi) : '-', a.durum, a.puan ?? '-', a.ogretmenNotu || ''];
      });
      if (homework.length) {
        ensureSpace(700);
        y = this._sectionTitle(doc, 'Ödev Takibi', y);
        doc.autoTable({
          startY: y,
          head: [['Ödev', 'Teslim Tarihi', 'Durum', 'Puan', 'Öğretmen Notu']],
          body: homework,
          styles: { font: 'Lato', fontSize: 9 },
          headStyles: { font: 'Lato', fontStyle: 'bold', fillColor: [37, 99, 235] },
          margin: { left: 40, right: 40 },
        });
        y = doc.lastAutoTable.finalY + 20;
      }
    }

    if (opt.books) {
      const books = State.getStudentBooks(studentId).map((b) => [
        b.kitapAdi, b.yazar || '-', b.sayfaSayisi ?? '-', b.durum,
        Utils.formatDateTR(b.baslangicTarihi), Utils.formatDateTR(b.bitisTarihi),
      ]);
      if (books.length) {
        ensureSpace(680);
        y = this._sectionTitle(doc, 'Kitap Okuma', y);
        doc.autoTable({
          startY: y,
          head: [['Kitap', 'Yazar', 'Sayfa', 'Durum', 'Başlangıç', 'Bitiş']],
          body: books,
          styles: { font: 'Lato', fontSize: 9 },
          headStyles: { font: 'Lato', fontStyle: 'bold', fillColor: [37, 99, 235] },
          margin: { left: 40, right: 40 },
        });
        y = doc.lastAutoTable.finalY + 20;
      }
    }

    if (opt.exams) {
      const exams = State.getStudentMockExams(studentId).map((m) => [
        m.denemeAdi, Utils.formatDateTR(m.tarih), m.puan ?? '-', m.dogru ?? '-', m.yanlis ?? '-', m.bos ?? '-', m.net ?? '-',
      ]);
      if (exams.length) {
        ensureSpace(680);
        y = this._sectionTitle(doc, 'Deneme Sonuçları', y);
        doc.autoTable({
          startY: y,
          head: [['Deneme', 'Tarih', 'Puan', 'Doğru', 'Yanlış', 'Boş', 'Net']],
          body: exams,
          styles: { font: 'Lato', fontSize: 9 },
          headStyles: { font: 'Lato', fontStyle: 'bold', fillColor: [37, 99, 235] },
          margin: { left: 40, right: 40 },
        });
        y = doc.lastAutoTable.finalY + 20;
      }
    }

    if (opt.observations) {
      const observations = State.getStudentObservations(studentId);
      if (observations.length) {
        ensureSpace(680);
        y = this._sectionTitle(doc, 'Gözlem Günlüğü', y);
        doc.autoTable({
          startY: y,
          head: [['Tarih', 'Tür', 'Beceri Etiketi', 'Metin']],
          body: observations.map((o) => [
            Utils.formatDateTR(o.tarih),
            Observations.TYPES.find((t) => t.key === o.tur)?.etiket || o.tur,
            o.beceriEtiketi || '-',
            o.metin,
          ]),
          styles: { font: 'Lato', fontSize: 9 },
          headStyles: { font: 'Lato', fontStyle: 'bold', fillColor: [37, 99, 235] },
          margin: { left: 40, right: 40 },
        });
      }
    }

    doc.save(`${student.ad.replace(/\s+/g, '_')}_rapor.pdf`);
  },

  classPDF(sinif, termId) {
    const term = State.data.terms.find((t) => t.id === termId);
    const doc = this._newDoc();
    let y = this._header(doc, `Sınıf Raporu — ${sinif} (${term ? term.ad : ''})`);

    const ranking = Assessments.rankInClass(sinif, termId);
    const rows = ranking.map((r) => [
      r.rank,
      r.student.ad,
      r.student.okulNo,
      ...Assessments.SLOTS.map((s) => {
        const rec = Assessments.getSlotRecord(r.student.id, termId, s.key);
        return rec && !Utils.isEmptyGrade(rec.puan) ? rec.puan : '-';
      }),
      r.average !== null ? r.average : '-',
    ]);

    doc.autoTable({
      startY: y,
      head: [['Sıra', 'Ad Soyad', 'Okul No', '1.Sınav', '2.Sınav', '1.Perf.', '2.Perf.', 'Ortalama']],
      body: rows,
      styles: { font: 'Lato', fontSize: 9 },
      headStyles: { font: 'Lato', fontStyle: 'bold', fillColor: [37, 99, 235] },
      margin: { left: 40, right: 40 },
    });

    doc.save(`${sinif.replace(/\s+/g, '_')}_sinif_raporu.pdf`);
  },

  studentExcel(studentId, sections) {
    const opt = { ...this.DEFAULT_STUDENT_SECTIONS, ...(sections || {}) };
    const student = State.getStudent(studentId);
    if (!student) return;
    const wb = XLSX.utils.book_new();

    const genel = [
      ['Ad Soyad', student.ad],
      ['Okul No', student.okulNo],
      ['Sınıf/Şube', student.sinif],
      ['Açıklama', student.aciklama || ''],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(genel), 'Genel Bilgiler');

    if (opt.observations) {
      const obsRows = [['Tarih', 'Tür', 'Beceri Etiketi', 'Metin']];
      for (const o of State.getStudentObservations(studentId)) {
        obsRows.push([o.tarih, Observations.TYPES.find((t) => t.key === o.tur)?.etiket || o.tur, o.beceriEtiketi || '', o.metin]);
      }
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(obsRows), 'Gözlem Günlüğü');
    }

    if (opt.assessments) {
      const terms = State.getTermsSorted();
      const notRows = [['Dönem', 'Değerlendirme', 'Not', 'Tarih', 'Açıklama']];
      for (const term of terms) {
        for (const slotDef of Assessments.SLOTS) {
          const rec = Assessments.getSlotRecord(studentId, term.id, slotDef.key);
          notRows.push([term.ad, slotDef.etiket, rec ? rec.puan : null, rec ? rec.tarih : '', rec ? rec.aciklama : '']);
        }
        notRows.push([term.ad, 'Dönem Ortalaması', Assessments.calcTermAverage(studentId, term.id), '', '']);
      }
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(notRows), 'Sınav-Performans');
    }

    if (opt.attendance) {
      const attRows = [['Tarih', 'Durum']];
      for (const a of State.getStudentAttendance(studentId)) attRows.push([a.tarih, a.durum]);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(attRows), 'Devamsızlık');
    }

    if (opt.homework) {
      const hwRows = [['Ödev', 'Veriliş', 'Teslim', 'Durum', 'Puan', 'Öğretmen Notu']];
      for (const a of State.getStudentHomework(studentId)) {
        const task = State.getHomeworkTask(a.homeworkId);
        hwRows.push([task?.ad || '-', task?.verilisTarihi || '', task?.teslimTarihi || '', a.durum, a.puan, a.ogretmenNotu || '']);
      }
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(hwRows), 'Ödevler');
    }

    if (opt.books) {
      const bookRows = [['Kitap', 'Yazar', 'Sayfa', 'Başlangıç', 'Bitiş', 'Durum', 'Öğrenci Özeti', 'Öğretmen Değerlendirmesi']];
      for (const b of State.getStudentBooks(studentId)) {
        bookRows.push([b.kitapAdi, b.yazar, b.sayfaSayisi, b.baslangicTarihi, b.bitisTarihi, b.durum, b.ogrenciOzeti, b.ogretmenDegerlendirmesi]);
      }
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(bookRows), 'Kitaplar');
    }

    if (opt.exams) {
      const examRows = [['Deneme', 'Tarih', 'Puan', 'Doğru', 'Yanlış', 'Boş', 'Net']];
      for (const m of State.getStudentMockExams(studentId)) {
        examRows.push([m.denemeAdi, m.tarih, m.puan, m.dogru, m.yanlis, m.bos, m.net]);
      }
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(examRows), 'Denemeler');
    }

    XLSX.writeFile(wb, `${student.ad.replace(/\s+/g, '_')}_rapor.xlsx`);
  },

  classExcel(sinif, termId) {
    const term = State.data.terms.find((t) => t.id === termId);
    const ranking = Assessments.rankInClass(sinif, termId);
    const rows = [['Sıra', 'Ad Soyad', 'Okul No', '1.Sınav', '2.Sınav', '1.Performans', '2.Performans', 'Ortalama']];
    for (const r of ranking) {
      rows.push([
        r.rank,
        r.student.ad,
        r.student.okulNo,
        ...Assessments.SLOTS.map((s) => {
          const rec = Assessments.getSlotRecord(r.student.id, termId, s.key);
          return rec ? rec.puan : null;
        }),
        r.average,
      ]);
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), sinif.slice(0, 28));
    XLSX.writeFile(wb, `${sinif.replace(/\s+/g, '_')}_${term ? term.ad : ''}_raporu.xlsx`);
  },

  // Dönem sonu KARNE — ham veri dökümü değil, veliye/okula verilebilecek tek, resmi
  // görünümlü bir özet. Dönemin başlangıç/bitiş tarihi Ayarlar'dan girildiyse devamsızlık,
  // ödev ve gözlem kayıtları SADECE o aralığa göre süzülür; girilmediyse tüm zamanlar kullanılır
  // (bu durum raporda açıkça belirtilir, sessizce yanlış sayı göstermez).
  karnePDF(studentId, termId) {
    const student = State.getStudent(studentId);
    const term = State.data.terms.find((t) => t.id === termId);
    if (!student || !term) return;

    const range = { baslangic: term.baslangicTarihi, bitis: term.bitisTarihi };
    const araligBelirsiz = !term.baslangicTarihi && !term.bitisTarihi;

    const doc = this._newDoc();
    doc.setFont('Lato', 'bold');
    doc.setFontSize(20);
    doc.text('KARNE', 40, 44);
    doc.setFont('Lato', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text('Oluşturulma: ' + Utils.formatDateTimeTR(new Date().toISOString()), 40, 60);
    doc.setTextColor(0);
    let y = 84;

    doc.setFontSize(11);
    doc.text(`${student.ad}   ·   Okul No: ${student.okulNo}   ·   Sınıf/Şube: ${student.sinif}`, 40, y);
    y += 18;
    doc.setFontSize(10);
    doc.setTextColor(100);
    const aralikMetni = araligBelirsiz
      ? `${term.ad} (tarih aralığı girilmedi — tüm zamanlar)`
      : `${term.ad} (${term.baslangicTarihi ? Utils.formatDateTR(term.baslangicTarihi) : '…'} – ${term.bitisTarihi ? Utils.formatDateTR(term.bitisTarihi) : '…'})`;
    doc.text(aralikMetni, 40, y);
    doc.setTextColor(0);
    y += 24;

    y = this._sectionTitle(doc, 'Sınav ve Performans Notları', y);
    const notRows = Assessments.SLOTS.map((slotDef) => {
      const rec = Assessments.getSlotRecord(studentId, termId, slotDef.key);
      return [slotDef.etiket, rec && !Utils.isEmptyGrade(rec.puan) ? rec.puan : '-'];
    });
    const ortalama = Assessments.calcTermAverage(studentId, termId);
    const ranking = Assessments.rankInClass(student.sinif, termId);
    const kendiSira = ranking.find((r) => r.student.id === studentId);
    doc.autoTable({
      startY: y,
      head: [['Değerlendirme', 'Not']],
      body: [...notRows, ['Dönem Ortalaması', ortalama !== null ? ortalama : '-'], ['Sınıf İçi Sıralama', kendiSira ? `${kendiSira.rank} / ${ranking.length}` : '-']],
      styles: { font: 'Lato', fontSize: 9 },
      headStyles: { font: 'Lato', fontStyle: 'bold', fillColor: [37, 99, 235] },
      margin: { left: 40, right: 40 },
    });
    y = doc.lastAutoTable.finalY + 20;

    const attSummary = Attendance.getStudentSummary(studentId, range);
    y = this._sectionTitle(doc, 'Devamsızlık' + (araligBelirsiz ? ' (tüm zamanlar)' : ''), y);
    doc.setFontSize(9);
    doc.text(
      attSummary.toplam
        ? `Toplam ${attSummary.toplam} gün · Var: ${attSummary.var} · Yok: ${attSummary.yok} · İzinli: ${attSummary.izinli} · Devamsızlık oranı: %${attSummary.devamsizlikOrani}`
        : 'Bu aralıkta yoklama kaydı yok.',
      40, y
    );
    y += 22;

    const hw = State.getStudentHomeworkInRange(studentId, range);
    const hwTamamlanan = hw.filter((a) => a.durum === 'teslim edildi').length;
    y = this._sectionTitle(doc, 'Ödev Tamamlama' + (araligBelirsiz ? ' (tüm zamanlar)' : ''), y);
    doc.setFontSize(9);
    doc.text(hw.length ? `${hwTamamlanan} / ${hw.length} ödev teslim edildi.` : 'Bu aralıkta ödev kaydı yok.', 40, y);
    y += 22;

    const obs = State.getStudentObservationsInRange(studentId, range);
    const degerlendirme = obs.find((o) => o.tur === 'degerlendirme');
    const digerGozlemler = obs.filter((o) => o.tur !== 'degerlendirme');

    if (degerlendirme) {
      if (y > 680) { doc.addPage(); y = 40; }
      y = this._sectionTitle(doc, 'Öğretmen Değerlendirmesi', y);
      doc.setFontSize(9);
      const lines = doc.splitTextToSize(degerlendirme.metin, 515);
      doc.text(lines, 40, y);
      y += lines.length * 11 + 14;
    }

    if (digerGozlemler.length) {
      if (y > 650) { doc.addPage(); y = 40; }
      y = this._sectionTitle(doc, 'Gözlem Günlüğü' + (araligBelirsiz ? ' (tüm zamanlar)' : ''), y);
      doc.autoTable({
        startY: y,
        head: [['Tarih', 'Tür', 'Metin']],
        body: digerGozlemler.map((o) => [Utils.formatDateTR(o.tarih), Observations.TYPES.find((t) => t.key === o.tur)?.etiket || o.tur, o.metin]),
        styles: { font: 'Lato', fontSize: 9 },
        headStyles: { font: 'Lato', fontStyle: 'bold', fillColor: [37, 99, 235] },
        margin: { left: 40, right: 40 },
      });
      y = doc.lastAutoTable.finalY + 30;
    }

    if (y > 700) { doc.addPage(); y = 40; }
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text('Öğretmen İmzası: _______________________', 40, y + 20);
    doc.setTextColor(0);

    doc.save(`${student.ad.replace(/\s+/g, '_')}_karne_${term.ad.replace(/\s+/g, '_')}.pdf`);
  },
};
