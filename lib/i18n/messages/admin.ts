import type { MessageGroup } from "../types";

/** Operator console (`app/admin/page.tsx`) and the translation editor. */
export const admin = {
  "admin.title": { "en-US": "Admin console", "fa-IR": "کنسول مدیریت" },
  "admin.eyebrow": { "en-US": "Operator", "fa-IR": "اپراتور" },
  "admin.description": {
    "en-US": "Accounts, projects and platform configuration across every deployment.",
    "fa-IR": "حساب‌ها، پروژه‌ها و پیکربندی پلتفرم در همهٔ استقرارها.",
  },
  "admin.refreshing": { "en-US": "Refreshing…", "fa-IR": "در حال بازخوانی…" },
  "admin.loadFailed": { "en-US": "Could not load admin data.", "fa-IR": "داده‌های مدیریتی بارگذاری نشد." },
  "admin.updateFailed": { "en-US": "Update failed.", "fa-IR": "به‌روزرسانی ناموفق بود." },
  "admin.deleteFailed": { "en-US": "Delete failed.", "fa-IR": "حذف ناموفق بود." },
  "admin.forbidden.title": {
    "en-US": "Admin access required",
    "fa-IR": "دسترسی مدیریتی لازم است",
  },
  "admin.forbidden.body": {
    "en-US": "This console is restricted to platform operators.",
    "fa-IR": "این کنسول فقط برای اپراتورهای پلتفرم است.",
  },
  "admin.forbidden.back": { "en-US": "Back to dashboard", "fa-IR": "بازگشت به پیشخوان" },
  "admin.operatorNote": {
    "en-US":
      "You are signed in as an operator. You can run the platform day to day; changing roles and deleting accounts or projects are reserved for an admin, so those controls are hidden rather than failing with a 403.",
    "fa-IR":
      "با نقش اپراتور وارد شده‌ای. میتوانی پلتفرم را روزمره اداره کنی؛ تغییر نقش‌ها و حذف حساب یا پروژه مخصوص مدیر است، برای همین آن کنترل‌ها پنهان شده‌اند نه اینکه با خطای ۴۰۳ مواجه شوی.",
  },

  // --------------------------------------------------------------- tabs
  "admin.tab.accounts": { "en-US": "Accounts", "fa-IR": "حساب‌ها" },
  "admin.tab.projects": { "en-US": "Projects", "fa-IR": "پروژه‌ها" },
  "admin.tab.platform": { "en-US": "Platform", "fa-IR": "پلتفرم" },
  "admin.tab.config": { "en-US": "Configuration", "fa-IR": "پیکربندی" },
  "admin.tab.i18n": { "en-US": "Translations", "fa-IR": "ترجمه‌ها" },

  // --------------------------------------------------------- stat cards
  "admin.stat.accountsHint": {
    "en-US": "{suspended} suspended · {locked} locked out · {newUsers} new this week",
    "fa-IR": "{suspended} تعلیق‌شده · {locked} قفل‌شده · {newUsers} حساب تازه این هفته",
  },
  "admin.stat.projectsHint": {
    "en-US": "{count} created this week",
    "fa-IR": "{count} پروژهٔ تازه این هفته",
  },
  "admin.stat.visitsHint": {
    "en-US": "last 24h · {unique} unique · {week} this week",
    "fa-IR": "۲۴ ساعت گذشته · {unique} یکتا · {week} این هفته",
  },
  "admin.stat.storageHint": {
    "en-US": "{count} visits all time",
    "fa-IR": "{count} بازدید در مجموع",
  },
  "admin.stat.sessions": { "en-US": "Live sessions", "fa-IR": "نشست‌های فعال" },
  "admin.stat.sessionsHint": {
    "en-US": "console sessions not yet expired",
    "fa-IR": "نشست‌های کنسول که هنوز منقضی نشده‌اند",
  },
  "admin.stat.apiKeys": { "en-US": "Active API keys", "fa-IR": "کلیدهای API فعال" },
  "admin.stat.apiKeysHint": {
    "en-US": "{count} unused for 30 days",
    "fa-IR": "{count} کلید بدون استفاده در ۳۰ روز گذشته",
  },
  "admin.stat.webhooksHint": {
    "en-US": "{count} failed deliveries this week",
    "fa-IR": "{count} تحویل ناموفق این هفته",
  },
  "admin.stat.scheduled": { "en-US": "Scheduled work", "fa-IR": "کارهای زمان‌بندی‌شده" },
  "admin.stat.scheduledHint": {
    "en-US": "{count} verified custom domains",
    "fa-IR": "{count} دامنهٔ اختصاصی تأییدشده",
  },

  // ----------------------------------------------------------- accounts
  "admin.searchUsers": {
    "en-US": "Search username or email",
    "fa-IR": "جست‌وجوی نام کاربری یا ایمیل",
  },
  "admin.searchProjects": {
    "en-US": "Search project or owner",
    "fa-IR": "جست‌وجوی پروژه یا مالک",
  },
  "admin.filter.allAccounts": { "en-US": "All accounts", "fa-IR": "همهٔ حساب‌ها" },
  "admin.filter.active": { "en-US": "Active", "fa-IR": "فعال" },
  "admin.filter.suspended": { "en-US": "Suspended", "fa-IR": "تعلیق‌شده" },
  "admin.filter.locked": { "en-US": "Locked out", "fa-IR": "قفل‌شده" },
  "admin.filter.admins": { "en-US": "Administrators", "fa-IR": "مدیران" },
  "admin.filter.allProjects": { "en-US": "All projects", "fa-IR": "همهٔ پروژه‌ها" },
  "admin.filter.live": { "en-US": "Live", "fa-IR": "فعال" },
  "admin.filter.ownerSuspended": { "en-US": "Owner suspended", "fa-IR": "مالک تعلیق‌شده" },
  "admin.sort.newest": { "en-US": "Newest first", "fa-IR": "تازه‌ترین اول" },
  "admin.sort.username": { "en-US": "Username A–Z", "fa-IR": "نام کاربری الف–ی" },
  "admin.sort.storage": { "en-US": "Most storage", "fa-IR": "بیشترین فضا" },
  "admin.sort.projects": { "en-US": "Most projects", "fa-IR": "بیشترین پروژه" },
  "admin.sort.recent": { "en-US": "Recently active", "fa-IR": "اخیراً فعال" },
  "admin.sort.name": { "en-US": "Name A–Z", "fa-IR": "نام الف–ی" },
  "admin.sort.files": { "en-US": "Most files", "fa-IR": "بیشترین فایل" },
  "admin.sort.visits": { "en-US": "Most visits", "fa-IR": "بیشترین بازدید" },
  "admin.noAccounts": { "en-US": "No accounts match this filter.", "fa-IR": "هیچ حسابی با این فیلتر پیدا نشد." },
  "admin.noProjects": { "en-US": "No projects match this filter.", "fa-IR": "هیچ پروژه‌ای با این فیلتر پیدا نشد." },
  "admin.th.account": { "en-US": "Account", "fa-IR": "حساب" },
  "admin.th.storage": { "en-US": "Storage", "fa-IR": "فضای ذخیره‌سازی" },
  "admin.th.lastLogin": { "en-US": "Last login", "fa-IR": "آخرین ورود" },
  "admin.th.owner": { "en-US": "Owner", "fa-IR": "مالک" },
  "admin.th.freeQuota": { "en-US": "Free quota", "fa-IR": "سهمیهٔ رایگان" },
  "admin.badge.locked": { "en-US": "locked out", "fa-IR": "قفل‌شده" },
  "admin.suspend": { "en-US": "Suspend", "fa-IR": "تعلیق" },
  "admin.resume": { "en-US": "Resume", "fa-IR": "فعال‌سازی دوباره" },
  "admin.activate": { "en-US": "Activate", "fa-IR": "فعال‌سازی" },
  "admin.clearLockout": { "en-US": "Clear lockout", "fa-IR": "رفع قفل" },
  "admin.done.suspended": {
    "en-US": "{count} accounts suspended",
    "fa-IR": "{count} حساب تعلیق شد",
  },
  "admin.done.resumed": {
    "en-US": "{count} accounts resumed",
    "fa-IR": "{count} حساب فعال شد",
  },
  "admin.done.unlocked": {
    "en-US": "{count} lockouts cleared",
    "fa-IR": "قفل {count} حساب برداشته شد",
  },
  "admin.done.userSuspended": {
    "en-US": "{name} suspended",
    "fa-IR": "{name} تعلیق شد",
  },
  "admin.done.userResumed": {
    "en-US": "{name} resumed",
    "fa-IR": "{name} فعال شد",
  },
  "admin.done.updated": { "en-US": "{name} updated", "fa-IR": "{name} به‌روزرسانی شد" },
  "admin.done.deleted": { "en-US": "{name} deleted", "fa-IR": "{name} حذف شد" },
  "admin.done.quotaSet": {
    "en-US": "{name} quota set to {value}",
    "fa-IR": "سهمیهٔ {name} روی {value} تنظیم شد",
  },
  "admin.done.capSet": {
    "en-US": "{name} cap set to {value} MB",
    "fa-IR": "سقف {name} روی {value} مگابایت تنظیم شد",
  },
  "admin.done.signedOut": {
    "en-US": "Signed {name} out everywhere",
    "fa-IR": "{name} از همهٔ دستگاه‌ها خارج شد",
  },
  "admin.title.impersonate": {
    "en-US": "Sign in as {name}",
    "fa-IR": "ورود با حساب {name}",
  },
  "admin.title.detail": { "en-US": "Account detail", "fa-IR": "جزئیات حساب" },
  "admin.title.deleteAccount": {
    "en-US": "Delete account and everything it owns",
    "fa-IR": "حذف حساب و همهٔ دارایی‌هایش",
  },
  "admin.title.deleteProject": {
    "en-US": "Delete project and its data",
    "fa-IR": "حذف پروژه و داده‌هایش",
  },
  "admin.impersonate.failed": {
    "en-US": "Could not start impersonating.",
    "fa-IR": "ورود با حساب دیگر ممکن نشد.",
  },
  "admin.detail.failed": { "en-US": "Could not load the account.", "fa-IR": "حساب بارگذاری نشد." },
  "admin.revoke.failed": {
    "en-US": "Could not revoke sessions.",
    "fa-IR": "نشست‌ها باطل نشد.",
  },
  "admin.deleteAccountPrompt": {
    "en-US":
      'Deleting "{name}" removes every project, file and visitor they own. This cannot be undone.\n\nType the username to confirm:',
    "fa-IR":
      "حذف «{name}» همهٔ پروژه‌ها، فایل‌ها و بازدیدکننده‌هایش را پاک میکند و برگشت‌پذیر نیست.\n\nبرای تأیید، نام کاربری را بنویس:",
  },
  "admin.deleteProjectPrompt": {
    "en-US":
      'Deleting "{name}" removes its files, data and configuration. This cannot be undone.\n\nType the project name to confirm:',
    "fa-IR":
      "حذف «{name}» فایل‌ها، داده‌ها و پیکربندی‌اش را پاک میکند و برگشت‌پذیر نیست.\n\nبرای تأیید، نام پروژه را بنویس:",
  },
  "admin.role.placeholder": { "en-US": "Set console role…", "fa-IR": "تعیین نقش کنسول…" },
  "admin.role.member": { "en-US": "Remove operator access", "fa-IR": "حذف دسترسی اپراتور" },
  "admin.role.operator": { "en-US": "Make operator", "fa-IR": "ارتقا به اپراتور" },
  "admin.role.admin": { "en-US": "Make admin", "fa-IR": "ارتقا به مدیر" },
  "admin.role.madeAdmins": { "en-US": "made admins", "fa-IR": "مدیر شدند" },
  "admin.role.madeOperators": { "en-US": "made operators", "fa-IR": "اپراتور شدند" },
  "admin.role.demoted": { "en-US": "demoted", "fa-IR": "تنزل کردند" },
  "admin.role.nowAdmin": { "en-US": "is now an admin", "fa-IR": "اکنون مدیر است" },
  "admin.role.nowOperator": { "en-US": "is now an operator", "fa-IR": "اکنون اپراتور است" },
  "admin.role.nowMember": { "en-US": "is now a member", "fa-IR": "اکنون عضو است" },
  "admin.role.aria": { "en-US": "Console role", "fa-IR": "نقش کنسول" },
  "admin.role.removeAccess": {
    "en-US": "Remove operator access",
    "fa-IR": "برداشتن دسترسی اپراتور",
  },
  "admin.role.makeOperator": { "en-US": "Make operator", "fa-IR": "اپراتور کردن" },
  "admin.role.makeAdmin": { "en-US": "Make admin", "fa-IR": "مدیر کردن" },
  "admin.role.apply": { "en-US": "Apply", "fa-IR": "اعمال" },
  "admin.role.memberDesc": {
    "en-US": "Member — dashboard only",
    "fa-IR": "عضو — فقط پیشخوان",
  },
  "admin.role.operatorDesc": {
    "en-US": "Operator — runs the platform",
    "fa-IR": "اپراتور — ادارهٔ پلتفرم",
  },
  "admin.role.adminDesc": {
    "en-US": "Admin — full control",
    "fa-IR": "مدیر — کنترل کامل",
  },
  "admin.badge.suspended": { "en-US": "suspended", "fa-IR": "تعلیق‌شده" },
  "admin.badge.lockedOut": { "en-US": "locked out", "fa-IR": "قفل‌شده" },
  "admin.badge.active": { "en-US": "active", "fa-IR": "فعال" },
  "admin.badge.admin": { "en-US": "admin", "fa-IR": "مدیر" },
  "admin.badge.operator": { "en-US": "operator", "fa-IR": "اپراتور" },
  "admin.th.actions": { "en-US": "Actions", "fa-IR": "اقدام‌ها" },
  "admin.selectAll.accounts": {
    "en-US": "Select every account on this page",
    "fa-IR": "انتخاب همهٔ حساب‌های این صفحه",
  },
  "admin.selectAll.projects": {
    "en-US": "Select every project on this page",
    "fa-IR": "انتخاب همهٔ پروژه‌های این صفحه",
  },
  "admin.bulk.roleCount": {
    "en-US": "{count} accounts {label}",
    "fa-IR": "{count} حساب {label}",
  },
  "admin.bulk.projectsResumed": {
    "en-US": "{count} projects resumed",
    "fa-IR": "{count} پروژه فعال شد",
  },
  "admin.bulk.projectsSuspended": {
    "en-US": "{count} projects suspended",
    "fa-IR": "{count} پروژه تعلیق شد",
  },
  "admin.tooltip.detail": { "en-US": "Account detail", "fa-IR": "جزئیات حساب" },
  "admin.tooltip.deleteAccount": {
    "en-US": "Delete account and everything it owns",
    "fa-IR": "حذف حساب و هر چه در اختیار دارد",
  },
  "admin.tooltip.deleteProject": {
    "en-US": "Delete project and its data",
    "fa-IR": "حذف پروژه و داده‌هایش",
  },
  "admin.project.stored": { "en-US": "{bytes} stored", "fa-IR": "‎{bytes} ذخیره‌شده" },
  "admin.role.isNowAdmin": { "en-US": "is now an admin", "fa-IR": "حالا مدیر است" },
  "admin.role.isNowOperator": { "en-US": "is now an operator", "fa-IR": "حالا اپراتور است" },
  "admin.role.isNowMember": { "en-US": "is now a member", "fa-IR": "حالا عضو است" },
  "admin.detail.roleChanged": { "en-US": "{name} {label}", "fa-IR": "{name} {label}" },
  "admin.detail.projects": { "en-US": "Projects", "fa-IR": "پروژه‌ها" },
  "admin.detail.visitors": { "en-US": "Visitors", "fa-IR": "بازدیدکننده‌ها" },
  "admin.detail.capLabel": { "en-US": "Storage cap (MB)", "fa-IR": "سقف فضای ذخیره‌سازی (مگابایت)" },
  "admin.detail.capUpdate": { "en-US": "Update cap", "fa-IR": "به‌روزرسانی سقف" },
  "admin.detail.th.files": { "en-US": "Files", "fa-IR": "فایل‌ها" },
  "admin.detail.noProjects": { "en-US": "No projects.", "fa-IR": "هیچ پروژه‌ای ندارد." },
  "admin.detail.signInAs": { "en-US": "Sign in as {username}", "fa-IR": "ورود با نام {username}" },
  "admin.detail.signOutEverywhere": {
    "en-US": "Sign out everywhere",
    "fa-IR": "خروج از همهٔ دستگاه‌ها",
  },
  "admin.detail.resumeAccount": { "en-US": "Resume account", "fa-IR": "فعال کردن حساب" },
  "admin.detail.suspendAccount": { "en-US": "Suspend account", "fa-IR": "تعلیق حساب" },
  "admin.config.filter": { "en-US": "Filter configuration keys", "fa-IR": "فیلتر کلیدهای پیکربندی" },
  "admin.config.default": { "en-US": "default {value}", "fa-IR": "پیش‌فرض {value}" },
  "admin.config.currently": {
    "en-US": "· currently {value}",
    "fa-IR": "· اکنون {value}",
  },
  "admin.config.noMatch": {
    "en-US": "No configuration key matches “{filter}”.",
    "fa-IR": "هیچ کلید پیکربندی‌ای با «{filter}» نخواند.",
  },
  "admin.detail.noEmail": { "en-US": "no email on file", "fa-IR": "ایمیلی ثبت نشده" },
  "admin.detail.joined": { "en-US": "joined {date}", "fa-IR": "عضویت از {date}" },
  "admin.detail.lastSeen": { "en-US": "last seen {date}", "fa-IR": "آخرین بازدید {date}" },
  "admin.detail.neverSignedIn": { "en-US": "never signed in", "fa-IR": "هرگز وارد نشده" },
  "admin.storedBytes": { "en-US": "{size} stored", "fa-IR": "{size} ذخیره‌شده" },

  // ----------------------------------------------------------- platform
  "admin.busiest": { "en-US": "Busiest projects this week", "fa-IR": "پرترافیک‌ترین پروژه‌های این هفته" },
  "admin.cron.title": { "en-US": "Global cron switches", "fa-IR": "کلیدهای سراسری کرون‌جاب" },
  "admin.cron.description": {
    "en-US": "Turn a task off across the whole platform. Projects keep their own toggles.",
    "fa-IR": "یک کار را در کل پلتفرم خاموش کن. هر پروژه کلیدهای خودش را نگه میدارد.",
  },
  "admin.cron.th.task": { "en-US": "Task", "fa-IR": "کار" },
  "admin.cron.th.due": { "en-US": "Due projects", "fa-IR": "پروژه‌های سررسیدشده" },
  "admin.cron.done": {
    "en-US": "{task} {state} globally",
    "fa-IR": "{task} به‌صورت سراسری {state}",
  },
  "admin.cron.state.enabled": { "en-US": "enabled", "fa-IR": "فعال" },
  "admin.cron.state.disabled": { "en-US": "disabled", "fa-IR": "غیرفعال" },
  "admin.library.title": { "en-US": "Public library", "fa-IR": "کتابخانهٔ عمومی" },
  "admin.library.description": {
    "en-US": "Assets served at /~public/<path> to every project on the platform.",
    "fa-IR": "فایل‌هایی که به‌صورت ‎/~public/<path> به همهٔ پروژه‌های پلتفرم سرو میشوند.",
  },
  "admin.library.publish": { "en-US": "Publish asset", "fa-IR": "انتشار فایل" },
  "admin.library.hint": {
    "en-US":
      "Pick the file, set the path it should be served at, then publish. HTML is refused — /~public/ is for shared stylesheets, scripts and images.",
    "fa-IR":
      "فایل را انتخاب کن، مسیر سرو شدنش را مشخص کن و منتشرش کن. HTML پذیرفته نمیشود — ‎/~public/ برای استایل‌شیت، اسکریپت و تصویر مشترک است.",
  },
  "admin.library.empty": { "en-US": "The public library is empty.", "fa-IR": "کتابخانهٔ عمومی خالی است." },
  "admin.library.published": {
    "en-US": "/~public/{path} published",
    "fa-IR": "‎/~public/{path} منتشر شد",
  },
  "admin.library.removed": { "en-US": "Removed", "fa-IR": "حذف شد" },

  // -------------------------------------------------------- config editor
  "admin.config.saved": { "en-US": "{key} saved", "fa-IR": "{key} ذخیره شد" },
  "admin.config.failed": { "en-US": "Config save failed.", "fa-IR": "ذخیرهٔ پیکربندی ناموفق بود." },

  // --------------------------------------------------- translation editor
  "i18n.title": { "en-US": "Translations", "fa-IR": "ترجمه‌ها" },
  "i18n.description": {
    "en-US":
      "Every user-visible string, in both cultures. Edits are stored as overrides on top of the wording this build ships with, so a platform upgrade never silently reverts them.",
    "fa-IR":
      "همهٔ رشته‌های قابل‌مشاهده، در هر دو فرهنگ. ویرایش‌ها به‌صورت بازنویسی روی متنی که این نسخه عرضه میکند ذخیره میشوند، پس ارتقای پلتفرم هرگز آن‌ها را بی‌سروصدا برنمیگرداند.",
  },
  "i18n.search": { "en-US": "Search keys or text…", "fa-IR": "جست‌وجوی کلید یا متن…" },
  "i18n.section.all": { "en-US": "All sections", "fa-IR": "همهٔ بخش‌ها" },
  "i18n.editing": { "en-US": "Editing", "fa-IR": "در حال ویرایش" },
  "i18n.showModifiedOnly": {
    "en-US": "Only overridden",
    "fa-IR": "فقط بازنویسی‌شده‌ها",
  },
  "i18n.shipped": { "en-US": "Shipped", "fa-IR": "متن پیش‌فرض" },
  "i18n.current": { "en-US": "Current", "fa-IR": "متن فعلی" },
  "i18n.modified": { "en-US": "Modified", "fa-IR": "بازنویسی‌شده" },
  "i18n.placeholders": {
    "en-US": "Placeholders are written as {name}.",
    "fa-IR": "متغیرها به شکل ‎{name} نوشته میشوند.",
  },
  "i18n.revert": { "en-US": "Revert", "fa-IR": "بازگشت به پیش‌فرض" },
  "i18n.resetOne": {
    "en-US": 'Reset "{key}" to the shipped wording?',
    "fa-IR": "«{key}» به متن پیش‌فرض برگردد؟",
  },
  "i18n.saved": { "en-US": "{key} saved", "fa-IR": "{key} ذخیره شد" },
  "i18n.reverted": { "en-US": "{key} reverted", "fa-IR": "{key} به پیش‌فرض برگشت" },
  "i18n.saveFailed": { "en-US": "Could not save the translation.", "fa-IR": "ذخیرهٔ ترجمه ناموفق بود." },
  "i18n.count": {
    "en-US": "{count} of {total} strings · {modified} overridden in {locale}",
    "fa-IR": "{count} از {total} رشته · {modified} بازنویسی‌شده در {locale}",
  },
  "i18n.empty": {
    "en-US": "Nothing matches this filter.",
    "fa-IR": "چیزی با این فیلتر پیدا نشد.",
  },
  "i18n.localeHint": {
    "en-US":
      "fa-IR is the platform default: right-to-left, Iransans and Vazir, Shamsi dates and Persian digits. en-US is Gregorian, Latin digits, left-to-right.",
    "fa-IR":
      "‏fa-IR پیش‌فرض پلتفرم است: راست‌به‌چپ، فونت ایران‌سنس و وزیر، تاریخ شمسی و ارقام فارسی. en-US میلادی، ارقام لاتین و چپ‌به‌راست است.",
  },
} satisfies MessageGroup;