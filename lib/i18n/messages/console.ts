import type { MessageGroup } from "../types";

/** Project list (`app/dashboard/page.tsx`) and the shared library. */
export const consoleMessages = {
  // ------------------------------------------------------------ dashboard
  "projects.title": { "en-US": "Projects", "fa-IR": "پروژه‌ها" },
  "projects.eyebrow": { "en-US": "Console", "fa-IR": "کنسول" },
  "projects.description": {
    "en-US":
      "Every project ships a document database, file storage, visitor accounts and a serving pipeline — frontend code only.",
    "fa-IR":
      "هر پروژه یک پایگاه‌دادهٔ سندی، فضای ذخیره‌سازی فایل، حساب بازدیدکننده و خط سرو دارد — فقط با کد فرانت.",
  },
  "projects.new": { "en-US": "New project", "fa-IR": "پروژهٔ جدید" },
  "projects.create.dialogTitle": { "en-US": "Create a project", "fa-IR": "ساخت یک پروژه" },
  "projects.create.dialogDescription": {
    "en-US": "The name becomes your public URL:",
    "fa-IR": "این نام نشانی عمومی شما خواهد بود:",
  },
  "projects.create.nameLabel": { "en-US": "Project name", "fa-IR": "نام پروژه" },
  "projects.create.nameHint": {
    "en-US": "Lowercase letters, digits, _ and -.",
    "fa-IR": "حروف کوچک انگلیسی، رقم، _ و -.",
  },
  "projects.create.submit": { "en-US": "Create project", "fa-IR": "ساخت پروژه" },
  "projects.create.working": { "en-US": "Creating…", "fa-IR": "در حال ساخت…" },
  "projects.create.done": {
    "en-US": 'Project "{name}" created',
    "fa-IR": "پروژهٔ «{name}» ساخته شد",
  },
  "projects.create.failed": {
    "en-US": "Could not create the project.",
    "fa-IR": "پروژه ساخته نشد.",
  },
  "projects.loadFailed": { "en-US": "Could not load projects.", "fa-IR": "پروژه‌ها بارگذاری نشدند." },
  "projects.delete.confirm": {
    "en-US": 'Delete "{name}" and all of its data? This cannot be undone.',
    "fa-IR": "پروژهٔ «{name}» و همهٔ داده‌هایش حذف شود؟ این کار برگشت‌پذیر نیست.",
  },
  "projects.delete.done": { "en-US": "Project deleted", "fa-IR": "پروژه حذف شد" },
  "projects.delete.failed": { "en-US": "Could not delete the project.", "fa-IR": "پروژه حذف نشد." },
  "projects.section.title": { "en-US": "Your projects", "fa-IR": "پروژه‌های شما" },
  "projects.section.description": {
    "en-US": "Open a project to manage code, data and access.",
    "fa-IR": "یک پروژه را باز کنید تا کد، داده و دسترسی‌ها را مدیریت کنید.",
  },
  "projects.empty.title": { "en-US": "No projects yet", "fa-IR": "هنوز پروژه‌ای ندارید" },
  "projects.empty.description": {
    "en-US":
      "Create your first project, upload static files, and call /api/db from your JavaScript — the platform is your backend.",
    "fa-IR":
      "نخستین پروژه‌تان را بسازید، فایل‌های استاتیک را بارگذاری کنید و از جاوااسکریپت‌تان ‎/api/db را فراخوانی کنید — پلتفرم بک‌اند شماست.",
  },
  "projects.empty.action": {
    "en-US": "Create your first project",
    "fa-IR": "نخستین پروژه‌تان را بسازید",
  },
  "projects.badge.live": { "en-US": "live", "fa-IR": "فعال" },
  "projects.badge.suspended": { "en-US": "suspended", "fa-IR": "تعلیق‌شده" },
  "projects.openWorkspace": { "en-US": "Open workspace", "fa-IR": "باز کردن فضای کار" },
  "projects.viewLive": { "en-US": "View live", "fa-IR": "دیدن نسخهٔ زنده" },
  "projects.meter.storage": { "en-US": "Storage", "fa-IR": "فضای ذخیره‌سازی" },
  "projects.meter.visits": { "en-US": "Visits this month", "fa-IR": "بازدید این ماه" },
  "projects.stat.storage": { "en-US": "Storage used", "fa-IR": "فضای مصرف‌شده" },
  "projects.stat.storageHint": {
    "en-US": "{count} files across all projects",
    "fa-IR": "{count} فایل در همهٔ پروژه‌ها",
  },
  "projects.stat.visits": { "en-US": "Visits this month", "fa-IR": "بازدید این ماه" },
  "projects.stat.visitsHint": {
    "en-US": "5-minute dedupe window",
    "fa-IR": "پنجرهٔ حذف تکرار: ۵ دقیقه",
  },
  "projects.stat.count": { "en-US": "Projects", "fa-IR": "پروژه‌ها" },
  "projects.stat.countHint": {
    "en-US": "Free tier · 5 MB storage",
    "fa-IR": "پلن رایگان · ۵ مگابایت فضا",
  },

  // -------------------------------------------------------------- library
  "library.title": { "en-US": "Library", "fa-IR": "کتابخانه" },
  "library.eyebrow": { "en-US": "Shared", "fa-IR": "مشترک" },
  "library.description": {
    "en-US":
      "Upload an asset once and every project you own references it from a single stable URL. Nothing is copied between projects.",
    "fa-IR":
      "یک فایل را یک بار بارگذاری کنید تا همهٔ پروژه‌هایتان از یک نشانی ثابت به آن ارجاع دهند. چیزی بین پروژه‌ها کپی نمیشود.",
  },
  "library.stat.usage": { "en-US": "Usage", "fa-IR": "مصرف" },
  "library.stat.usageDescription": {
    "en-US": "Separate from your project file budget.",
    "fa-IR": "جدا از سهمیهٔ فایل پروژه‌ها.",
  },
  "library.stat.assets": { "en-US": "Assets", "fa-IR": "فایل‌ها" },
  "library.stat.assetsDescription": {
    "en-US": "One copy each, shared by every project.",
    "fa-IR": "یک نسخه از هرکدام، مشترک بین همهٔ پروژه‌ها.",
  },
  "library.stat.baseUrl": { "en-US": "Your base URL", "fa-IR": "آدرس پایهٔ شما" },
  "library.stat.baseUrlDescription": {
    "en-US": "Every asset lives under this path.",
    "fa-IR": "همهٔ فایل‌ها زیر همین مسیر هستند.",
  },
  "library.publish.title": { "en-US": "Publish an asset", "fa-IR": "انتشار یک فایل" },
  "library.publish.description": {
    "en-US": "Any file type except .html and .htm. The URL it gets is shown in the list below.",
    "fa-IR": "هر نوع فایلی به‌جز ‎.html و ‎.htm. نشانی دریافتی در فهرست زیر نمایش داده میشود.",
  },
  "library.publish.chooseFiles": { "en-US": "Choose files", "fa-IR": "انتخاب فایل" },
  "library.publish.uploadFolder": { "en-US": "Upload a folder", "fa-IR": "بارگذاری یک پوشه" },
  "library.publish.uploading": { "en-US": "Uploading…", "fa-IR": "در حال بارگذاری…" },
  "library.publish.warning": {
    "en-US":
      "Library files are served from the platform origin, so HTML is refused: it would run scripts against your own console session. Project pages can host HTML in the Code tab instead.",
    "fa-IR":
      "فایل‌های کتابخانه از مبدأ پلتفرم سرو میشوند، بنابراین HTML پذیرفته نمیشود: روی نشست کنسول خودتان اسکریپت اجرا میکرد. صفحه‌های پروژه میتوانند HTML را در تب کد داشته باشند.",
  },
  "library.publish.done": {
    "en-US": "{count} assets published",
    "fa-IR": "{count} فایل منتشر شد",
  },
  "library.publish.failed": { "en-US": "Upload failed.", "fa-IR": "بارگذاری ناموفق بود." },
  "library.publish.blockedHtml": {
    "en-US": "{path}: HTML cannot be published to the library.",
    "fa-IR": "{path}: HTML را نمیشود در کتابخانه منتشر کرد.",
  },
  "library.reference.title": { "en-US": "Reference an asset", "fa-IR": "ارجاع به یک فایل" },
  "library.reference.description": {
    "en-US":
      "Link it from any project. library/ is a reserved folder name, so a relative reference resolves to your library on a custom domain too.",
    "fa-IR":
      "از هر پروژه‌ای به آن پیوند دهید. ‎library/ نام پوشهٔ رزروشده است، پس ارجاع نسبی روی دامنهٔ اختصاصی هم به کتابخانهٔ شما میرسد.",
  },
  "library.filter.placeholder": { "en-US": "Filter assets…", "fa-IR": "فیلتر فایل‌ها…" },
  "library.filter.ariaLabel": { "en-US": "Filter library assets", "fa-IR": "فیلتر فایل‌های کتابخانه" },
  "library.list.of": { "en-US": "{shown} of {total}", "fa-IR": "{shown} از {total}" },
  "library.remove.selected": { "en-US": "Remove {count}", "fa-IR": "حذف {count} مورد" },
  "library.remove.one": { "en-US": "Remove", "fa-IR": "حذف" },
  "library.remove.confirm": {
    "en-US": "Remove {count} assets from the library?",
    "fa-IR": "{count} فایل از کتابخانه حذف شود؟",
  },
  "library.remove.done": { "en-US": "{count} removed", "fa-IR": "{count} مورد حذف شد" },
  "library.selectAll": { "en-US": "Select all {count}", "fa-IR": "انتخاب همه ({count})" },
  "library.empty.filtered": {
    "en-US": "Nothing matches “{query}”.",
    "fa-IR": "چیزی با «{query}» پیدا نشد.",
  },
  "library.empty.body": {
    "en-US":
      "Your library is empty. Publish a stylesheet or a font and every project can link to it.",
    "fa-IR":
      "کتابخانه‌ات خالی است. یک فایل استایل یا فونت منتشر کن تا همهٔ پروژه‌ها بتوانند به آن لینک بدهند.",
  },
  "library.copied": { "en-US": "{what} copied", "fa-IR": "{what} کپی شد" },
  "library.copy.baseUrl": { "en-US": "Base URL", "fa-IR": "آدرس پایه" },
  "library.copy.publicUrl": { "en-US": "Public URL", "fa-IR": "آدرس عمومی" },
  "library.loadFailed": { "en-US": "Could not load the library.", "fa-IR": "کتابخانه بارگذاری نشد." },
  "library.table.url": { "en-US": "URL", "fa-IR": "نشانی" },
  "library.table.copyTitle": { "en-US": "Copy the public URL", "fa-IR": "کپی آدرس عمومی" },
} satisfies MessageGroup;