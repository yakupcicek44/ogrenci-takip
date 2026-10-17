// Öğretmen Asistanı — Görevler / Hatırlatıcılar / Notlar (DigiOps TO'daki "Yönetici Asistanı"
// modülünden uyarlandı: kişisel görev + hatırlatıcı + not merkezi)
const ASSISTANT_TABS = [
  { key: 'gorevler', label: 'Görevler' },
  { key: 'hatirlaticilar', label: 'Hatırlatıcılar' },
  { key: 'notlar', label: 'Notlar' },
  { key: 'belgeler', label: 'Belgeler' },
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
    const renderers = { gorevler: renderGorevlerTab, hatirlaticilar: renderHatirlaticilarTab, notlar: renderNotlarTab, belgeler: renderBelgelerTab };
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
            const ok = await Confirm.ask('Bu görev (ve alt görevleri) silinsin mi? (Çöp Kutusu\'ndan geri alınabilir)', { danger: true });
            if (!ok) return;
            for (const alt of State.getSubtasks(task.id)) {
              await Trash.moveToTrash('tasks', alt, `Alt görev: ${alt.baslik}`);
            }
            await Trash.moveToTrash('tasks', task, `Görev: ${task.baslik}`);
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
      <div class="card" id="push-card">
        <div class="card-title">Bildirimler</div>
        <p class="muted small">
          Açarsan, hatırlatıcı zamanı geldiğinde telefon kilitli veya uygulama kapalı olsa
          bile gerçek bir bildirim gelir (WhatsApp mesajı gibi — sessiz moddaysa o da sessiz
          kalır, bu bir çalar saat değildir). Açtığında hatırlatıcı metni+zamanı Yakup'un
          kendi Cloudflare hesabına gönderilir, başka hiçbir veri gitmez.
        </p>
        <div id="push-status" class="muted small" style="margin-bottom:8px;"></div>
        <button class="btn btn-primary btn-block" id="push-enable">Bildirimleri Aç</button>
        <button class="btn btn-secondary btn-block" id="push-disable" style="display:none;">Bildirimleri Kapat</button>
      </div>

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
      </div>
      <div id="reminder-list" class="list"></div>
    `;
  },

  mount() {
    this._refreshPushCard();

    document.getElementById('push-enable').addEventListener('click', async () => {
      const statusEl = document.getElementById('push-status');
      statusEl.textContent = 'İzin isteniyor…';
      const result = await Push.enable();
      if (!result.ok) {
        statusEl.textContent = '';
        Utils.toast(result.error, 'error');
        return;
      }
      statusEl.textContent = '';
      Utils.toast('Bildirimler açıldı.', 'success');
      this._refreshPushCard();
    });

    document.getElementById('push-disable').addEventListener('click', async () => {
      await Push.disable();
      Utils.toast('Bildirimler kapatıldı.', 'info');
      this._refreshPushCard();
    });

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
          const ok = await Confirm.ask('Bu hatırlatıcı silinsin mi? (Çöp Kutusu\'ndan geri alınabilir)', {});
          if (!ok) return;
          const r = State.getReminder(btn.dataset.id);
          await Trash.moveToTrash('reminders', r, `Hatırlatıcı: ${r.metin}`);
          // Reminders.remove() aynı zamanda sunucudaki push senkronunu da siler —
          // çöpe atarken bunu atlamamalı, yoksa "silinen" hatırlatıcı yine bildirim gönderebilir.
          Push.deleteReminderSync(r.id);
          renderList();
        };
      });
    };

    renderList();
  },

  async _refreshPushCard() {
    const enableBtn = document.getElementById('push-enable');
    const disableBtn = document.getElementById('push-disable');
    const statusEl = document.getElementById('push-status');
    if (!Push.isSupported()) {
      statusEl.textContent = 'Bu tarayıcı bildirim desteklemiyor.';
      enableBtn.style.display = 'none';
      disableBtn.style.display = 'none';
      return;
    }
    const enabled = await Push.isEnabled();
    statusEl.textContent = enabled ? 'Durum: Açık' : 'Durum: Kapalı';
    enableBtn.style.display = enabled ? 'none' : '';
    disableBtn.style.display = enabled ? '' : 'none';
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
              const ok = await Confirm.ask('Bu not silinsin mi? (Çöp Kutusu\'ndan geri alınabilir)', { danger: true });
              if (!ok) return;
              await Trash.moveToTrash('notes', note, `Not: ${note.baslik || note.metin.slice(0, 40)}`);
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

// ---- Belgeler (yıllık plan, toplantı tutanağı gibi PDF/Word dosyaları) ----
const renderBelgelerTab = {
  html() {
    return `
      <div class="card">
        <div class="card-title">Belge Yükle</div>
        <p class="muted small">
          Yıllık plan, toplantı tutanağı gibi PDF veya Word (.doc/.docx) dosyalarını yükleyip tek
          yerden erişebilirsin. Dosyalar sadece bu cihazda saklanır ve JSON yedeğe dahil edilir —
          çok büyük dosyalar yedek dosyasını büyütür, en fazla ${Documents.MAX_BOYUT / 1024 / 1024} MB.
        </p>
        <label class="field-label">Başlık (opsiyonel — boşsa dosya adı kullanılır)</label>
        <input type="text" id="doc-ad" class="input">
        <label class="field-label">Kategori</label>
        <select id="doc-kategori" class="input">
          ${Documents.KATEGORILER.map((k) => `<option value="${k.key}">${k.etiket}</option>`).join('')}
        </select>
        <label class="btn btn-primary btn-block" id="doc-upload-label" style="text-align:center; display:block; margin-top:10px;">
          Dosya Seç ve Yükle
          <input type="file" id="doc-upload-input" accept=".pdf,.doc,.docx" style="display:none;">
        </label>
        <div id="doc-upload-status" class="muted small" style="margin-top:6px;"></div>
      </div>

      <div class="toolbar">
        <select id="doc-filter-kategori" class="input">
          <option value="">Tüm Kategoriler</option>
          ${Documents.KATEGORILER.map((k) => `<option value="${k.key}">${k.etiket}</option>`).join('')}
        </select>
      </div>
      <div id="doc-list" class="list"></div>
    `;
  },

  mount() {
    const renderList = () => {
      const kategori = document.getElementById('doc-filter-kategori').value;
      const list = Documents.filterByKategori(kategori);
      const container = document.getElementById('doc-list');
      if (!list.length) { container.innerHTML = emptyState('Henüz belge yüklenmedi.', '📄'); return; }
      container.innerHTML = list.map((d) => {
        const kat = Documents.KATEGORILER.find((k) => k.key === d.kategori);
        return `
          <div class="list-item" data-id="${d.id}">
            <div class="list-item-main">
              <div class="list-item-title">${Utils.escapeHtml(d.ad)}</div>
              <div class="list-item-sub"><span class="badge">${kat ? kat.etiket : d.kategori}</span> · ${(d.boyut / 1024 / 1024).toFixed(1)} MB · ${Utils.formatDateTR(d.olusturmaTarihi)}</div>
            </div>
            <div style="display:flex;gap:6px;">
              <button class="btn btn-secondary btn-sm doc-download" data-id="${d.id}">İndir</button>
              <button class="btn btn-danger btn-sm doc-delete" data-id="${d.id}">Sil</button>
            </div>
          </div>
        `;
      }).join('');
      container.querySelectorAll('.doc-download').forEach((btn) => {
        btn.onclick = () => Documents.download(list.find((d) => d.id === btn.dataset.id));
      });
      container.querySelectorAll('.doc-delete').forEach((btn) => {
        btn.onclick = async () => {
          const ok = await Confirm.ask('Bu belge silinsin mi? (Çöp Kutusu\'ndan geri alınabilir)', { danger: true });
          if (!ok) return;
          const d = list.find((x) => x.id === btn.dataset.id);
          await Trash.moveToTrash('documents', d, `Belge: ${d.ad}`);
          renderList();
        };
      });
    };

    document.getElementById('doc-upload-input').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const statusEl = document.getElementById('doc-upload-status');
      statusEl.textContent = 'Yükleniyor…';
      const result = await Documents.upload(file, {
        ad: document.getElementById('doc-ad').value,
        kategori: document.getElementById('doc-kategori').value,
      });
      statusEl.textContent = '';
      e.target.value = '';
      if (!result.ok) { Utils.toast(result.errors.join(' '), 'error'); return; }
      document.getElementById('doc-ad').value = '';
      Utils.toast('Belge yüklendi.', 'success');
      renderList();
    });

    document.getElementById('doc-filter-kategori').addEventListener('change', renderList);
    renderList();
  },
};
