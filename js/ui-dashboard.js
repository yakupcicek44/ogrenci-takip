// Ana Ekran
const DashboardView = {
  html() {
    const students = State.getActiveStudents();
    const eksikOdevler = State.data.homeworkAssignments.filter((a) => a.durum === 'eksik').length;
    const bekleyenOdevler = State.data.homeworkAssignments.filter((a) => a.durum === 'bekliyor').length;
    const yaklasanlar = Homework.getUpcoming(7);

    const sonYedek = State.data.settings.sonYedekTarihi;
    const sonDriveYedek = State.data.settings.drive?.sonBasariliYedek;
    const enYeniYedek = [sonYedek, sonDriveYedek].filter(Boolean).sort().pop();
    const yedekUyarisiGoster = !enYeniYedek || (Date.now() - new Date(enYeniYedek).getTime()) > 7 * 24 * 3600 * 1000;

    // Basit gelişim özeti: son 5 deneme sonucuna göre genel sınıf ortalaması trendi
    const allExams = State.data.mockExams.slice().sort((a, b) => (a.tarih || '').localeCompare(b.tarih || ''));
    const sonDenemeOzet = allExams.length
      ? `Son deneme: ${allExams[allExams.length - 1].denemeAdi} (${Utils.formatDateTR(allExams[allExams.length - 1].tarih)})`
      : 'Henüz deneme sonucu girilmedi.';

    return pageWrap('Ana Sayfa', `
      ${yedekUyarisiGoster ? `
        <div class="alert alert-warning">
          ⚠️ ${enYeniYedek ? 'Son yedeğin üzerinden 7 günden fazla geçti.' : 'Henüz hiç yedek alınmadı.'}
          Cihaz içi kayıt tek başına telefon kaybına karşı yeterli değildir —
          <a href="#/ayarlar">şimdi yedek al</a> (Google Drive'a otomatik yedeklemeyi de Ayarlar'dan açabilirsin).
        </div>
      ` : ''}

      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-value">${students.length}</div>
          <div class="stat-label">Öğrenci</div>
        </div>
        <div class="stat-card ${eksikOdevler ? 'stat-danger' : ''}">
          <div class="stat-value">${eksikOdevler}</div>
          <div class="stat-label">Eksik Ödev</div>
        </div>
        <div class="stat-card ${bekleyenOdevler ? 'stat-warning' : ''}">
          <div class="stat-value">${bekleyenOdevler}</div>
          <div class="stat-label">Bekleyen Ödev</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${yaklasanlar.length}</div>
          <div class="stat-label">Yaklaşan Teslim (7g)</div>
        </div>
      </div>

      ${(() => {
        const bugunGorevleri = Tasks.getDashboardTasks();
        const bugunHatirlaticilar = Reminders.getToday();
        if (!bugunGorevleri.length && !bugunHatirlaticilar.length) return '';
        return `
          <div class="card">
            <div class="card-title">Bugün — Asistan</div>
            <ul class="simple-list">
              ${bugunGorevleri.slice(0, 4).map((t) => `
                <li>✅ ${t.oncelik === 'yuksek' ? '🔴 ' : ''}${Utils.escapeHtml(t.baslik)}${Tasks.isOverdue(t) ? ' <strong style="color:var(--danger)">(gecikti)</strong>' : ''}</li>
              `).join('')}
              ${bugunHatirlaticilar.slice(0, 4).map((r) => `
                <li>⏰ ${Utils.escapeHtml(r.metin)}${r.saat ? ' · ' + r.saat : ''}</li>
              `).join('')}
            </ul>
            <a href="#/asistan" class="btn btn-secondary btn-block" style="margin-top:8px;">Asistanı Aç</a>
          </div>
        `;
      })()}

      <div class="card">
        <div class="card-title">Gelişim Özeti</div>
        <p class="muted">${Utils.escapeHtml(sonDenemeOzet)}</p>
      </div>

      ${yaklasanlar.length ? `
        <div class="card">
          <div class="card-title">Yaklaşan Teslimler</div>
          <ul class="simple-list">
            ${yaklasanlar.map((t) => `<li>${Utils.escapeHtml(t.ad)} — ${Utils.formatDateTR(t.teslimTarihi)}</li>`).join('')}
          </ul>
        </div>
      ` : ''}

      <div class="quick-actions">
        <a href="#/ogrenciler?ekle=1" class="btn btn-primary">+ Öğrenci Ekle</a>
        <a href="#/odev-atama?yeni=1" class="btn btn-secondary">Toplu Ödev Ata</a>
        <a href="#/ayarlar" class="btn btn-secondary">Yedek Al</a>
      </div>
    `);
  },

  mount() {},
};
