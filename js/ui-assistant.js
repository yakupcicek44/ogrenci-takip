// Öğretmen Asistanı — Görevler / Hatırlatıcılar / Notlar (DigiOps TO'daki "Yönetici Asistanı"
// modülünden uyarlandı: kişisel görev + hatırlatıcı + not merkezi)
const ASSISTANT_TABS = [
  { key: 'gorevler', label: 'Görevler' },
  { key: 'hatirlaticilar', label: 'Hatırlatıcılar' },
  { key: 'notlar', label: 'Notlar' },
];

const AssistantView = {
  html(params) {
    const tab = params.tab || 'gorevler';
    return pageWrap('Asistan', `
      <div class="tabs">
        ${ASSISTANT_TABS.map((t) => `<a href="#/asistan/${t.key}" class="tab ${t.key === tab ? 'tab-active' : ''}">${t.label}</a>`).join('')}
      </div>
      <div id="assistant-tab-content" class="tab-content" style="padding:0;"></div>
    `);
  },

  mount(params) {
    const tab = params.tab || 'gorevler';
    const container = document.getElementById('assistant-tab-content');
    const renderers = { gorevler: renderGorevlerTab, hatirlaticilar: renderHatirlaticilarTab, notlar: renderNotlarTab };
    const renderer = renderers[tab] || renderGorevlerTab;
    container.innerHTML = renderer.html();
    renderer.mount();
  },
};

// ---- Görevler ----
const renderGorevlerTab = {
  html() {
    const students = [...State.data.students].sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));
    return `
      <div class="card">
        <div class="card-title">Yeni Görev</div>
        <input type="text" id="new-task-baslik" class="input" placeholder="Örn: Z sınıfının performans ödevlerini değerlendir">
        <div class="field-row-2" style="margin-top:8px;">
          <select id="new-task-oncelik" class="input">
            <option value="normal">Normal Öncelik</option>
            <option value="yuksek">Yüksek Öncelik</option>
            <option value="dusuk">Düşük Öncelik</option>
          </select>
          <input type="date" id="new-task-tarih" class="input" value="${Utils.todayISO()}">
        </div>
        <select id="new-task-ogrenci" class="input" style="margin-top:8px;">
          <option value="">(Öğrenciyle ilişkilendirme — opsiyonel)</option>
          ${students.map((s) => `<option value="${s.id}">${Utils.escapeHtml(s.ad)}</option>`).join('')}
        </select>
        <button class="btn btn-primary btn-block" id="new-task-submit" style="margin-top:10px;">Görev Ekle</button>
      </div>

      <div class="toolbar">
        <select id="task-filter-durum" class="input">
          <option value="">Tüm Durumlar</option>
          ${Tasks.DURUMLAR.map((d) => `<option value="${d}">${d}</option>`).join('')}
        </select>
      </div>
      <div id="task-list" class="list"></div>
    `;
  },

  mount() {
    document.getElementById('new-task-submit').addEventListener('click', async () => {
      const result = await Tasks.create({
        baslik: document.getElementById('new-task-baslik').value,
        oncelik: document.getElementById('new-task-oncelik').value,
        sonTarih: document.getElementById('new-task-tarih').value,
        studentId: document.getElementById('new-task-ogrenci').value || null,
      });
      if (!result.ok) { Utils.toast(result.errors.join(' '), 'error'); return; }
      document.getElementById('new-task-baslik').value = '';
      Utils.toast('Görev eklendi.', 'success');
      renderList();
    });

    const openTaskDetail = (task) => {
      const student = task.studentId ? State.getStudent(task.studentId) : null;
      const altGorevler = State.getSubtasks(task.id);
      Modal.open(`
        <div class="modal-header">${Utils.escapeHtml(task.baslik)}</div>
        <div class="modal-body">
          ${student ? `<p class="muted small">Öğrenci: ${Utils.escapeHtml(student.ad)}</p>` : ''}
          <label class="field-label">Açıklama</label>
          <textarea id="td-aciklama" class="input" rows="2">${Utils.escapeHtml(task.aciklama || '')}</textarea>
          <label class="field-label">Son Tarih</label>
          <input type="date" id="td-tarih" class="input" value="${task.sonTarih || ''}">
          <label class="field-label">Öncelik</label>
          <select id="td-oncelik" class="input">
            ${Tasks.ONCELIKLER.map((o) => `<option value="${o}" ${o === task.oncelik ? 'selected' : ''}>${o}</option>`).join('')}
          </select>

          <div class="card" style="margin-top:12px;">
            <div class="card-title">Alt Görevler</div>
            <div id="td-subtasks">
              ${altGorevler.length ? altGorevler.map((a) => `
                <div class="checkbox-row">
                  <input type="checkbox" class="subtask-check" data-id="${a.id}" ${a.durum === 'tamamlandi' ? 'checked' : ''}>
                  <span style="${a.durum === 'tamamlandi' ? 'text-decoration:line-through;color:var(--muted);' : ''}">${Utils.escapeHtml(a.baslik)}</span>
                </div>
              `).join('') : '<p class="muted small">Alt görev yok.</p>'}
            </div>
            <input type="text" id="td-new-subtask" class="input" placeholder="+ Alt görev ekle, Enter'a bas" style="margin-top:8px;">
          </div>

          <div class="button-row" style="margin-top:12px;">
            <button class="btn btn-secondary" id="td-postpone-1">Yarına Ertele</button>
            <button class="btn btn-secondary" id="td-postpone-7">Haftaya Ertele</button>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-danger" id="td-delete">Sil</button>
          <button class="btn btn-secondary" id="td-cancel">Vazgeç</button>
          <button class="btn btn-primary" id="td-save">Kaydet</button>
        </div>
      `, {
        onMount: (root) => {
          root.querySelector('#td-cancel').onclick = () => Modal.close();
          root.querySelector('#td-delete').onclick = async () => {
            const ok = await Confirm.ask('Bu görev (ve alt görevleri) silinsin mi?', { danger: true });
            if (!ok) return;
            await Tasks.remove(task.id);
            Modal.close();
            renderList();
          };
          root.querySelector('#td-save').onclick = async () => {
            await Tasks.update(task.id, {
              baslik: task.baslik,
              aciklama: root.querySelector('#td-aciklama').value,
              sonTarih: root.querySelector('#td-tarih').value,
              oncelik: root.querySelector('#td-oncelik').value,
            });
            Modal.close();
            Utils.toast('Görev güncellendi.', 'success');
            renderList();
          };
          root.querySelector('#td-postpone-1').onclick = async () => { await Tasks.postpone(task.id, 'yarin'); Modal.close(); renderList(); };
          root.querySelector('#td-postpone-7').onclick = async () => { await Tasks.postpone(task.id, 'haftaya'); Modal.close(); renderList(); };
          root.querySelectorAll('.subtask-check').forEach((cb) => {
            cb.onclick = async () => {
              if (cb.checked) await Tasks.complete(cb.dataset.id);
              else await Tasks.reopen(cb.dataset.id);
              renderList();
            };
          });
          root.querySelector('#td-new-subtask').addEventListener('keydown', async (e) => {
            if (e.key !== 'Enter' || !e.target.value.trim()) return;
            await Tasks.create({ baslik: e.target.value, ustGorevId: task.id, oncelik: 'normal' });
            Modal.close();
            openTaskDetail(State.getTask(task.id));
          });
        },
      });
    };

    const renderList = () => {
      const durum = document.getElementById('task-filter-durum').value;
      const list = Tasks.filterAll({ durum });
      const container = document.getElementById('task-list');
      if (!list.length) { container.innerHTML = emptyState('Görev yok. Yukarıdan ekleyebilirsin.', '✅'); return; }
      container.innerHTML = list.map((t) => {
        const altSayisi = State.getSubtasks(t.id).length;
        const gecikmis = Tasks.isOverdue(t);
        const student = t.studentId ? State.getStudent(t.studentId) : null;
        return `
          <div class="list-item" data-id="${t.id}">
            <input type="checkbox" class="task-check" data-id="${t.id}" ${t.durum === 'tamamlandi' ? 'checked' : ''} style="margin-right:10px;">
            <div class="list-item-main" style="${t.durum === 'tamamlandi' ? 'opacity:0.55;' : ''}">
              <div class="list-item-title">${Utils.escapeHtml(t.baslik)} ${t.oncelik === 'yuksek' ? '🔴' : ''}</div>
              <div class="list-item-sub">
                ${t.sonTarih ? (gecikmis ? `<span style="color:var(--danger);font-weight:700;">Gecikti: ${Utils.formatDateTR(t.sonTarih)}</span>` : Utils.formatDateTR(t.sonTarih)) : 'Tarihsiz'}
                ${student ? ' · ' + Utils.escapeHtml(student.ad) : ''}
                ${altSayisi ? ' · ' + altSayisi + ' alt görev' : ''}
              </div>
            </div>
            <button class="btn btn-secondary btn-sm open-task" data-id="${t.id}">Aç</button>
          </div>
        `;
      }).join('');

      container.querySelectorAll('.open-task').forEach((btn) => {
        btn.onclick = () => openTaskDetail(State.getTask(btn.dataset.id));
      });
      container.querySelectorAll('.task-check').forEach((cb) => {
        cb.onclick = async () => {
          if (cb.checked) await Tasks.complete(cb.dataset.id);
          else await Tasks.reopen(cb.dataset.id);
          renderList();
        };
      });
    };

    document.getElementById('task-filter-durum').addEventListener('change', renderList);
    renderList();
  },
};

// ---- Hatırlatıcılar ----
const renderHatirlaticilarTab = {
  html() {
    const students = [...State.data.students].sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));
    return `
      <div class="card">
        <div class="card-title">Yeni Hatırlatıcı</div>
        <input type="text" id="new-rem-metin" class="input" placeholder="Örn: Ayşe'nin velisini ara">
        <div class="field-row-2" style="margin-top:8px;">
          <input type="date" id="new-rem-tarih" class="input" value="${Utils.todayISO()}">
          <input type="time" id="new-rem-saat" class="input">
        </div>
        <select id="new-rem-ogrenci" class="input" style="margin-top:8px;">
          <option value="">(Öğrenciyle ilişkilendirme — opsiyonel)</option>
          ${students.map((s) => `<option value="${s.id}">${Utils.escapeHtml(s.ad)}</option>`).join('')}
        </select>
        <div id="new-rem-errors" class="form-errors"></div>
        <button class="btn btn-primary btn-block" id="new-rem-submit" style="margin-top:10px;">Hatırlatıcı Ekle</button>
        <p class="muted small" style="margin-top:8px;">Bu, telefonuna bildirim göndermez — sadece uygulamayı açtığında burada ve Ana Sayfa'da görünür.</p>
      </div>
      <div id="reminder-list" class="list"></div>
    `;
  },

  mount() {
    document.getElementById('new-rem-submit').addEventListener('click', async () => {
      const result = await Reminders.create({
        metin: document.getElementById('new-rem-metin').value,
        tarih: document.getElementById('new-rem-tarih').value,
        saat: document.getElementById('new-rem-saat').value,
        studentId: document.getElementById('new-rem-ogrenci').value || null,
      });
      const errBox = document.getElementById('new-rem-errors');
      if (!result.ok) { errBox.innerHTML = result.errors.map((e) => `<div>${Utils.escapeHtml(e)}</div>`).join(''); return; }
      errBox.innerHTML = '';
      document.getElementById('new-rem-metin').value = '';
      document.getElementById('new-rem-saat').value = '';
      Utils.toast('Hatırlatıcı eklendi.', 'success');
      renderList();
    });

    const renderList = () => {
      const list = Reminders.filterAll();
      const container = document.getElementById('reminder-list');
      if (!list.length) { container.innerHTML = emptyState('Hatırlatıcı yok.', '⏰'); return; }
      container.innerHTML = list.map((r) => {
        const student = r.studentId ? State.getStudent(r.studentId) : null;
        return `
          <div class="list-item" data-id="${r.id}">
            <input type="checkbox" class="rem-check" data-id="${r.id}" ${r.tamamlandi ? 'checked' : ''} style="margin-right:10px;">
            <div class="list-item-main" style="${r.tamamlandi ? 'opacity:0.55;' : ''}">
              <div class="list-item-title">${Utils.escapeHtml(r.metin)}</div>
              <div class="list-item-sub">${Utils.formatDateTR(r.tarih)}${r.saat ? ' · ' + r.saat : ''}${student ? ' · ' + Utils.escapeHtml(student.ad) : ''}</div>
            </div>
            <button class="btn btn-secondary btn-sm rem-delete" data-id="${r.id}">Sil</button>
          </div>
        `;
      }).join('');

      container.querySelectorAll('.rem-check').forEach((cb) => {
        cb.onclick = async () => { await Reminders.toggle(cb.dataset.id); renderList(); };
      });
      container.querySelectorAll('.rem-delete').forEach((btn) => {
        btn.onclick = async () => {
          const ok = await Confirm.ask('Bu hatırlatıcı silinsin mi?', {});
          if (!ok) return;
          await Reminders.remove(btn.dataset.id);
          renderList();
        };
      });
    };

    renderList();
  },
};

// ---- Notlar ----
const renderNotlarTab = {
  html() {
    return `
      <button class="btn btn-primary btn-block" id="add-note">+ Not Ekle</button>
      <div id="note-list" class="list" style="margin-top:10px;"></div>
    `;
  },

  mount() {
    const openNoteForm = (note) => {
      Modal.open(`
        <div class="modal-header">${note ? 'Notu Düzenle' : 'Yeni Not'}</div>
        <div class="modal-body">
          <label class="field-label">Başlık (opsiyonel)</label>
          <input type="text" id="note-baslik" class="input" value="${Utils.escapeHtml(note?.baslik || '')}">
          <label class="field-label">Metin *</label>
          <textarea id="note-metin" class="input" rows="4">${Utils.escapeHtml(note?.metin || '')}</textarea>
          <div id="note-errors" class="form-errors"></div>
        </div>
        <div class="modal-actions">
          ${note ? '<button class="btn btn-danger" id="note-delete">Sil</button>' : ''}
          <button class="btn btn-secondary" id="note-cancel">Vazgeç</button>
          <button class="btn btn-primary" id="note-save">Kaydet</button>
        </div>
      `, {
        onMount: (root) => {
          root.querySelector('#note-cancel').onclick = () => Modal.close();
          if (note) {
            root.querySelector('#note-delete').onclick = async () => {
              const ok = await Confirm.ask('Bu not silinsin mi?', { danger: true });
              if (!ok) return;
              await Notes.remove(note.id);
              Modal.close();
              renderList();
            };
          }
          root.querySelector('#note-save').onclick = async () => {
            const result = await Notes.save({
              baslik: root.querySelector('#note-baslik').value,
              metin: root.querySelector('#note-metin').value,
            }, note?.id);
            if (!result.ok) {
              root.querySelector('#note-errors').innerHTML = result.errors.map((e) => `<div>${Utils.escapeHtml(e)}</div>`).join('');
              return;
            }
            Modal.close();
            Utils.toast('Not kaydedildi.', 'success');
            renderList();
          };
        },
      });
    };

    const renderList = () => {
      const list = State.data.notes.slice().sort((a, b) => (b.guncellemeTarihi || '').localeCompare(a.guncellemeTarihi || ''));
      const container = document.getElementById('note-list');
      if (!list.length) { container.innerHTML = emptyState('Not yok.', '🗒️'); return; }
      container.innerHTML = list.map((n) => `
        <div class="list-item" data-id="${n.id}">
          <div class="list-item-main">
            <div class="list-item-title">${Utils.escapeHtml(n.baslik || Utils.formatDateTimeTR(n.guncellemeTarihi))}</div>
            <div class="list-item-sub">${Utils.escapeHtml(n.metin.slice(0, 80))}${n.metin.length > 80 ? '…' : ''}</div>
          </div>
          <button class="btn btn-secondary btn-sm edit-note" data-id="${n.id}">Aç</button>
        </div>
      `).join('');
      container.querySelectorAll('.edit-note').forEach((btn) => {
        btn.onclick = () => openNoteForm(list.find((n) => n.id === btn.dataset.id));
      });
    };

    document.getElementById('add-note').onclick = () => openNoteForm(null);
    renderList();
  },
};
