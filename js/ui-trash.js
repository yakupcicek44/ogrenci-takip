// Çöp Kutusu ekranı — Trash modülünün üzerindeki ince arayüz katmanı.
const TRASH_STORE_ETIKETLERI = {
  observations: 'Gözlem',
  books: 'Kitap',
  mockExams: 'Deneme',
  tasks: 'Görev',
  reminders: 'Hatırlatıcı',
  notes: 'Not',
  documents: 'Belge',
};

const TrashView = {
  html() {
    return pageWrap('Çöp Kutusu', `
      <div class="card">
        <p class="muted small">
          Silinen kayıtlar burada ${Trash.SAKLAMA_GUNU} gün saklanır, bu süre içinde geri
          yüklenebilir. Süre dolunca sessizce kalıcı olarak silinir. Öğrenci silme ve
          "Tüm Verileri Sıfırla" gibi büyük/kademeli işlemler buraya dahil değildir —
          onlar zaten ayrıca onaylıdır.
        </p>
      </div>
      <div id="trash-list" class="list"></div>
      <button class="btn btn-danger btn-block" id="trash-empty-all" style="margin-top:12px;">Çöp Kutusunu Tamamen Boşalt</button>
    `, { back: '#/ayarlar' });
  },

  mount() {
    const renderList = () => {
      const list = Trash.list();
      const container = document.getElementById('trash-list');
      if (!list.length) { container.innerHTML = emptyState('Çöp kutusu boş.', '🗑️'); return; }
      container.innerHTML = list.map((t) => {
        const gecenGun = Math.floor((Date.now() - new Date(t.silinmeTarihi).getTime()) / (24 * 3600 * 1000));
        const kalanGun = Math.max(0, Trash.SAKLAMA_GUNU - gecenGun);
        return `
          <div class="list-item" data-id="${t.id}">
            <div class="list-item-main">
              <div class="list-item-title"><span class="badge">${TRASH_STORE_ETIKETLERI[t.store] || t.store}</span> ${Utils.escapeHtml(t.ozet)}</div>
              <div class="list-item-sub">${Utils.formatDateTimeTR(t.silinmeTarihi)} · ${kalanGun} gün sonra kalıcı silinir</div>
            </div>
            <div style="display:flex;gap:6px;">
              <button class="btn btn-secondary btn-sm trash-restore" data-id="${t.id}">Geri Yükle</button>
              <button class="btn btn-danger btn-sm trash-purge" data-id="${t.id}">Kalıcı Sil</button>
            </div>
          </div>
        `;
      }).join('');

      container.querySelectorAll('.trash-restore').forEach((btn) => {
        btn.onclick = async () => {
          const entry = Trash.list().find((t) => t.id === btn.dataset.id);
          const result = await Trash.restore(btn.dataset.id);
          if (!result.ok) { Utils.toast(result.errors.join(' '), 'error'); return; }
          // Hatırlatıcı çöpe atılırken sunucudan (push senkronu) kaldırılmıştı —
          // geri yüklenince ve hâlâ tamamlanmamışsa yeniden senkronlanmalı.
          if (entry.store === 'reminders' && !entry.kayit.tamamlandi) {
            Push.syncReminder(entry.kayit);
          }
          Utils.toast('Geri yüklendi.', 'success');
          renderList();
        };
      });
      container.querySelectorAll('.trash-purge').forEach((btn) => {
        btn.onclick = async () => {
          const ok = await Confirm.ask('Bu kayıt kalıcı olarak silinsin mi? Bu işlem geri alınamaz.', { danger: true });
          if (!ok) return;
          await Trash.purgeOne(btn.dataset.id);
          renderList();
        };
      });
    };

    document.getElementById('trash-empty-all').addEventListener('click', async () => {
      if (!Trash.list().length) { Utils.toast('Çöp kutusu zaten boş.', 'info'); return; }
      const ok = await Confirm.ask(
        'Çöp kutusundaki TÜM kayıtlar kalıcı olarak silinecek. Bu işlem geri alınamaz.',
        { danger: true, confirmText: 'Evet, Boşalt' }
      );
      if (!ok) return;
      await Trash.purgeAll();
      Utils.toast('Çöp kutusu boşaltıldı.', 'success');
      renderList();
    });

    renderList();
  },
};
