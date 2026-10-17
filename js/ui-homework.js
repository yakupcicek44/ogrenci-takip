// Toplu Ödev Atama Paneli + tüm ödev kayıtlarının filtrelenebilir listesi
const HomeworkView = {
  html() {
    const siniflar = State.getSiniflar();
    return pageWrap('Ödevler', `
      <div class="card">
        <div class="card-title">Toplu Ödev Ata</div>
        <label class="field-label">Ödev Adı *</label>
        <input type="text" id="new-hw-ad" class="input">
        <label class="field-label">Açıklama</label>
        <textarea id="new-hw-aciklama" class="input" rows="2"></textarea>
        <label class="field-label">Veriliş Tarihi</label>
        <input type="date" id="new-hw-verilis" class="input" value="${Utils.todayISO()}">
        <label class="field-label">Teslim Tarihi</label>
        <input type="date" id="new-hw-teslim" class="input">

        <label class="field-label">Öğrenciler</label>
        <select id="new-hw-sinif-filter" class="input">
          <option value="">Tüm Sınıflar</option>
          ${siniflar.map((s) => `<option value="${Utils.escapeHtml(s)}">${Utils.escapeHtml(s)}</option>`).join('')}
        </select>
        <label class="checkbox-row"><input type="checkbox" id="new-hw-select-all"> Tümünü Seç</label>
        <div id="new-hw-student-list" class="checkbox-list"></div>

        <div id="new-hw-errors" class="form-errors"></div>
        <button class="btn btn-primary btn-block" id="new-hw-submit">Ödevi Ata</button>
      </div>

      <div class="card">
        <div class="card-title">Atanmış Ödevler</div>
        <div class="toolbar">
          <select id="hw-filter-durum" class="input">
            <option value="">Tüm Durumlar</option>
            ${Homework.DURUMLAR.map((d) => `<option value="${d}">${d}</option>`).join('')}
          </select>
          <select id="hw-filter-sinif" class="input">
            <option value="">Tüm Sınıflar</option>
            ${siniflar.map((s) => `<option value="${Utils.escapeHtml(s)}">${Utils.escapeHtml(s)}</option>`).join('')}
          </select>
        </div>
        <div id="hw-assignment-list" class="list"></div>
      </div>
    `);
  },

  mount() {
    const siniflar = State.getSiniflar();

    const renderStudentCheckboxes = () => {
      const sinif = document.getElementById('new-hw-sinif-filter').value;
      const students = sinif ? State.getActiveStudents().filter((s) => s.sinif === sinif) : State.getActiveStudents();
      const container = document.getElementById('new-hw-student-list');
      container.innerHTML = students.map((s) => `
        <label class="checkbox-row">
          <input type="checkbox" class="hw-student-checkbox" value="${s.id}"> ${Utils.escapeHtml(s.ad)} (${Utils.escapeHtml(s.sinif)})
        </label>
      `).join('') || '<p class="muted">Bu sınıfta öğrenci yok.</p>';
    };

    document.getElementById('new-hw-sinif-filter').addEventListener('change', renderStudentCheckboxes);
    document.getElementById('new-hw-select-all').addEventListener('change', (e) => {
      document.querySelectorAll('.hw-student-checkbox').forEach((cb) => { cb.checked = e.target.checked; });
    });

    document.getElementById('new-hw-submit').addEventListener('click', async () => {
      const selected = [...document.querySelectorAll('.hw-student-checkbox:checked')].map((cb) => cb.value);
      const form = {
        ad: document.getElementById('new-hw-ad').value,
        aciklama: document.getElementById('new-hw-aciklama').value,
        verilisTarihi: document.getElementById('new-hw-verilis').value,
        teslimTarihi: document.getElementById('new-hw-teslim').value,
      };
      const result = await Homework.assign(form, selected);
      const errBox = document.getElementById('new-hw-errors');
      if (!result.ok) {
        errBox.innerHTML = result.errors.map((e) => `<div>${Utils.escapeHtml(e)}</div>`).join('');
        return;
      }
      errBox.innerHTML = '';
      document.getElementById('new-hw-ad').value = '';
      document.getElementById('new-hw-aciklama').value = '';
      document.getElementById('new-hw-teslim').value = '';
      document.querySelectorAll('.hw-student-checkbox').forEach((cb) => { cb.checked = false; });
      Utils.toast(`Ödev ${selected.length} öğrenciye atandı.`, 'success');
      renderAssignmentList();
    });

    const openEditModal = (assignmentId) => {
      const a = State.data.homeworkAssignments.find((x) => x.id === assignmentId);
      const task = State.getHomeworkTask(a.homeworkId);
      const student = State.getStudent(a.studentId);
      Modal.open(`
        <div class="modal-header">${Utils.escapeHtml(task?.ad || '')} — ${Utils.escapeHtml(student?.ad || '')}</div>
        <div class="modal-body">
          <label class="field-label">Durum</label>
          <select id="ehw-durum" class="input">
            ${Homework.DURUMLAR.map((d) => `<option value="${d}" ${d === a.durum ? 'selected' : ''}>${d}</option>`).join('')}
          </select>
          <label class="field-label">Puan</label>
          <input type="number" step="0.01" id="ehw-puan" class="input" value="${a.puan ?? ''}">
          <label class="field-label">Öğretmen Notu</label>
          <textarea id="ehw-not" class="input" rows="2">${Utils.escapeHtml(a.ogretmenNotu || '')}</textarea>
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" id="ehw-cancel">Vazgeç</button>
          <button class="btn btn-primary" id="ehw-save">Kaydet</button>
        </div>
      `, {
        onMount: (root) => {
          root.querySelector('#ehw-cancel').onclick = () => Modal.close();
          root.querySelector('#ehw-save').onclick = async () => {
            await Homework.updateAssignment(a.id, {
              durum: root.querySelector('#ehw-durum').value,
              puan: root.querySelector('#ehw-puan').value,
              ogretmenNotu: root.querySelector('#ehw-not').value,
            });
            Modal.close();
            Utils.toast('Güncellendi.', 'success');
            renderAssignmentList();
          };
        },
      });
    };

    const renderAssignmentList = () => {
      const durum = document.getElementById('hw-filter-durum').value;
      const sinif = document.getElementById('hw-filter-sinif').value;
      const list = Homework.filterAll({ durum, sinif });
      const container = document.getElementById('hw-assignment-list');
      if (!list.length) { container.innerHTML = emptyState('Kayıt bulunamadı.', '📝'); return; }
      container.innerHTML = list.map((row) => `
        <div class="list-item" data-id="${row.id}">
          <div class="list-item-main">
            <div class="list-item-title">${Utils.escapeHtml(row.task.ad)} — ${Utils.escapeHtml(row.student.ad)}</div>
            <div class="list-item-sub">${Utils.escapeHtml(row.student.sinif)} · Teslim: ${Utils.formatDateTR(row.task.teslimTarihi)} · <span class="badge badge-${row.durum.replace(/\s/g, '-')}">${row.durum}</span></div>
          </div>
          <button class="btn btn-secondary btn-sm edit-assignment" data-id="${row.id}">Düzenle</button>
        </div>
      `).join('');
      container.querySelectorAll('.edit-assignment').forEach((btn) => {
        btn.onclick = () => openEditModal(btn.dataset.id);
      });
    };

    document.getElementById('hw-filter-durum').addEventListener('change', renderAssignmentList);
    document.getElementById('hw-filter-sinif').addEventListener('change', renderAssignmentList);

    renderStudentCheckboxes();
    renderAssignmentList();

    const params = new URLSearchParams(location.hash.split('?')[1] || '');
    if (params.get('yeni') === '1') {
      document.getElementById('new-hw-ad').focus();
    }
  },
};
