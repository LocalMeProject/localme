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
    "en-US": "Password and email for your platform account.",
    "fa-IR": "رمز عبور و ایمیل حساب پلتفرم تو.",
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
  "account.keepBlank": { "en-US": "Leave blank to keep", "fa-IR": "خالی بگذار تا تغییر نکند" },
  "account.toast.updated": { "en-US": "Account updated", "fa-IR": "حساب به‌روزرسانی شد" },
  "account.toast.failed": { "en-US": "Update failed.", "fa-IR": "به‌روزرسانی ناموفق بود." },

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