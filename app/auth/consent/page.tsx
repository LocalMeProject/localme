"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { BrandMark } from "@/components/logo";
import { CultureSwitch } from "@/components/culture-switch";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import { apiGet, apiPost } from "@/app/console";
import { ShieldAlert, Bot, CheckCircle2, XCircle, Clock, KeyRound } from "lucide-react";

interface ConsentData {
  id: string;
  clientName: string;
  tokenName: string;
  description: string | null;
  requestedDuration: "4h" | "1d";
  status: "pending" | "approved" | "denied" | "expired";
  expiresAt: string;
  user: {
    id: number;
    username: string;
  };
}

export default function ConsentPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm text-neutral-500">Loading...</div>}>
      <ConsentForm />
    </Suspense>
  );
}

function ConsentForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isRtl } = useI18n();
  const requestId = searchParams.get("requestId");

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<ConsentData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState<"4h" | "1d">("4h");
  const [decision, setDecision] = useState<"approved" | "denied" | null>(null);

  useEffect(() => {
    if (!requestId) {
      setError(isRtl ? "شناسه درخواست مشخص نشده است." : "Missing request ID.");
      setLoading(false);
      return;
    }

    let isMounted = true;
    apiGet<ConsentData>(`/api/auth/consent?requestId=${encodeURIComponent(requestId)}`)
      .then((res) => {
        if (!isMounted) return;
        setData(res);
        setDuration(res.requestedDuration || "4h");
        if (res.status !== "pending") {
          setDecision(res.status === "approved" ? "approved" : "denied");
        }
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("401") || msg.includes("unauthorized") || msg.includes("Console session required")) {
          // Redirect unauthenticated users to login with returnTo
          router.replace(`/auth?returnTo=${encodeURIComponent(`/auth/consent?requestId=${requestId}`)}`);
          return;
        }
        setError(msg);
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [requestId, router, isRtl]);

  async function handleDecision(action: "approve" | "deny") {
    if (!requestId) return;
    setBusy(true);
    try {
      await apiPost("/api/auth/consent", {
        requestId,
        action,
        duration,
      });
      setDecision(action === "approve" ? "approved" : "denied");
      toast.success(
        action === "approve"
          ? (isRtl ? "دسترسی عامل با موفقیت تأیید شد." : "Agent access approved successfully.")
          : (isRtl ? "درخواست دسترسی رد شد." : "Consent request denied."),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex flex-col justify-between p-4 sm:p-6 text-neutral-900 dark:text-neutral-100">
      <header className="flex items-center justify-between max-w-xl mx-auto w-full">
        <BrandMark />
        <CultureSwitch />
      </header>

      <main className="max-w-md mx-auto w-full my-8">
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 sm:p-8 shadow-sm">
          {loading ? (
            <div className="py-12 text-center text-sm text-neutral-500">
              <Clock className="w-8 h-8 animate-spin mx-auto mb-3 opacity-60" />
              {isRtl ? "در حال دریافت اطلاعات درخواست..." : "Loading consent details..."}
            </div>
          ) : error ? (
            <div className="py-8 text-center space-y-4">
              <ShieldAlert className="w-12 h-12 text-red-500 mx-auto" />
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                {isRtl ? "خطا در درخواست" : "Request Error"}
              </h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">{error}</p>
              <Button variant="outline" onClick={() => router.push("/dashboard")}>
                {isRtl ? "بازگشت به پیشخوان" : "Back to Dashboard"}
              </Button>
            </div>
          ) : decision ? (
            <div className="py-8 text-center space-y-4">
              {decision === "approved" ? (
                <>
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                  <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                    {isRtl ? "دسترسی تأیید شد" : "Access Approved"}
                  </h2>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    {isRtl
                      ? `عامل "${data?.clientName}" اکنون دارای دسترسی کوتاه‌مدت به حساب شما است. می‌توانید این صفحه را ببندید.`
                      : `The agent "${data?.clientName}" now has ephemeral access to your account. You can safely close this window.`}
                  </p>
                </>
              ) : (
                <>
                  <XCircle className="w-12 h-12 text-red-500 mx-auto" />
                  <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                    {isRtl ? "درخواست رد شد" : "Request Denied"}
                  </h2>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    {isRtl
                      ? "درخواست اتصال عامل رد شد و هیچ کلیدی صادر نگردید."
                      : "The connection request was denied. No token was issued."}
                  </p>
                </>
              )}
              <div className="pt-4">
                <Button variant="outline" onClick={() => router.push("/account")}>
                  {isRtl ? "مدیریت دسترسی‌ها در حساب" : "Manage Access in Account"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-3">
                  <Bot className="w-6 h-6" />
                </div>
                <h1 className="text-xl font-bold tracking-tight">
                  {isRtl ? "مجوز اتصال عامل هوشمند" : "Authorize Agent Access"}
                </h1>
                <p className="text-xs text-neutral-500">
                  {isRtl
                    ? `یک عامل هوشمند درخواست دسترسی موقت به حساب کاربری ${data?.user.username} دارد.`
                    : `An autonomous agent is requesting ephemeral access to @${data?.user.username}.`}
                </p>
              </div>

              <div className="bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 space-y-3 text-sm">
                <div className="flex justify-between items-center py-1 border-b border-neutral-200 dark:border-neutral-800">
                  <span className="text-neutral-500 text-xs">{isRtl ? "نام عامل" : "Agent / Client"}</span>
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100">{data?.clientName}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-neutral-200 dark:border-neutral-800">
                  <span className="text-neutral-500 text-xs">{isRtl ? "عنوان کلید" : "Token Name"}</span>
                  <span className="font-mono text-xs">{data?.tokenName}</span>
                </div>
                {data?.description && (
                  <div className="py-1 border-b border-neutral-200 dark:border-neutral-800 text-xs">
                    <span className="text-neutral-500 block mb-1">{isRtl ? "توضیحات" : "Description"}</span>
                    <p className="text-neutral-700 dark:text-neutral-300">{data.description}</p>
                  </div>
                )}
                <div className="pt-2">
                  <label className="text-xs text-neutral-500 block mb-2 font-medium">
                    {isRtl ? "مدت زمان اعتبار کلید:" : "Granted Token Duration:"}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDuration("4h")}
                      className={`px-3 py-2 text-xs rounded-lg border font-medium transition ${
                        duration === "4h"
                          ? "bg-blue-600 text-white border-blue-600 dark:bg-blue-500"
                          : "bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                      }`}
                    >
                      {isRtl ? "۴ ساعت (پیش‌فرض)" : "4 Hours (Default)"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDuration("1d")}
                      className={`px-3 py-2 text-xs rounded-lg border font-medium transition ${
                        duration === "1d"
                          ? "bg-blue-600 text-white border-blue-600 dark:bg-blue-500"
                          : "bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                      }`}
                    >
                      {isRtl ? "۱ روز (۲۴ ساعت)" : "1 Day (24 Hours)"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-xl p-3 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <p>
                  {isRtl
                    ? "عامل با این کلید قادر به ایجاد، بروزرسانی و مدیریت پروژه‌ها و فایل‌ها به نمایندگی از شما خواهد بود. پس از پایان مهلت، کلید به طور خودکار باطل می‌شود."
                    : "The agent will be authorized to read and manage your projects during this period. The token permanently expires after the selected duration."}
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                  disabled={busy}
                  onClick={() => handleDecision("approve")}
                >
                  <KeyRound className="w-4 h-4 me-1.5" />
                  {isRtl ? "تأیید و اعطای دسترسی" : "Approve Access"}
                </Button>
                <Button
                  variant="outline"
                  className="text-red-600 dark:text-red-400 border-neutral-200 dark:border-neutral-800 hover:bg-red-50 dark:hover:bg-red-950/30"
                  disabled={busy}
                  onClick={() => handleDecision("deny")}
                >
                  {isRtl ? "رد درخواست" : "Deny"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="text-center text-xs text-neutral-400 py-4">
        LocalMe Platform &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
