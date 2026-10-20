// Sesli yazma (mikrofon ile not girişi) — tarayıcının yerleşik Web Speech API'si
// (webkitSpeechRecognition) kullanılır. İNTERNET GEREKTİRİR: ses, tanıma için
// tarayıcının bulut servisine gönderilir — AI ile kağıt tarama ile aynı tradeoff,
// uygulamanın geri kalanının aksine çevrimdışı çalışmaz.
const Speech = {
  isSupported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  },

  // micBtn tıklanınca başlar/durur, tanınan metin textarea'nın mevcut içeriğine eklenir
  // (üzerine yazmaz). Desteklenmeyen tarayıcılarda (iOS Safari gibi) buton gizlenir.
  bindToTextarea(micBtn, textarea) {
    if (!micBtn || !textarea) return;
    if (!this.isSupported()) {
      micBtn.style.display = 'none';
      return;
    }

    const RecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null;
    let listening = false;
    let baseValue = '';

    const setIdle = () => {
      listening = false;
      recognition = null;
      micBtn.classList.remove('btn-danger');
      micBtn.classList.add('btn-secondary');
      micBtn.textContent = '🎤';
      micBtn.setAttribute('aria-label', 'Sesli yaz');
    };

    micBtn.onclick = () => {
      if (listening) {
        recognition.stop();
        return;
      }

      baseValue = textarea.value;
      if (baseValue && !/\s$/.test(baseValue)) baseValue += ' ';

      recognition = new RecognitionCtor();
      recognition.lang = 'tr-TR';
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onstart = () => {
        listening = true;
        micBtn.classList.remove('btn-secondary');
        micBtn.classList.add('btn-danger');
        micBtn.textContent = '⏹';
        micBtn.setAttribute('aria-label', 'Sesli yazmayı durdur');
      };

      recognition.onresult = (event) => {
        let finalText = '';
        let interimText = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) finalText += transcript + ' ';
          else interimText += transcript;
        }
        if (finalText) baseValue += finalText;
        textarea.value = baseValue + interimText;
      };

      recognition.onerror = (event) => {
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          Utils.toast('Mikrofon izni verilmedi.', 'error');
        } else if (event.error === 'network') {
          Utils.toast('Sesli yazma için internet bağlantısı gerekir.', 'error');
        } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
          Utils.toast('Sesli yazma başarısız oldu.', 'error');
        }
      };

      recognition.onend = setIdle;

      recognition.start();
    };
  },
};
