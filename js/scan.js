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

  async callWorker({ dataUrl, mimeType, rubric, context }) {
    const base64 = dataUrl.split(',')[1];
    const res = await fetch(ScanConfig.WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-App-Secret': ScanConfig.APP_SHARED_SECRET },
      body: JSON.stringify({ imageBase64: base64, mimeType, rubric, context }),
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

// Tekrar kullanılabilir akış: dosya/kamera seç -> önizleme+kriter -> AI değerlendir -> onay/red.
const ScanFlow = {
  start({ studentId, ownerType, ownerId, defaultRubric = '', context = '', onApprove }) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.style.display = 'none';
    document.body.appendChild(input);

    input.addEventListener('change', async () => {
      const file = input.files[0];
      document.body.removeChild(input);
      if (!file) return;

      let compressed;
      try {
        compressed = await Scan.compressImageFile(file);
      } catch (e) {
        Utils.toast('Görsel işlenemedi: ' + e.message, 'error');
        return;
      }

      this._showReviewModal({ compressed, studentId, ownerType, ownerId, defaultRubric, context, onApprove });
    });

    input.click();
  },

  _showReviewModal({ compressed, studentId, ownerType, ownerId, defaultRubric, context, onApprove }) {
    Modal.open(`
      <div class="modal-header">Kağıt Tara ve Değerlendir</div>
      <div class="modal-body">
        <img src="${compressed.dataUrl}" style="width:100%;border-radius:10px;margin-bottom:10px;">
        <label class="field-label">Cevap Anahtarı / Kriter (boş bırakılabilir)</label>
        <textarea id="scan-rubric" class="input" rows="3">${Utils.escapeHtml(defaultRubric)}</textarea>
        <p class="muted small">Bu görsel değerlendirme için Google Gemini'ye gönderilecek. Sonuç bir TASLAKTIR, onaylamadan hiçbir nota işlenmez.</p>
        <div id="scan-status" class="muted small"></div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="scan-cancel">Vazgeç</button>
        <button class="btn btn-primary" id="scan-evaluate">Değerlendir</button>
      </div>
    `, {
      onMount: (root) => {
        root.querySelector('#scan-cancel').onclick = () => Modal.close();
        root.querySelector('#scan-evaluate').onclick = async () => {
          const rubric = root.querySelector('#scan-rubric').value;
          const statusEl = root.querySelector('#scan-status');
          const btn = root.querySelector('#scan-evaluate');
          btn.disabled = true;
          statusEl.textContent = 'Taranıyor ve değerlendiriliyor… (internet gerekir, biraz sürebilir)';
          try {
            const result = await Scan.callWorker({ dataUrl: compressed.dataUrl, mimeType: compressed.mimeType, rubric, context });
            this._showDraftModal({ compressed, studentId, ownerType, ownerId, rubric, context, result, onApprove });
          } catch (e) {
            statusEl.textContent = '';
            Utils.toast('Değerlendirme başarısız: ' + e.message, 'error');
            btn.disabled = false;
          }
        };
      },
    });
  },

  _showDraftModal({ compressed, studentId, ownerType, ownerId, rubric, context, result, onApprove }) {
    Modal.open(`
      <div class="modal-header">AI Taslak Değerlendirme (Onaysız)</div>
      <div class="modal-body">
        <img src="${compressed.dataUrl}" style="width:100%;border-radius:10px;margin-bottom:10px;">
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
            studentId, ownerType, ownerId, imageDataUrl: compressed.dataUrl,
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
            studentId, ownerType, ownerId, imageDataUrl: compressed.dataUrl,
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
