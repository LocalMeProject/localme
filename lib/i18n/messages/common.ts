import type { MessageGroup } from "../types";

/**
 * Vocabulary shared by every surface: navigation chrome, generic actions,
 * status words and the empty/error states.
 *
 * Keys are dotted and grouped by area (`common.*`, `nav.*`, `state.*`,
 * `error.*`) rather than namespaced per page, so the admin console's
 * translation editor can offer a category filter that actually means
 * something.
 */
export const common = {
  // ------------------------------------------------------------- actions
  "action.save": { "en-US": "Save", "fa-IR": "ذخیره" },
  "action.saveChanges": { "en-US": "Save changes", "fa-IR": "ذخیرهٔ تغییرات" },
  "action.saving": { "en-US": "Saving…", "fa-IR": "در حال ذخیره…" },
  "action.working": { "en-US": "Working…", "fa-IR": "در حال انجام…" },
  "action.cancel": { "en-US": "Cancel", "fa-IR": "انصراف" },
  "action.close": { "en-US": "Close", "fa-IR": "بستن" },
  "action.delete": { "en-US": "Delete", "fa-IR": "حذف" },
  "action.remove": { "en-US": "Remove", "fa-IR": "برداشتن" },
  "action.edit": { "en-US": "Edit", "fa-IR": "ویرایش" },
  "action.rename": { "en-US": "Rename", "fa-IR": "تغییر نام" },
  "action.move": { "en-US": "Move", "fa-IR": "انتقال" },
  "action.copy": { "en-US": "Copy", "fa-IR": "کپی" },
  "action.copied": { "en-US": "Copied", "fa-IR": "کپی شد" },
  "action.download": { "en-US": "Download", "fa-IR": "دانلود" },
  "action.upload": { "en-US": "Upload", "fa-IR": "بارگذاری" },
  "action.refresh": { "en-US": "Refresh", "fa-IR": "بازخوانی" },
  "action.retry": { "en-US": "Try again", "fa-IR": "تلاش دوباره" },
  "action.create": { "en-US": "Create", "fa-IR": "ساختن" },
  "action.confirm": { "en-US": "Confirm", "fa-IR": "تأیید" },
  "action.dismiss": { "en-US": "Dismiss", "fa-IR": "بی‌خیال" },
  "action.selectAll": { "en-US": "Select all", "fa-IR": "انتخاب همه" },
  "action.clearSelection": { "en-US": "Clear selection", "fa-IR": "لغو انتخاب" },
  "action.export": { "en-US": "Export", "fa-IR": "برون‌بری" },
  "action.import": { "en-US": "Import", "fa-IR": "درون‌ریزی" },
  "action.back": { "en-US": "Back", "fa-IR": "بازگشت" },
  "action.next": { "en-US": "Next", "fa-IR": "بعدی" },
  "action.previous": { "en-US": "Previous", "fa-IR": "قبلی" },
  "action.apply": { "en-US": "Apply", "fa-IR": "اعمال" },
  "action.reset": { "en-US": "Reset", "fa-IR": "بازنشانی" },
  "action.signOut": { "en-US": "Sign out", "fa-IR": "خروج" },
  "action.signIn": { "en-US": "Sign in", "fa-IR": "ورود" },
  "action.showMore": { "en-US": "Show more", "fa-IR": "بیشتر" },
  "action.showLess": { "en-US": "Show less", "fa-IR": "کمتر" },

  // -------------------------------------------------------------- labels
  "label.name": { "en-US": "Name", "fa-IR": "نام" },
  "label.description": { "en-US": "Description", "fa-IR": "توضیح" },
  "label.title": { "en-US": "Title", "fa-IR": "عنوان" },
  "label.type": { "en-US": "Type", "fa-IR": "نوع" },
  "label.status": { "en-US": "Status", "fa-IR": "وضعیت" },
  "label.size": { "en-US": "Size", "fa-IR": "حجم" },
  "label.path": { "en-US": "Path", "fa-IR": "مسیر" },
  "label.project": { "en-US": "Project", "fa-IR": "پروژه" },
  "label.projects": { "en-US": "Projects", "fa-IR": "پروژه‌ها" },
  "label.account": { "en-US": "Account", "fa-IR": "حساب کاربری" },
  "label.accounts": { "en-US": "Accounts", "fa-IR": "حساب‌ها" },
  "label.username": { "en-US": "Username", "fa-IR": "نام کاربری" },
  "label.password": { "en-US": "Password", "fa-IR": "رمز عبور" },
  "label.email": { "en-US": "Email", "fa-IR": "ایمیل" },
  "label.role": { "en-US": "Role", "fa-IR": "نقش" },
  "label.roles": { "en-US": "Roles", "fa-IR": "نقش‌ها" },
  "label.permission": { "en-US": "Permission", "fa-IR": "مجوز" },
  "label.permissions": { "en-US": "Permissions", "fa-IR": "مجوزها" },
  "label.created": { "en-US": "Created", "fa-IR": "ساخته شده" },
  "label.updated": { "en-US": "Updated", "fa-IR": "آخرین تغییر" },
  "label.createdAt": { "en-US": "Created at", "fa-IR": "زمان ساخت" },
  "label.updatedAt": { "en-US": "Updated at", "fa-IR": "زمان آخرین تغییر" },
  "label.lastSeen": { "en-US": "Last seen", "fa-IR": "آخرین بازدید" },
  "label.owner": { "en-US": "Owner", "fa-IR": "مالک" },
  "label.value": { "en-US": "Value", "fa-IR": "مقدار" },
  "label.key": { "en-US": "Key", "fa-IR": "کلید" },
  "label.endpoint": { "en-US": "Endpoint", "fa-IR": "نشانی" },
  "label.method": { "en-US": "Method", "fa-IR": "متد" },
  "label.id": { "en-US": "ID", "fa-IR": "شناسه" },
  "label.enabled": { "en-US": "Enabled", "fa-IR": "فعال" },
  "label.disabled": { "en-US": "Disabled", "fa-IR": "غیرفعال" },
  "label.optional": { "en-US": "optional", "fa-IR": "اختیاری" },
  "label.required": { "en-US": "required", "fa-IR": "اجباری" },
  "label.none": { "en-US": "None", "fa-IR": "هیچ" },
  "label.any": { "en-US": "Any", "fa-IR": "هر مقداری" },
  "label.all": { "en-US": "All", "fa-IR": "همه" },
  "label.usage": { "en-US": "Usage", "fa-IR": "مصرف" },
  "label.quota": { "en-US": "Quota", "fa-IR": "سهمیه" },
  "label.limit": { "en-US": "Limit", "fa-IR": "محدودیت" },
  "label.source": { "en-US": "Source", "fa-IR": "منبع" },
  "label.response": { "en-US": "Response", "fa-IR": "پاسخ" },
  "label.request": { "en-US": "Request", "fa-IR": "درخواست" },
  "label.result": { "en-US": "Result", "fa-IR": "نتیجه" },
  "label.total": { "en-US": "Total", "fa-IR": "مجموع" },
  "label.count": { "en-US": "Count", "fa-IR": "تعداد" },
  "label.details": { "en-US": "Details", "fa-IR": "جزئیات" },
  "label.notes": { "en-US": "Notes", "fa-IR": "یادداشت‌ها" },
  "label.reason": { "en-US": "Reason", "fa-IR": "دلیل" },
  "label.action": { "en-US": "Action", "fa-IR": "اقدام" },
  "label.actions": { "en-US": "Actions", "fa-IR": "اقدام‌ها" },
  "label.schedules": { "en-US": "Schedule", "fa-IR": "زمان‌بندی" },
  "label.folder": { "en-US": "Folder", "fa-IR": "پوشه" },
  "label.file": { "en-US": "File", "fa-IR": "فایل" },
  "label.files": { "en-US": "Files", "fa-IR": "فایل‌ها" },
  "label.language": { "en-US": "Language", "fa-IR": "زبان" },
  "label.culture": { "en-US": "Culture", "fa-IR": "فرهنگ و زبان" },

  // -------------------------------------------------------------- states
  "state.loading": { "en-US": "Loading…", "fa-IR": "در حال بارگذاری…" },
  "state.empty": { "en-US": "Nothing here yet", "fa-IR": "هنوز چیزی این‌جا نیست" },
  "state.error": { "en-US": "Something went wrong", "fa-IR": "یک مشکل پیش آمد" },
  "state.success": { "en-US": "Done", "fa-IR": "انجام شد" },
  "state.active": { "en-US": "Active", "fa-IR": "فعال" },
  "state.inactive": { "en-US": "Inactive", "fa-IR": "غیرفعال" },
  "state.suspended": { "en-US": "Suspended", "fa-IR": "تعلیق‌شده" },
  "state.pending": { "en-US": "Pending", "fa-IR": "در انتظار" },
  "state.failed": { "en-US": "Failed", "fa-IR": "ناموفق" },
  "state.successState": { "en-US": "Succeeded", "fa-IR": "موفق" },
  "state.never": { "en-US": "Never", "fa-IR": "هرگز" },
  "state.yes": { "en-US": "Yes", "fa-IR": "بله" },
  "state.no": { "en-US": "No", "fa-IR": "خیر" },
  "state.copy": { "en-US": "Copy", "fa-IR": "کپی" },
  "state.untitled": { "en-US": "Untitled", "fa-IR": "بی‌نام" },

  // -------------------------------------------------------------- errors
  "error.generic": {
    "en-US": "Something went wrong. Please try again.",
    "fa-IR": "یک مشکل پیش آمد. لطفاً دوباره تلاش کنید.",
  },
  "error.required": {
    "en-US": "{field} is required.",
    "fa-IR": "پر کردن «{field}» الزامی است.",
  },
  "error.invalidJson": {
    "en-US": "That is not valid JSON.",
    "fa-IR": "این JSON معتبر نیست.",
  },
  "jsonField.format": { "en-US": "Format", "fa-IR": "مرتب‌سازی" },
  "error.network": {
    "en-US": "The server could not be reached.",
    "fa-IR": "ارتباط با سرور برقرار نشد.",
  },
  "error.unauthorized": {
    "en-US": "You are not signed in.",
    "fa-IR": "شما وارد حساب خود نشده‌اید.",
  },
  "error.forbidden": {
    "en-US": "You do not have permission to do that.",
    "fa-IR": "اجازهٔ این کار را ندارید.",
  },
  "error.notFound": {
    "en-US": "That item does not exist.",
    "fa-IR": "چنین موردی وجود ندارد.",
  },
  "error.quotaExceeded": {
    "en-US": "This would go past your quota, so nothing was written.",
    "fa-IR": "این کار از سهمیهٔ شما بیشتر میشد، بنابراین چیزی ذخیره نشد.",
  },

  // ----------------------------------------------------------------- nav
  "nav.home": { "en-US": "Home", "fa-IR": "خانه" },
  "nav.projects": { "en-US": "Projects", "fa-IR": "پروژه‌ها" },
  "nav.library": { "en-US": "Library", "fa-IR": "کتابخانه" },
  "nav.docs": { "en-US": "API docs", "fa-IR": "مستندات API" },
  "nav.console": { "en-US": "Console", "fa-IR": "کنسول" },
  "nav.account": { "en-US": "Account", "fa-IR": "حساب کاربری" },
  "nav.dashboard": { "en-US": "Dashboard", "fa-IR": "پیشخوان" },
  "nav.sections": { "en-US": "Sections", "fa-IR": "بخش‌ها" },
  "nav.primary": { "en-US": "Main navigation", "fa-IR": "منوی اصلی" },
  "nav.consoleLabel": { "en-US": "LocalMe console", "fa-IR": "کنسول لوکال می" },
  "nav.consoleFooterTagline": {
    "en-US": "SQLite-first · Postgres-ready · docs are the contract",
    "fa-IR": "اول SQLite، آمادهٔ Postgres · مستندات، مرجع نهایی است",
  },

  // -------------------------------------------------------- theme toggle
  "theme.toggle": { "en-US": "Toggle theme", "fa-IR": "تغییر پوستهٔ روشن و تاریک" },
  "theme.dark": { "en-US": "Dark", "fa-IR": "تاریک" },
  "theme.light": { "en-US": "Light", "fa-IR": "روشن" },

  // ----------------------------------------------------------- culture
  "culture.label": { "en-US": "Culture", "fa-IR": "زبان و فرهنگ" },
  "culture.switch": { "en-US": "Change language and calendar", "fa-IR": "تغییر زبان و تقویم" },
  "culture.switched": {
    "en-US": "Language switched to {locale}.",
    "fa-IR": "زبان به {locale} تغییر کرد.",
  },

  // -------------------------------------------------------------- misc
  "a11y.skipToContent": { "en-US": "Skip to content", "fa-IR": "پرش به محتوای اصلی" },
  "misc.notFoundTitle": { "en-US": "Page not found", "fa-IR": "صفحه پیدا نشد" },
  "misc.notFoundBody": {
    "en-US": "That address does not match anything on this platform.",
    "fa-IR": "این نشانی به هیچ صفحه‌ای روی این پلتفرم نمیخورد.",
  },
  "misc.confirmIrreversible": {
    "en-US": "This cannot be undone.",
    "fa-IR": "این کار برگشت‌پذیر نیست.",
  },
  "confirm.typeWord": {
    "en-US": "Type {word} to confirm",
    "fa-IR": "برای تأیید، {word} را بنویس",
  },
  "misc.selectedCount": {
    "en-US": "{count} selected",
    "fa-IR": "{count} مورد انتخاب شده",
  },

  // ----------------------------------------------------------- code edit
  "code.unsaved": { "en-US": "unsaved", "fa-IR": "ذخیره‌نشده" },
  "code.cursor": { "en-US": "Ln {line}, Col {column}", "fa-IR": "سطر {line}، ستون {column}" },

  // ------------------------------------------------------------ pagination
  "pagination.empty": { "en-US": "Nothing to show", "fa-IR": "چیزی برای نمایش نیست" },
  "pagination.range": {
    "en-US": "{from}–{to} of {total} {label}",
    "fa-IR": "{from}–{to} از {total} {label}",
  },
  "pagination.rowsPerPage": { "en-US": "{size} / page", "fa-IR": "{size} / صفحه" },
  "pagination.rowsPerPageLabel": { "en-US": "Rows per page", "fa-IR": "ردیف در هر صفحه" },
  "pagination.prev": { "en-US": "Previous page", "fa-IR": "صفحهٔ قبل" },
  "pagination.next": { "en-US": "Next page", "fa-IR": "صفحهٔ بعد" },
  "pagination.rows": { "en-US": "rows", "fa-IR": "ردیف" },
  "pagination.accounts": { "en-US": "accounts", "fa-IR": "حساب" },
  "pagination.projects": { "en-US": "projects", "fa-IR": "پروژه" },
  "pagination.documents": { "en-US": "documents", "fa-IR": "سند" },

  // ------------------------------------------------------------ selection
  "selection.clear": { "en-US": "Clear", "fa-IR": "لغو انتخاب" },
  "selection.clearTitle": { "en-US": "Clear selection", "fa-IR": "لغو انتخاب‌ها" },
  "selection.selected": {
    "en-US": "{count} {noun} selected",
    "fa-IR": "{count} {noun} انتخاب شده",
  },
  "selection.aria": { "en-US": "{count} {noun} selected", "fa-IR": "{count} {noun} انتخاب شده" },
  "selection.row": { "en-US": "row", "fa-IR": "ردیف" },
  "selection.account": { "en-US": "account", "fa-IR": "حساب" },
  "selection.project": { "en-US": "project", "fa-IR": "پروژه" },
  "selection.file": { "en-US": "file", "fa-IR": "فایل" },
  "selection.documents": { "en-US": "document", "fa-IR": "سند" },
  "selection.route": { "en-US": "route", "fa-IR": "مسیر" },
  "selection.role": { "en-US": "role", "fa-IR": "نقش" },
  "selection.visitor": { "en-US": "visitor", "fa-IR": "بازدیدکننده" },
  "selection.secret": { "en-US": "secret", "fa-IR": "راز" },
  "selection.selectItem": { "en-US": "Select {id}", "fa-IR": "انتخاب {id}" },

  // ------------------------------------------------------- transfer tools
  "transfer.selectFirst": {
    "en-US": "Select at least one row first.",
    "fa-IR": "اول دست‌کم یک ردیف را انتخاب کن.",
  },
  "transfer.export": { "en-US": "Export", "fa-IR": "برون‌بری" },
  "transfer.exportSelected": {
    "en-US": "Export {count}",
    "fa-IR": "برون‌بری {count} مورد",
  },
  "transfer.exportAllTitle": {
    "en-US": "Export every {label} in this project",
    "fa-IR": "برون‌بری همهٔ {label}های این پروژه",
  },
  "transfer.exportSelectedTitle": {
    "en-US": "Export {count} selected",
    "fa-IR": "برون‌بری {count} مورد انتخاب‌شده",
  },
  "transfer.exported": {
    "en-US": "Exported {count} items",
    "fa-IR": "{count} مورد برون‌بری شد",
  },
  "transfer.exportFailed": { "en-US": "Export failed.", "fa-IR": "برون‌بری ناموفق بود." },
  "transfer.importTitle": {
    "en-US": "Import {label}",
    "fa-IR": "درون‌ریزی {label}",
  },
  "transfer.importDescription": {
    "en-US":
      "Paste a JSON array in the shape produced by Export. Merge upserts the items sent and leaves everything else untouched; Replace deletes the existing rows first. Password hashes and secret values are never exported, so imported visitors start disabled.",
    "fa-IR":
      "یک آرایهٔ JSON به همان شکلی که برون‌بری تولید میکند بچسبان. حالت ادغام موارد ارسالی را به‌روز میکند و بقیه را دست‌نخورده میگذارد؛ حالت جایگزینی اول ردیف‌های موجود را حذف میکند. هش رمزها و مقادیر اسرار هرگز برون‌بری نمیشوند، بنابراین بازدیدکننده‌های درون‌ریزی‌شده از ابتدا غیرفعال‌اند.",
  },
  "transfer.mode": { "en-US": "Mode", "fa-IR": "حالت" },
  "transfer.mode.merge": {
    "en-US": "Merge — keep everything else",
    "fa-IR": "ادغام — بقیه دست‌نخورده بماند",
  },
  "transfer.mode.replace": {
    "en-US": "Replace — delete existing first",
    "fa-IR": "جایگزینی — اول موجودی‌ها حذف شوند",
  },
  "transfer.importing": { "en-US": "Importing…", "fa-IR": "در حال درون‌ریزی…" },
  "transfer.imported": {
    "en-US": "Imported {count} items",
    "fa-IR": "{count} مورد درون‌ریزی شد",
  },
  "transfer.importFailed": { "en-US": "Import failed.", "fa-IR": "درون‌ریزی ناموفق بود." },
  "transfer.notArray": {
    "en-US": "Payload must be a JSON array.",
    "fa-IR": "محتوای ارسالی باید یک آرایهٔ JSON باشد.",
  },
  "transfer.delete": { "en-US": "Delete", "fa-IR": "حذف" },
  "transfer.deleteCount": {
    "en-US": "Delete {count}",
    "fa-IR": "حذف {count} مورد",
  },
  "transfer.copyFrom": { "en-US": "Add from project…", "fa-IR": "افزودن از پروژهٔ دیگر…" },
  "transfer.copyFromTitle": {
    "en-US": "Add {label} from another project",
    "fa-IR": "افزودن {label} از پروژه‌ای دیگر",
  },
  "transfer.copyFromDescription": {
    "en-US":
      "Copies rows into this project. Existing rows with the same key are updated; nothing else is touched. Roles the destination is missing are created automatically.",
    "fa-IR":
      "ردیف‌ها را در این پروژه کپی میکند. ردیف‌های موجود با همان کلید به‌روز میشوند و چیز دیگری دست نمیخورد. نقش‌هایی که مقصد ندارد خودکار ساخته میشوند.",
  },
  "transfer.sourceProject": { "en-US": "Source project", "fa-IR": "پروژهٔ مبدأ" },
  "transfer.chooseProject": { "en-US": "Choose a project", "fa-IR": "یک پروژه انتخاب کن" },
  "transfer.onlySelected": {
    "en-US": "Only the {count} selected rows",
    "fa-IR": "فقط {count} ردیف انتخاب‌شده",
  },
  "transfer.onlySelectedHint": {
    "en-US": " (select rows here first to enable)",
    "fa-IR": " (اول این‌جا ردیف انتخاب کن تا فعال شود)",
  },
  "transfer.copying": { "en-US": "Copying…", "fa-IR": "در حال کپی…" },
  "transfer.copy": { "en-US": "Copy", "fa-IR": "کپی" },
  "transfer.copied": {
    "en-US": "Copied {count} items",
    "fa-IR": "{count} مورد کپی شد",
  },
  "transfer.copiedRoles": {
    "en-US": " · created roles: {roles}",
    "fa-IR": " · نقش‌های ساخته‌شده: {roles}",
  },
  "transfer.copyFailed": { "en-US": "Copy failed.", "fa-IR": "کپی ناموفق بود." },

  // -------------------------------------------------------------- units
  // Byte and count units live in the catalog because they are user-facing
  // words in Persian ("مگابایت"), not symbols. Changing the language is not
  // just swapping digits.
  "unit.byte": { "en-US": "B", "fa-IR": "بایت" },
  "unit.kilobyte": { "en-US": "KB", "fa-IR": "کیلوبایت" },
  "unit.megabyte": { "en-US": "MB", "fa-IR": "مگابایت" },
  "unit.gigabyte": { "en-US": "GB", "fa-IR": "گیگابایت" },
  "unit.terabyte": { "en-US": "TB", "fa-IR": "ترابایت" },
  "unit.million": { "en-US": "M", "fa-IR": "میلیون" },
  "unit.secondsShort": { "en-US": "{count}s", "fa-IR": "{count} ثانیه" },
  "unit.minutesShort": { "en-US": "{count}m", "fa-IR": "{count} دقیقه" },
  "unit.hoursShort": { "en-US": "{count}h", "fa-IR": "{count} ساعت" },
  "unit.daysShort": { "en-US": "{count}d", "fa-IR": "{count} روز" },
} satisfies MessageGroup;