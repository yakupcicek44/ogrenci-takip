// Ayarlar: ağırlıklar, dönem yönetimi, yedekleme/geri yükleme, veri sıfırlama
const SettingsView = {
  html() {
    const w = State.data.settings.agirliklar;
    const terms = State.getTermsSorted();
    const sonYedek = State.data.settings.sonYedekTarihi;

    return pageWrap('Ayarlar', `
      <div class="card">
        <div class="card-title">Not Ağırlıkları</div>
        <p class="muted small">Bunlar varsayılan/örnek değerlerdir — resmi bir notlandırma kuralı değildir. Kendi kuralına göre değiştir. Toplamın 100 olması önerilir.</p>
        <div class="field-row-2">
          <div><label class="field-label">1. Sınav (%)</label><input type="number" id="w-sinav1" class="input" value="${w.sinav1}"></div>
          <div><label class="field-label">2. Sınav (%)</label><input type="number" id="w-sinav2" class="input" value="${w.sinav2}"></div>
        </div>
        <div class="field-row-2">
          <div><label class="field-label">1. Performans (%)</label><input type="number" id="w-performans1" class="input" value="${w.performans1}"></div>
          <div><label class="field-label">2. Performans (%)</label><input type="number" id="w-performans2" class="input" value="${w.performans2}"></div>
        </div>
        <p id="w-toplam" class="muted small"></p>
        <button class="btn btn-primary btn-block" id="w-save">Ağırlıkları Kaydet</button>
      </div>

      <div class="card">
        <div class="card-title">Dönemler</div>
        <div class="list" id="term-list">
          ${terms.map((t) => `
            <div class="list-item" data-id="${t.id}">
              <div class="list-item-main"><div class="list-item-title">${Utils.escapeHtml(t.ad)}</div></div>
              <button class="btn btn-secondary btn-sm edit-term" data-id="${t.id}">Düzenle</button>
            </div>
          `).join('')}
        </div>
        <button class="btn btn-secondary btn-block" id="add-term">+ Dönem Ekle</button>
      </div>

      <div class="card">
        <div class="card-title">Yedekleme</div>
        <p class="muted small">
          Yedek dosyası bu cihaza indirilir. <strong>Bu yalnızca cihaz içi bir yedektir</strong> —
          telefon kaybolur veya bozulursa bu dosya da kaybolabilir. Yedeği ayrıca e-posta, Google Drive/iCloud
          gibi bir buluta da kopyalamanı öneririz.
        </p>
        <p class="muted small">Son yedek: ${sonYedek ? Utils.formatDateTimeTR(sonYedek) : 'Henüz alınmadı'}</p>
        <button class="btn btn-primary btn-block" id="backup-export">Yedek Al (JSON indir)</button>
        <label class="btn btn-secondary btn-block" id="backup-import-label" style="text-align:center; display:block; margin-top:8px;">
          Yedekten Geri Yükle
          <input type="file" id="backup-import-input" accept="application/json" style="display:none;">
        </label>
      </div>

      <div class="card">
        <div class="card-title">Hesap</div>
        <p class="muted small">Kullanıcı adı: ${Utils.escapeHtml(State.data.settings.auth?.username || '-')}</p>
        <button class="btn btn-secondary btn-block" id="change-password">Şifre Değiştir</button>
        <button class="btn btn-secondary btn-block" id="logout" style="margin-top:8px;">Çıkış Yap</button>
      </div>

      <div class="card card-danger">
        <div class="card-title">Tehlikeli İşlemler</div>
        <button class="btn btn-danger btn-block" id="reset-all">Tüm Verileri Sıfırla</button>
        <p class="muted small">Tüm öğrenci, not, ödev, kitap ve deneme kayıtlarını kalıcı olarak siler. Geri alınamaz — önce yedek almanı öneririz.</p>
      </div>
    `);
  },

  mount() {
    const updateToplam = () => {
      const vals = {
        sinav1: Number(document.getElementById('w-sinav1').value || 0),
        sinav2: Number(document.getElementById('w-sinav2').value || 0),
        performans1: Number(document.getElementById('w-performans1').value || 0),
        performans2: Number(document.getElementById('w-performans2').value || 0),
      };
      const toplam = Assessments.weightsSum(vals);
      const el = document.getElementById('w-toplam');
      el.textContent = `Toplam: %${toplam}` + (toplam !== 100 ? ' — 100 olması önerilir.' : ' ✓');
      el.style.color = toplam !== 100 ? '#b45309' : '#16a34a';
    };
    ['w-sinav1', 'w-sinav2', 'w-performans1', 'w-performans2'].forEach((id) => {
      document.getElementById(id).addEventListener('input', updateToplam);
    });
    updateToplam();

    document.getElementById('w-save').addEventListener('click', async () => {
      const agirliklar = {
        sinav1: Number(document.getElementById('w-sinav1').value || 0),
        sinav2: Number(document.getElementById('w-sinav2').value || 0),
        performans1: Number(document.getElementById('w-performans1').value || 0),
        performans2: Number(document.getElementById('w-performans2').value || 0),
      };
      await State.save('settings', { ...State.data.settings, agirliklar });
      Utils.toast('Ağırlıklar kaydedildi.', 'success');
    });

    const openTermForm = (term) => {
      Modal.open(`
        <div class="modal-header">${term ? 'Dönemi Düzenle' : 'Yeni Dönem'}</div>
        <div class="modal-body">
          <label class="field-label">Dönem Adı *</label>
          <input type="text" id="term-ad" class="input" value="${Utils.escapeHtml(term?.ad || '')}">
        </div>
        <div class="modal-actions">
          ${term ? '<button class="btn btn-danger" id="term-delete">Sil</button>' : ''}
          <button class="btn btn-secondary" id="term-cancel">Vazgeç</button>
          <button class="btn btn-primary" id="term-save">Kaydet</button>
        </div>
      `, {
        onMount: (root) => {
          root.querySelector('#term-cancel').onclick = () => Modal.close();
          if (term) {
            root.querySelector('#term-delete').onclick = async () => {
              const ok = await Confirm.ask('Bu dönem silinirse, bu döneme ait tüm sınav/performans notları da silinir. Devam edilsin mi?', { danger: true });
              if (!ok) return;
              const related = State.data.assessments.filter((a) => a.termId === term.id);
              for (const r of related) await State.remove('assessments', r.id);
              await State.remove('terms', term.id);
              Modal.close();
              Router.render();
            };
          }
          root.querySelector('#term-save').onclick = async () => {
            const ad = root.querySelector('#term-ad').value.trim();
            if (!ad) return;
            const terms = State.getTermsSorted();
            const record = term ? { ...term, ad } : { id: Utils.uid(), ad, sira: terms.length + 1 };
            await State.save('terms', record);
            Modal.close();
            Router.render();
          };
        },
      });
    };

    document.getElementById('add-term').addEventListener('click', () => openTermForm(null));
    document.querySelectorAll('.edit-term').forEach((btn) => {
      btn.addEventListener('click', () => openTermForm(State.data.terms.find((t) => t.id === btn.dataset.id)));
    });

    document.getElementById('backup-export').addEventListener('click', async () => {
      await Backup.exportToFile();
      Utils.toast('Yedek indirildi.', 'success');
      Router.render();
    });

    document.getElementById('backup-import-input').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const payload = await Backup.readFile(file);
        const err = Backup.validate(payload);
        if (err) { Utils.toast(err, 'error'); return; }
        const ok = await Confirm.ask(
          'Geri yükleme işlemi mevcut TÜM verilerin üzerine yazacak. Şu anki veriler kaybolacak. Devam etmeden önce mevcut verileri de yedeklediğinden emin ol. Onaylıyor musun?',
          { danger: true, confirmText: 'Evet, Geri Yükle' }
        );
        if (!ok) { e.target.value = ''; return; }
        const result = await Backup.restore(payload);
        if (!result.ok) { Utils.toast(result.error, 'error'); return; }
        Utils.toast('Veriler geri yüklendi.', 'success');
        Router.render();
      } catch (err) {
        Utils.toast(err.message, 'error');
      } finally {
        e.target.value = '';
      }
    });

    document.getElementById('logout').addEventListener('click', () => {
      Auth.lock();
      location.reload();
    });

    document.getElementById('change-password').addEventListener('click', () => {
      Modal.open(`
        <div class="modal-header">Şifre Değiştir</div>
        <div class="modal-body">
          <label class="field-label">Mevcut Şifre</label>
          <input type="password" id="cp-current" class="input">
          <label class="field-label">Yeni Kullanıcı Adı</label>
          <input type="text" id="cp-username" class="input" value="${Utils.escapeHtml(State.data.settings.auth?.username || '')}">
          <label class="field-label">Yeni Şifre</label>
          <input type="password" id="cp-new" class="input">
          <label class="field-label">Yeni Şifre (tekrar)</label>
          <input type="password" id="cp-new2" class="input">
          <div id="cp-errors" class="form-errors"></div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" id="cp-cancel">Vazgeç</button>
          <button class="btn btn-primary" id="cp-save">Kaydet</button>
        </div>
      `, {
        onMount: (root) => {
          root.querySelector('#cp-cancel').onclick = () => Modal.close();
          root.querySelector('#cp-save').onclick = async () => {
            const current = root.querySelector('#cp-current').value;
            const newUsername = root.querySelector('#cp-username').value;
            const newPass = root.querySelector('#cp-new').value;
            const newPass2 = root.querySelector('#cp-new2').value;
            const errBox = root.querySelector('#cp-errors');
            if (newPass !== newPass2) { errBox.textContent = 'Yeni şifreler aynı değil.'; return; }
            const result = await Auth.changePassword(current, newUsername, newPass);
            if (!result.ok) { errBox.textContent = result.error; return; }
            Modal.close();
            Utils.toast('Şifre güncellendi.', 'success');
          };
        },
      });
    });

    document.getElementById('reset-all').addEventListener('click', async () => {
      const ok1 = await Confirm.ask('Tüm öğrenci ve kayıtlar kalıcı olarak silinecek. Önce yedek aldığından emin misin?', { danger: true, confirmText: 'Evet, Devam Et' });
      if (!ok1) return;
      const ok2 = await Confirm.ask('Bu işlem GERİ ALINAMAZ. Gerçekten tüm verileri silmek istiyor musun?', { danger: true, confirmText: 'Evet, Sil' });
      if (!ok2) return;
      for (const store of ['students', 'terms', 'assessments', 'homeworkTasks', 'homeworkAssignments', 'books', 'mockExams', 'scans']) {
        await DB.clear(store);
      }
      await State.init();
      Utils.toast('Tüm veriler silindi.', 'success');
      location.hash = '#/';
    });
  },
};
