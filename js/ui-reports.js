// Raporlar — öğrenci bazlı ve sınıf bazlı PDF/Excel çıktıları
const ReportsView = {
  html() {
    const students = [...State.data.students].sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));
    const siniflar = State.getSiniflar();
    const terms = State.getTermsSorted();
    const aktifDonem = State.getActiveTerm();

    return pageWrap('Raporlar', `
      <div class="card">
        <div class="card-title">Öğrenci Bazlı Rapor</div>
        <select id="report-student" class="input">
          ${students.map((s) => `<option value="${s.id}">${Utils.escapeHtml(s.ad)} (${Utils.escapeHtml(s.sinif)})</option>`).join('')}
        </select>
        <label class="field-label">Dahil Edilecek Bölümler</label>
        <div class="checkbox-list">
          <label class="checkbox-row"><input type="checkbox" class="report-section-check" value="assessments" checked> Sınav ve Performans</label>
          <label class="checkbox-row"><input type="checkbox" class="report-section-check" value="attendance" checked> Devamsızlık</label>
          <label class="checkbox-row"><input type="checkbox" class="report-section-check" value="homework" checked> Ödevler</label>
          <label class="checkbox-row"><input type="checkbox" class="report-section-check" value="books" checked> Kitap Okuma</label>
          <label class="checkbox-row"><input type="checkbox" class="report-section-check" value="exams" checked> Deneme Sonuçları</label>
          <label class="checkbox-row"><input type="checkbox" class="report-section-check" value="observations" checked> Gözlem Günlüğü</label>
        </div>
        <div class="button-row">
          <button class="btn btn-primary" id="report-student-pdf">PDF İndir</button>
          <button class="btn btn-secondary" id="report-student-excel">Excel İndir</button>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Dönem Sonu Karne</div>
        <p class="muted small">Notlar, devamsızlık, ödev ve gözlem günlüğünü tek, resmi görünümlü bir PDF'te birleştirir.</p>
        <select id="karne-student" class="input">
          ${students.map((s) => `<option value="${s.id}">${Utils.escapeHtml(s.ad)} (${Utils.escapeHtml(s.sinif)})</option>`).join('')}
        </select>
        <select id="karne-term" class="input" style="margin-top:8px;">
          ${terms.map((t) => `<option value="${t.id}" ${t.id === aktifDonem?.id ? 'selected' : ''}>${Utils.escapeHtml(t.ad)}${!t.baslangicTarihi ? ' (tarih aralığı girilmedi)' : ''}</option>`).join('')}
        </select>
        <div class="button-row">
          <button class="btn btn-secondary" id="karne-ai-metin">AI ile Değerlendirme Taslağı Oluştur</button>
        </div>
        <button class="btn btn-primary btn-block" id="karne-pdf" style="margin-top:10px;">Karne İndir (PDF)</button>
        <div id="karne-status" class="muted small" style="margin-top:6px;"></div>
      </div>

      <div class="card">
        <div class="card-title">Sınıf Bazlı Rapor</div>
        <select id="report-sinif" class="input">
          ${siniflar.map((s) => `<option value="${Utils.escapeHtml(s)}">${Utils.escapeHtml(s)}</option>`).join('')}
        </select>
        <select id="report-term" class="input">
          ${terms.map((t) => `<option value="${t.id}" ${t.id === aktifDonem?.id ? 'selected' : ''}>${Utils.escapeHtml(t.ad)}</option>`).join('')}
        </select>
        <label class="field-label">Dahil Edilecek Bölümler</label>
        <div class="checkbox-list">
          <label class="checkbox-row"><input type="checkbox" class="class-section-check" value="grades" checked> Notlar</label>
          <label class="checkbox-row"><input type="checkbox" class="class-section-check" value="ranking" checked> Sıralama</label>
          <label class="checkbox-row"><input type="checkbox" class="class-section-check" value="attendance"> Devamsızlık %</label>
          <label class="checkbox-row"><input type="checkbox" class="class-section-check" value="homework"> Ödev Tamamlama</label>
        </div>
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

    const getSelectedSections = () => {
      const sections = {};
      document.querySelectorAll('.report-section-check').forEach((cb) => { sections[cb.value] = cb.checked; });
      return sections;
    };

    document.getElementById('report-student-pdf')?.addEventListener('click', () => {
      const id = document.getElementById('report-student').value;
      if (!id) return;
      Reports.studentPDF(id, getSelectedSections());
    });
    document.getElementById('report-student-excel')?.addEventListener('click', () => {
      const id = document.getElementById('report-student').value;
      if (!id) return;
      Reports.studentExcel(id, getSelectedSections());
    });
    document.getElementById('karne-pdf')?.addEventListener('click', () => {
      const studentId = document.getElementById('karne-student').value;
      const termId = document.getElementById('karne-term').value;
      if (!studentId || !termId) return;
      Reports.karnePDF(studentId, termId);
    });

    document.getElementById('karne-ai-metin')?.addEventListener('click', async () => {
      const studentId = document.getElementById('karne-student').value;
      const termId = document.getElementById('karne-term').value;
      if (!studentId || !termId) return;
      const statusEl = document.getElementById('karne-status');
      statusEl.textContent = 'Taslak oluşturuluyor… (internet gerekir)';
      try {
        const metin = await Narrative.generate(studentId, termId);
        statusEl.textContent = '';
        Modal.open(`
          <div class="modal-header">AI Değerlendirme Taslağı (Onaysız)</div>
          <div class="modal-body">
            <p class="muted small">Bu bir öneridir — gözden geçirip düzenledikten sonra onayla. Onaylarsan Gözlem Günlüğü'ne "Öğretmen Değerlendirmesi" olarak kaydedilir ve Karne'de otomatik görünür.</p>
            <textarea id="narr-metin" class="input" rows="6">${Utils.escapeHtml(metin)}</textarea>
          </div>
          <div class="modal-actions">
            <button class="btn btn-secondary" id="narr-reject">Vazgeç</button>
            <button class="btn btn-primary" id="narr-approve">Onayla ve Kaydet</button>
          </div>
        `, {
          onMount: (root) => {
            root.querySelector('#narr-reject').onclick = () => Modal.close();
            root.querySelector('#narr-approve').onclick = async () => {
              await Narrative.approve(studentId, termId, root.querySelector('#narr-metin').value);
              Modal.close();
              Utils.toast('Değerlendirme kaydedildi.', 'success');
            };
          },
        });
      } catch (e) {
        statusEl.textContent = '';
        Utils.toast('Taslak oluşturulamadı: ' + e.message, 'error');
      }
    });

    const getSelectedClassSections = () => {
      const sections = {};
      document.querySelectorAll('.class-section-check').forEach((cb) => { sections[cb.value] = cb.checked; });
      return sections;
    };

    document.getElementById('report-sinif-pdf')?.addEventListener('click', () => {
      const sinif = document.getElementById('report-sinif').value;
      const termId = document.getElementById('report-term').value;
      if (!sinif || !termId) return;
      Reports.classPDF(sinif, termId, getSelectedClassSections());
    });
    document.getElementById('report-sinif-excel')?.addEventListener('click', () => {
      const sinif = document.getElementById('report-sinif').value;
      const termId = document.getElementById('report-term').value;
      if (!sinif || !termId) return;
      Reports.classExcel(sinif, termId, getSelectedClassSections());
    });
  },
};
