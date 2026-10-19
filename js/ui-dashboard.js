// Ana Ekran — gerçek veriyle beslenen özet + grafikler
const DASHBOARD_CHART_COLORS = {
  primary: '#2563eb', accent: '#7c3aed', success: '#16a34a', warning: '#f59e0b', danger: '#dc2626', muted: '#94a3b8',
};

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

    let onboardingGorundu = true;
    try { onboardingGorundu = localStorage.getItem('ogrenciTakipOnboarding') === '1'; } catch (e) { /* no-op */ }

    const siniflar = State.getSiniflar();
    const aktifDonem = State.getActiveTerm();

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
        const bugun = Utils.todayISO();
        const dow = new Date(bugun + 'T00:00:00').getDay();
        if (dow < 1 || dow > 5 || !State.data.dersProgrami.length) return '';
        const bugunler = Schedule.getOccurrencesInRange(bugun, bugun);
        if (!bugunler.length) return '';
        return `
          <div class="card">
            <div class="card-title">Bugünün Ders Programı</div>
            <ul class="simple-list">
              ${bugunler.map((o) => `<li>${o.baslangicSaati}-${o.bitisSaati} · ${Utils.escapeHtml(o.sinif)}${o.iptal ? ' <strong style="color:var(--danger)">(iptal)</strong>' : ''}</li>`).join('')}
            </ul>
            <a href="#/asistan/ders-programi" class="btn btn-secondary btn-block" style="margin-top:8px;">Ders Programını Aç</a>
          </div>
        `;
      })()}

      ${State.data.homeworkAssignments.length ? `
        <div class="card">
          <div class="card-title">Ödev Durumu Dağılımı</div>
          <canvas id="chart-odev-durum" height="180"></canvas>
        </div>
      ` : ''}

      ${siniflar.length ? `
        <div class="card">
          <div class="card-title">Sınıf Dağılımı</div>
          <canvas id="chart-sinif-dagilim" height="180"></canvas>
          <p class="muted small" style="margin-top:6px;">Bir sütuna dokunursan o sınıfın öğrenci listesi açılır.</p>
        </div>
      ` : ''}

      ${siniflar.length && aktifDonem ? `
        <div class="card">
          <div class="card-title">Sınıf Ortalamaları (${Utils.escapeHtml(aktifDonem.ad)}${State.data.dersler.length > 1 ? ' — ' + Utils.escapeHtml(State.getActiveCourse().ad) : ''})</div>
          <canvas id="chart-sinif-ortalama" height="180"></canvas>
        </div>
      ` : ''}

      ${(() => {
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

    // --- Ödev Durumu Dağılımı (donut) ---
    const odevCanvas = document.getElementById('chart-odev-durum');
    if (odevCanvas) {
      const sayilar = Homework.DURUMLAR.map((d) => State.data.homeworkAssignments.filter((a) => a.durum === d).length);
      new Chart(odevCanvas, {
        type: 'doughnut',
        data: {
          labels: Homework.DURUMLAR,
          datasets: [{
            data: sayilar,
            backgroundColor: [DASHBOARD_CHART_COLORS.accent, DASHBOARD_CHART_COLORS.success, DASHBOARD_CHART_COLORS.danger, DASHBOARD_CHART_COLORS.warning],
            borderWidth: 0,
          }],
        },
        options: {
          responsive: true,
          plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } },
          onClick: (evt, elements) => {
            if (!elements.length) return;
            const durum = Homework.DURUMLAR[elements[0].index];
            location.hash = `#/odev-atama?durum=${encodeURIComponent(durum)}`;
          },
        },
      });
    }

    // --- Sınıf Dağılımı (bar, tıklanınca öğrenci listesine gider) ---
    const sinifCanvas = document.getElementById('chart-sinif-dagilim');
    if (sinifCanvas) {
      const siniflar = State.getSiniflar();
      const sayilar = siniflar.map((s) => Students.countBySinif(s).aktif);
      new Chart(sinifCanvas, {
        type: 'bar',
        data: { labels: siniflar, datasets: [{ data: sayilar, backgroundColor: DASHBOARD_CHART_COLORS.primary, borderRadius: 6 }] },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
          onClick: (evt, elements) => {
            if (!elements.length) return;
            location.hash = `#/ogrenciler?sinif=${encodeURIComponent(siniflar[elements[0].index])}`;
          },
        },
      });
    }

    // --- Sınıf Ortalamaları (bar) ---
    const ortalamaCanvas = document.getElementById('chart-sinif-ortalama');
    if (ortalamaCanvas) {
      const siniflar = State.getSiniflar();
      const aktifDonem = State.getActiveTerm();
      const aktifDers = State.getActiveCourse();
      const ortalamalar = siniflar.map((s) => Assessments.classAverage(s, aktifDonem.id, aktifDers?.id));
      new Chart(ortalamaCanvas, {
        type: 'bar',
        data: {
          labels: siniflar,
          datasets: [{
            data: ortalamalar,
            backgroundColor: DASHBOARD_CHART_COLORS.accent,
            borderRadius: 6,
          }],
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (ctx) => ctx.raw === null ? 'Not girilmedi' : `Ortalama: ${ctx.raw}` } },
          },
          scales: { y: { beginAtZero: true, max: 100 } },
          onClick: (evt, elements) => {
            if (!elements.length) return;
            location.hash = `#/ogrenciler?sinif=${encodeURIComponent(siniflar[elements[0].index])}`;
          },
        },
      });
    }
  },
};
