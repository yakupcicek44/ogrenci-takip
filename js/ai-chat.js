// Asistan Sohbeti — Gemini AI ile doğal dilde hatırlatıcı/görev/not/ders programı ekleme.
// ÖNEMLİ: Worker (sunucu) HİÇBİR ŞEYİ KAYDETMEZ, sadece hangi eylemin (action) çağrılması
// gerektiğini döner; gerçek IndexedDB yazma işlemi burada, istemci tarafında yapılır.
// Yakup'un açık talebiyle eylemler ONAY BEKLEMEDEN anında kaydedilir — güvenlik ağı olarak
// her eylem sonrası bir "Geri Al" seçeneği sunulur (bkz. ui-assistant.js Sohbet sekmesi).
const AiChat = {
  CHAT_URL: ScanConfig.WORKER_URL + '/chat',

  // STORE_MAP: her action adının hangi IndexedDB store'una yazdığı — "Geri Al" bu
  // bilgiyle doğrudan State.remove çağırabilsin diye.
  ACTIONS: {
    create_reminder: {
      store: 'reminders',
      run: async (args) => Reminders.create({ metin: args.metin, tarih: args.tarih, saat: args.saat || '' }),
      ozet: (args) => `Hatırlatıcı eklendi: "${args.metin}" — ${Utils.formatDateTR(args.tarih)}${args.saat ? ' ' + args.saat : ''}`,
    },
    create_task: {
      store: 'tasks',
      run: async (args) => Tasks.create({ baslik: args.baslik, oncelik: args.oncelik || 'normal', sonTarih: args.sonTarih || null }),
      ozet: (args) => `Görev eklendi: "${args.baslik}"`,
    },
    create_note: {
      store: 'notes',
      run: async (args) => Notes.save({ baslik: args.baslik || '', metin: args.metin }),
      ozet: (args) => `Not eklendi: "${args.baslik || (args.metin || '').slice(0, 30)}"`,
    },
    create_schedule_slot: {
      store: 'dersProgrami',
      run: async (args) => Schedule.createSlot({ gun: args.gun, baslangicSaati: args.baslangicSaati, bitisSaati: args.bitisSaati, sinif: args.sinif, ders: args.ders || '' }),
      ozet: (args) => `Ders programına eklendi: ${Schedule.GUNLER[Number(args.gun)] || ''} ${args.baslangicSaati}-${args.bitisSaati} · ${args.sinif}`,
    },
  },

  // Asistan'a context olarak gönderilecek, uygulamanın GÜNCEL durumunun kısa bir özeti.
  // Tüm öğrenci/not detayları değil — sadece eylem almak/soru cevaplamak için gereken kısım.
  buildContext() {
    const today = Utils.todayISO();
    const gunAdi = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'][new Date(today + 'T00:00:00').getDay()];
    const hafta = Schedule.weekRange(Schedule.weekMonday(today));
    const dersler = Schedule.getOccurrencesInRange(hafta.start, hafta.end).filter((o) => !o.iptal);
    const gorevler = Tasks.filterAll({ durum: 'bekliyor' }).slice(0, 10);
    const hatirlaticilar = Reminders.filterAll({ tamamlandi: false }).slice(0, 10);
    const siniflar = State.getSiniflar();
    const belgeler = State.data.documents.slice(0, 10).map((d) => d.ad);

    return [
      `Bugün: ${today} (${gunAdi})`,
      `Bu haftanın ders programı: ${dersler.length ? dersler.map((o) => `${o.tarih} ${o.baslangicSaati}-${o.bitisSaati} ${o.sinif}`).join('; ') : 'kayıt yok'}`,
      `Açık görevler: ${gorevler.length ? gorevler.map((t) => `"${t.baslik}"${t.sonTarih ? ' (' + t.sonTarih + ')' : ''}`).join('; ') : 'yok'}`,
      `Açık hatırlatıcılar: ${hatirlaticilar.length ? hatirlaticilar.map((r) => `"${r.metin}" ${r.tarih}${r.saat ? ' ' + r.saat : ''}`).join('; ') : 'yok'}`,
      `Sınıflar: ${siniflar.length ? siniflar.join(', ') : 'yok'}`,
      `Belgeler: ${belgeler.length ? belgeler.join(', ') : 'yok'}`,
    ].join('\n');
  },

  async send(message, history, image) {
    const res = await fetch(this.CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-App-Secret': ScanConfig.APP_SHARED_SECRET },
      body: JSON.stringify({
        message,
        systemContext: this.buildContext(),
        history,
        image: image ? { data: image.dataUrl.split(',')[1], mimeType: image.mimeType } : undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'Asistan yanıt veremedi.');
    return data; // { ok, replyText, action: {name, args} | null, model }
  },

  async executeAction(action) {
    const def = this.ACTIONS[action.name];
    if (!def) return { ok: false, error: 'Bilinmeyen eylem: ' + action.name };
    const result = await def.run(action.args || {});
    if (!result.ok) return { ok: false, error: (result.errors || ['Eylem başarısız.']).join(' ') };
    const record = result.record || result.student;
    return { ok: true, store: def.store, id: record?.id, ozet: def.ozet(action.args || {}) };
  },

  async undo(store, id) {
    await State.remove(store, id);
  },

  // --- Sohbet geçmişi (kalıcı) — sadece METİN kaydedilir, fotoğraflar asla saklanmaz. ---
  async saveMessage(record) {
    const full = { id: Utils.uid(), olusturmaTarihi: new Date().toISOString(), ...record };
    await State.save('chatMesajlari', full);
    return full;
  },

  async updateMessage(id, patch) {
    const existing = State.data.chatMesajlari.find((m) => m.id === id);
    if (!existing) return;
    await State.save('chatMesajlari', { ...existing, ...patch });
  },

  getMessages() {
    return [...State.data.chatMesajlari].sort((a, b) => (a.olusturmaTarihi || '').localeCompare(b.olusturmaTarihi || ''));
  },

  async clearMessages() {
    for (const m of [...State.data.chatMesajlari]) await State.remove('chatMesajlari', m.id);
  },

  // Kayıtlı mesaj geçmişinden Gemini'ye gönderilecek son N turu (role:user/model) çıkarır.
  // Hata balonları context'e dahil edilmez (model için gürültü olur).
  buildHistoryFromMessages(messages) {
    return messages
      .filter((m) => m.role !== 'error')
      .slice(-10)
      .map((m) => ({ role: m.role === 'user' ? 'user' : 'model', text: m.text }));
  },
};
