import type { MessageGroup } from "../types";

/** Console sign-in / sign-up (`app/auth/page.tsx`) and account settings. */
export const auth = {
  "auth.title.login": { "en-US": "Sign in to the console", "fa-IR": "ورود به کنسول" },
  "auth.title.signup": { "en-US": "Create your account", "fa-IR": "ساخت حساب کاربری" },
  "auth.subtitle.login": {
    "en-US": "Back to your projects, databases and deploy pipelines.",
    "fa-IR": "برگرد به پروژه‌ها، پایگاه‌داده‌ها و خط دیپلوی‌ات.",
  },
  "auth.subtitle.signup": {
    "en-US": "One account hosts every project. No card, no backend code.",
    "fa-IR": "یک حساب، میزبان همهٔ پروژه‌ها. بدون کارت بانکی، بدون کد بک‌اند.",
  },
  "auth.captcha.label": { "en-US": "Captcha", "fa-IR": "کپچا" },
  "auth.captcha.placeholder": { "en-US": "Answer", "fa-IR": "پاسخ" },
  "auth.password.hint": { "en-US": "At least 8 characters.", "fa-IR": "دست‌کم ۸ نویسه." },
  "auth.submit.login": { "en-US": "Sign in", "fa-IR": "ورود" },
  "auth.submit.signup": { "en-US": "Create account", "fa-IR": "ساخت حساب" },
  "auth.submit.working": { "en-US": "Working…", "fa-IR": "در حال انجام…" },
  "auth.switch.haveAccount": {
    "en-US": "Already have an account?",
    "fa-IR": "قبلاً حساب ساخته‌ای؟",
  },
  "auth.switch.newHere": { "en-US": "New here?", "fa-IR": "تازه این‌جا آمده‌ای؟" },
  "auth.switch.create": { "en-US": "Create an account", "fa-IR": "ساخت حساب کاربری" },
  "auth.toast.welcome": { "en-US": "Welcome to LocalMe", "fa-IR": "به لوکال می خوش آمدی" },
  "auth.toast.welcomeBack": { "en-US": "Welcome back", "fa-IR": "خوش برگشتی" },
  "auth.toast.failed": { "en-US": "Sign in failed.", "fa-IR": "ورود ناموفق بود." },
  "auth.visitorNote": {
    "en-US":
      "Looking for a hosted project's login? Visit /your-project/… — visitor accounts are per project.",
    "fa-IR":
      "دنبال صفحهٔ ورود یک پروژهٔ میزبانی‌شده هستی؟ به ‎/your-project/… برو — حساب بازدیدکننده برای هر پروژه جداست.",
  },

  // ------------------------------------------------------------- account
  "account.title": { "en-US": "Account", "fa-IR": "حساب کاربری" },
  "account.eyebrow": { "en-US": "Console", "fa-IR": "کنسول" },
  "account.description": {
    "en-US": "Manage your profile, resource limits and master API key.",
    "fa-IR": "مدیریت نمایه، سقف منابع و کلید اصلی API شما.",
  },
  "account.backToDashboard": { "en-US": "Dashboard", "fa-IR": "پیشخوان" },
  "account.signedInAs": { "en-US": "Signed-in account", "fa-IR": "حساب واردشده" },
  "account.cardDescription": {
    "en-US":
      "Changing your password keeps existing sessions alive (they slide on activity).",
    "fa-IR":
      "با تغییر رمز عبور، نشست‌های فعال باقی میمانند (با هر فعالیت تمدید میشوند).",
  },
  "account.currentPassword": { "en-US": "Current password", "fa-IR": "رمز عبور فعلی" },
  "account.newPassword": { "en-US": "New password", "fa-IR": "رمز عبور جدید" },
  "account.keepBlank": { "en-US": "Leave blank to keep", "fa-IR": "برای عدم تغییر، خالی بگذارید" },
  "account.toast.updated": { "en-US": "Account updated", "fa-IR": "حساب به‌روزرسانی شد" },
  "account.toast.failed": { "en-US": "Update failed.", "fa-IR": "به‌روزرسانی ناموفق بود." },

  // limits & quota
  "account.limits.title": { "en-US": "Resource Limits", "fa-IR": "سقف منابع و سهمیه‌ها" },
  "account.limits.description": {
    "en-US": "Your plan's project and storage allowances.",
    "fa-IR": "سهمیه تعداد پروژه و فضای ذخیره‌سازی سطح کاربری شما.",
  },
  "account.limits.projects": { "en-US": "Projects", "fa-IR": "پروژه‌ها" },
  "account.limits.projectSize": { "en-US": "Per-project cap", "fa-IR": "سقف حجم هر پروژه" },
  "account.limits.totalStorage": { "en-US": "Total storage", "fa-IR": "کل فضای ذخیره‌سازی" },
  "account.limits.used": { "en-US": "{used} of {total}", "fa-IR": "{used} از {total}" },

  // master API key
  "account.apiKey.title": { "en-US": "Master API Key", "fa-IR": "کلید اصلی API" },
  "account.apiKey.description": {
    "en-US": "User-level key that grants full access across all your projects.",
    "fa-IR": "کلید سطح کاربری با دسترسی کامل به همه پروژه‌های شما.",
  },
  "account.apiKey.reveal": { "en-US": "Reveal", "fa-IR": "نمایش" },
  "account.apiKey.hide": { "en-US": "Hide", "fa-IR": "مخفی‌سازی" },
  "account.apiKey.copy": { "en-US": "Copy", "fa-IR": "کپی" },
  "account.apiKey.copied": { "en-US": "Master API key copied", "fa-IR": "کلید اصلی کپی شد" },
  "account.apiKey.regenerate": { "en-US": "Regenerate key", "fa-IR": "تولید مجدد کلید" },
  "account.apiKey.regenerateConfirmTitle": {
    "en-US": "Regenerate Master API Key?",
    "fa-IR": "تولید مجدد کلید اصلی API؟",
  },
  "account.apiKey.regenerateConfirmDescription": {
    "en-US":
      "The current key will immediately stop working. Any scripts or integrations using it will fail.",
    "fa-IR":
      "کلید فعلی بلافاصله از کار خواهد افتاد. اسکریپت‌ها یا سرویس‌هایی که از آن استفاده میکنند با خطا مواجه میشوند.",
  },
  "account.apiKey.regenerated": {
    "en-US": "Master API key regenerated",
    "fa-IR": "کلید اصلی با موفقیت بازتولید شد",
  },
  "account.apiKey.prefix": { "en-US": "Prefix", "fa-IR": "پیشوند" },
  "account.apiKey.created": { "en-US": "Created", "fa-IR": "تاریخ ساخت" },
  "account.apiKey.lastUsed": { "en-US": "Last used", "fa-IR": "آخرین استفاده" },
  "account.apiKey.neverUsed": { "en-US": "Never", "fa-IR": "هرگز" },

  // ---------------------------------------------------------- impersonate
  "impersonation.bodyPrefix": {
    "en-US": "Signed in as",
    "fa-IR": "با حساب",
  },
  "impersonation.bodySuffix": {
    "en-US": "— everything you do here happens as them.",
    "fa-IR": "وارد شده‌ای — هر کاری که این‌جا انجام دهی به نام او انجام میشود.",
  },
  "impersonation.return": { "en-US": "Return to my account", "fa-IR": "بازگشت به حساب خودم" },
  "impersonation.returning": { "en-US": "Returning…", "fa-IR": "در حال بازگشت…" },
  "impersonation.failed": {
    "en-US": "Could not end the impersonation session.",
    "fa-IR": "نشست جای‌گزینی بسته نشد.",
  },
} satisfies MessageGroup;