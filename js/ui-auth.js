// Giriş / ilk kurulum ekranı — Router'dan önce çalışır, #app içine kendi başına render edilir.
const LoginView = {
  html() {
    if (!Auth.isSetup()) {
      return `
        <div class="page">
          <div class="page-content" style="padding-top:60px;">
            <div class="card">
              <div class="card-title">Hoş Geldin — İlk Kurulum</div>
              <p class="muted small">
                Uygulamayı açarken kullanacağın bir kullanıcı adı ve şifre belirle.
                Bu, telefonunu eline alan birinin uygulamayı rastgele açmasını engeller —
                ama bir sunucu şifrelemesi değildir. Şifreni unutursan veriyi sıfırlamak
                dışında kurtarma yolu yoktur; bu yüzden düzenli yedek almak (Ayarlar) önemlidir.
              </p>
              <label class="field-label">Kullanıcı Adı</label>
              <input type="text" id="setup-username" class="input" autocomplete="username">
              <label class="field-label">Şifre (en az 4 karakter)</label>
              <input type="password" id="setup-password" class="input" autocomplete="new-password">
              <label class="field-label">Şifre (tekrar)</label>
              <input type="password" id="setup-password2" class="input" autocomplete="new-password">
              <div id="setup-errors" class="form-errors"></div>
              <button class="btn btn-primary btn-block" id="setup-submit" style="margin-top:12px;">Kurulumu Tamamla</button>
            </div>
          </div>
        </div>
      `;
    }
    return `
      <div class="page">
        <div class="page-content" style="padding-top:80px;">
          <div class="card">
            <div class="card-title">Giriş Yap</div>
            <label class="field-label">Kullanıcı Adı</label>
            <input type="text" id="login-username" class="input" autocomplete="username">
            <label class="field-label">Şifre</label>
            <input type="password" id="login-password" class="input" autocomplete="current-password">
            <div id="login-errors" class="form-errors"></div>
            <button class="btn btn-primary btn-block" id="login-submit" style="margin-top:12px;">Giriş Yap</button>
            <button class="btn btn-secondary btn-block" id="login-forgot" style="margin-top:8px;">Şifremi Unuttum</button>
          </div>
        </div>
      </div>
    `;
  },

  mount(onSuccess) {
    if (!Auth.isSetup()) {
      document.getElementById('setup-submit').onclick = async () => {
        const username = document.getElementById('setup-username').value;
        const p1 = document.getElementById('setup-password').value;
        const p2 = document.getElementById('setup-password2').value;
        const errBox = document.getElementById('setup-errors');
        if (p1 !== p2) { errBox.textContent = 'Şifreler aynı değil.'; return; }
        const result = await Auth.setup(username, p1);
        if (!result.ok) { errBox.textContent = result.error; return; }
        onSuccess();
      };
      return;
    }

    document.getElementById('login-submit').onclick = async () => {
      const username = document.getElementById('login-username').value;
      const password = document.getElementById('login-password').value;
      const errBox = document.getElementById('login-errors');
      const ok = await Auth.verify(username, password);
      if (!ok) { errBox.textContent = 'Kullanıcı adı veya şifre yanlış.'; return; }
      Auth.unlock();
      onSuccess();
    };

    document.getElementById('login-forgot').onclick = async () => {
      const ok1 = await Confirm.ask(
        'Şifre kurtarma yöntemi yoktur. Devam edersen bu telefondaki TÜM öğrenci verisi silinecek ve baştan kurulum yapman gerekecek. Daha sonra bir JSON yedeğin varsa geri yükleyebilirsin.',
        { danger: true, confirmText: 'Devam Et' }
      );
      if (!ok1) return;
      const ok2 = await Confirm.ask('Bu işlem GERİ ALINAMAZ. Gerçekten tüm veriyi sıfırlamak istiyor musun?', { danger: true, confirmText: 'Evet, Sıfırla' });
      if (!ok2) return;
      await Auth.resetEverything();
      location.reload();
    };
  },
};
