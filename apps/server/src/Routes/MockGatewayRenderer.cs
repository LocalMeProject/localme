namespace LocalMe.Server.Routes;

using LocalMe.DataPlane.Finance;

public static class MockGatewayRenderer
{
    public static string RenderNotFoundHtml()
    {
        return """
                <!DOCTYPE html>
                <html lang="fa" dir="rtl">
                <head>
                  <meta charset="utf-8">
                  <title>خطا در درگاه پرداخت شاپرک</title>
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <link rel="stylesheet" href="/styles.css">
                </head>
                <body style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #0f172a; font-family: 'Vazirmatn', sans-serif;">
                  <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 32px; max-width: 440px; text-align: center; color: #f8fafc;">
                    <div style="font-size: 32px; font-weight: bold; color: #f87171; margin-bottom: 12px;">!</div>
                    <h2 style="font-size: 18px; margin-bottom: 8px; color: #f87171;">شناسه پرداخت شاپرک یافت نشد</h2>
                    <p style="font-size: 13px; color: #94a3b8; line-height: 1.6; margin-bottom: 20px;">توکن ارجاع بانکی نامعتبر است یا منقضی گردیده است.</p>
                    <a href="/panel" style="display: inline-block; padding: 10px 20px; background: #10b981; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 700;">بازگشت به پنل توسعه‌دهنده</a>
                  </div>
                </body>
                </html>
        """;
    }

    public static string RenderGatewayHtml(StoredPayment payment, string pspName, string toman, string callbackUrl)
    {
        return $$"""
            <!DOCTYPE html>
            <html lang="fa" dir="rtl">
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>درگاه پرداخت شاپرک - {{pspName}}</title>
              <link rel="stylesheet" href="/styles.css">
              <style>
                body {
                  margin: 0;
                  padding: 24px;
                  background: #090d16;
                  color: #f1f5f9;
                  font-family: 'Vazirmatn', system-ui, sans-serif;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  min-height: 100vh;
                  box-sizing: border-box;
                }
                .shaparak-box {
                  background: #111827;
                  border: 1px solid #1f2937;
                  border-radius: 16px;
                  max-width: 500px;
                  width: 100%;
                  box-shadow: 0 20px 40px rgba(0,0,0,0.6);
                  overflow: hidden;
                }
                .shaparak-header {
                  background: linear-gradient(135deg, #064e3b 0%, #065f46 100%);
                  padding: 20px 24px;
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  border-bottom: 2px solid #10b981;
                }
                .shaparak-title {
                  font-size: 15px;
                  font-weight: 800;
                  color: #ecfdf5;
                }
                .shaparak-sub {
                  font-size: 11.5px;
                  color: #a7f3d0;
                  margin-top: 2px;
                }
                .timer-badge {
                  background: rgba(0,0,0,0.3);
                  padding: 6px 12px;
                  border-radius: 20px;
                  font-family: 'Vazirmatn', sans-serif;
                  font-size: 14px;
                  font-weight: 700;
                  color: #fef08a;
                  border: 1px solid rgba(254, 240, 138, 0.3);
                }
                .content-body {
                  padding: 24px;
                }
                .info-row {
                  display: flex;
                  justify-content: space-between;
                  padding: 8px 0;
                  border-bottom: 1px dashed #1f2937;
                  font-size: 12.5px;
                }
                .info-label { color: #9ca3af; }
                .info-val { font-weight: 700; color: #f9fafb; font-family: 'Vazirmatn', sans-serif; }
                .amount-highlight {
                  background: rgba(16, 185, 129, 0.1);
                  border: 1px solid rgba(16, 185, 129, 0.3);
                  border-radius: 10px;
                  padding: 12px 16px;
                  margin: 16px 0;
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                }
                .form-group {
                  margin-bottom: 14px;
                }
                .form-label {
                  display: block;
                  font-size: 12px;
                  font-weight: 600;
                  color: #d1d5db;
                  margin-bottom: 6px;
                }
                .card-inputs {
                  display: flex;
                  gap: 8px;
                  direction: ltr;
                }
                .card-part {
                  flex: 1;
                  text-align: center;
                  font-family: 'Vazirmatn', sans-serif;
                  font-size: 16px;
                  letter-spacing: 2px;
                  background: #1f2937;
                  border: 1px solid #374151;
                  color: #fff;
                  border-radius: 8px;
                  padding: 10px 4px;
                  outline: none;
                }
                .card-part:focus { border-color: #10b981; box-shadow: 0 0 0 2px rgba(16,185,129,0.2); }
                .grid-2 {
                  display: grid;
                  grid-template-columns: 1fr 1fr;
                  gap: 12px;
                }
                .input-field {
                  width: 100%;
                  background: #1f2937;
                  border: 1px solid #374151;
                  color: #fff;
                  border-radius: 8px;
                  padding: 10px 12px;
                  font-family: 'Vazirmatn', sans-serif;
                  font-size: 13px;
                  box-sizing: border-box;
                  outline: none;
                }
                .input-field:focus { border-color: #10b981; }
                .otp-row {
                  display: flex;
                  gap: 8px;
                }
                .btn-otp {
                  background: #374151;
                  color: #ecfdf5;
                  border: 1px solid #4b5563;
                  border-radius: 8px;
                  font-size: 11.5px;
                  padding: 0 14px;
                  font-weight: 700;
                  cursor: pointer;
                  white-space: nowrap;
                  transition: background 0.15s;
                }
                .btn-otp:hover { background: #4b5563; }
                .toast-otp {
                  display: none;
                  background: #064e3b;
                  border: 1px solid #10b981;
                  color: #ecfdf5;
                  padding: 8px 12px;
                  border-radius: 6px;
                  font-size: 11.5px;
                  margin-top: 6px;
                }
                .btn-pay {
                  width: 100%;
                  background: #10b981;
                  color: #022c22;
                  font-weight: 800;
                  font-size: 14.5px;
                  padding: 12px;
                  border-radius: 8px;
                  border: none;
                  cursor: pointer;
                  margin-top: 12px;
                  transition: opacity 0.15s;
                }
                .btn-pay:hover { opacity: 0.9; }
                .btn-cancel {
                  width: 100%;
                  background: transparent;
                  color: #9ca3af;
                  font-size: 12.5px;
                  padding: 10px;
                  border: 1px solid #374151;
                  border-radius: 8px;
                  margin-top: 8px;
                  cursor: pointer;
                  transition: color 0.15s;
                }
                .btn-cancel:hover { color: #f87171; border-color: #f87171; }
              </style>
            </head>
            <body>
              <div class="shaparak-box">
                <div class="shaparak-header">
                  <div>
                    <div class="shaparak-title">{{pspName}}</div>
                    <div class="shaparak-sub">سامانه هوشمند تبادل الکترونیکی شاپرک</div>
                  </div>
                  <div class="timer-badge" id="countdown">۰۲:۰۰</div>
                </div>
                <div class="content-body">
                  <div class="info-row">
                    <span class="info-label">پذیرنده اینترنتی:</span>
                    <span class="info-val">LocalMe Sovereign Platform</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">توکن ارجاع:</span>
                    <span class="info-val">{{payment.AuthorityToken}}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">شماره همراه متقاضی:</span>
                    <span class="info-val">{{payment.CustomerPhone}}</span>
                  </div>

                  <div class="amount-highlight">
                    <span style="font-size: 12px; color: #a7f3d0;">مبلغ پرداختی نهایی:</span>
                    <span style="font-size: 16px; font-weight: 800; color: #10b981;">{{toman}}</span>
                  </div>

                  <form method="POST" action="/_baas/v1/pay/mock-gateway/action">
                    <input type="hidden" name="authority" value="{{payment.AuthorityToken}}">
                    <input type="hidden" name="action" id="form-action" value="pay">

                    <div class="form-group">
                      <label class="form-label">شماره کارت بانکی ۱۶ رقمی:</label>
                      <div class="card-inputs">
                        <input type="text" class="card-part" maxlength="4" value="۶۰۳۷" required>
                        <input type="text" class="card-part" maxlength="4" value="۹۹۷۵" required>
                        <input type="text" class="card-part" maxlength="4" value="۳۸۱۴" required>
                        <input type="text" class="card-part" maxlength="4" value="۹۰۲۱" required>
                      </div>
                    </div>

                    <div class="grid-2">
                      <div class="form-group">
                        <label class="form-label">کد شناسایی دوم:</label>
                        <input type="password" class="input-field" maxlength="4" value="382" required placeholder="***">
                      </div>
                      <div class="form-group">
                        <label class="form-label">انقضا (ماه / سال):</label>
                        <div style="display: flex; gap: 4px; direction: ltr;">
                          <input type="text" class="input-field" style="text-align: center;" maxlength="2" value="08" placeholder="MM">
                          <input type="text" class="input-field" style="text-align: center;" maxlength="2" value="06" placeholder="YY">
                        </div>
                      </div>
                    </div>

                    <div class="form-group">
                      <label class="form-label">رمز دوم پویا:</label>
                      <div class="otp-row">
                        <input type="password" class="input-field" id="otp-input" maxlength="8" value="749102" required placeholder="رمز پیامک شده">
                        <button type="button" class="btn-otp" id="btn-request-otp">دریافت رمز پویا</button>
                      </div>
                      <div class="toast-otp" id="toast-otp">
                        رمز پویای یکبارمصرف ۷۴۹۱۰۲ برای شماره {{payment.CustomerPhone}} ارسال شد.
                      </div>
                    </div>

                    <button type="submit" class="btn-pay" onclick="document.getElementById('form-action').value='pay';">
                      پرداخت و تکمیل تراکنش
                    </button>
                    <button type="submit" class="btn-cancel" onclick="document.getElementById('form-action').value='cancel';">
                      انصراف و بازگشت به پذیرنده
                    </button>
                  </form>
                </div>
              </div>

              <script>
                let sec = 120;
                const timerEl = document.getElementById('countdown');
                const interval = setInterval(() => {
                  sec--;
                  if (sec <= 0) {
                    clearInterval(interval);
                    timerEl.textContent = 'منقضی شد';
                  } else {
                    const m = String(Math.floor(sec / 60)).padStart(2, '0');
                    const s = String(sec % 60).padStart(2, '0');
                    timerEl.textContent = m + ':' + s;
                  }
                }, 1000);

                const btnOtp = document.getElementById('btn-request-otp');
                const toastOtp = document.getElementById('toast-otp');
                if (btnOtp && toastOtp) {
                  btnOtp.addEventListener('click', () => {
                    toastOtp.style.display = 'block';
                    btnOtp.disabled = true;
                    btnOtp.textContent = 'ارسال شد (۶۰s)';
                  });
                }
              </script>
            </body>
            </html>
        """;
    }
}
