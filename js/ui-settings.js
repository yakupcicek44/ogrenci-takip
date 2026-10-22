// Ayarlar: ağırlıklar, dönem yönetimi, yedekleme/geri yükleme, veri sıfırlama
const SettingsView = {
  html() {
    const w = State.data.settings.agirliklar;
    const terms = State.getTermsSorted();
    const aktifDonem = State.getActiveTerm();
    const dersler = State.getDersSorted();
    const aktifDers = State.getActiveCourse();
    const sonYedek = State.data.settings.sonYedekTarihi;

    return pageWrap('Ayarlar', `
      <div class="card">
        <div class="card-title">Sistem Durumu</div>
        <div class="kv-row"><span>Sürüm</span><strong>${APP_VERSION}</strong></div>
        <div class="kv-row"><span>Öğrenci</span><strong>${State.getActiveStudents().length} aktif${State.data.students.length - State.getActiveStudents().length ? ' · ' + (State.data.students.length - State.getActiveStudents().length) + ' pasif' : ''}</strong></div>
        <div class="kv-row"><span>Sınav/Performans Notu</span><strong>${State.data.assessments.filter((a) => !Utils.isEmptyGrade(a.puan)).length}</strong></div>
        <div class="kv-row"><span>Ödev / Atama</span><strong>${State.data.homeworkTasks.length} ödev · ${State.data.homeworkAssignments.length} atama</strong></div>
        <div class="kv-row"><span>Kitap / Deneme</span><strong>${State.data.books.length} / ${State.data.mockExams.length}</strong></div>
        <div class="kv-row"><span>Gözlem Günlüğü</span><strong>${State.data.observations.length}</strong></div>
        <div class="kv-row"><span>Yoklama Kaydı</span><strong>${State.data.attendance.length}</strong></div>
        <div class="kv-row"><span>Görev / Hatırlatıcı / Not</span><strong>${State.data.tasks.length} / ${State.data.reminders.length} / ${State.data.notes.length}</strong></div>
        <div class="kv-row"><span>Aktif Dönem</span><strong>${Utils.escapeHtml(aktifDonem?.ad || '-')}</strong></div>
        ${dersler.length > 1 ? `<div class="kv-row"><span>Aktif Ders</span><strong>${Utils.escapeHtml(aktifDers?.ad || '-')} (${dersler.length} ders tanımlı)</strong></div>` : ''}
        <div class="kv-row"><span>Taranan Kağıt (AI)</span><strong>${State.data.scans.length}</strong></div>
        <div class="kv-row"><span>Belgeler</span><strong>${State.data.documents.length}</strong></div>
        <div class="kv-row"><span>Çöp Kutusu</span><strong>${State.data.trash.length}</strong></div>
        <div class="kv-row"><span>Ders Programı</span><strong>${State.data.dersProgrami.length} ders · bu ay ${Schedule.totalHoursInRange(Schedule.monthRange(Utils.todayISO().slice(0, 7)).start, Schedule.monthRange(Utils.todayISO().slice(0, 7)).end)} saat</strong></div>
        <div class="kv-row"><span>Sohbet Geçmişi</span><strong>${State.data.chatMesajlari.length} mesaj</strong></div>
        <div class="kv-row"><span>Son JSON Yedek</span><strong>${sonYedek ? Utils.formatDateTimeTR(sonYedek) : 'Hiç alınmadı'}</strong></div>
        <div class="kv-row"><span>Son Drive Yedeği</span><strong>${State.data.settings.drive?.sonBasariliYedek ? Utils.formatDateTimeTR(State.data.settings.drive.sonBasariliYedek) : 'Bağlı değil / hiç alınmadı'}</strong></div>
        <div class="kv-row"><span>Tahmini Depolama</span><strong id="storage-estimate">hesaplanıyor…</strong></div>
      </div>

      <div class="card">
        <div class="card-title">Görünüm</div>
        <div class="theme-picker">
          ${Theme.OPTIONS.map((o) => `
            <div class="theme-option ${Theme.get() === o.key ? 'active' : ''}" data-theme-option="${o.key}">
              <span class="theme-option-icon">${o.icon}</span>${o.label}
            </div>
          `).join('')}
        </div>
      </div>

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
        <p class="muted small">Aktif dönem; Ana Sayfa'daki grafiklerde ve rapor ekranlarındaki varsayılan seçimde kullanılır.</p>
        <div class="list" id="term-list">
          ${terms.map((t) => {
            const aktif = t.id === aktifDonem?.id;
            return `
              <div class="list-item" data-id="${t.id}">
                <div class="list-item-main"><div class="list-item-title">${Utils.escapeHtml(t.ad)}${aktif ? ' <span class="badge">Aktif</span>' : ''}</div></div>
                <div style="display:flex;gap:6px;">
                  ${!aktif ? `<button class="btn btn-secondary btn-sm set-active-term" data-id="${t.id}">Aktif Yap</button>` : ''}
                  <button class="btn btn-secondary btn-sm edit-term" data-id="${t.id}">Düzenle</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
        <button class="btn btn-secondary btn-block" id="add-term">+ Dönem Ekle</button>
      </div>

      <div class="card">
        <div class="card-title">Dersler</div>
        <p class="muted small">Aynı sınıfa birden fazla ders veriyorsan (örn. Felsefe + Seçmeli Felsefe), her ders için ayrı not takibi yapabilmek üzere burada ekleyebilirsin. Tek ders varken öğrenci/rapor ekranlarında hiçbir şey değişmez — ders seçimi sadece birden fazla ders olunca görünür.</p>
        <div class="list" id="ders-list">
          ${dersler.map((d) => {
            const aktif = d.id === aktifDers?.id;
            return `
              <div class="list-item" data-id="${d.id}">
                <div class="list-item-main"><div class="list-item-title">${Utils.escapeHtml(d.ad)}${aktif ? ' <span class="badge">Aktif</span>' : ''}</div></div>
                <div style="display:flex;gap:6px;">
                  ${!aktif && dersler.length > 1 ? `<button class="btn btn-secondary btn-sm set-active-ders" data-id="${d.id}">Aktif Yap</button>` : ''}
                  <button class="btn btn-secondary btn-sm edit-ders" data-id="${d.id}">Düzenle</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
        <button class="btn btn-secondary btn-block" id="add-ders">+ Ders Ekle</button>
      </div>

      <div class="card">
        <div class="card-title">Sınıf Yönetimi</div>
        <p class="muted small">Bir sınıfı "silmek" öğrenci kayıtlarını SİLMEZ — öğrencileri güvenle pasife alır (geri alınabilir) veya sınıf adını düzeltir.</p>
        <div class="list" id="sinif-list">
          ${State.getSiniflar().map((s) => {
            const sayilar = Students.countBySinif(s);
            return `
              <div class="list-item" data-sinif="${Utils.escapeHtml(s)}">
                <div class="list-item-main">
                  <div class="list-item-title">${Utils.escapeHtml(s)}</div>
                  <div class="list-item-sub">${sayilar.aktif} aktif${sayilar.pasif ? ' · ' + sayilar.pasif + ' pasif' : ''}</div>
                </div>
                <button class="btn btn-secondary btn-sm manage-sinif" data-sinif="${Utils.escapeHtml(s)}">Yönet</button>
              </div>
            `;
          }).join('') || '<p class="muted small">Henüz öğrenci eklenmedi.</p>'}
        </div>
      </div>

      <div class="card">
        <div class="card-title">Beceri/Yetkinlik Etiketleri</div>
        <p class="muted small">Gözlem Günlüğü'nde önerilen kısayol etiketler. Resmi bir liste değildir, kendi kategorilerini yönetebilirsin.</p>
        <div id="beceri-chip-list" class="checkbox-list" style="display:flex;flex-wrap:wrap;gap:6px;">
          ${Observations.getBeceriEtiketleri().map((b) => `
            <span class="badge" data-tag="${Utils.escapeHtml(b)}" style="display:flex;align-items:center;gap:4px;">
              ${Utils.escapeHtml(b)}
              <button class="remove-beceri" data-tag="${Utils.escapeHtml(b)}" aria-label="${Utils.escapeHtml(b)} etiketini kaldır" style="border:none;background:none;color:inherit;cursor:pointer;font-weight:800;padding:0;">×</button>
            </span>
          `).join('')}
        </div>
        <div class="field-row-2" style="margin-top:8px;">
          <input type="text" id="beceri-yeni" class="input" placeholder="Yeni etiket...">
          <button class="btn btn-secondary" id="beceri-ekle">Ekle</button>
        </div>
        <button class="btn btn-secondary btn-block" id="beceri-varsayilana-don" style="margin-top:8px;">Varsayılanlara Dön</button>
      </div>

      <div class="card">
        <div class="card-title">Felsefe/Mantık Kavram Etiketleri</div>
        <p class="muted small">Gözlem Günlüğü'nde önerilen kavram kısayolları (Determinizm, Epistemoloji vb.). Beceri etiketlerinden ayrı, gözlemin HANGİ KONUYLA ilgili olduğunu işaretler.</p>
        <div id="kavram-chip-list" class="checkbox-list" style="display:flex;flex-wrap:wrap;gap:6px;">
          ${Observations.getKavramEtiketleri().map((k) => `
            <span class="badge" data-tag="${Utils.escapeHtml(k)}" style="display:flex;align-items:center;gap:4px;">
              ${Utils.escapeHtml(k)}
              <button class="remove-kavram" data-tag="${Utils.escapeHtml(k)}" aria-label="${Utils.escapeHtml(k)} etiketini kaldır" style="border:none;background:none;color:inherit;cursor:pointer;font-weight:800;padding:0;">×</button>
            </span>
          `).join('')}
        </div>
        <div class="field-row-2" style="margin-top:8px;">
          <input type="text" id="kavram-yeni" class="input" placeholder="Yeni kavram...">
          <button class="btn btn-secondary" id="kavram-ekle">Ekle</button>
        </div>
        <button class="btn btn-secondary btn-block" id="kavram-varsayilana-don" style="margin-top:8px;">Varsayılanlara Dön</button>
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
        <div class="card-title">Google Drive'a Otomatik Yedekleme</div>
        <p class="muted small">
          Bağlandığında uygulama her açılışta (günde en fazla bir kez) kendi Drive'ına otomatik bir yedek
          dosyası yükler — sadece bu uygulamanın oluşturduğu dosyalara erişilir, Drive'ındaki diğer
          dosyalarına dokunulmaz.
        </p>
        <p class="muted small">Durum: ${State.data.settings.drive?.connected ? 'Bağlı' : 'Bağlı değil'}${State.data.settings.drive?.sonBasariliYedek ? ' · Son Drive yedeği: ' + Utils.formatDateTimeTR(State.data.settings.drive.sonBasariliYedek) : ''}</p>
        ${State.data.settings.drive?.connected ? `
          <button class="btn btn-secondary btn-block" id="drive-backup-now">Şimdi Drive'a Yedekle</button>
          <button class="btn btn-secondary btn-block" id="drive-disconnect" style="margin-top:8px;">Bağlantıyı Kaldır</button>
        ` : `
          <button class="btn btn-primary btn-block" id="drive-connect">Google Drive'a Bağlan</button>
        `}
        <div id="drive-status" class="muted small" style="margin-top:6px;"></div>
      </div>

      <div class="card">
        <div class="card-title">Hesap</div>
        <p class="muted small">Kullanıcı adı: ${Utils.escapeHtml(State.data.settings.auth?.username || '-')}</p>
        <button class="btn btn-secondary btn-block" id="change-password">Şifre Değiştir</button>
        <button class="btn btn-secondary btn-block" id="logout" style="margin-top:8px;">Çıkış Yap</button>
      </div>

      <div class="card">
        <div class="card-title">Çöp Kutusu</div>
        <p class="muted small">Gözlem, kitap, deneme, görev, hatırlatıcı, not ve belge silmeleri ${Trash.SAKLAMA_GUNU} gün burada saklanır, geri yüklenebilir.</p>
        <div class="kv-row"><span>Çöp Kutusunda</span><strong>${State.data.trash.length} kayıt</strong></div>
        <button class="btn btn-secondary btn-block" id="open-trash" style="margin-top:8px;">Çöp Kutusunu Aç</button>
      </div>

      <div class="card card-danger">
        <div class="card-title">Tehlikeli İşlemler</div>
        <button class="btn btn-danger btn-block" id="reset-all">Tüm Verileri Sıfırla</button>
        <p class="muted small">Tüm öğrenci, not, ödev, kitap ve deneme kayıtlarını kalıcı olarak siler. Geri alınamaz — önce yedek almanı öneririz.</p>
      </div>
    `);
  },

  mount() {
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then((est) => {
        const el = document.getElementById('storage-estimate');
        if (!el) return;
        const usedMB = est.usage ? (est.usage / (1024 * 1024)).toFixed(1) : '0';
        const quotaMB = est.quota ? (est.quota / (1024 * 1024)).toFixed(0) : null;
        el.textContent = quotaMB ? `${usedMB} MB / ~${quotaMB} MB` : `${usedMB} MB`;
      }).catch(() => {
        const el = document.getElementById('storage-estimate');
        if (el) el.textContent = 'bilinmiyor';
      });
    } else {
      const el = document.getElementById('storage-estimate');
      if (el) el.textContent = 'tarayıcı desteklemiyor';
    }

    document.querySelectorAll('[data-theme-option]').forEach((el) => {
      el.addEventListener('click', () => {
        Theme.set(el.dataset.themeOption);
        document.querySelectorAll('[data-theme-option]').forEach((x) => x.classList.toggle('active', x === el));
      });
    });

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
          <label class="field-label">Başlangıç Tarihi (opsiyonel — karne/devamsızlık bu aralığa göre hesaplanır)</label>
          <input type="date" id="term-baslangic" class="input" value="${term?.baslangicTarihi || ''}">
          <label class="field-label">Bitiş Tarihi (opsiyonel)</label>
          <input type="date" id="term-bitis" class="input" value="${term?.bitisTarihi || ''}">
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
            const baslangicTarihi = root.querySelector('#term-baslangic').value || null;
            const bitisTarihi = root.querySelector('#term-bitis').value || null;
            const terms = State.getTermsSorted();
            const record = term
              ? { ...term, ad, baslangicTarihi, bitisTarihi }
              : { id: Utils.uid(), ad, sira: terms.length + 1, baslangicTarihi, bitisTarihi };
            await State.save('terms', record);
            Modal.close();
            Router.render();
          };
        },
      });
    };

    document.getElementById('beceri-ekle').addEventListener('click', async () => {
      const input = document.getElementById('beceri-yeni');
      const val = input.value.trim();
      if (!val) return;
      const current = Observations.getBeceriEtiketleri();
      if (current.includes(val)) { Utils.toast('Bu etiket zaten var.', 'info'); return; }
      await State.save('settings', { ...State.data.settings, beceriEtiketleri: [...current, val] });
      input.value = '';
      Router.render();
    });

    document.querySelectorAll('.remove-beceri').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const current = Observations.getBeceriEtiketleri().filter((b) => b !== btn.dataset.tag);
        await State.save('settings', { ...State.data.settings, beceriEtiketleri: current });
        Router.render();
      });
    });

    document.getElementById('beceri-varsayilana-don').addEventListener('click', async () => {
      await State.save('settings', { ...State.data.settings, beceriEtiketleri: [...Observations.DEFAULT_BECERI_ONERILERI] });
      Utils.toast('Varsayılan etiketlere dönüldü.', 'success');
      Router.render();
    });

    document.getElementById('kavram-ekle').addEventListener('click', async () => {
      const input = document.getElementById('kavram-yeni');
      const val = input.value.trim();
      if (!val) return;
      const current = Observations.getKavramEtiketleri();
      if (current.includes(val)) { Utils.toast('Bu kavram zaten var.', 'info'); return; }
      await State.save('settings', { ...State.data.settings, kavramEtiketleri: [...current, val] });
      input.value = '';
      Router.render();
    });

    document.querySelectorAll('.remove-kavram').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const current = Observations.getKavramEtiketleri().filter((k) => k !== btn.dataset.tag);
        await State.save('settings', { ...State.data.settings, kavramEtiketleri: current });
        Router.render();
      });
    });

    document.getElementById('kavram-varsayilana-don').addEventListener('click', async () => {
      await State.save('settings', { ...State.data.settings, kavramEtiketleri: [...Observations.DEFAULT_KAVRAM_ONERILERI] });
      Utils.toast('Varsayılan kavramlara dönüldü.', 'success');
      Router.render();
    });

    document.querySelectorAll('.manage-sinif').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sinif = btn.dataset.sinif;
        const sayilar = Students.countBySinif(sinif);
        Modal.open(`
          <div class="modal-header">${Utils.escapeHtml(sinif)}</div>
          <div class="modal-body">
            <p class="muted small">${sayilar.aktif} aktif, ${sayilar.pasif} pasif öğrenci bu sınıfta.</p>
            <label class="field-label">Sınıf Adını Düzelt (yazım hatası vb.)</label>
            <input type="text" id="sinif-yeni-ad" class="input" value="${Utils.escapeHtml(sinif)}">
            <button class="btn btn-secondary btn-block" id="sinif-rename" style="margin-top:8px;">Adı Güncelle (${sayilar.toplam} öğrenciyi etkiler)</button>
          </div>
          <div class="modal-actions">
            <button class="btn btn-danger" id="sinif-pasif-yap">${sayilar.aktif} Öğrenciyi Pasife Al</button>
            <button class="btn btn-secondary" id="sinif-cancel">Kapat</button>
          </div>
        `, {
          onMount: (root) => {
            root.querySelector('#sinif-cancel').onclick = () => Modal.close();
            root.querySelector('#sinif-rename').onclick = async () => {
              const yeniAd = root.querySelector('#sinif-yeni-ad').value;
              const result = await Students.renameSinif(sinif, yeniAd);
              if (!result.ok) { Utils.toast(result.errors.join(' '), 'error'); return; }
              Modal.close();
              Utils.toast(`${result.etkilenen} öğrencinin sınıfı güncellendi.`, 'success');
              Router.render();
            };
            root.querySelector('#sinif-pasif-yap').onclick = async () => {
              if (!sayilar.aktif) { Utils.toast('Bu sınıfta pasife alınacak aktif öğrenci yok.', 'info'); return; }
              const ok = await Confirm.ask(
                `${sayilar.aktif} öğrenci pasife alınacak. Kayıtları SİLİNMEZ, istediğinde öğrenci sayfasından tekrar aktif yapabilirsin. Onaylıyor musun?`,
                { danger: true, confirmText: 'Evet, Pasife Al' }
              );
              if (!ok) return;
              const n = await Students.bulkSetPasifBySinif(sinif, true);
              Modal.close();
              Utils.toast(`${n} öğrenci pasife alındı.`, 'success');
              Router.render();
            };
          },
        });
      });
    });

    document.getElementById('open-trash').addEventListener('click', () => { location.hash = '#/cop-kutusu'; });

    document.querySelectorAll('.set-active-term').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await State.save('settings', { ...State.data.settings, aktifDonemId: btn.dataset.id });
        Utils.toast('Aktif dönem güncellendi.', 'success');
        Router.render();
      });
    });

    document.getElementById('add-term').addEventListener('click', () => openTermForm(null));
    document.querySelectorAll('.edit-term').forEach((btn) => {
      btn.addEventListener('click', () => openTermForm(State.data.terms.find((t) => t.id === btn.dataset.id)));
    });

    document.querySelectorAll('.set-active-ders').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await State.save('settings', { ...State.data.settings, aktifDersId: btn.dataset.id });
        Utils.toast('Aktif ders güncellendi.', 'success');
        Router.render();
      });
    });

    const openDersForm = (ders) => {
      Modal.open(`
        <div class="modal-header">${ders ? 'Dersi Düzenle' : 'Yeni Ders'}</div>
        <div class="modal-body">
          <label class="field-label">Ders Adı *</label>
          <input type="text" id="ders-ad" class="input" value="${Utils.escapeHtml(ders?.ad || '')}">
        </div>
        <div class="modal-actions">
          ${ders ? '<button class="btn btn-danger" id="ders-delete">Sil</button>' : ''}
          <button class="btn btn-secondary" id="ders-cancel">Vazgeç</button>
          <button class="btn btn-primary" id="ders-save">Kaydet</button>
        </div>
      `, {
        onMount: (root) => {
          root.querySelector('#ders-cancel').onclick = () => Modal.close();
          if (ders) {
            root.querySelector('#ders-delete').onclick = async () => {
              if (State.data.dersler.length <= 1) {
                Utils.toast('En az bir ders olmalı — bu tek dersi silemezsin.', 'info');
                return;
              }
              const notSayisi = Dersler.countAssessments(ders.id);
              const ok = await Confirm.ask(
                notSayisi
                  ? `Bu ders silinirse, bu derse ait ${notSayisi} sınav/performans notu da kalıcı olarak silinir. Devam edilsin mi?`
                  : 'Bu ders silinsin mi?',
                { danger: true }
              );
              if (!ok) return;
              await Dersler.remove(ders.id);
              Modal.close();
              Router.render();
            };
          }
          root.querySelector('#ders-save').onclick = async () => {
            const ad = root.querySelector('#ders-ad').value;
            const result = ders ? await Dersler.rename(ders.id, ad) : await Dersler.create(ad);
            if (!result.ok) { Utils.toast(result.errors.join(' '), 'error'); return; }
            Modal.close();
            Router.render();
          };
        },
      });
    };

    document.getElementById('add-ders').addEventListener('click', () => openDersForm(null));
    document.querySelectorAll('.edit-ders').forEach((btn) => {
      btn.addEventListener('click', () => openDersForm(State.data.dersler.find((d) => d.id === btn.dataset.id)));
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

    document.getElementById('drive-connect')?.addEventListener('click', async () => {
      const statusEl = document.getElementById('drive-status');
      statusEl.textContent = 'Google Drive bağlantısı için izin ekranı açılıyor…';
      try {
        await DriveBackup.connectInteractive();
        statusEl.textContent = '';
        Utils.toast('Google Drive bağlandı.', 'success');
        Router.render();
      } catch (e) {
        statusEl.textContent = '';
        Utils.toast('Bağlanılamadı: ' + e.message, 'error');
      }
    });

    document.getElementById('drive-backup-now')?.addEventListener('click', async () => {
      const statusEl = document.getElementById('drive-status');
      statusEl.textContent = 'Drive\'a yükleniyor…';
      try {
        await DriveBackup.backupNow({ interactive: true });
        statusEl.textContent = '';
        Utils.toast('Drive\'a yedeklendi.', 'success');
        Router.render();
      } catch (e) {
        statusEl.textContent = '';
        Utils.toast('Yedekleme başarısız: ' + e.message, 'error');
      }
    });

    document.getElementById('drive-disconnect')?.addEventListener('click', async () => {
      const ok = await Confirm.ask('Google Drive bağlantısı kaldırılsın mı? Otomatik yedekleme duracak.', {});
      if (!ok) return;
      await DriveBackup.disconnect();
      Utils.toast('Bağlantı kaldırıldı.', 'success');
      Router.render();
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
      for (const store of ['students', 'terms', 'assessments', 'homeworkTasks', 'homeworkAssignments', 'books', 'mockExams', 'scans', 'observations', 'tasks', 'reminders', 'notes', 'attendance', 'documents', 'trash', 'dersProgrami', 'dersProgramiIstisna', 'ekDersSaatleri', 'chatMesajlari']) {
        await DB.clear(store);
      }
      await State.init();
      Utils.toast('Tüm veriler silindi.', 'success');
      location.hash = '#/';
    });
  },
};
