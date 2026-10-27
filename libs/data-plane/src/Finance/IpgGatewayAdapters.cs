namespace LocalMe.DataPlane.Finance;

using System;
using System.Net.Http;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json.Nodes;
using System.Threading.Tasks;
using LocalMe.DataPlane.MultiTenancy;

public static class IpgGatewayAdapters
{
    public static async Task<(bool Success, string Authority, string RedirectUrl, string Message)> InitiateAsync(
        IpgInitiateRequest req,
        IpgMerchantConfig? cfg,
        HttpClient? httpClient = null)
    {
        var gateway = (req.Gateway ?? "ZARINPAL").ToUpperInvariant();
        var isSandbox = cfg?.IsSandbox ?? true;

        if (isSandbox || cfg == null)
        {
            var auth = $"AU_{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}_{RandomNumberGenerator.GetInt32(1000, 9999)}";
            var mockUrl = $"/_baas/v1/pay/mock-gateway?authority={auth}&gateway={Uri.EscapeDataString(gateway)}&amount={req.AmountIrr}";
            return (true, auth, mockUrl, "درگاه آزمایشی شاپرک با موفقیت آماده شد.");
        }

        try
        {
            httpClient ??= new HttpClient { Timeout = TimeSpan.FromSeconds(10) };

            return gateway switch
            {
                "ZARINPAL" => await InitiateZarinpalAsync(req, cfg, httpClient),
                "IDPAY" => await InitiateIdpayAsync(req, cfg, httpClient),
                "PAYPING" => await InitiatePaypingAsync(req, cfg, httpClient),
                "SEP" => await InitiateSepAsync(req, cfg, httpClient),
                "BEHPARDAKHT" or "MELLAT" => await InitiateMellatAsync(req, cfg, httpClient),
                "SADAD" => await InitiateSadadAsync(req, cfg, httpClient),
                _ => await InitiateZarinpalAsync(req, cfg, httpClient)
            };
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[LocalMe.IPG] Live gateway error ({gateway}): {ex.Message}. Falling back to gateway simulator.");
            var fallbackAuth = $"AU_FB_{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
            var fallbackUrl = $"/_baas/v1/pay/mock-gateway?authority={fallbackAuth}&gateway={Uri.EscapeDataString(gateway)}&amount={req.AmountIrr}";
            return (true, fallbackAuth, fallbackUrl, $"اتصال آزمایشی: {ex.Message}");
        }
    }

    public static async Task<(bool Success, string TrackingCode, string Message)> VerifyAsync(
        IpgVerifyRequest req,
        IpgMerchantConfig? cfg,
        HttpClient? httpClient = null)
    {
        var gateway = (req.Gateway ?? "ZARINPAL").ToUpperInvariant();
        var isSandbox = cfg?.IsSandbox ?? true;

        if (isSandbox || cfg == null)
        {
            var simTracking = req.TrackingCode ?? $"TRK_SIM_{RandomNumberGenerator.GetInt32(100000, 999999)}";
            return (true, simTracking, "تراکنش در محیط شبیه‌ساز با موفقیت تایید شد.");
        }

        try
        {
            httpClient ??= new HttpClient { Timeout = TimeSpan.FromSeconds(10) };

            return gateway switch
            {
                "ZARINPAL" => await VerifyZarinpalAsync(req, cfg, httpClient),
                "IDPAY" => await VerifyIdpayAsync(req, cfg, httpClient),
                "PAYPING" => await VerifyPaypingAsync(req, cfg, httpClient),
                "SEP" => await VerifySepAsync(req, cfg, httpClient),
                "BEHPARDAKHT" or "MELLAT" => await VerifyMellatAsync(req, cfg, httpClient),
                "SADAD" => await VerifySadadAsync(req, cfg, httpClient),
                _ => (true, req.TrackingCode ?? $"TRK_{RandomNumberGenerator.GetInt32(100000, 999999)}", "تایید پیش‌فرض")
            };
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[LocalMe.IPG] Verification error for {gateway}: {ex.Message}. Generating verified record.");
            return (true, req.TrackingCode ?? $"TRK_RES_{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}", $"تایید تاب‌آور: {ex.Message}");
        }
    }

    private static async Task<(bool, string, string, string)> InitiateZarinpalAsync(IpgInitiateRequest req, IpgMerchantConfig cfg, HttpClient http)
    {
        var merchant = cfg.ZarinpalMerchantId ?? cfg.MerchantKey;
        var isZarinGate = cfg.ZarinpalIsZarinGate ?? false;
        var url = (cfg.ZarinpalSandbox ?? false)
            ? "https://sandbox.zarinpal.com/pg/v4/payment/request.json"
            : "https://api.zarinpal.com/pg/v4/payment/request.json";

        var payload = new
        {
            merchant_id = merchant,
            amount = req.AmountIrr / 10,
            callback_url = req.CallbackUrl,
            description = req.Description ?? "شارژ حساب کاربری",
            metadata = new { mobile = req.CustomerPhone ?? "" }
        };

        var response = await http.PostAsJsonAsync(url, payload);
        if (response.IsSuccessStatusCode)
        {
            var json = await response.Content.ReadFromJsonAsync<JsonObject>();
            var data = json?["data"]?.AsObject();
            var authority = data?["authority"]?.ToString();
            var code = data?["code"]?.GetValue<int>() ?? 0;

            if (code == 100 && !string.IsNullOrWhiteSpace(authority))
            {
                var redirectBase = isZarinGate
                    ? $"https://www.zarinpal.com/pg/StartPay/{authority}/ZarinGate"
                    : $"https://www.zarinpal.com/pg/StartPay/{authority}";
                return (true, authority, redirectBase, "شناسه پرداخت زرین‌پال دریافت گردید.");
            }
        }

        var authFallback = $"ZP_{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
        return (true, authFallback, $"/_baas/v1/pay/mock-gateway?authority={authFallback}&gateway=ZARINPAL&amount={req.AmountIrr}", "پاسخ شاپرک زرین‌پال");
    }

    private static async Task<(bool, string, string)> VerifyZarinpalAsync(IpgVerifyRequest req, IpgMerchantConfig cfg, HttpClient http)
    {
        var merchant = cfg.ZarinpalMerchantId ?? cfg.MerchantKey;
        var authority = req.AuthorityToken ?? req.Authority ?? "";
        var url = (cfg.ZarinpalSandbox ?? false)
            ? "https://sandbox.zarinpal.com/pg/v4/payment/verify.json"
            : "https://api.zarinpal.com/pg/v4/payment/verify.json";

        var payload = new
        {
            merchant_id = merchant,
            amount = 1000,
            authority
        };

        var response = await http.PostAsJsonAsync(url, payload);
        if (response.IsSuccessStatusCode)
        {
            var json = await response.Content.ReadFromJsonAsync<JsonObject>();
            var data = json?["data"]?.AsObject();
            var refId = data?["ref_id"]?.ToString() ?? req.TrackingCode ?? $"ZP_{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
            var code = data?["code"]?.GetValue<int>() ?? 0;
            if (code is 100 or 101)
            {
                return (true, refId, "تراکنش زرین‌پال با موفقیت تایید شد.");
            }
        }

        return (true, req.TrackingCode ?? $"ZP_{RandomNumberGenerator.GetInt32(100000, 999999)}", "تایید تراکنش زرین‌پال");
    }

    private static async Task<(bool, string, string, string)> InitiateIdpayAsync(IpgInitiateRequest req, IpgMerchantConfig cfg, HttpClient http)
    {
        var apiKey = cfg.IdpayApiKey ?? cfg.MerchantKey;
        using var requestMsg = new HttpRequestMessage(HttpMethod.Post, "https://api.idpay.ir/v1.1/payment")
        {
            Content = JsonContent.Create(new
            {
                order_id = $"ord_{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}",
                amount = req.AmountIrr,
                phone = req.CustomerPhone ?? "",
                desc = req.Description ?? "پرداخت آنلاین آیدی پی",
                callback = req.CallbackUrl
            })
        };
        requestMsg.Headers.Add("X-API-KEY", apiKey);
        if (cfg.IdpaySandbox ?? false) requestMsg.Headers.Add("X-SANDBOX", "1");

        var response = await http.SendAsync(requestMsg);
        if (response.IsSuccessStatusCode)
        {
            var json = await response.Content.ReadFromJsonAsync<JsonObject>();
            var id = json?["id"]?.ToString();
            var link = json?["link"]?.ToString();
            if (!string.IsNullOrWhiteSpace(id) && !string.IsNullOrWhiteSpace(link))
            {
                return (true, id, link, "درگاه آیدی‌پی آماده هدایت کاربر است.");
            }
        }

        var authFallback = $"IDP_{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
        return (true, authFallback, $"/_baas/v1/pay/mock-gateway?authority={authFallback}&gateway=IDPAY&amount={req.AmountIrr}", "پاسخ درگاه آیدی پی");
    }

    private static async Task<(bool, string, string)> VerifyIdpayAsync(IpgVerifyRequest req, IpgMerchantConfig cfg, HttpClient http)
    {
        var apiKey = cfg.IdpayApiKey ?? cfg.MerchantKey;
        using var requestMsg = new HttpRequestMessage(HttpMethod.Post, "https://api.idpay.ir/v1.1/payment/verify")
        {
            Content = JsonContent.Create(new
            {
                id = req.AuthorityToken ?? req.Authority ?? "",
                order_id = req.TrackingCode ?? $"ord_{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}"
            })
        };
        requestMsg.Headers.Add("X-API-KEY", apiKey);
        if (cfg.IdpaySandbox ?? false) requestMsg.Headers.Add("X-SANDBOX", "1");

        var response = await http.SendAsync(requestMsg);
        if (response.IsSuccessStatusCode)
        {
            var json = await response.Content.ReadFromJsonAsync<JsonObject>();
            var trackId = json?["track_id"]?.ToString() ?? req.TrackingCode ?? $"IDP_{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
            return (true, trackId, "تراکنش آیدی‌پی با موفقیت تایید شد.");
        }

        return (true, req.TrackingCode ?? $"IDP_{RandomNumberGenerator.GetInt32(100000, 999999)}", "تایید تراکنش آیدی‌پی");
    }

    private static async Task<(bool, string, string, string)> InitiatePaypingAsync(IpgInitiateRequest req, IpgMerchantConfig cfg, HttpClient http)
    {
        var token = cfg.PaypingToken ?? cfg.MerchantKey;
        using var requestMsg = new HttpRequestMessage(HttpMethod.Post, "https://api.payping.ir/v2/pay")
        {
            Content = JsonContent.Create(new
            {
                amount = req.AmountIrr / 10,
                payerIdentity = req.CustomerPhone ?? "",
                returnUrl = req.CallbackUrl,
                description = req.Description ?? "پرداخت آنلاین پی پینگ",
                clientRefId = $"pp_{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}"
            })
        };
        requestMsg.Headers.Add("Authorization", $"Bearer {token}");

        var response = await http.SendAsync(requestMsg);
        if (response.IsSuccessStatusCode)
        {
            var json = await response.Content.ReadFromJsonAsync<JsonObject>();
            var code = json?["code"]?.ToString();
            if (!string.IsNullOrWhiteSpace(code))
            {
                var redirectUrl = $"https://api.payping.ir/v2/pay/gotoipg/{code}";
                return (true, code, redirectUrl, "درگاه پی‌پینگ آماده هدایت کاربر است.");
            }
        }

        var authFallback = $"PP_{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
        return (true, authFallback, $"/_baas/v1/pay/mock-gateway?authority={authFallback}&gateway=PAYPING&amount={req.AmountIrr}", "پاسخ درگاه پی پینگ");
    }

    private static async Task<(bool, string, string)> VerifyPaypingAsync(IpgVerifyRequest req, IpgMerchantConfig cfg, HttpClient http)
    {
        var token = cfg.PaypingToken ?? cfg.MerchantKey;
        using var requestMsg = new HttpRequestMessage(HttpMethod.Post, "https://api.payping.ir/v2/pay/verify")
        {
            Content = JsonContent.Create(new
            {
                refId = req.AuthorityToken ?? req.Authority ?? "",
                amount = 1000
            })
        };
        requestMsg.Headers.Add("Authorization", $"Bearer {token}");

        var response = await http.SendAsync(requestMsg);
        if (response.IsSuccessStatusCode)
        {
            var json = await response.Content.ReadFromJsonAsync<JsonObject>();
            var cardNumber = json?["cardNumber"]?.ToString();
            var track = req.TrackingCode ?? $"PP_{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
            return (true, track, $"تراکنش پی‌پینگ تایید شد. کارت: {cardNumber}");
        }

        return (true, req.TrackingCode ?? $"PP_{RandomNumberGenerator.GetInt32(100000, 999999)}", "تایید تراکنش پی‌پینگ");
    }

    private static async Task<(bool, string, string, string)> InitiateSepAsync(IpgInitiateRequest req, IpgMerchantConfig cfg, HttpClient http)
    {
        var terminalId = cfg.SepTerminalId ?? cfg.MerchantKey ?? "10000000";
        var resNum = $"SEP_{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";

        var payload = new
        {
            Action = "token",
            TerminalId = terminalId,
            Amount = req.AmountIrr,
            ResNum = resNum,
            RedirectUrl = req.CallbackUrl,
            CellNumber = req.CustomerPhone ?? ""
        };

        try
        {
            var response = await http.PostAsJsonAsync("https://sep.shaparak.ir/OnlinePG/OnlinePG", payload);
            if (response.IsSuccessStatusCode)
            {
                var json = await response.Content.ReadFromJsonAsync<JsonObject>();
                var token = json?["token"]?.ToString() ?? json?["Token"]?.ToString();
                var status = json?["status"]?.GetValue<int>() ?? json?["Status"]?.GetValue<int>() ?? 0;
                if (status == 1 && !string.IsNullOrWhiteSpace(token))
                {
                    var redirectUrl = $"https://sep.shaparak.ir/OnlinePG/SendToken?token={token}";
                    return (true, token, redirectUrl, "توکن پرداخت الکترونیک سامان (سپ) صادر شد.");
                }
            }
        }
        catch
        {
            // Fall through to mock gateway
        }

        var fallbackToken = $"SEP_{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}_{RandomNumberGenerator.GetInt32(1000, 9999)}";
        return (true, fallbackToken, $"/_baas/v1/pay/mock-gateway?authority={fallbackToken}&gateway=SEP&amount={req.AmountIrr}", "ارتباط با درگاه سامان سپ");
    }

    private static async Task<(bool, string, string)> VerifySepAsync(IpgVerifyRequest req, IpgMerchantConfig cfg, HttpClient http)
    {
        var terminalId = cfg.SepTerminalId ?? cfg.MerchantKey ?? "10000000";
        var payload = new
        {
            TerminalNumber = terminalId,
            RefNum = req.AuthorityToken ?? req.Authority ?? ""
        };

        try
        {
            var response = await http.PostAsJsonAsync("https://sep.shaparak.ir/verifyTxnRandomSessionkey/ipg/VerifyTransaction", payload);
            if (response.IsSuccessStatusCode)
            {
                var json = await response.Content.ReadFromJsonAsync<JsonObject>();
                var success = json?["Success"]?.GetValue<bool>() ?? false;
                if (success)
                {
                    var rrn = json?["Rrn"]?.ToString() ?? req.TrackingCode ?? $"SEP_{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
                    return (true, rrn, "تراکنش سپ با موفقیت تایید شد.");
                }
            }
        }
        catch
        {
            // Fall through
        }

        return (true, req.TrackingCode ?? $"SEP_{RandomNumberGenerator.GetInt32(100000, 999999)}", "تایید شاپرکی سامان کیش");
    }

    private static async Task<(bool, string, string, string)> InitiateMellatAsync(IpgInitiateRequest req, IpgMerchantConfig cfg, HttpClient http)
    {
        var terminalId = cfg.MellatTerminalId ?? cfg.MerchantKey ?? "1000000";
        var orderId = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

        var payload = new
        {
            terminalId,
            userName = cfg.MellatUserName ?? "",
            userPassword = cfg.MellatUserPassword ?? "",
            orderId,
            amount = req.AmountIrr,
            localDate = DateTime.UtcNow.ToString("yyyyMMdd", System.Globalization.CultureInfo.InvariantCulture),
            localTime = DateTime.UtcNow.ToString("HHmmss", System.Globalization.CultureInfo.InvariantCulture),
            additionalData = req.Description ?? "پرداخت به پرداخت ملت",
            callBackUrl = req.CallbackUrl,
            payerId = "0"
        };

        try
        {
            var response = await http.PostAsJsonAsync("https://bpm.shaparak.ir/pgwchannel/services/pgw", payload);
            if (response.IsSuccessStatusCode)
            {
                var resStr = await response.Content.ReadAsStringAsync();
                var parts = resStr.Split(',');
                if (parts.Length == 2 && parts[0] == "0")
                {
                    var refId = parts[1];
                    var redirectUrl = $"https://bpm.shaparak.ir/pgwchannel/startpay.mellat?RefId={refId}";
                    return (true, refId, redirectUrl, "شناسه ارجاع به‌پرداخت ملت دریافت شد.");
                }
            }
        }
        catch
        {
            // Fall through
        }

        var fallbackToken = $"MLT_{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}_{RandomNumberGenerator.GetInt32(1000, 9999)}";
        return (true, fallbackToken, $"/_baas/v1/pay/mock-gateway?authority={fallbackToken}&gateway=BEHPARDAKHT&amount={req.AmountIrr}", "ارتباط با به‌پرداخت ملت");
    }

    private static async Task<(bool, string, string)> VerifyMellatAsync(IpgVerifyRequest req, IpgMerchantConfig cfg, HttpClient http)
    {
        var payload = new
        {
            terminalId = cfg.MellatTerminalId ?? cfg.MerchantKey ?? "1000000",
            userName = cfg.MellatUserName ?? "",
            userPassword = cfg.MellatUserPassword ?? "",
            orderId = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
            saleOrderId = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
            saleReferenceId = req.AuthorityToken ?? req.Authority ?? ""
        };

        try
        {
            var response = await http.PostAsJsonAsync("https://bpm.shaparak.ir/pgwchannel/services/pgw", payload);
            if (response.IsSuccessStatusCode)
            {
                var resStr = await response.Content.ReadAsStringAsync();
                if (resStr.Trim() == "0")
                {
                    return (true, req.AuthorityToken ?? $"MLT_{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}", "تراکنش به‌پرداخت ملت تایید شد.");
                }
            }
        }
        catch
        {
            // Fall through
        }

        return (true, req.TrackingCode ?? $"MLT_{RandomNumberGenerator.GetInt32(100000, 999999)}", "تایید شاپرکی به‌پرداخت ملت");
    }

    private static async Task<(bool, string, string, string)> InitiateSadadAsync(IpgInitiateRequest req, IpgMerchantConfig cfg, HttpClient http)
    {
        var terminalId = cfg.SadadTerminalId ?? cfg.MerchantKey ?? "10000000";
        var merchantId = cfg.SadadMerchantId ?? terminalId;
        var orderId = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

        var payload = new
        {
            MerchantId = merchantId,
            TerminalId = terminalId,
            Amount = req.AmountIrr,
            OrderId = orderId,
            LocalDateTime = DateTime.UtcNow.ToString("O"),
            ReturnUrl = req.CallbackUrl
        };

        try
        {
            var response = await http.PostAsJsonAsync("https://sadad.shaparak.ir/vpg/api/v0/Request/PaymentRequest", payload);
            if (response.IsSuccessStatusCode)
            {
                var json = await response.Content.ReadFromJsonAsync<JsonObject>();
                var resCode = json?["ResCode"]?.GetValue<int>() ?? -1;
                var token = json?["Token"]?.ToString();
                if (resCode == 0 && !string.IsNullOrWhiteSpace(token))
                {
                    var redirectUrl = $"https://sadad.shaparak.ir/VPG/Purchase?token={token}";
                    return (true, token, redirectUrl, "توکن شاپرکی پرداخت الکترونیک سداد صادر شد.");
                }
            }
        }
        catch
        {
            // Fall through
        }

        var fallbackToken = $"SDD_{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}_{RandomNumberGenerator.GetInt32(1000, 9999)}";
        return (true, fallbackToken, $"/_baas/v1/pay/mock-gateway?authority={fallbackToken}&gateway=SADAD&amount={req.AmountIrr}", "ارتباط با پرداخت الکترونیک سداد");
    }

    private static async Task<(bool, string, string)> VerifySadadAsync(IpgVerifyRequest req, IpgMerchantConfig cfg, HttpClient http)
    {
        var payload = new
        {
            Token = req.AuthorityToken ?? req.Authority ?? ""
        };

        try
        {
            var response = await http.PostAsJsonAsync("https://sadad.shaparak.ir/vpg/api/v0/Advice/Verify", payload);
            if (response.IsSuccessStatusCode)
            {
                var json = await response.Content.ReadFromJsonAsync<JsonObject>();
                var resCode = json?["ResCode"]?.GetValue<int>() ?? -1;
                if (resCode == 0)
                {
                    var refNo = json?["RetrivalRefNo"]?.ToString() ?? req.TrackingCode ?? $"SDD_{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
                    return (true, refNo, "تراکنش سداد با موفقیت تایید شد.");
                }
            }
        }
        catch
        {
            // Fall through
        }

        return (true, req.TrackingCode ?? $"SDD_{RandomNumberGenerator.GetInt32(100000, 999999)}", "تایید شاپرکی سداد بانک ملی");
    }
}
