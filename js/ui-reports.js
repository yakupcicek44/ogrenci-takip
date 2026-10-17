// Raporlar — öğrenci bazlı ve sınıf bazlı PDF/Excel çıktıları
const ReportsView = {
  html() {
    const students = [...State.data.students].sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));
    const siniflar = State.getSiniflar();
    const terms = State.getTermsSorted();

    return pageWrap('Raporlar', `
      <div class="card">
        <div class="card-title">Öğrenci Bazlı Rapor</div>
        <select id="report-student" class="input">
          ${students.map((s) => `<option value="${s.id}">${Utils.escapeHtml(s.ad)} (${Utils.escapeHtml(s.sinif)})</option>`).join('')}
        </select>
        <div class="button-row">
          <button class="btn btn-primary" id="report-student-pdf">PDF İndir</button>
          <button class="btn btn-secondary" id="report-student-excel">Excel İndir</button>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Sınıf Bazlı Rapor</div>
        <select id="report-sinif" class="input">
          ${siniflar.map((s) => `<option value="${Utils.escapeHtml(s)}">${Utils.escapeHtml(s)}</option>`).join('')}
        </select>
        <select id="report-term" class="input">
          ${terms.map((t) => `<option value="${t.id}">${Utils.escapeHtml(t.ad)}</option>`).join('')}
        </select>
        <div class="button-row">
          <button class="btn btn-primary" id="report-sinif-pdf">PDF İndir</button>
          <button class="btn btn-secondary" id="report-sinif-excel">Excel İndir</button>
        </div>
      </div>
    `);
  },

  mount() {
    if (!State.data.students.length) {
      Utils.toast('Rapor oluşturmak için önce öğrenci eklemelisin.', 'info');
    }

    document.getElementById('report-student-pdf')?.addEventListener('click', () => {
      const id = document.getElementById('report-student').value;
      if (!id) return;
      Reports.studentPDF(id);
    });
    document.getElementById('report-student-excel')?.addEventListener('click', () => {
      const id = document.getElementById('report-student').value;
      if (!id) return;
      Reports.studentExcel(id);
    });
    document.getElementById('report-sinif-pdf')?.addEventListener('click', () => {
      const sinif = document.getElementById('report-sinif').value;
      const termId = document.getElementById('report-term').value;
      if (!sinif || !termId) return;
      Reports.classPDF(sinif, termId);
    });
    document.getElementById('report-sinif-excel')?.addEventListener('click', () => {
      const sinif = document.getElementById('report-sinif').value;
      const termId = document.getElementById('report-term').value;
      if (!sinif || !termId) return;
      Reports.classExcel(sinif, termId);
    });
  },
};
