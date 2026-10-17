// Kamera ile kağıt tarama + Gemini AI değerlendirmesi (Cloudflare Worker proxy üzerinden).
// ÖNEMLİ: Bu özellik internet bağlantısı gerektirir ve taranan görsel Google'ın
// Gemini API'sine gönderilir — diğer tüm veriler sadece cihazda kalırken BU veri
// cihaz dışına çıkar. AI'nin önerisi her zaman bir TASLAKTIR; öğretmen onaylamadan
// hiçbir resmi nota/değerlendirmeye yazılmaz.
const ScanConfig = {
  WORKER_URL: 'https://ogrenci-takip-ai-proxy.ogrenci-takip-ai-proxy.workers.dev',
  APP_SHARED_SECRET: 'ef39ea1301e4a351d2a27d0c92c2e5a4d915ad05afa6a0b1',
};

const Scan = {
  // Görseli küçültüp sıkıştırır (hem yükleme hızı hem cihaz depolama alanı için).
  compressImageFile(file, { maxDim = 1600, quality = 0.82 } = {}) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();
      reader.onload = () => {
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) { height = Math.round(height * (maxDim / width)); width = maxDim; }
            else { width = Math.round(width * (maxDim / height)); height = maxDim; }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          canvas.getContext('2d').drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve({ dataUrl, mimeType: 'image/jpeg' });
        };
        img.onerror = () => reject(new Error('Görsel okunamadı.'));
        img.src = reader.result;
      };
      reader.onerror = () => reject(new Error('Dosya okunamadı.'));
      reader.readAsDataURL(file);
    });
  },

  // images: [{dataUrl, mimeType}, ...] — birden fazla sayfa/foto tek değerlendirme
  // olarak Gemini'ye birlikte gönderilir (çok sayfalı kağıtlar için).
  async callWorker({ images, rubric, context }) {
    const payloadImages = images.map((img) => ({ data: img.dataUrl.split(',')[1], mimeType: img.mimeType }));
    const res = await fetch(ScanConfig.WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-App-Secret': ScanConfig.APP_SHARED_SECRET },
      body: JSON.stringify({ images: payloadImages, rubric, context }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'Değerlendirme başarısız oldu.');
    return data;
  },

  async save(record) {
    const full = {
      id: Utils.uid(),
      olusturmaTarihi: new Date().toISOString(),
      durum: 'taslak',
      ...record,
    };
    await State.save('scans', full);
    return full;
  },
};

// Tekrar kullanılabilir akış: kamerayla birden fazla foto çek (çok sayfalı kağıtlar
// için) -> "Tamamladım" -> hepsi TEK değerlendirme olarak AI'ya gönderilir -> onay/red.
const ScanFlow = {
  start({ studentId, ownerType, ownerId, defaultRubric = '', context = '', onApprove }) {
    this._showCaptureModal({ captured: [], studentId, ownerType, ownerId, defaultRubric, context, onApprove });
  },

  // Dosya seçiciyi açar, seçilen/çekilen görseli sıkıştırıp döner. İptal edilirse null.
  _pickAndCompress() {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment';
      input.style.display = 'none';
      document.body.appendChild(input);
      input.addEventListener('change', async () => {
        const file = input.files[0];
        document.body.removeChild(input);
        if (!file) { resolve(null); return; }
        try {
          resolve(await Scan.compressImageFile(file));
        } catch (e) {
          Utils.toast('Görsel işlenemedi: ' + e.message, 'error');
          resolve(null);
        }
      });
      input.click();
    });
  },

  _showCaptureModal({ captured, studentId, ownerType, ownerId, defaultRubric, context, onApprove }) {
    const yeniden = () => this._showCaptureModal({ captured, studentId, ownerType, ownerId, defaultRubric, context, onApprove });

    Modal.open(`
      <div class="modal-header">Kağıt Tara${captured.length ? ` (${captured.length} fotoğraf)` : ''}</div>
      <div class="modal-body">
        ${captured.length ? `
          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px;">
            ${captured.map((c, i) => `
              <div style="position:relative;">
                <img src="${c.dataUrl}" style="width:72px;height:72px;object-fit:cover;border-radius:8px;">
                <button class="scan-remove-photo" data-idx="${i}" aria-label="Bu fotoğrafı kaldır" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;background:var(--danger);color:#fff;border:none;font-size:12px;line-height:1;">×</button>
              </div>
            `).join('')}
          </div>
        ` : ''}
        <button class="btn btn-secondary btn-block" id="scan-add-photo">📷 ${captured.length ? 'Başka Fotoğraf Ekle' : 'Fotoğraf Çek'}</button>
        ${captured.length ? `
          <label class="field-label" style="margin-top:10px;">Cevap Anahtarı / Kriter (boş bırakılabilir)</label>
          <textarea id="scan-rubric" class="input" rows="3">${Utils.escapeHtml(defaultRubric)}</textarea>
          <p class="muted small">Birden fazla sayfa çektiysen hepsi TEK bir değerlendirme olarak birlikte gönderilir.</p>
        ` : `
          <p class="muted small">Çok sayfalı bir kağıtsa her sayfayı tek tek çekebilirsin — hepsi bitince "Tamamladım" ile tek seferde değerlendirmeye gönderilir.</p>
        `}
        <div id="scan-status" class="muted small"></div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="scan-cancel">Vazgeç</button>
        ${captured.length ? '<button class="btn btn-primary" id="scan-done">Tamamladım, Değerlendir</button>' : ''}
      </div>
    `, {
      onMount: (root) => {
        root.querySelector('#scan-cancel').onclick = () => Modal.close();
        root.querySelectorAll('.scan-remove-photo').forEach((btn) => {
          btn.onclick = () => { captured.splice(Number(btn.dataset.idx), 1); yeniden(); };
        });
        root.querySelector('#scan-add-photo').onclick = async () => {
          const compressed = await this._pickAndCompress();
          if (compressed) captured.push(compressed);
          yeniden();
        };
        root.querySelector('#scan-done')?.addEventListener('click', async () => {
          const rubric = root.querySelector('#scan-rubric').value;
          const statusEl = root.querySelector('#scan-status');
          const btn = root.querySelector('#scan-done');
          btn.disabled = true;
          statusEl.textContent = 'Taranıyor ve değerlendiriliyor… (internet gerekir, biraz sürebilir)';
          try {
            const result = await Scan.callWorker({ images: captured, rubric, context });
            this._showDraftModal({ captured, studentId, ownerType, ownerId, rubric, context, result, onApprove });
          } catch (e) {
            statusEl.textContent = '';
            Utils.toast('Değerlendirme başarısız: ' + e.message, 'error');
            btn.disabled = false;
          }
        });
      },
    });
  },

  _showDraftModal({ captured, studentId, ownerType, ownerId, rubric, context, result, onApprove }) {
    Modal.open(`
      <div class="modal-header">AI Taslak Değerlendirme (Onaysız)</div>
      <div class="modal-body">
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px;">
          ${captured.map((c) => `<img src="${c.dataUrl}" style="width:64px;height:64px;object-fit:cover;border-radius:8px;">`).join('')}
        </div>
        <label class="field-label">AI Değerlendirmesi (gerekirse düzenle)</label>
        <textarea id="draft-metin" class="input" rows="4">${Utils.escapeHtml(result.degerlendirme || '')}</textarea>
        <label class="field-label">Önerilen Puan (gerekirse düzenle, boş bırakılabilir)</label>
        <input type="number" step="0.01" id="draft-puan" class="input" value="${result.onerilenPuan ?? ''}">
        <p class="muted small">Bu bir öneridir — sen gözden geçirmeden resmi kayda işlenmez.</p>
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="draft-reject">Reddet</button>
        <button class="btn btn-primary" id="draft-approve">Onayla ve Uygula</button>
      </div>
    `, {
      onMount: (root) => {
        root.querySelector('#draft-reject').onclick = async () => {
          await Scan.save({
            studentId, ownerType, ownerId, imageDataUrls: captured.map((c) => c.dataUrl),
            rubricUsed: rubric, context, aiMetin: result.degerlendirme, aiOnerilenPuan: result.onerilenPuan,
            durum: 'reddedildi',
          });
          Modal.close();
          Utils.toast('Değerlendirme reddedildi, kayda işlenmedi.', 'info');
        };
        root.querySelector('#draft-approve').onclick = async () => {
          const metin = root.querySelector('#draft-metin').value;
          const puanRaw = root.querySelector('#draft-puan').value;
          const puan = Utils.isEmptyGrade(puanRaw) ? null : Number(puanRaw);
          await Scan.save({
            studentId, ownerType, ownerId, imageDataUrls: captured.map((c) => c.dataUrl),
            rubricUsed: rubric, context, aiMetin: metin, aiOnerilenPuan: puan,
            durum: 'onaylandi',
          });
          Modal.close();
          Utils.toast('Onaylandı ve işlendi.', 'success');
          if (onApprove) onApprove(puan, metin);
        };
      },
    });
  },
};
