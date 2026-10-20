// Günlük toplu yoklama alma ekranı
const AttendanceView = {
  html() {
    const siniflar = State.getSiniflar();
    return pageWrap('Yoklama', `
      <div class="toolbar">
        <select id="att-sinif" class="input">
          ${siniflar.length ? siniflar.map((s) => `<option value="${Utils.escapeHtml(s)}">${Utils.escapeHtml(s)}</option>`).join('') : '<option value="">Önce öğrenci ekle</option>'}
        </select>
        <input type="date" id="att-tarih" class="input" value="${Utils.todayISO()}">
      </div>
      <div class="button-row">
        <button class="btn btn-secondary" id="att-hepsi-var">Hepsini "Var" Yap</button>
      </div>
      <div id="att-list" class="list" style="margin-top:12px;"></div>
      <button class="btn btn-primary btn-block" id="att-save" style="margin-top:12px;">Yoklamayı Kaydet</button>
    `);
  },

  mount() {
    let pending = {}; // studentId -> durum (henüz kaydedilmemiş yerel seçim)

    const renderList = () => {
      const sinif = document.getElementById('att-sinif').value;
      const tarih = document.getElementById('att-tarih').value;
      const container = document.getElementById('att-list');
      if (!sinif) { container.innerHTML = emptyState('Önce bir sınıf seç.', '🗓️'); return; }

      const students = State.getActiveStudents().filter((s) => s.sinif === sinif).sort((a, b) => a.okulNo.localeCompare(b.okulNo, 'tr', { numeric: true }));
      if (!students.length) { container.innerHTML = emptyState('Bu sınıfta öğrenci yok.', '🗓️'); return; }

      // Her öğrenci varsayılan olarak "var" işaretli gelir — öğretmen sadece
      // devamsız olanları işaretlesin, herkesi tek tek "var" yapması gerekmesin.
      const existing = State.getAttendanceForDate(sinif, tarih);
      pending = {};
      students.forEach((s) => { pending[s.id] = existing[s.id] || 'var'; });

      container.innerHTML = students.map((s) => `
        <div class="list-item" data-student="${s.id}">
          <div class="list-item-main">
            <div class="list-item-title">${Utils.escapeHtml(s.ad)}</div>
          </div>
          <div class="button-row" style="margin:0;">
            ${Attendance.DURUMLAR.map((d) => `
              <button class="btn btn-sm att-durum-btn ${pending[s.id] === d ? (d === 'var' ? 'btn-primary' : 'btn-danger') : 'btn-secondary'}" data-student="${s.id}" data-durum="${d}">${d}</button>
            `).join('')}
          </div>
        </div>
      `).join('');

      container.querySelectorAll('.att-durum-btn').forEach((btn) => {
        btn.onclick = () => {
          pending[btn.dataset.student] = btn.dataset.durum;
          renderButtonsOnly();
        };
      });
    };

    const renderButtonsOnly = () => {
      document.querySelectorAll('.att-durum-btn').forEach((btn) => {
        const selected = pending[btn.dataset.student] === btn.dataset.durum;
        btn.className = `btn btn-sm att-durum-btn ${selected ? (btn.dataset.durum === 'var' ? 'btn-primary' : 'btn-danger') : 'btn-secondary'}`;
      });
    };

    document.getElementById('att-sinif').addEventListener('change', renderList);
    document.getElementById('att-tarih').addEventListener('change', renderList);

    document.getElementById('att-hepsi-var').addEventListener('click', () => {
      document.querySelectorAll('.att-durum-btn[data-durum="var"]').forEach((btn) => {
        pending[btn.dataset.student] = 'var';
      });
      renderButtonsOnly();
    });

    document.getElementById('att-save').addEventListener('click', async () => {
      const tarih = document.getElementById('att-tarih').value;
      await Attendance.bulkMark(tarih, pending);
      Utils.toast('Yoklama kaydedildi.', 'success');
    });

    renderList();
  },
};
