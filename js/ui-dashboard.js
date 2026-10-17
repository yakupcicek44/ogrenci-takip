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

    let onboardingGorundu = true;
    try { onboardingGorundu = localStorage.getItem('ogrenciTakipOnboarding') === '1'; } catch (e) { /* no-op */ }

    return pageWrap('Ana Sayfa', `
      ${!onboardingGorundu ? `
        <div class="card" id="onboarding-card" style="border-color:var(--primary);">
          <div class="card-title">👋 Hoş Geldin</div>
          <p class="muted small">
            Alt menüden <strong>Öğrenciler</strong>'den öğrenci ekle, <strong>Asistan</strong>'dan günlük
            görev/hatırlatıcılarını takip et, <strong>Yoklama</strong>'dan günlük yoklama al,
            <strong>Raporlar</strong>'dan PDF/Excel çıktı ve dönem sonu karne al. Tüm verilerin sadece
            bu telefonda saklanıyor — <a href="#/ayarlar">Ayarlar</a>'dan düzenli yedek almayı unutma.
          </p>
          <button class="btn btn-primary btn-block" id="onboarding-dismiss">Anladım</button>
        </div>
      ` : ''}

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

      ${(() => {
        const siniflar = State.getSiniflar();
        if (!siniflar.length) return '';
        return `
          <div class="card">
            <div class="card-title">Sınıf Dağılımı</div>
            <div class="list">
              ${siniflar.map((s) => {
                const sayilar = Students.countBySinif(s);
                return `<a href="#/ogrenciler?sinif=${encodeURIComponent(s)}" class="list-item">
                  <div class="list-item-main"><div class="list-item-title">${Utils.escapeHtml(s)}</div></div>
                  <strong>${sayilar.aktif}${sayilar.pasif ? ' <span class="muted small">(+' + sayilar.pasif + ' pasif)</span>' : ''}</strong>
                </a>`;
              }).join('')}
            </div>
          </div>
        `;
      })()}

      ${(() => {
        // "Eksik bilgi": hiç not, gözlem veya devamsızlık kaydı olmayan aktif öğrenciler —
        // öğretmenin henüz dokunmadığı, dikkat gerektiren kayıtlar.
        const eksikler = students.filter((s) => {
          const hasAssessment = State.data.assessments.some((a) => a.studentId === s.id && !Utils.isEmptyGrade(a.puan));
          const hasObs = State.data.observations.some((o) => o.studentId === s.id);
          const hasAtt = State.data.attendance.some((a) => a.studentId === s.id);
          return !hasAssessment && !hasObs && !hasAtt;
        });
        if (!eksikler.length) return '';
        return `
          <div class="alert alert-warning">
            ⚠️ ${eksikler.length} öğrencide hiç not, gözlem veya yoklama kaydı yok: ${eksikler.slice(0, 4).map((s) => Utils.escapeHtml(s.ad)).join(', ')}${eksikler.length > 4 ? ' …' : ''}
          </div>
        `;
      })()}

      <div class="card">
        <div class="card-title">Gelişim Özeti</div>
        <p class="muted">${Utils.escapeHtml(sonDenemeOzet)}</p>
      </div>

      ${(() => {
        const sonGozlemler = [...State.data.observations].sort((a, b) => (b.tarih || '').localeCompare(a.tarih || '')).slice(0, 5);
        if (!sonGozlemler.length) return '';
        return `
          <div class="card">
            <div class="card-title">Son Gözlem Kayıtları</div>
            <ul class="simple-list">
              ${sonGozlemler.map((o) => {
                const s = State.getStudent(o.studentId);
                return `<li>${Utils.formatDateTR(o.tarih)} · ${s ? Utils.escapeHtml(s.ad) : '?'} — ${Utils.escapeHtml(o.metin.slice(0, 60))}${o.metin.length > 60 ? '…' : ''}</li>`;
              }).join('')}
            </ul>
          </div>
        `;
      })()}

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

  mount() {
    document.getElementById('onboarding-dismiss')?.addEventListener('click', () => {
      try { localStorage.setItem('ogrenciTakipOnboarding', '1'); } catch (e) { /* no-op */ }
      Router.render();
    });
  },
};
