// Öğrenci listesi + öğrenci detay (6 sekme)
function studentFormHtml(student) {
  return `
    <div class="modal-header">${student ? 'Öğrenciyi Düzenle' : 'Yeni Öğrenci'}</div>
    <div class="modal-body">
      <label class="field-label">Ad Soyad *</label>
      <input type="text" id="f-ad" class="input" value="${Utils.escapeHtml(student?.ad || '')}">

      <label class="field-label">Okul Numarası *</label>
      <input type="text" id="f-okulNo" class="input" value="${Utils.escapeHtml(student?.okulNo || '')}">

      <label class="field-label">Sınıf/Şube *</label>
      <input type="text" id="f-sinif" class="input" placeholder="Örn: 9/A" value="${Utils.escapeHtml(student?.sinif || '')}">

      <label class="field-label">Açıklama</label>
      <textarea id="f-aciklama" class="input" rows="2">${Utils.escapeHtml(student?.aciklama || '')}</textarea>
      <p class="muted small">Gözlem/ön değerlendirme notları öğrenci sayfasının Genel Bilgiler sekmesinden, tarihli olarak eklenir.</p>

      <div id="form-errors" class="form-errors"></div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-secondary" id="f-cancel">Vazgeç</button>
      <button class="btn btn-primary" id="f-save">Kaydet</button>
    </div>
  `;
}

function openStudentForm(studentId, onSaved) {
  const student = studentId ? State.getStudent(studentId) : null;
  Modal.open(studentFormHtml(student), {
    onMount: (root) => {
      root.querySelector('#f-cancel').onclick = () => Modal.close();
      root.querySelector('#f-save').onclick = async () => {
        const form = {
          ad: root.querySelector('#f-ad').value,
          okulNo: root.querySelector('#f-okulNo').value,
          sinif: root.querySelector('#f-sinif').value,
          aciklama: root.querySelector('#f-aciklama').value,
        };
        const result = student ? await Students.update(student.id, form) : await Students.create(form);
        if (!result.ok) {
          root.querySelector('#form-errors').innerHTML = result.errors.map((e) => `<div>${Utils.escapeHtml(e)}</div>`).join('');
          return;
        }
        Modal.close();
        Utils.toast('Öğrenci kaydedildi.', 'success');
        if (onSaved) onSaved(result.student);
      };
    },
  });
}

const StudentListView = {
  html() {
    const siniflar = State.getSiniflar();
    return pageWrap('Öğrenciler', `
      <div class="toolbar">
        <input type="text" id="student-search" class="input" placeholder="Ad veya okul no ara...">
        <select id="student-sinif-filter" class="input">
          <option value="">Tüm Sınıflar</option>
          ${siniflar.map((s) => `<option value="${Utils.escapeHtml(s)}">${Utils.escapeHtml(s)}</option>`).join('')}
        </select>
      </div>
      <div class="button-row">
        <button class="btn btn-secondary" id="download-template">Excel Şablonu İndir</button>
        <label class="btn btn-secondary" id="import-excel-label" style="text-align:center;">
          Excel'den İçe Aktar
          <input type="file" id="import-excel-input" accept=".xlsx,.xls" style="display:none;">
        </label>
      </div>
      <div id="student-list-container"></div>
      <button class="fab" id="add-student-fab" title="Öğrenci Ekle">+</button>
    `);
  },

  mount() {
    const renderList = () => {
      const q = document.getElementById('student-search').value;
      const sinif = document.getElementById('student-sinif-filter').value;
      const list = Students.search(q, sinif);
      const container = document.getElementById('student-list-container');
      if (!list.length) {
        container.innerHTML = emptyState('Kayıtlı öğrenci bulunamadı.', '🧑‍🎓');
        return;
      }
      container.innerHTML = `
        <div class="list">
          ${list.map((s) => `
            <a href="#/ogrenci/${s.id}" class="list-item ${s.durum === 'pasif' ? 'list-item-muted' : ''}">
              <div class="list-item-main">
                <div class="list-item-title">${Utils.escapeHtml(s.ad)}${s.durum === 'pasif' ? ' <span class="badge">pasif</span>' : ''}</div>
                <div class="list-item-sub">No: ${Utils.escapeHtml(s.okulNo)} · ${Utils.escapeHtml(s.sinif)}</div>
              </div>
              <div class="list-item-arrow">›</div>
            </a>
          `).join('')}
        </div>
      `;
    };

    document.getElementById('student-search').addEventListener('input', Utils.debounce(renderList, 150));
    document.getElementById('student-sinif-filter').addEventListener('change', renderList);
    document.getElementById('add-student-fab').addEventListener('click', () => {
      openStudentForm(null, (student) => { location.hash = '#/ogrenci/' + student.id; });
    });

    document.getElementById('download-template').addEventListener('click', () => {
      const rows = [
        ['Ad Soyad', 'Okul No', 'Sınıf/Şube', 'Açıklama', 'Gözlem Notu'],
        ['Örnek Öğrenci', '1001', '9/A', '', ''],
      ];
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = [{ wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 30 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(wb, ws, 'Öğrenciler');
      XLSX.writeFile(wb, 'ogrenci_import_sablonu.xlsx');
    });

    document.getElementById('import-excel-input').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const firstSheet = wb.Sheets[wb.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
        if (!rawRows.length) { Utils.toast('Dosyada okunacak satır bulunamadı.', 'error'); return; }

        const { eklenen, atlananlar } = await Students.bulkImportFromSheetRows(rawRows);
        const atlananHtml = atlananlar.length
          ? `<p class="muted small" style="margin-top:8px;">Atlanan satırlar:</p><ul class="simple-list">${atlananlar.map((a) => `<li>Satır ${a.satir}: ${Utils.escapeHtml(a.sebep)}</li>`).join('')}</ul>`
          : '';
        Modal.open(`
          <div class="modal-header">İçe Aktarma Tamamlandı</div>
          <div class="modal-body">
            <p>${eklenen} öğrenci eklendi.${atlananlar.length ? ` ${atlananlar.length} satır atlandı.` : ''}</p>
            ${atlananHtml}
          </div>
          <div class="modal-actions">
            <button class="btn btn-primary" id="import-done-close">Kapat</button>
          </div>
        `, {
          onMount: (root) => {
            root.querySelector('#import-done-close').onclick = () => { Modal.close(); renderList(); };
          },
        });
      } catch (err) {
        Utils.toast('Dosya okunamadı — geçerli bir Excel dosyası olduğundan emin ol.', 'error');
      } finally {
        e.target.value = '';
      }
    });

    renderList();

    const params = new URLSearchParams(location.hash.split('?')[1] || '');
    if (params.get('ekle') === '1') {
      openStudentForm(null, (student) => { location.hash = '#/ogrenci/' + student.id; });
    }
  },
};

const STUDENT_TABS = [
  { key: 'genel', label: 'Genel Bilgiler' },
  { key: 'sinav', label: 'Sınav/Performans' },
  { key: 'odev', label: 'Ödev Takibi' },
  { key: 'kitap', label: 'Kitap Okuma' },
  { key: 'deneme', label: 'Deneme Sonuçları' },
  { key: 'yoklama', label: 'Yoklama' },
  { key: 'gelisim', label: 'Gelişim Geçmişi' },
];

const StudentDetailView = {
  html(params) {
    const student = State.getStudent(params.id);
    if (!student) return pageWrap('Öğrenci Bulunamadı', emptyState('Bu öğrenci silinmiş olabilir.'), { back: '#/ogrenciler' });

    const tab = params.tab || 'genel';
    return pageWrap(student.ad, `
      <div class="tabs">
        ${STUDENT_TABS.map((t) => `
          <a href="#/ogrenci/${student.id}/${t.key}" class="tab ${t.key === tab ? 'tab-active' : ''}">${t.label}</a>
        `).join('')}
      </div>
      <div id="tab-content" class="tab-content"></div>
    `, { back: '#/ogrenciler' });
  },

  mount(params) {
    const student = State.getStudent(params.id);
    if (!student) return;
    const tab = params.tab || 'genel';
    const container = document.getElementById('tab-content');
    const renderers = {
      genel: renderGenelTab,
      sinav: renderSinavTab,
      odev: renderOdevTab,
      kitap: renderKitapTab,
      deneme: renderDenemeTab,
      yoklama: renderYoklamaTab,
      gelisim: renderGelisimTab,
    };
    const renderer = renderers[tab] || renderGenelTab;
    container.innerHTML = renderer.html(student);
    renderer.mount(student);
  },
};

// ---- Genel Bilgiler ----
const renderGenelTab = {
  html(student) {
    return `
      <div class="card">
        <div class="card-title">Kimlik Bilgileri</div>
        <div class="kv-row"><span>Ad Soyad</span><strong>${Utils.escapeHtml(student.ad)}</strong></div>
        <div class="kv-row"><span>Okul No</span><strong>${Utils.escapeHtml(student.okulNo)}</strong></div>
        <div class="kv-row"><span>Sınıf/Şube</span><strong>${Utils.escapeHtml(student.sinif)}</strong></div>
        <div class="kv-row"><span>Durum</span><strong>${student.durum === 'pasif' ? 'Pasif' : 'Aktif'}</strong></div>
        <button class="btn btn-secondary btn-block" id="edit-genel">Düzenle</button>
      </div>

      <div class="card">
        <div class="card-title">Açıklama</div>
        <p class="muted">${Utils.escapeHtml(student.aciklama) || '<em>Girilmemiş</em>'}</p>
      </div>

      <div class="card">
        <div class="card-title">Gözlem Günlüğü</div>
        <p class="muted small">Maarif Modeli'nin süreç temelli değerlendirme anlayışına uygun olarak her gözlem/ön değerlendirme kendi tarihiyle kaydedilir.</p>
        <button class="btn btn-secondary btn-block" id="add-observation">+ Gözlem / Ön Değerlendirme Ekle</button>
        <div id="observation-list" class="list" style="margin-top:10px;"></div>
      </div>

      <div class="card card-danger">
        <div class="card-title">Tehlikeli İşlemler</div>
        <button class="btn btn-secondary btn-block" id="toggle-pasif">${student.durum === 'pasif' ? 'Aktif Yap' : 'Pasif Yap'}</button>
        <button class="btn btn-danger btn-block" id="delete-student" style="margin-top:8px">Öğrenciyi ve Tüm Kayıtlarını Sil</button>
      </div>
    `;
  },
  mount(student) {
    document.getElementById('edit-genel').onclick = () => {
      openStudentForm(student.id, () => Router.render());
    };
    document.getElementById('toggle-pasif').onclick = async () => {
      await Students.setPasif(student.id, student.durum !== 'pasif');
      Utils.toast('Durum güncellendi.', 'success');
      Router.render();
    };
    document.getElementById('delete-student').onclick = async () => {
      const ok = await Confirm.ask(
        `${student.ad} adlı öğrenci ve TÜM kayıtları (notlar, ödevler, kitaplar, denemeler) kalıcı olarak silinecek. Bu işlem geri alınamaz. Onaylıyor musun?`,
        { danger: true, confirmText: 'Evet, Sil' }
      );
      if (!ok) return;
      await Students.hardDelete(student.id);
      Utils.toast('Öğrenci silindi.', 'success');
      location.hash = '#/ogrenciler';
    };

    const openObservationForm = (obs) => {
      Modal.open(`
        <div class="modal-header">${obs ? 'Gözlemi Düzenle' : 'Yeni Gözlem'}</div>
        <div class="modal-body">
          <label class="field-label">Tür</label>
          <select id="obs-tur" class="input">
            ${Observations.TYPES.map((t) => `<option value="${t.key}" ${obs?.tur === t.key ? 'selected' : ''}>${t.etiket}</option>`).join('')}
          </select>
          <label class="field-label">Tarih</label>
          <input type="date" id="obs-tarih" class="input" value="${obs?.tarih || Utils.todayISO()}">
          <label class="field-label">Metin *</label>
          <textarea id="obs-metin" class="input" rows="3">${Utils.escapeHtml(obs?.metin || '')}</textarea>
          <label class="field-label">Beceri/Yetkinlik Etiketi (opsiyonel)</label>
          <input type="text" id="obs-beceri" class="input" value="${Utils.escapeHtml(obs?.beceriEtiketi || '')}" placeholder="Örn: Eleştirel Düşünme">
          <div class="checkbox-list" style="display:flex;flex-wrap:wrap;gap:6px;padding:8px;">
            ${Observations.BECERI_ONERILERI.map((b) => `<span class="badge obs-chip" data-val="${Utils.escapeHtml(b)}" style="cursor:pointer;">${b}</span>`).join('')}
          </div>
          <div id="obs-errors" class="form-errors"></div>
        </div>
        <div class="modal-actions">
          ${obs ? '<button class="btn btn-danger" id="obs-delete">Sil</button>' : ''}
          <button class="btn btn-secondary" id="obs-cancel">Vazgeç</button>
          <button class="btn btn-primary" id="obs-save">Kaydet</button>
        </div>
      `, {
        onMount: (root) => {
          root.querySelector('#obs-cancel').onclick = () => Modal.close();
          root.querySelectorAll('.obs-chip').forEach((chip) => {
            chip.onclick = () => { root.querySelector('#obs-beceri').value = chip.dataset.val; };
          });
          if (obs) {
            root.querySelector('#obs-delete').onclick = async () => {
              const ok = await Confirm.ask('Bu gözlem kaydı silinsin mi?', { danger: true });
              if (!ok) return;
              await Observations.remove(obs.id);
              Modal.close();
              renderObservations();
            };
          }
          root.querySelector('#obs-save').onclick = async () => {
            const result = await Observations.save(student.id, {
              tur: root.querySelector('#obs-tur').value,
              tarih: root.querySelector('#obs-tarih').value,
              metin: root.querySelector('#obs-metin').value,
              beceriEtiketi: root.querySelector('#obs-beceri').value,
            }, obs?.id);
            if (!result.ok) {
              root.querySelector('#obs-errors').innerHTML = result.errors.map((e) => `<div>${Utils.escapeHtml(e)}</div>`).join('');
              return;
            }
            Modal.close();
            Utils.toast('Gözlem kaydedildi.', 'success');
            renderObservations();
          };
        },
      });
    };

    const renderObservations = () => {
      const list = State.getStudentObservations(student.id);
      const container = document.getElementById('observation-list');
      if (!list.length) { container.innerHTML = emptyState('Henüz gözlem eklenmedi.', '📝'); return; }
      container.innerHTML = list.map((o) => {
        const tur = Observations.TYPES.find((t) => t.key === o.tur);
        return `
          <div class="list-item" data-id="${o.id}">
            <div class="list-item-main">
              <div class="list-item-title">${Utils.formatDateTR(o.tarih)} · <span class="badge">${tur ? tur.etiket : o.tur}</span>${o.beceriEtiketi ? ' · <span class="badge">' + Utils.escapeHtml(o.beceriEtiketi) + '</span>' : ''}</div>
              <div class="list-item-sub">${Utils.escapeHtml(o.metin)}</div>
            </div>
            <button class="btn btn-secondary btn-sm edit-obs" data-id="${o.id}">Düzenle</button>
          </div>
        `;
      }).join('');
      container.querySelectorAll('.edit-obs').forEach((btn) => {
        btn.onclick = () => openObservationForm(list.find((o) => o.id === btn.dataset.id));
      });
    };

    document.getElementById('add-observation').onclick = () => openObservationForm(null);
    renderObservations();
  },
};

// ---- Sınav / Performans ----
const renderSinavTab = {
  html(student) {
    const terms = State.getTermsSorted();
    return `
      <div class="field-inline">
        <label>Dönem:</label>
        <select id="sinav-term-select" class="input">
          ${terms.map((t) => `<option value="${t.id}">${Utils.escapeHtml(t.ad)}</option>`).join('')}
        </select>
      </div>
      <div id="sinav-table-container"></div>
    `;
  },
  mount(student) {
    const select = document.getElementById('sinav-term-select');
    const renderTable = () => {
      const termId = select.value;
      const container = document.getElementById('sinav-table-container');
      const ortalama = Assessments.calcTermAverage(student.id, termId);
      container.innerHTML = `
        <div class="list">
          ${Assessments.SLOTS.map((slotDef) => {
            const rec = Assessments.getSlotRecord(student.id, termId, slotDef.key);
            return `
              <div class="list-item" data-slot="${slotDef.key}">
                <div class="list-item-main">
                  <div class="list-item-title">${slotDef.etiket}</div>
                  <div class="list-item-sub">
                    Not: ${rec && !Utils.isEmptyGrade(rec.puan) ? rec.puan : '<em>girilmedi</em>'}
                    ${rec && rec.tarih ? ' · ' + Utils.formatDateTR(rec.tarih) : ''}
                  </div>
                </div>
                <button class="btn btn-secondary btn-sm edit-slot" data-slot="${slotDef.key}">Düzenle</button>
              </div>
            `;
          }).join('')}
        </div>
        <div class="card">
          <div class="kv-row"><span>Dönem Ortalaması</span><strong>${ortalama !== null ? ortalama : '-'}</strong></div>
          <p class="muted small">Ağırlıklar Ayarlar sekmesinden değiştirilebilir. Boş notlar sıfır sayılmaz, ortalamaya dahil edilmez.</p>
        </div>
      `;

      container.querySelectorAll('.edit-slot').forEach((btn) => {
        btn.onclick = () => {
          const slotKey = btn.dataset.slot;
          const slotDef = Assessments.SLOTS.find((s) => s.key === slotKey);
          const rec = Assessments.getSlotRecord(student.id, termId, slotKey);
          Modal.open(`
            <div class="modal-header">${slotDef.etiket}</div>
            <div class="modal-body">
              <label class="field-label">Not (boş bırakılabilir)</label>
              <input type="number" step="0.01" id="s-puan" class="input" value="${rec && rec.puan !== null ? rec.puan : ''}">
              <label class="field-label">Tarih</label>
              <input type="date" id="s-tarih" class="input" value="${rec?.tarih || ''}">
              <label class="field-label">Açıklama</label>
              <textarea id="s-aciklama" class="input" rows="2">${Utils.escapeHtml(rec?.aciklama || '')}</textarea>
              <button class="btn btn-secondary btn-block" id="s-scan" style="margin-top:10px;">📷 Kağıt Tara ve AI ile Değerlendir</button>
            </div>
            <div class="modal-actions">
              <button class="btn btn-secondary" id="s-cancel">Vazgeç</button>
              <button class="btn btn-primary" id="s-save">Kaydet</button>
            </div>
          `, {
            onMount: (root) => {
              root.querySelector('#s-cancel').onclick = () => Modal.close();
              root.querySelector('#s-save').onclick = async () => {
                await Assessments.saveSlot(student.id, termId, slotKey, {
                  puan: root.querySelector('#s-puan').value,
                  tarih: root.querySelector('#s-tarih').value,
                  aciklama: root.querySelector('#s-aciklama').value,
                });
                Modal.close();
                Utils.toast('Not kaydedildi.', 'success');
                renderTable();
              };
              root.querySelector('#s-scan').onclick = () => {
                ScanFlow.start({
                  studentId: student.id,
                  ownerType: 'assessmentSlot',
                  ownerId: `${termId}:${slotKey}`,
                  context: `${slotDef.etiket} — ${student.ad}`,
                  onApprove: async (puan, metin) => {
                    const current = Assessments.getSlotRecord(student.id, termId, slotKey);
                    await Assessments.saveSlot(student.id, termId, slotKey, {
                      puan: puan,
                      tarih: current?.tarih || Utils.todayISO(),
                      aciklama: (current?.aciklama ? current.aciklama + '\n\n' : '') + 'AI değerlendirmesi: ' + metin,
                    });
                    renderTable();
                  },
                });
              };
            },
          });
        };
      });
    };
    select.addEventListener('change', renderTable);
    renderTable();
  },
};

// ---- Ödev Takibi ----
const renderOdevTab = {
  html(student) {
    const assignments = State.getStudentHomework(student.id);
    return `
      <button class="btn btn-secondary btn-block" id="add-individual-hw">+ Bireysel Ödev Ata</button>
      <div class="list" id="hw-list">
        ${assignments.length ? '' : emptyState('Henüz ödev atanmadı.', '📝')}
      </div>
    `;
  },
  mount(student) {
    const listEl = document.getElementById('hw-list');
    const renderList = () => {
      const assignments = State.getStudentHomework(student.id).map((a) => ({ ...a, task: State.getHomeworkTask(a.homeworkId) })).filter((a) => a.task);
      if (!assignments.length) { listEl.innerHTML = emptyState('Henüz ödev atanmadı.', '📝'); return; }
      assignments.sort((a, b) => (b.task.verilisTarihi || '').localeCompare(a.task.verilisTarihi || ''));
      listEl.innerHTML = assignments.map((a) => `
        <div class="list-item" data-id="${a.id}">
          <div class="list-item-main">
            <div class="list-item-title">${Utils.escapeHtml(a.task.ad)}</div>
            <div class="list-item-sub">Teslim: ${Utils.formatDateTR(a.task.teslimTarihi)} · Durum: <span class="badge badge-${a.durum.replace(/\s/g, '-')}">${a.durum}</span></div>
          </div>
          <button class="btn btn-secondary btn-sm edit-hw" data-id="${a.id}">Düzenle</button>
        </div>
      `).join('');

      listEl.querySelectorAll('.edit-hw').forEach((btn) => {
        btn.onclick = () => {
          const a = State.data.homeworkAssignments.find((x) => x.id === btn.dataset.id);
          Modal.open(`
            <div class="modal-header">${Utils.escapeHtml(State.getHomeworkTask(a.homeworkId)?.ad || '')}</div>
            <div class="modal-body">
              <label class="field-label">Durum</label>
              <select id="hw-durum" class="input">
                ${Homework.DURUMLAR.map((d) => `<option value="${d}" ${d === a.durum ? 'selected' : ''}>${d}</option>`).join('')}
              </select>
              <label class="field-label">Puan</label>
              <input type="number" step="0.01" id="hw-puan" class="input" value="${a.puan !== null && a.puan !== undefined ? a.puan : ''}">
              <label class="field-label">Öğretmen Notu</label>
              <textarea id="hw-not" class="input" rows="2">${Utils.escapeHtml(a.ogretmenNotu || '')}</textarea>
              <button class="btn btn-secondary btn-block" id="hw-scan" style="margin-top:10px;">📷 Ödevi Tara ve AI ile Değerlendir</button>
            </div>
            <div class="modal-actions">
              <button class="btn btn-secondary" id="hw-cancel">Vazgeç</button>
              <button class="btn btn-primary" id="hw-save">Kaydet</button>
            </div>
          `, {
            onMount: (root) => {
              root.querySelector('#hw-cancel').onclick = () => Modal.close();
              root.querySelector('#hw-scan').onclick = () => {
                const task = State.getHomeworkTask(a.homeworkId);
                ScanFlow.start({
                  studentId: student.id,
                  ownerType: 'homeworkAssignment',
                  ownerId: a.id,
                  defaultRubric: task?.cevapAnahtari || '',
                  context: `${task?.ad || 'Ödev'} — ${student.ad}`,
                  onApprove: async (puan, metin) => {
                    await Homework.updateAssignment(a.id, {
                      durum: 'teslim edildi',
                      puan: puan,
                      ogretmenNotu: (a.ogretmenNotu ? a.ogretmenNotu + '\n\n' : '') + 'AI değerlendirmesi: ' + metin,
                    });
                    renderList();
                  },
                });
              };
              root.querySelector('#hw-save').onclick = async () => {
                await Homework.updateAssignment(a.id, {
                  durum: root.querySelector('#hw-durum').value,
                  puan: root.querySelector('#hw-puan').value,
                  ogretmenNotu: root.querySelector('#hw-not').value,
                });
                Modal.close();
                Utils.toast('Ödev güncellendi.', 'success');
                renderList();
              };
            },
          });
        };
      });
    };

    document.getElementById('add-individual-hw').onclick = () => {
      Modal.open(`
        <div class="modal-header">Bireysel Ödev Ata</div>
        <div class="modal-body">
          <label class="field-label">Ödev Adı *</label>
          <input type="text" id="ihw-ad" class="input">
          <label class="field-label">Açıklama</label>
          <textarea id="ihw-aciklama" class="input" rows="2"></textarea>
          <label class="field-label">Veriliş Tarihi</label>
          <input type="date" id="ihw-verilis" class="input" value="${Utils.todayISO()}">
          <label class="field-label">Teslim Tarihi</label>
          <input type="date" id="ihw-teslim" class="input">
          <label class="field-label">Cevap Anahtarı / Kriter (opsiyonel)</label>
          <textarea id="ihw-cevapanahtari" class="input" rows="2"></textarea>
          <div id="ihw-errors" class="form-errors"></div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" id="ihw-cancel">Vazgeç</button>
          <button class="btn btn-primary" id="ihw-save">Ata</button>
        </div>
      `, {
        onMount: (root) => {
          root.querySelector('#ihw-cancel').onclick = () => Modal.close();
          root.querySelector('#ihw-save').onclick = async () => {
            const result = await Homework.assign({
              ad: root.querySelector('#ihw-ad').value,
              aciklama: root.querySelector('#ihw-aciklama').value,
              verilisTarihi: root.querySelector('#ihw-verilis').value,
              teslimTarihi: root.querySelector('#ihw-teslim').value,
              cevapAnahtari: root.querySelector('#ihw-cevapanahtari').value,
            }, [student.id]);
            if (!result.ok) {
              root.querySelector('#ihw-errors').innerHTML = result.errors.map((e) => `<div>${Utils.escapeHtml(e)}</div>`).join('');
              return;
            }
            Modal.close();
            Utils.toast('Ödev atandı.', 'success');
            renderList();
          };
        },
      });
    };

    renderList();
  },
};

// ---- Kitap Okuma ----
const renderKitapTab = {
  html(student) {
    return `
      <button class="btn btn-secondary btn-block" id="add-book">+ Kitap Ekle</button>
      <div class="list" id="book-list"></div>
    `;
  },
  mount(student) {
    const listEl = document.getElementById('book-list');

    const openBookForm = (book) => {
      Modal.open(`
        <div class="modal-header">${book ? 'Kitabı Düzenle' : 'Yeni Kitap'}</div>
        <div class="modal-body">
          <label class="field-label">Kitap Adı *</label>
          <input type="text" id="bk-ad" class="input" value="${Utils.escapeHtml(book?.kitapAdi || '')}">
          <label class="field-label">Yazar</label>
          <input type="text" id="bk-yazar" class="input" value="${Utils.escapeHtml(book?.yazar || '')}">
          <label class="field-label">Sayfa Sayısı</label>
          <input type="number" id="bk-sayfa" class="input" value="${book?.sayfaSayisi ?? ''}">
          <label class="field-label">Başlangıç Tarihi</label>
          <input type="date" id="bk-baslangic" class="input" value="${book?.baslangicTarihi || ''}">
          <label class="field-label">Bitiş Tarihi</label>
          <input type="date" id="bk-bitis" class="input" value="${book?.bitisTarihi || ''}">
          <label class="field-label">Durum</label>
          <select id="bk-durum" class="input">
            ${Books.DURUMLAR.map((d) => `<option value="${d}" ${book?.durum === d ? 'selected' : ''}>${d}</option>`).join('')}
          </select>
          <label class="field-label">Öğrenci Özeti</label>
          <textarea id="bk-ozet" class="input" rows="2">${Utils.escapeHtml(book?.ogrenciOzeti || '')}</textarea>
          <label class="field-label">Öğretmen Değerlendirmesi</label>
          <textarea id="bk-degerlendirme" class="input" rows="2">${Utils.escapeHtml(book?.ogretmenDegerlendirmesi || '')}</textarea>
          <div id="bk-errors" class="form-errors"></div>
        </div>
        <div class="modal-actions">
          ${book ? '<button class="btn btn-danger" id="bk-delete">Sil</button>' : ''}
          <button class="btn btn-secondary" id="bk-cancel">Vazgeç</button>
          <button class="btn btn-primary" id="bk-save">Kaydet</button>
        </div>
      `, {
        onMount: (root) => {
          root.querySelector('#bk-cancel').onclick = () => Modal.close();
          if (book) {
            root.querySelector('#bk-delete').onclick = async () => {
              const ok = await Confirm.ask('Bu kitap kaydı silinsin mi?', { danger: true });
              if (!ok) return;
              await Books.remove(book.id);
              Modal.close();
              renderList();
            };
          }
          root.querySelector('#bk-save').onclick = async () => {
            const form = {
              kitapAdi: root.querySelector('#bk-ad').value,
              yazar: root.querySelector('#bk-yazar').value,
              sayfaSayisi: root.querySelector('#bk-sayfa').value,
              baslangicTarihi: root.querySelector('#bk-baslangic').value,
              bitisTarihi: root.querySelector('#bk-bitis').value,
              durum: root.querySelector('#bk-durum').value,
              ogrenciOzeti: root.querySelector('#bk-ozet').value,
              ogretmenDegerlendirmesi: root.querySelector('#bk-degerlendirme').value,
            };
            const result = await Books.save(student.id, form, book?.id);
            if (!result.ok) {
              root.querySelector('#bk-errors').innerHTML = result.errors.map((e) => `<div>${Utils.escapeHtml(e)}</div>`).join('');
              return;
            }
            Modal.close();
            Utils.toast('Kitap kaydedildi.', 'success');
            renderList();
          };
        },
      });
    };

    const renderList = () => {
      const books = State.getStudentBooks(student.id);
      if (!books.length) { listEl.innerHTML = emptyState('Henüz kitap eklenmedi.', '📚'); return; }
      listEl.innerHTML = books.map((b) => `
        <div class="list-item" data-id="${b.id}">
          <div class="list-item-main">
            <div class="list-item-title">${Utils.escapeHtml(b.kitapAdi)}</div>
            <div class="list-item-sub">${Utils.escapeHtml(b.yazar || '-')} · ${b.durum}</div>
          </div>
          <button class="btn btn-secondary btn-sm edit-book" data-id="${b.id}">Düzenle</button>
        </div>
      `).join('');
      listEl.querySelectorAll('.edit-book').forEach((btn) => {
        btn.onclick = () => openBookForm(books.find((b) => b.id === btn.dataset.id));
      });
    };

    document.getElementById('add-book').onclick = () => openBookForm(null);
    renderList();
  },
};

// ---- Deneme Sonuçları ----
const renderDenemeTab = {
  html(student) {
    return `
      <button class="btn btn-secondary btn-block" id="add-exam">+ Deneme Sonucu Ekle</button>
      <div class="card"><canvas id="exam-chart" height="180"></canvas></div>
      <div class="list" id="exam-list"></div>
    `;
  },
  mount(student) {
    const listEl = document.getElementById('exam-list');
    let chart = null;

    const drawChart = () => {
      const data = MockExams.chartData(student.id);
      const ctx = document.getElementById('exam-chart');
      if (chart) chart.destroy();
      if (!data.labels.length) return;
      chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: data.labels,
          datasets: [
            { label: 'Puan', data: data.puanlar, borderColor: '#2563eb', backgroundColor: 'transparent', tension: 0.3, spanGaps: true },
            { label: 'Net', data: data.netler, borderColor: '#16a34a', backgroundColor: 'transparent', tension: 0.3, spanGaps: true },
          ],
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } },
      });
    };

    const openExamForm = (exam) => {
      Modal.open(`
        <div class="modal-header">${exam ? 'Deneme Düzenle' : 'Yeni Deneme'}</div>
        <div class="modal-body">
          <label class="field-label">Deneme Adı *</label>
          <input type="text" id="ex-ad" class="input" value="${Utils.escapeHtml(exam?.denemeAdi || '')}">
          <label class="field-label">Tarih *</label>
          <input type="date" id="ex-tarih" class="input" value="${exam?.tarih || Utils.todayISO()}">
          <label class="field-label">Puan</label>
          <input type="number" step="0.01" id="ex-puan" class="input" value="${exam?.puan ?? ''}">
          <div class="field-row-3">
            <div><label class="field-label">Doğru</label><input type="number" id="ex-dogru" class="input" value="${exam?.dogru ?? ''}"></div>
            <div><label class="field-label">Yanlış</label><input type="number" id="ex-yanlis" class="input" value="${exam?.yanlis ?? ''}"></div>
            <div><label class="field-label">Boş</label><input type="number" id="ex-bos" class="input" value="${exam?.bos ?? ''}"></div>
          </div>
          <label class="field-label">Net</label>
          <input type="number" step="0.01" id="ex-net" class="input" value="${exam?.net ?? ''}">
          <div id="ex-errors" class="form-errors"></div>
        </div>
        <div class="modal-actions">
          ${exam ? '<button class="btn btn-danger" id="ex-delete">Sil</button>' : ''}
          <button class="btn btn-secondary" id="ex-cancel">Vazgeç</button>
          <button class="btn btn-primary" id="ex-save">Kaydet</button>
        </div>
      `, {
        onMount: (root) => {
          root.querySelector('#ex-cancel').onclick = () => Modal.close();
          if (exam) {
            root.querySelector('#ex-delete').onclick = async () => {
              const ok = await Confirm.ask('Bu deneme sonucu silinsin mi?', { danger: true });
              if (!ok) return;
              await MockExams.remove(exam.id);
              Modal.close();
              renderAll();
            };
          }
          root.querySelector('#ex-save').onclick = async () => {
            const form = {
              denemeAdi: root.querySelector('#ex-ad').value,
              tarih: root.querySelector('#ex-tarih').value,
              puan: root.querySelector('#ex-puan').value,
              dogru: root.querySelector('#ex-dogru').value,
              yanlis: root.querySelector('#ex-yanlis').value,
              bos: root.querySelector('#ex-bos').value,
              net: root.querySelector('#ex-net').value,
            };
            const result = await MockExams.save(student.id, form, exam?.id);
            if (!result.ok) {
              root.querySelector('#ex-errors').innerHTML = result.errors.map((e) => `<div>${Utils.escapeHtml(e)}</div>`).join('');
              return;
            }
            Modal.close();
            Utils.toast('Deneme kaydedildi.', 'success');
            renderAll();
          };
        },
      });
    };

    const renderAll = () => {
      const exams = State.getStudentMockExams(student.id);
      if (!exams.length) { listEl.innerHTML = emptyState('Henüz deneme sonucu eklenmedi.', '📊'); }
      else {
        listEl.innerHTML = exams.slice().reverse().map((m) => `
          <div class="list-item" data-id="${m.id}">
            <div class="list-item-main">
              <div class="list-item-title">${Utils.escapeHtml(m.denemeAdi)}</div>
              <div class="list-item-sub">${Utils.formatDateTR(m.tarih)} · Puan: ${m.puan ?? '-'} · Net: ${m.net ?? '-'}</div>
            </div>
            <button class="btn btn-secondary btn-sm edit-exam" data-id="${m.id}">Düzenle</button>
          </div>
        `).join('');
        listEl.querySelectorAll('.edit-exam').forEach((btn) => {
          btn.onclick = () => openExamForm(exams.find((m) => m.id === btn.dataset.id));
        });
      }
      drawChart();
    };

    document.getElementById('add-exam').onclick = () => openExamForm(null);
    renderAll();
  },
};

// ---- Gelişim Geçmişi ----
// ---- Yoklama (öğrenci bazlı geçmiş + tekil düzeltme) ----
const renderYoklamaTab = {
  html(student) {
    const summary = Attendance.getStudentSummary(student.id);
    return `
      <div class="card">
        <div class="card-title">Devamsızlık Özeti (tüm zamanlar)</div>
        <div class="kv-row"><span>Toplam Kayıt</span><strong>${summary.toplam}</strong></div>
        <div class="kv-row"><span>Var</span><strong>${summary.var}</strong></div>
        <div class="kv-row"><span>Yok</span><strong>${summary.yok}</strong></div>
        <div class="kv-row"><span>İzinli</span><strong>${summary.izinli}</strong></div>
        <div class="kv-row"><span>Devamsızlık Oranı</span><strong>${summary.devamsizlikOrani !== null ? summary.devamsizlikOrani + '%' : '-'}</strong></div>
        <p class="muted small" style="margin-top:8px;">Günlük toplu yoklama almak için alt menüden <a href="#/yoklama">Yoklama</a> sekmesini kullan.</p>
      </div>
      <button class="btn btn-secondary btn-block" id="add-single-attendance">+ Tekil Gün Düzelt/Ekle</button>
      <div id="attendance-list" class="list" style="margin-top:10px;"></div>
    `;
  },
  mount(student) {
    const renderList = () => {
      const list = State.getStudentAttendance(student.id);
      const container = document.getElementById('attendance-list');
      if (!list.length) { container.innerHTML = emptyState('Henüz yoklama kaydı yok.', '🗓️'); return; }
      container.innerHTML = list.map((a) => `
        <div class="list-item" data-id="${a.id}">
          <div class="list-item-main">
            <div class="list-item-title">${Utils.formatDateTR(a.tarih)}</div>
            <div class="list-item-sub"><span class="badge badge-${a.durum === 'var' ? 'teslim-edildi' : a.durum === 'yok' ? 'eksik' : 'geç-teslim'}">${a.durum}</span></div>
          </div>
          <button class="btn btn-secondary btn-sm edit-attendance" data-tarih="${a.tarih}" data-durum="${a.durum}">Düzenle</button>
        </div>
      `).join('');
      container.querySelectorAll('.edit-attendance').forEach((btn) => {
        btn.onclick = () => openForm(btn.dataset.tarih, btn.dataset.durum);
      });
    };

    const openForm = (tarih, durum) => {
      Modal.open(`
        <div class="modal-header">Yoklama Kaydı</div>
        <div class="modal-body">
          <label class="field-label">Tarih</label>
          <input type="date" id="at-tarih" class="input" value="${tarih || Utils.todayISO()}">
          <label class="field-label">Durum</label>
          <select id="at-durum" class="input">
            ${Attendance.DURUMLAR.map((d) => `<option value="${d}" ${d === durum ? 'selected' : ''}>${d}</option>`).join('')}
          </select>
        </div>
        <div class="modal-actions">
          <button class="btn btn-danger" id="at-delete">Sil</button>
          <button class="btn btn-secondary" id="at-cancel">Vazgeç</button>
          <button class="btn btn-primary" id="at-save">Kaydet</button>
        </div>
      `, {
        onMount: (root) => {
          root.querySelector('#at-cancel').onclick = () => Modal.close();
          root.querySelector('#at-delete').onclick = async () => {
            await Attendance.unmark(student.id, root.querySelector('#at-tarih').value);
            Modal.close();
            renderList();
          };
          root.querySelector('#at-save').onclick = async () => {
            await Attendance.mark(student.id, root.querySelector('#at-tarih').value, root.querySelector('#at-durum').value);
            Modal.close();
            Utils.toast('Yoklama kaydedildi.', 'success');
            renderList();
          };
        },
      });
    };

    document.getElementById('add-single-attendance').onclick = () => openForm(null, 'var');
    renderList();
  },
};

const renderGelisimTab = {
  html(student) {
    const terms = State.getTermsSorted();
    const sinifGecmisi = student.sinifGecmisi || [];
    const hw = State.getStudentHomework(student.id);
    const tamamlanan = hw.filter((a) => a.durum === 'teslim edildi').length;

    return `
      <div class="card">
        <div class="card-title">Dönem Ortalamaları</div>
        <div class="list">
          ${terms.map((t) => {
            const ort = Assessments.calcTermAverage(student.id, t.id);
            return `<div class="kv-row"><span>${Utils.escapeHtml(t.ad)}</span><strong>${ort !== null ? ort : '-'}</strong></div>`;
          }).join('')}
          <div class="kv-row"><span>Genel Ortalama</span><strong>${Assessments.calcOverallAverage(student.id) ?? '-'}</strong></div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Ödev Tamamlama</div>
        <p class="muted">${hw.length ? `${tamamlanan} / ${hw.length} ödev teslim edildi.` : 'Ödev kaydı yok.'}</p>
      </div>

      <div class="card">
        <div class="card-title">Sınıf Geçmişi</div>
        ${sinifGecmisi.length ? `
          <ul class="simple-list">
            ${sinifGecmisi.map((g) => `<li>${Utils.escapeHtml(g.sinif)} — ${Utils.formatDateTR(g.tarih)}</li>`).join('')}
          </ul>
        ` : '<p class="muted">Kayıt yok.</p>'}
      </div>

      ${(() => {
        const scans = State.getStudentScans(student.id);
        if (!scans.length) return '';
        return `
          <div class="card">
            <div class="card-title">AI Tarama Geçmişi</div>
            <div class="list">
              ${scans.map((s) => `
                <div class="list-item" data-id="${s.id}" style="align-items:flex-start;">
                  <img src="${s.imageDataUrl}" style="width:48px;height:48px;object-fit:cover;border-radius:8px;flex-shrink:0;">
                  <div class="list-item-main">
                    <div class="list-item-title">${Utils.formatDateTimeTR(s.olusturmaTarihi)} · <span class="badge badge-${s.durum === 'onaylandi' ? 'teslim-edildi' : s.durum === 'reddedildi' ? 'eksik' : 'bekliyor'}">${s.durum}</span></div>
                    <div class="list-item-sub">${Utils.escapeHtml(s.context || '')}${s.aiOnerilenPuan !== null && s.aiOnerilenPuan !== undefined ? ' · Puan: ' + s.aiOnerilenPuan : ''}</div>
                    <div class="list-item-sub">${Utils.escapeHtml(s.aiMetin || '')}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      })()}
    `;
  },
  mount() {},
};
