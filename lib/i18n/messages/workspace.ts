import type { MessageGroup } from "../types";

/**
 * The project workspace (`app/dashboard/projects/[projectId]/page.tsx`).
 *
 * Split by tab rather than by component, so the admin console's category
 * filter maps onto something a person can reason about: "everything in the
 * Automate tab" is a coherent group of wording.
 *
 * Counts and quantities arrive as already-formatted strings from `fmt`
 * (`fmt.number`, `fmt.bytes`, `fmt.dateTime`) and are interpolated in here, so
 * a message never has to know how a culture writes a digit.
 */
export const workspace = {
  // ------------------------------------------------------------- chrome
  "workspace.loadFailed": {
    "en-US": "Project not found.",
    "fa-IR": "پروژه پیدا نشد.",
  },
  "workspace.backToProjects": { "en-US": "Back to projects", "fa-IR": "بازگشت به پروژه‌ها" },
  "workspace.allProjects": { "en-US": "All projects", "fa-IR": "همهٔ پروژه‌ها" },
  "workspace.tab.overview": { "en-US": "Overview", "fa-IR": "نمای کلی" },
  "workspace.tab.code": { "en-US": "Code", "fa-IR": "کد" },
  "workspace.tab.data": { "en-US": "Database", "fa-IR": "پایگاه‌داده" },
  "workspace.tab.routes": { "en-US": "Routing", "fa-IR": "مسیرها" },
  "workspace.tab.access": { "en-US": "Access", "fa-IR": "دسترسی" },
  "workspace.tab.secrets": { "en-US": "Secrets", "fa-IR": "اسرار" },
  "workspace.tab.automate": { "en-US": "Automate", "fa-IR": "خودکارسازی" },
  "workspace.tab.settings": { "en-US": "Settings", "fa-IR": "تنظیمات" },

  // ----------------------------------------------------------- overview
  "overview.storage.hint": {
    "en-US": "{count} files of 5 MB free tier",
    "fa-IR": "{count} فایل از پلن رایگان ۵ مگابایتی",
  },
  "overview.visits.hint": { "en-US": "Free quota: {count}", "fa-IR": "سهمیهٔ رایگان: {count}" },
  "overview.url.title": { "en-US": "Serving URL", "fa-IR": "نشانی سرو" },
  "overview.url.hint": {
    "en-US": "Served by the platform with watermark + visit accounting",
    "fa-IR": "با واترمارک و شمارش بازدید توسط پلتفرم سرو میشود",
  },
  "overview.cap.title": { "en-US": "Storage cap", "fa-IR": "سقف فضای ذخیره‌سازی" },
  "overview.cap.used": { "en-US": "{used} of {total} used", "fa-IR": "{used} از {total} مصرف شده" },

  // --------------------------------------------------------------- code
  "files.title": { "en-US": "Project files", "fa-IR": "فایل‌های پروژه" },
  "files.description": {
    "en-US": "Static assets served at your project URL. index.html is the entry point.",
    "fa-IR": "فایل‌های استاتیک که در نشانی پروژه سرو میشوند. ‎index.html نقطهٔ ورود است.",
  },
  "files.upload": { "en-US": "Upload files", "fa-IR": "بارگذاری فایل" },
  "files.new": { "en-US": "New file", "fa-IR": "فایل جدید" },
  "files.new.description": {
    "en-US": "Project-relative path, e.g. about.html or css/main.css",
    "fa-IR": "مسیر نسبت به پروژه، مثل ‎about.html یا ‎css/main.css",
  },
  "files.new.submit": { "en-US": "Create & edit", "fa-IR": "ساخت و ویرایش" },
  "files.new.created": { "en-US": "{name} created", "fa-IR": "‎{name} ساخته شد" },
  "files.new.failed": { "en-US": "Could not create the file.", "fa-IR": "فایل ساخته نشد." },
  "files.rename.title": { "en-US": "Rename or move", "fa-IR": "تغییر نام یا انتقال" },
  "files.rename.description": {
    "en-US": "The destination is project-relative. Typing a new folder creates it.",
    "fa-IR": "مقصد نسبت به پروژه است. نوشتن نام یک پوشهٔ تازه، آن را میسازد.",
  },
  "files.rename.moving": { "en-US": "Moving…", "fa-IR": "در حال انتقال…" },
  "files.rename.done": { "en-US": "Renamed to {to}", "fa-IR": "به «{to}» تغییر نام یافت" },
  "files.rename.failed": { "en-US": "Rename failed.", "fa-IR": "تغییر نام ناموفق بود." },
  "files.usage.used": { "en-US": "{used} of {total} used", "fa-IR": "{used} از {total} مصرف شده" },
  "files.usage.count": { "en-US": "{count} files", "fa-IR": "{count} فایل" },
  "files.root": { "en-US": "root", "fa-IR": "ریشه" },
  "files.filter.placeholder": { "en-US": "Filter…", "fa-IR": "فیلتر…" },
  "files.filter.ariaLabel": { "en-US": "Filter files", "fa-IR": "فیلتر فایل‌ها" },
  "files.sort.name": { "en-US": "Sort: name", "fa-IR": "مرتب‌سازی: نام" },
  "files.sort.size": { "en-US": "Sort: size", "fa-IR": "مرتب‌سازی: حجم" },
  "files.sort.modified": { "en-US": "Sort: modified", "fa-IR": "مرتب‌سازی: تغییر" },
  "files.table.name": { "en-US": "Name", "fa-IR": "نام" },
  "files.table.size": { "en-US": "Size", "fa-IR": "حجم" },
  "files.table.modified": { "en-US": "Modified", "fa-IR": "آخرین تغییر" },
  "files.editing": { "en-US": "editing", "fa-IR": "در حال ویرایش" },
  "files.selectAll": { "en-US": "Select every visible file", "fa-IR": "انتخاب همهٔ فایل‌های دیده‌شده" },
  "files.delete.title": { "en-US": "Delete", "fa-IR": "حذف" },
  "files.delete.confirm": { "en-US": "Delete {label}?", "fa-IR": "‎{label} حذف شود؟" },
  "files.delete.confirmFolder": {
    "en-US": "{path} and everything inside it",
    "fa-IR": "{path} و هر چه درون آن است",
  },
  "files.delete.confirmCount": { "en-US": "Delete {count} files?", "fa-IR": "حذف {count} فایل؟" },
  "files.delete.done": { "en-US": "Deleted", "fa-IR": "حذف شد" },
  "files.delete.doneCount": { "en-US": "{count} deleted", "fa-IR": "{count} مورد حذف شد" },
  "files.delete.failed": { "en-US": "Delete failed.", "fa-IR": "حذف ناموفق بود." },
  "files.empty.filtered": { "en-US": "Nothing matches “{query}”.", "fa-IR": "چیزی با «{query}» پیدا نشد." },
  "files.empty.folder": { "en-US": "This folder is empty.", "fa-IR": "این پوشه خالی است." },
  "files.empty.body": {
    "en-US":
      "This project has no files. Upload from disk or create index.html — it is served at / without any route.",
    "fa-IR":
      "این پروژه هیچ فایلی ندارد. از دیسک بارگذاری کن یا ‎index.html بساز — بدون هیچ مسیری روی ‎/ سرو میشود.",
  },
  "files.listFailed": { "en-US": "Could not list files.", "fa-IR": "فهرست فایل‌ها بارگذاری نشد." },
  "files.openFailed": { "en-US": "Could not open the file.", "fa-IR": "فایل باز نشد." },
  "files.uploaded": { "en-US": "{count} files uploaded", "fa-IR": "{count} فایل بارگذاری شد" },
  "files.uploadFailed": { "en-US": "Upload failed.", "fa-IR": "بارگذاری ناموفق بود." },
  "files.saved": { "en-US": "Saved", "fa-IR": "ذخیره شد" },
  "files.saveFailed": { "en-US": "Save failed.", "fa-IR": "ذخیره ناموفق بود." },
  "files.binary": {
    "en-US": "is a binary file — the editor does not open it.",
    "fa-IR": "یک فایل دودویی است — ویرایشگر آن را باز نمیکند.",
  },

  // --------------------------------------------------------------- data
  "data.title": { "en-US": "Document database", "fa-IR": "پایگاه‌دادهٔ سندی" },
  "data.description": {
    "en-US":
      "Mongo-style JSON documents. Tables appear on first insert — the same API your app calls.",
    "fa-IR":
      "سندهای JSON به سبک Mongo. جدول‌ها با اولین درج ظاهر میشوند — همان API که اپ تو صدا میزند.",
  },
  "data.insert": { "en-US": "Insert document", "fa-IR": "درج سند" },
  "data.insert.title": { "en-US": "Insert into {table}", "fa-IR": "درج در {table}" },
  "data.insert.description": {
    "en-US": "Every document needs a unique id field.",
    "fa-IR": "هر سند به یک فیلد ‎id یکتا نیاز دارد.",
  },
  "data.insert.invalidJson": {
    "en-US": "Document must be valid JSON.",
    "fa-IR": "سند باید JSON معتبر باشد.",
  },
  "data.insert.done": { "en-US": "Document inserted", "fa-IR": "سند درج شد" },
  "data.insert.failed": { "en-US": "Insert failed.", "fa-IR": "درج ناموفق بود." },
  "data.empty.tables": {
    "en-US": "No tables yet — insert a document or let your app call /api/db/insert.",
    "fa-IR": "هنوز جدولی نیست — یک سند درج کن یا بگذار اپ تو ‎/api/db/insert را صدا بزند.",
  },
  "data.search.placeholder": { "en-US": "Search every field…", "fa-IR": "جست‌وجو در همهٔ فیلدها…" },
  "data.search.ariaLabel": { "en-US": "Search documents", "fa-IR": "جست‌وجوی اسناد" },
  "data.sort.created": { "en-US": "Sort: created", "fa-IR": "مرتب‌سازی: ساخت" },
  "data.sort.updated": { "en-US": "Sort: updated", "fa-IR": "مرتب‌سازی: تغییر" },
  "data.sort.id": { "en-US": "Sort: id", "fa-IR": "مرتب‌سازی: شناسه" },
  "data.sort.newest": { "en-US": "Newest first", "fa-IR": "تازه‌ترین اول" },
  "data.sort.oldest": { "en-US": "Oldest first", "fa-IR": "قدیمیترین اول" },
  "data.noMatches": { "en-US": "no matches", "fa-IR": "بدون نتیجه" },
  "data.table.id": { "en-US": "id", "fa-IR": "شناسه" },
  "data.table.fields": { "en-US": "fields", "fa-IR": "فیلدها" },
  "data.table.updated": { "en-US": "Updated", "fa-IR": "آخرین تغییر" },
  "data.delete.title": { "en-US": "Delete document", "fa-IR": "حذف سند" },
  "data.empty.filtered": {
    "en-US": "No document contains “{query}”.",
    "fa-IR": "هیچ سندی شامل «{query}» نیست.",
  },
  "data.empty.table": { "en-US": "This table is empty.", "fa-IR": "این جدول خالی است." },
  "data.loadFailed": { "en-US": "Could not load documents.", "fa-IR": "اسناد بارگذاری نشدند." },
  "data.tablesFailed": { "en-US": "Could not list tables.", "fa-IR": "فهرست جدول‌ها بارگذاری نشد." },
  "data.summary.none": { "en-US": "no fields beyond id", "fa-IR": "هیچ فیلدی جز شناسه ندارد" },
  "data.summary.count": { "en-US": "{count} fields", "fa-IR": "{count} فیلد" },
  "data.summary.more": { "en-US": " +{count} more", "fa-IR": " و {count} فیلد دیگر" },
  "data.dialog.created": { "en-US": "Created {when}", "fa-IR": "ساخته شده: {when}" },
  "data.dialog.updated": { "en-US": "Updated {when}", "fa-IR": "آخرین تغییر: {when}" },
  "data.dialog.empty": {
    "en-US": "This document has no fields beyond its id.",
    "fa-IR": "این سند هیچ فیلدی جز شناسه ندارد.",
  },
  "data.dialog.copyJson": { "en-US": "Copy JSON", "fa-IR": "کپی JSON" },
  "data.dialog.clipboardFailed": {
    "en-US": "Clipboard unavailable.",
    "fa-IR": "کلیپ‌بورد در دسترس نیست.",
  },
  "data.value.array": { "en-US": "array · {count}", "fa-IR": "آرایه · {count}" },
  "data.value.object": { "en-US": "object · {count}", "fa-IR": "شیء · {count}" },
  "data.value.empty": { "en-US": "empty", "fa-IR": "خالی" },
  "data.null": { "en-US": "null", "fa-IR": "null" },

  // ------------------------------------------------------------- routes
  "routes.title": { "en-US": "Routing", "fa-IR": "مسیرها" },
  "routes.description": {
    "en-US": "Exact matches first, then proxy mounts by longest prefix, then static files.",
    "fa-IR": "اول تطبیق دقیق، بعد مسیرهای پروکسی بر اساس بلندترین پیشوند، و در پایان فایل‌های استاتیک.",
  },
  "routes.empty": {
    "en-US":
      "No routes yet. A project serves index.html at / without one — add a route to point a path at a different HTML file, gate it behind a login, or forward it to another service.",
    "fa-IR":
      "هنوز مسیری نیست. یک پروژه بدون مسیر هم ‎index.html را روی ‎/ سرو میکند — با افزودن مسیر میتوانی یک نشانی را به فایل HTML دیگری وصل کنی، پشت ورود پنهانش کنی یا به سرویسی دیگر بفرستی.",
  },
  "routes.save.done": { "en-US": "Route {path} saved", "fa-IR": "مسیر {path} ذخیره شد" },
  "routes.save.failed": { "en-US": "Could not save the route.", "fa-IR": "مسیر ذخیره نشد." },
  "routes.loadFailed": { "en-US": "Could not load routes.", "fa-IR": "مسیرها بارگذاری نشدند." },
  "routes.delete.confirm": { "en-US": "Delete {count} routes?", "fa-IR": "حذف {count} مسیر؟" },
  "routes.delete.doneCount": { "en-US": "{count} removed", "fa-IR": "{count} مورد حذف شد" },
  "routes.delete.done": { "en-US": "Route deleted", "fa-IR": "مسیر حذف شد" },
  "routes.delete.failed": { "en-US": "Delete failed.", "fa-IR": "حذف ناموفق بود." },
  "routes.selectAll": { "en-US": "Select every route", "fa-IR": "انتخاب همهٔ مسیرها" },
  "routes.table.path": { "en-US": "Path", "fa-IR": "مسیر" },
  "routes.table.target": { "en-US": "Target", "fa-IR": "هدف" },
  "routes.table.file": { "en-US": "File", "fa-IR": "فایل" },
  "routes.table.auth": { "en-US": "Auth", "fa-IR": "احراز" },
  "routes.openTitle": { "en-US": "Open {path}", "fa-IR": "باز کردن {path}" },
  "routes.open": { "en-US": "open", "fa-IR": "باز کردن" },
  "routes.disabled": { "en-US": "disabled", "fa-IR": "غیرفعال" },
  "routes.downloadTitle": { "en-US": "Download {file}", "fa-IR": "دانلود {file}" },
  "routes.download": { "en-US": "download", "fa-IR": "دانلود" },
  "routes.missing": { "en-US": "missing", "fa-IR": "موجود نیست" },
  "routes.proxyMount": { "en-US": "proxy mount", "fa-IR": "سوارشدهٔ پروکسی" },
  "routes.anyVisitor": { "en-US": "any visitor", "fa-IR": "هر بازدیدکننده" },
  "routes.public": { "en-US": "public", "fa-IR": "عمومی" },
  "routes.form.title": { "en-US": "Add or update a route", "fa-IR": "افزودن یا به‌روزرسانی مسیر" },
  "routes.form.description": {
    "en-US": "Saving an existing path updates it.",
    "fa-IR": "ذخیرهٔ یک مسیر موجود، همان را به‌روز میکند.",
  },
  "routes.form.pathLabel": { "en-US": "Path pattern", "fa-IR": "الگوی مسیر" },
  "routes.form.targetLabel": { "en-US": "Target file", "fa-IR": "فایل هدف" },
  "routes.form.targetMissing": {
    "en-US": "{file} does not exist yet — this path will 404 until you create it in the Code tab.",
    "fa-IR": "‎{file} هنوز وجود ندارد — تا در تب کد نسازی، این مسیر ‎۴۰۴ میدهد.",
  },
  "routes.form.targetNoFiles": {
    "en-US": "This project has no files yet; create one in the Code tab first.",
    "fa-IR": "این پروژه هنوز فایلی ندارد؛ اول در تب کد یکی بساز.",
  },
  "routes.form.targetCount": {
    "en-US": "{count} files in this project. Paths are project-relative and resolve against your project base URL.",
    "fa-IR": "‎{count} فایل در این پروژه. مسیرها نسبت به پروژه‌اند و روی نشانی پایهٔ پروژه resolve میشوند.",
  },
  "routes.form.proxy": { "en-US": "Proxy route", "fa-IR": "مسیر پروکسی" },
  "routes.form.requiresAuth": { "en-US": "Requires visitor auth", "fa-IR": "نیازمند احراز بازدیدکننده" },
  "routes.form.rolePlaceholder": { "en-US": "Role (optional)", "fa-IR": "نقش (اختیاری)" },
  "routes.form.permissionPlaceholder": {
    "en-US": "Permission (optional)",
    "fa-IR": "مجوز (اختیاری)",
  },
  "routes.form.permissionAria": { "en-US": "Required permission", "fa-IR": "مجوز لازم" },
  "routes.form.anyPermission": { "en-US": "Any permission", "fa-IR": "هر مجوزی" },
  "routes.form.save": { "en-US": "Save route", "fa-IR": "ذخیرهٔ مسیر" },
  "routes.form.test": { "en-US": "Test this path", "fa-IR": "آزمایش این مسیر" },

  // --------------------------------------------------------------- roles
  "roles.empty": {
    "en-US":
      "No roles yet. A visitor without a role can still sign in; roles are what let a route or an API endpoint require a specific set of permissions.",
    "fa-IR":
      "هنوز نقشی نیست. بازدیدکننده بدون نقش هم میتواند وارد شود؛ نقش‌ها همان چیزی‌اند که به یک مسیر یا نشانی API اجازه میدهند مجموعه‌ای مشخص از مجوزها بخواهد.",
  },
  "roles.new.label": { "en-US": "New role", "fa-IR": "نقش جدید" },
  "roles.new.submit": { "en-US": "Add role", "fa-IR": "افزودن نقش" },
  "roles.create.done": { "en-US": 'Role "{name}" created', "fa-IR": "نقش «{name}» ساخته شد" },
  "roles.create.failed": { "en-US": "Could not create the role.", "fa-IR": "نقش ساخته نشد." },
  "roles.update.done": { "en-US": "Role updated", "fa-IR": "نقش به‌روز شد" },
  "roles.update.failed": { "en-US": "Could not update the role.", "fa-IR": "نقش به‌روز نشد." },
  "roles.delete.doneVisitors": {
    "en-US": "Role and {count} visitors deleted",
    "fa-IR": "نقش و {count} بازدیدکننده حذف شد",
  },
  "roles.delete.doneMoved": {
    "en-US": "Role deleted; {count} visitors moved",
    "fa-IR": "نقش حذف شد؛ {count} بازدیدکننده منتقل شد",
  },
  "roles.delete.doneLeft": {
    "en-US": "Role deleted; {count} visitors have no role",
    "fa-IR": "نقش حذف شد؛ {count} بازدیدکننده بدون نقش ماند",
  },
  "roles.delete.failed": { "en-US": "Could not delete the role.", "fa-IR": "نقش حذف نشد." },
  "roles.selectAll": { "en-US": "Select every role", "fa-IR": "انتخاب همهٔ نقش‌ها" },
  "roles.table.role": { "en-US": "Role", "fa-IR": "نقش" },
  "roles.table.visitors": { "en-US": "Visitors", "fa-IR": "بازدیدکنندگان" },
  "roles.table.permissions": { "en-US": "Permissions", "fa-IR": "مجوزها" },
  "roles.none": { "en-US": "none", "fa-IR": "هیچ" },
  "roles.morePermissions": { "en-US": "+{count}", "fa-IR": "+{count}" },
  "roles.manageTitle": { "en-US": "Manage {name}", "fa-IR": "مدیریت {name}" },
  "roles.menu.edit": { "en-US": "Edit name & permissions", "fa-IR": "ویرایش نام و مجوزها" },
  "roles.menu.delete": { "en-US": "Delete role…", "fa-IR": "حذف نقش…" },
  "roles.edit.title": { "en-US": "Edit role", "fa-IR": "ویرایش نقش" },
  "roles.edit.description": {
    "en-US": "Permissions gate API keys and routes; a role with none can sign in but nothing else.",
    "fa-IR": "مجوزها روی کلیدهای API و مسیرها اثر میگذارند؛ نقشی بدون مجوز فقط میتواند وارد شود و هیچ کار دیگری.",
  },
  "roles.edit.nameLabel": { "en-US": "Name", "fa-IR": "نام" },
  "roles.edit.permissionsLabel": { "en-US": "Permissions ({count})", "fa-IR": "مجوزها ({count})" },
  "roles.edit.noCatalogue": {
    "en-US": "No permission catalogue available.",
    "fa-IR": "فهرست مجوزها در دسترس نیست.",
  },
  "roles.edit.save": { "en-US": "Save role", "fa-IR": "ذخیرهٔ نقش" },
  "roles.delete.title": { "en-US": 'Delete "{name}"', "fa-IR": "حذف «{name}»" },
  "roles.delete.description": {
    "en-US": "{count} visitors have this role. Choose what happens to them.",
    "fa-IR": "{count} بازدیدکننده این نقش را دارند. سرنوشتشان را انتخاب کن.",
  },
  "roles.delete.holdersOne": {
    "en-US": "1 visitor has this role. Choose what happens to them.",
    "fa-IR": "۱ بازدیدکننده این نقش را دارد. سرنوشتش را انتخاب کن.",
  },
  "roles.delete.option.leave_title": { "en-US": "Keep them, without a role", "fa-IR": "نگهشان دار، بدون نقش" },
  "roles.delete.option.leave_detail": {
    "en-US": "They still sign in and match routes that need no particular role.",
    "fa-IR": "همچنان وارد میشوند و با مسیرهایی که نقش خاصی نمیخواهند کار میکنند.",
  },
  "roles.delete.option.move_title": { "en-US": "Move them to another role", "fa-IR": "انتقالشان به نقشی دیگر" },
  "roles.delete.option.move_detail": {
    "en-US": "Pick the role below; they inherit its permissions immediately.",
    "fa-IR": "نقش را پایین‌تر انتخاب کن؛ مجوزهایش را همان لحظه به ارث میبرند.",
  },
  "roles.delete.option.remove_title": { "en-US": "Delete those visitors", "fa-IR": "حذف آن بازدیدکننده‌ها" },
  "roles.delete.option.remove_detail": {
    "en-US": "Removes the accounts and their password hashes. Cannot be undone.",
    "fa-IR": "حساب‌ها و هش رمزهایشان حذف میشود. برگشت‌پذیر نیست.",
  },
  "roles.delete.moveToLabel": { "en-US": "Move to role", "fa-IR": "انتقال به نقش" },
  "roles.delete.chooseRole": { "en-US": "Choose a role", "fa-IR": "یک نقش انتخاب کن" },
  "roles.delete.roleOption": {
    "en-US": "{name} ({count} permissions)",
    "fa-IR": "{name} ({count} مجوز)",
  },
  "roles.delete.confirm": { "en-US": "Delete role", "fa-IR": "حذف نقش" },
  "roles.delete.deleting": { "en-US": "Deleting…", "fa-IR": "در حال حذف…" },

  // -------------------------------------------------------------- access
  "access.visitors.title": { "en-US": "Visitor accounts", "fa-IR": "حساب‌های بازدیدکننده" },
  "access.visitors.description": {
    "en-US":
      "Per-project logins for requires-auth routes. Visitors sign in at your project URL or get redirected automatically.",
    "fa-IR":
      "ورودهای مخصوص همین پروژه برای مسیرهای نیازمند احراز. بازدیدکننده در نشانی پروژه وارد میشود یا خودکار هدایت میشود.",
  },
  "access.visitors.urlHint": { "en-US": "your project URL", "fa-IR": "نشانی پروژهٔ تو" },
  "access.visitors.add": { "en-US": "Add visitor", "fa-IR": "افزودن بازدیدکننده" },
  "access.visitors.done": { "en-US": "Visitor created", "fa-IR": "بازدیدکننده ساخته شد" },
  "access.visitors.failed": { "en-US": "Could not create the visitor.", "fa-IR": "بازدیدکننده ساخته نشد." },
  "access.visitors.removed": { "en-US": "Visitor removed", "fa-IR": "بازدیدکننده حذف شد" },
  "access.visitors.deleteConfirm": {
    "en-US": "Delete {count} visitor accounts?",
    "fa-IR": "حذف {count} حساب بازدیدکننده؟",
  },
  "access.visitors.removedCount": { "en-US": "{count} removed", "fa-IR": "{count} مورد حذف شد" },
  "access.visitors.selectionHint": {
    "en-US": "Use the controls on the list to export, import or copy these accounts.",
    "fa-IR": "برای برون‌بری، درون‌ریزی یا کپی این حساب‌ها از ابزارهای بالای فهرست استفاده کن.",
  },
  "access.visitors.label": { "en-US": "visitors", "fa-IR": "بازدیدکننده" },
  "access.visitors.selectAll": { "en-US": "Select every visitor", "fa-IR": "انتخاب همهٔ بازدیدکننده‌ها" },
  "access.visitors.roleFor": { "en-US": "Role for {name}", "fa-IR": "نقش {name}" },
  "access.roleChanged": { "en-US": "{name} is now {role}", "fa-IR": "‎{name} حالا {role} است" },
  "access.roleFailed": { "en-US": "Could not change the role.", "fa-IR": "نقش تغییر نکرد." },
  "access.keys.title": { "en-US": "API keys", "fa-IR": "کلیدهای API" },
  "access.keys.description": {
    "en-US": "Machine access pinned to this project: Authorization: Bearer sk_…",
    "fa-IR": "دسترسی ماشینی که به همین پروژه سنجاق شده است: ‎Authorization: Bearer sk_…",
  },
  "access.keys.once": {
    "en-US": "Copy this key now — it is shown only once.",
    "fa-IR": "این کلید را همین حالا کپی کن — فقط یک بار نشان داده میشود.",
  },
  "access.keys.nameLabel": { "en-US": "Key name", "fa-IR": "نام کلید" },
  "access.keys.create": { "en-US": "Create key", "fa-IR": "ساخت کلید" },
  "access.keys.failed": { "en-US": "Could not create the key.", "fa-IR": "کلید ساخته نشد." },
  "access.keys.permissionsHint": {
    "en-US": "Permissions — leave all unchecked for full project access",
    "fa-IR": "مجوزها — برای دسترسی کامل به پروژه هیچ‌کدام را تیک نزن",
  },
  "access.keys.table.name": { "en-US": "Name", "fa-IR": "نام" },
  "access.keys.table.prefix": { "en-US": "Prefix", "fa-IR": "پیشوند" },
  "access.keys.table.status": { "en-US": "Status", "fa-IR": "وضعیت" },
  "access.keys.permissionCount": {
    "en-US": "{count} permissions",
    "fa-IR": "{count} مجوز",
  },
  "access.keys.revoked": { "en-US": "revoked", "fa-IR": "ابطال‌شده" },
  "access.keys.active": { "en-US": "active", "fa-IR": "فعال" },
  "access.keys.revokeDone": { "en-US": "Key revoked", "fa-IR": "کلید ابطال شد" },
  "access.keys.revokeFailed": { "en-US": "Revoke failed.", "fa-IR": "ابطال ناموفق بود." },

  // ------------------------------------------------------------- secrets
  "secrets.title": { "en-US": "Secrets", "fa-IR": "اسرار" },
  "secrets.description": {
    "en-US":
      "AES-256-GCM sealed. Reference them in proxy headers as {{KEY}} — plaintext never appears in config or logs.",
    "fa-IR":
      "با ‎AES-256-GCM مهر و موم میشوند. در هدرهای پروکسی به شکل ‎{{KEY}} به آن‌ها ارجاع بده — متن آشکار هرگز در تنظیمات یا لاگ ظاهر نمیشود.",
  },
  "secrets.sealed": { "en-US": "Secret sealed", "fa-IR": "راز مهر و موم شد" },
  "secrets.saveFailed": { "en-US": "Could not save the secret.", "fa-IR": "راز ذخیره نشد." },
  "secrets.loadFailed": { "en-US": "Could not load secrets.", "fa-IR": "اسرار بارگذاری نشدند." },
  "secrets.revealFailed": { "en-US": "Could not decrypt.", "fa-IR": "رمزگشایی نشد." },
  "secrets.reveal": { "en-US": "reveal once", "fa-IR": "یک بار نمایش بده" },
  "secrets.deleteConfirm": { "en-US": "Delete secret {key}?", "fa-IR": "راز {key} حذف شود؟" },
  "secrets.deleteConfirmCount": { "en-US": "Delete {count} secrets?", "fa-IR": "حذف {count} راز؟" },
  "secrets.deleted": { "en-US": "Secret deleted", "fa-IR": "راز حذف شد" },
  "secrets.removedCount": { "en-US": "{count} removed", "fa-IR": "{count} مورد حذف شد" },
  "secrets.deleteFailed": { "en-US": "Delete failed.", "fa-IR": "حذف ناموفق بود." },
  "secrets.filter.placeholder": { "en-US": "Filter keys…", "fa-IR": "فیلتر کلیدها…" },
  "secrets.filter.ariaLabel": { "en-US": "Filter secrets", "fa-IR": "فیلتر اسرار" },
  "secrets.shownOf": { "en-US": "{shown} of {total}", "fa-IR": "{shown} از {total}" },
  "secrets.hideAll": { "en-US": "Hide all", "fa-IR": "پنهان کردن همه" },
  "secrets.selectAll": {
    "en-US": "Select every visible secret",
    "fa-IR": "انتخاب همهٔ اسرار دیده‌شده",
  },
  "secrets.table.value": { "en-US": "Value", "fa-IR": "مقدار" },
  "secrets.empty.filtered": { "en-US": "No secret matches {query}.", "fa-IR": "هیچ رازی با {query} پیدا نشد." },
  "secrets.empty.body": {
    "en-US":
      "No secrets yet. Add one below and reference it from a proxy route header as {{KEY}} — the value is decrypted at request time and never written to a file.",
    "fa-IR":
      "هنوز رازی نیست. یکی پایین‌تر بساز و در هدر یک مسیر پروکسی به شکل ‎{{KEY}} به آن ارجاع بده — مقدار در لحظهٔ درخواست رمزگشایی میشود و هرگز در فایلی نوشته نمیشود.",
  },
  "secrets.form.title": { "en-US": "Add or update a secret", "fa-IR": "افزودن یا به‌روزرسانی راز" },
  "secrets.form.valueLabel": { "en-US": "Value", "fa-IR": "مقدار" },
  "secrets.form.submit": { "en-US": "Seal secret", "fa-IR": "مهر و موم راز" },

  // ------------------------------------------------------------ automate
  "automate.cron.title": { "en-US": "Built-in cron jobs", "fa-IR": "کران‌جاب‌های داخلی" },
  "automate.cron.description": {
    "en-US":
      "Database-backed schedule. The platform runner calls /api/cron/run with the platform cron token and executes every task whose next run is due.",
    "fa-IR":
      "زمان‌بندی نگهداری‌شده در پایگاه‌داده. اجراکنندهٔ پلتفرم ‎/api/cron/run را با توکن کرون پلتفرم صدا میزند و هر وظیفه‌ای که زمانش رسیده را اجرا میکند.",
  },
  "automate.cron.table.task": { "en-US": "Task", "fa-IR": "وظیفه" },
  "automate.cron.table.lastRun": { "en-US": "Last run", "fa-IR": "آخرین اجرا" },
  "automate.cron.runNow": { "en-US": "Run now", "fa-IR": "همین حالا اجرا کن" },
  "automate.cron.done": { "en-US": "{task} executed", "fa-IR": "‎{task} اجرا شد" },
  "automate.cron.failed": { "en-US": "Run failed.", "fa-IR": "اجرا ناموفق بود." },
  "automate.cron.toggleFailed": { "en-US": "Toggle failed.", "fa-IR": "تغییر وضعیت ناموفق بود." },
  "automate.hooks.title": { "en-US": "Webhooks", "fa-IR": "وب‌هوک‌ها" },
  "automate.hooks.description": {
    "en-US": "Deliveries are signed with HMAC-SHA256 in x-webhook-signature.",
    "fa-IR": "تحویل‌ها با ‎HMAC-SHA256 در هدر ‎x-webhook-signature امضا میشوند.",
  },
  "automate.hooks.once": {
    "en-US": "Signing secret — shown only once:",
    "fa-IR": "راز امضا — فقط یک بار نشان داده میشود:",
  },
  "automate.hooks.urlLabel": { "en-US": "Endpoint URL", "fa-IR": "نشانی مقصد" },
  "automate.hooks.add": { "en-US": "Add webhook", "fa-IR": "افزودن وب‌هوک" },
  "automate.hooks.created": { "en-US": "Webhook created", "fa-IR": "وب‌هوک ساخته شد" },
  "automate.hooks.createFailed": { "en-US": "Could not create the webhook.", "fa-IR": "وب‌هوک ساخته نشد." },
  "automate.hooks.deleted": { "en-US": "Webhook deleted", "fa-IR": "وب‌هوک حذف شد" },
  "automate.hooks.deleteFailed": { "en-US": "Delete failed.", "fa-IR": "حذف ناموفق بود." },
  "automate.hooks.copyTitle": { "en-US": "Copy URL", "fa-IR": "کپی نشانی" },
  "automate.hooks.copied": { "en-US": "URL copied", "fa-IR": "نشانی کپی شد" },
  "automate.hooks.clipboardFailed": {
    "en-US": "Clipboard unavailable.",
    "fa-IR": "کلیپ‌بورد در دسترس نیست.",
  },
  "automate.hooks.test": { "en-US": "Test", "fa-IR": "آزمایش" },
  "automate.hooks.testDelivered": {
    "en-US": "Test payload delivered",
    "fa-IR": "محمولهٔ آزمایشی تحویل شد",
  },
  "automate.hooks.testNothing": {
    "en-US": "Nothing delivered — check the URL and the delivery log.",
    "fa-IR": "چیزی تحویل نشد — نشانی و گزارش تحویل را بررسی کن.",
  },
  "automate.hooks.testFailed": { "en-US": "Test failed.", "fa-IR": "آزمایش ناموفق بود." },
  "automate.hooks.table.events": { "en-US": "Events", "fa-IR": "رویدادها" },
  "automate.hooks.deliveries": { "en-US": "Recent deliveries", "fa-IR": "تحویل‌های اخیر" },
  "automate.hooks.table.event": { "en-US": "Event", "fa-IR": "رویداد" },
  "automate.hooks.table.endpoint": { "en-US": "Endpoint", "fa-IR": "مقصد" },
  "automate.hooks.table.when": { "en-US": "When", "fa-IR": "کِی" },
  "automate.hooks.error": { "en-US": "error", "fa-IR": "خطا" },
  "automate.endpoints.title": { "en-US": "Named API endpoints", "fa-IR": "نشانی‌های API نام‌دار" },
  "automate.endpoints.description": {
    "en-US": "Disabled endpoints return 403 for this project (api_endpoints).",
    "fa-IR": "نشانی‌های غیرفعال برای این پروژه ‎۴۰۳ برمیگردانند (‎api_endpoints).",
  },
  "automate.endpoints.public": { "en-US": "Public", "fa-IR": "عمومی" },
  "automate.endpoints.hint": {
    "en-US":
      "Turning Public on allows anonymous, project-scoped calls to that endpoint — use it for public read APIs and form submissions. Everything else requires a session or API key.",
    "fa-IR":
      "روشن کردن «عمومی» اجازهٔ فراخوانی ناشناس و محدود به پروژه را میدهد — برای APIهای خواندنی عمومی و ارسال فرم. بقیه به نشست یا کلید API نیاز دارند.",
  },
  "automate.endpoints.updateFailed": { "en-US": "Update failed.", "fa-IR": "به‌روزرسانی ناموفق بود." },

  // ------------------------------------------------------------ settings
  "settings.general.title": { "en-US": "General", "fa-IR": "عمومی" },
  "settings.general.description": {
    "en-US": "The name is the public URL segment — renaming breaks old links.",
    "fa-IR": "نام، بخشی از نشانی عمومی است — تغییرش لینک‌های قدیمی را خراب میکند.",
  },
  "settings.general.nameLabel": { "en-US": "Project name", "fa-IR": "نام پروژه" },
  "settings.general.watermark": { "en-US": "Hosted-on watermark", "fa-IR": "واترمارک میزبانی" },
  "settings.general.save": { "en-US": "Save settings", "fa-IR": "ذخیرهٔ تنظیمات" },
  "settings.general.saved": { "en-US": "Settings saved", "fa-IR": "تنظیمات ذخیره شد" },
  "settings.general.saveFailed": { "en-US": "Save failed.", "fa-IR": "ذخیره ناموفق بود." },
  "settings.general.live": { "en-US": "Project live", "fa-IR": "پروژه فعال" },
  "settings.general.liveHint": {
    "en-US": "Suspended projects return 403 on every serving path.",
    "fa-IR": "پروژه‌های تعلیق‌شده روی همهٔ مسیرهای سرو ‎۴۰۳ برمیگردانند.",
  },
  "settings.general.resumed": { "en-US": "Project resumed", "fa-IR": "پروژه از تعلیق خارج شد" },
  "settings.general.suspended": {
    "en-US": "Project suspended (serving now 403s)",
    "fa-IR": "پروژه تعلیق شد (سرو اکنون ‎۴۰۳ میدهد)",
  },
  "settings.general.updateFailed": { "en-US": "Update failed.", "fa-IR": "به‌روزرسانی ناموفق بود." },
  "settings.domains.title": { "en-US": "Custom domains", "fa-IR": "دامنه‌های اختصاصی" },
  "settings.domains.description": {
    "en-US":
      "Point the domain at this host, publish the TXT record, then verify. Verified domains serve this project directly.",
    "fa-IR":
      "دامنه را به این میزبان وصل کن، رکورد TXT را منتشر کن و بعد تأییدش کن. دامنه‌های تأییدشده این پروژه را مستقیم سرو میکنند.",
  },
  "settings.domains.label": { "en-US": "Domain", "fa-IR": "دامنه" },
  "settings.domains.attach": { "en-US": "Attach", "fa-IR": "اتصال" },
  "settings.domains.attached": {
    "en-US": "Domain attached — publish the TXT record, then verify",
    "fa-IR": "دامنه متصل شد — رکورد TXT را منتشر کن و بعد تأیید کن",
  },
  "settings.domains.attachFailed": {
    "en-US": "Could not attach the domain.",
    "fa-IR": "اتصال دامنه ناموفق بود.",
  },
  "settings.domains.verified": { "en-US": "{domain} verified", "fa-IR": "‎{domain} تأیید شد" },
  "settings.domains.notFound": {
    "en-US": "TXT record not found yet — DNS can take a few minutes",
    "fa-IR": "رکورد TXT هنوز پیدا نشد — DNS چند دقیقه طول میکشد",
  },
  "settings.domains.verifyFailed": {
    "en-US": "Verification failed.",
    "fa-IR": "تأیید ناموفق بود.",
  },
  "settings.domains.badge.verified": { "en-US": "verified", "fa-IR": "تأییدشده" },
  "settings.domains.badge.pending": { "en-US": "pending", "fa-IR": "در انتظار" },
  "settings.domains.verify": { "en-US": "Verify", "fa-IR": "تأیید" },
  "settings.domains.removeFailed": { "en-US": "Delete failed.", "fa-IR": "حذف ناموفق بود." },

  // --------------------------------------------------------------- usage
  "usage.title": { "en-US": "Usage", "fa-IR": "مصرف" },
  "usage.summary": {
    "en-US": "{visits} visits this month of {free} free",
    "fa-IR": "‎{visits} بازدید این ماه از {free} رایگان",
  },
  "usage.empty": {
    "en-US": "Daily rollups appear after the stats cron runs (or run it from Automate).",
    "fa-IR": "گزارش‌های روزانه بعد از اجرای کرون آمار ظاهر میشوند (یا از بخش خودکارسازی اجرایش کن).",
  },
  "usage.days": { "en-US": "{count} days", "fa-IR": "{count} روز" },
  "usage.visits": { "en-US": "visits", "fa-IR": "بازدید" },
  "usage.unique": { "en-US": "unique", "fa-IR": "یکتا" },
  "usage.week": { "en-US": "Week of {from} – {to}", "fa-IR": "هفتهٔ {from} تا {to}" },
  "usage.filter.from": { "en-US": "From", "fa-IR": "از تاریخ" },
  "usage.filter.to": { "en-US": "To", "fa-IR": "تا تاریخ" },
  "usage.filter.any": { "en-US": "Any date", "fa-IR": "هر تاریخ" },
  "usage.filter.noMatch": {
    "en-US": "No day in this project falls inside that range.",
    "fa-IR": "هیچ روزی از این پروژه در آن بازه نیفتد.",
  },

  // -------------------------------------------------------------- backup
  "backup.title": { "en-US": "Backup", "fa-IR": "پشتیبان" },
  "backup.description": {
    "en-US": "ZIP export of every file in this project (Blueprint §4.3).",
    "fa-IR": "برون‌بری ZIP از همهٔ فایل‌های این پروژه (Blueprint §4.3).",
  },
  "backup.filesOnly": { "en-US": "Files only (.zip)", "fa-IR": "فقط فایل‌ها (‎.zip)" },
  "backup.full": {
    "en-US": "Full export — files, library, config, secrets (.zip)",
    "fa-IR": "برون‌بری کامل — فایل‌ها، کتابخانه، تنظیمات، اسرار (‎.zip)",
  },
  "backup.restoreTitle": { "en-US": "Restore from an export", "fa-IR": "بازیابی از یک برون‌بری" },
  "backup.restoreDescription": {
    "en-US":
      "Upload a full export archive to overwrite the files and configuration of this project. Imported visitors start disabled — password hashes are never exported.",
    "fa-IR":
      "یک آرشیو برون‌بری کامل را بارگذاری کنید تا فایل‌ها و تنظیمات این پروژه بازنویسی شود. بازدیدکننده‌های درون‌ریزی‌شده از ابتدا غیرفعال‌اند — هش رمزها هرگز برون‌بری نمیشوند.",
  },
  "backup.restoreSubmit": { "en-US": "Restore archive", "fa-IR": "بازیابی آرشیو" },
  "backup.restoring": { "en-US": "Restoring…", "fa-IR": "در حال بازیابی…" },
  "backup.restoreDone": {
    "en-US": "Restored {files} files and {features} config sections",
    "fa-IR": "‎{files} فایل و {features} بخش تنظیمات بازیابی شد",
  },
  "backup.restoreFailed": { "en-US": "Import failed.", "fa-IR": "درون‌ریزی ناموفق بود." },
  "backup.conflict.title": { "en-US": "Library Conflict Detected", "fa-IR": "تداخل فایل‌های کتابخانه" },
  "backup.conflict.description": {
    "en-US":
      "Your account library has {existing} asset(s), and this archive includes {incoming} library asset(s). Choose how to handle your shared library:",
    "fa-IR":
      "کتابخانهٔ مشترک شما دارای {existing} فایل است و این آرشیو شامل {incoming} فایل کتابخانه است. نحوهٔ اعمال تغییرات را انتخاب کنید:",
  },
  "backup.conflict.overwrite": { "en-US": "Overwrite completely", "fa-IR": "جایگزینی کامل" },
  "backup.conflict.overwriteDesc": {
    "en-US": "Dump current library completely and replace with archive assets.",
    "fa-IR": "پاک‌سازی کامل کتابخانهٔ فعلی و جایگزینی با فایل‌های آرشیو.",
  },
  "backup.conflict.append": { "en-US": "Append & overwrite", "fa-IR": "افزودن و بازنویسی" },
  "backup.conflict.appendDesc": {
    "en-US": "Add new assets and update existing duplicates; preserve other files.",
    "fa-IR": "افزودن فایل‌های جدید و به‌روزرسانی فایل‌های هم‌نام؛ حفظ سایر فایل‌ها.",
  },
  "backup.conflict.skip": { "en-US": "Skip library", "fa-IR": "صرف‌نظر از کتابخانه" },
  "backup.conflict.skipDesc": {
    "en-US": "Restore only project files and configuration; do not modify library.",
    "fa-IR": "فقط فایل‌ها و تنظیمات پروژه بازیابی شوند و کتابخانه تغییر نکند.",
  },
} satisfies MessageGroup;
