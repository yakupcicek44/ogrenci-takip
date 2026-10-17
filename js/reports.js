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

  studentPDF(studentId) {
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

    const homework = State.getStudentHomework(studentId).map((a) => {
      const task = State.getHomeworkTask(a.homeworkId);
      return [task ? task.ad : '-', task ? Utils.formatDateTR(task.teslimTarihi) : '-', a.durum, a.puan ?? '-', a.ogretmenNotu || ''];
    });
    if (homework.length) {
      if (y > 700) { doc.addPage(); y = 40; }
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

    const books = State.getStudentBooks(studentId).map((b) => [
      b.kitapAdi, b.yazar || '-', b.sayfaSayisi ?? '-', b.durum,
      Utils.formatDateTR(b.baslangicTarihi), Utils.formatDateTR(b.bitisTarihi),
    ]);
    if (books.length) {
      if (y > 680) { doc.addPage(); y = 40; }
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

    const exams = State.getStudentMockExams(studentId).map((m) => [
      m.denemeAdi, Utils.formatDateTR(m.tarih), m.puan ?? '-', m.dogru ?? '-', m.yanlis ?? '-', m.bos ?? '-', m.net ?? '-',
    ]);
    if (exams.length) {
      if (y > 680) { doc.addPage(); y = 40; }
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

    if (student.gozlemNotlari) {
      if (y > 700) { doc.addPage(); y = 40; }
      y = this._sectionTitle(doc, 'Öğretmen Gözlem Notları', y);
      doc.setFontSize(9);
      doc.text(student.gozlemNotlari, 40, y, { maxWidth: 515 });
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

  studentExcel(studentId) {
    const student = State.getStudent(studentId);
    if (!student) return;
    const wb = XLSX.utils.book_new();

    const genel = [
      ['Ad Soyad', student.ad],
      ['Okul No', student.okulNo],
      ['Sınıf/Şube', student.sinif],
      ['Açıklama', student.aciklama || ''],
      ['Gözlem Notları', student.gozlemNotlari || ''],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(genel), 'Genel Bilgiler');

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

    const hwRows = [['Ödev', 'Veriliş', 'Teslim', 'Durum', 'Puan', 'Öğretmen Notu']];
    for (const a of State.getStudentHomework(studentId)) {
      const task = State.getHomeworkTask(a.homeworkId);
      hwRows.push([task?.ad || '-', task?.verilisTarihi || '', task?.teslimTarihi || '', a.durum, a.puan, a.ogretmenNotu || '']);
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(hwRows), 'Ödevler');

    const bookRows = [['Kitap', 'Yazar', 'Sayfa', 'Başlangıç', 'Bitiş', 'Durum', 'Öğrenci Özeti', 'Öğretmen Değerlendirmesi']];
    for (const b of State.getStudentBooks(studentId)) {
      bookRows.push([b.kitapAdi, b.yazar, b.sayfaSayisi, b.baslangicTarihi, b.bitisTarihi, b.durum, b.ogrenciOzeti, b.ogretmenDegerlendirmesi]);
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(bookRows), 'Kitaplar');

    const examRows = [['Deneme', 'Tarih', 'Puan', 'Doğru', 'Yanlış', 'Boş', 'Net']];
    for (const m of State.getStudentMockExams(studentId)) {
      examRows.push([m.denemeAdi, m.tarih, m.puan, m.dogru, m.yanlis, m.bos, m.net]);
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(examRows), 'Denemeler');

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
};
