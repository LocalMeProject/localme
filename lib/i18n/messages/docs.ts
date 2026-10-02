import type { MessageGroup } from "../types";

/**
 * The API reference (`app/docs/page.tsx`).
 *
 * This page is the platform's contract with a developer, so it is catalogued
 * like every other surface — an operator can reword a paragraph without
 * touching the code, and a Persian reader gets the reference in Persian.
 *
 * API paths, HTTP methods, header names, config keys, cron expressions and
 * error codes are *not* translated: they are identifiers, and they are
 * written inside `‹angle brackets›` in a message so the page can render them
 * in the monospace, forced-LTR span that makes them readable inside Persian
 * text. That is the only markup the message format carries, and the renderer
 * lives next to the page rather than in this layer.
 */
export const docs = {
  // ---------------------------------------------------------- navigation
  "docs.nav.overview": { "en-US": "Overview", "fa-IR": "نمای کلی" },
  "docs.nav.addressing": { "en-US": "Addressing & context", "fa-IR": "نشانی‌دهی و بافت" },
  "docs.nav.auth": { "en-US": "Authentication", "fa-IR": "احراز هویت" },
  "docs.nav.database": { "en-US": "Database", "fa-IR": "پایگاه‌داده" },
  "docs.nav.storage": { "en-US": "Storage", "fa-IR": "فضای ذخیره‌سازی" },
  "docs.nav.library": { "en-US": "Library", "fa-IR": "کتابخانه" },
  "docs.nav.secrets": { "en-US": "Secrets & proxy", "fa-IR": "اسرار و پروکسی" },
  "docs.nav.serving": { "en-US": "Routing & serving", "fa-IR": "مسیریابی و سرو" },
  "docs.nav.operations": { "en-US": "Certificates & operations", "fa-IR": "گواهی‌ها و عملیات" },
  "docs.nav.console": { "en-US": "Console API", "fa-IR": "API کنسول" },
  "docs.nav.limits": { "en-US": "Limits & quotas", "fa-IR": "محدودیت‌ها و سهمیه‌ها" },
  "docs.nav.errors": { "en-US": "Errors", "fa-IR": "خطاها" },

  // -------------------------------------------------------------- header
  "docs.header.health": { "en-US": "Health", "fa-IR": "سلامت سرویس" },
  "docs.header.signIn": { "en-US": "Sign in", "fa-IR": "ورود" },
  "docs.aside.eyebrow": { "en-US": "api reference", "fa-IR": "مرجع API" },
  "docs.aside.aria": { "en-US": "API sections", "fa-IR": "بخش‌های API" },
  "docs.aside.consoleTitle": { "en-US": "Console", "fa-IR": "کنسول" },
  "docs.aside.consoleBody": {
    "en-US": "Everything documented here has a matching panel in the dashboard.",
    "fa-IR": "هر چیزی که این‌جا مستند شده، یک پنل متناظر در پیشخوان دارد.",
  },
  "docs.aside.openConsole": { "en-US": "Open the console", "fa-IR": "باز کردن کنسول" },
  "docs.main.eyebrow": { "en-US": "documentation", "fa-IR": "مستندات" },
  "docs.main.title": { "en-US": "LocalMe HTTP API", "fa-IR": "‎LocalMe HTTP API" },
  "docs.main.lede": {
    "en-US":
      "Every hosted project talks to the same REST surface. The platform resolves which project is calling from the request path or the ‹X-Project-Id› header, so your frontend can use relative ‹/api/…› URLs from any page.",
    "fa-IR":
      "همهٔ پروژه‌های میزبانی‌شده با یک سطح REST یکسان کار میکنند. پلتفرم از روی مسیر درخواست یا هدر ‹X-Project-Id› تشخیص میدهد کدام پروژه دارد صدا میزند، بنابراین فرانت‌اند تو میتواند از هر صفحه‌ای نشانی‌های نسبی ‹/api/…› را صدا بزند.",
  },
  "docs.main.badge.json": { "en-US": "JSON over HTTPS", "fa-IR": "JSON روی HTTPS" },
  "docs.main.badge.credential": {
    "en-US": "cookie or Bearer key",
    "fa-IR": "کوکی یا کلید Bearer",
  },
  "docs.main.badge.nobuild": { "en-US": "no build step", "fa-IR": "بدون مرحلهٔ build" },

  // ------------------------------------------------------- table headers
  "docs.table.method": { "en-US": "Method", "fa-IR": "متد" },
  "docs.table.path": { "en-US": "Path", "fa-IR": "مسیر" },
  "docs.table.notes": { "en-US": "Notes", "fa-IR": "توضیح" },
  "docs.table.operator": { "en-US": "Operator", "fa-IR": "عملگر" },
  "docs.table.meaning": { "en-US": "Meaning", "fa-IR": "معنا" },
  "docs.table.status": { "en-US": "Status", "fa-IR": "وضعیت" },
  "docs.table.codes": { "en-US": "Common codes", "fa-IR": "کدهای رایج" },

  // -------------------------------------------------------- auth legend
  "docs.auth.legend.sessionOrKey": {
    "en-US": "session or API key",
    "fa-IR": "نشست یا کلید API",
  },
  "docs.auth.legend.public": { "en-US": "public", "fa-IR": "عمومی" },
  "docs.auth.legend.console": { "en-US": "console session", "fa-IR": "نشست کنسول" },
  "docs.auth.legend.admin": { "en-US": "admin session", "fa-IR": "نشست مدیر" },

  // ----------------------------------------------------------- overview
  "docs.overview.body": {
    "en-US":
      "A project is a folder of static files plus a managed backend: a document database, blob storage, a shared asset library, visitor accounts and roles, routing, encrypted secrets, a reverse proxy, scheduled tasks, webhooks and custom domains. You write HTML, CSS and JavaScript; the platform owns everything else.",
    "fa-IR":
      "یک پروژه، پوشه‌ای از فایل‌های استاتیک به‌علاوهٔ یک بک‌اند مدیریت‌شده است: پایگاه‌دادهٔ سندی، فضای ذخیره‌سازی بلاب، کتابخانهٔ فایل‌های مشترک، حساب‌های بازدیدکننده و نقش‌ها، مسیریابی، اسرار رمز‌شده، یک پروکسی معکوس، وظایف زمان‌بندی‌شده، وب‌هوک‌ها و دامنه‌های اختصاصی. تو HTML، CSS و JavaScript مینویسی؛ بقیه‌اش مال پلتفرم است.",
  },

  // ---------------------------------------------------------- addressing
  "docs.addressing.body": {
    "en-US":
      "Projects are served from ‹{origin}/[username]/[project-name]/›. Relative API paths inside a served page inherit that context automatically. Server-side or external clients can address a project explicitly:",
    "fa-IR":
      "پروژه‌ها از ‹{origin}/[username]/[project-name]/› سرو میشوند. مسیرهای نسبی API درون یک صفحهٔ سروشده، خودبه‌خود همان بافت را به ارث میبرند. کلاینت‌های سمت سرور یا بیرونی میتوانند پروژه را صریح نشانی بدهند:",
  },
  "docs.addressing.order": {
    "en-US":
      "Resolution order is: the ‹X-Project-Id› header, an explicit ‹projectId› field in the body, then the ‹/username/project/› prefix of the request path.",
    "fa-IR":
      "ترتیب تشخیص این‌گونه است: هدر ‹X-Project-Id›، سپس فیلد ‹projectId› در بدنه، و در پایان پیشوند ‹/username/project/› در مسیر درخواست.",
  },

  // ---------------------------------------------------------------- auth
  "docs.auth.intro": {
    "en-US": "Three credential types reach the API, and they can be combined inside one project:",
    "fa-IR": "سه نوع اعتبار به API میرسند و میتوانند در یک پروژه با هم ترکیب شوند:",
  },
  "docs.auth.session.title": { "en-US": "Visitor session", "fa-IR": "نشست بازدیدکننده" },
  "docs.auth.session.body": {
    "en-US":
      "Cookie ‹auth_<projectId>›, issued by ‹/auth/token›. Carries the visitor's role and permissions.",
    "fa-IR":
      "کوکی ‹auth_<projectId>› که ‹/auth/token› صادرش میکند. نقش و مجوزهای بازدیدکننده را حمل میکند.",
  },
  "docs.auth.key.title": { "en-US": "API key", "fa-IR": "کلید API" },
  "docs.auth.key.body": {
    "en-US": "Sent as ‹Authorization: Bearer sk_…› and scoped to one project.",
    "fa-IR": "به شکل ‹Authorization: Bearer sk_…› فرستاده میشود و به یک پروژه محدود است.",
  },
  "docs.auth.owner.title": { "en-US": "Owner or admin", "fa-IR": "مالک یا مدیر" },
  "docs.auth.owner.body": {
    "en-US":
      "A console session visiting its own project is treated as the Owner role, so everything is permitted.",
    "fa-IR":
      "یک نشست کنسول که پروژهٔ خودش را باز میکند، نقش مالک در نظر گرفته میشود، پس همه‌چیز مجاز است.",
  },
  "docs.auth.login": {
    "en-US":
      "Login and signup are handled for you. Point visitors at ‹/auth/login?returnUrl=/your/page› and upload a ‹login.html› at the project root to replace the built-in page with your own design.",
    "fa-IR":
      "ورود و ثبت‌نام برایت انجام میشود. بازدیدکننده‌ها را به ‹/auth/login?returnUrl=/your/page› بفرست و یک ‹login.html› در ریشهٔ پروژه بگذار تا صفحهٔ داخلی با طراحی خودت جایگزین شود.",
  },
  "docs.auth.me": {
    "en-US":
      "Check who is signed in at any time with ‹/auth/me›, which returns the role, the permission list and the principal kind (‹visitor›, ‹api_key›, ‹owner› or ‹anonymous›).",
    "fa-IR":
      "هر وقت خواستی ببین چه کسی وارد است، ‹/auth/me› را صدا بزن؛ نقش، فهرست مجوزها و نوع فاعل (‹visitor›، ‹api_key›، ‹owner› یا ‹anonymous›) را برمیگرداند.",
  },

  // ------------------------------------------------------------ database
  "docs.database.body": {
    "en-US":
      "A schema-less document store. Tables are created implicitly on first insert, and every document must carry a non-null ‹id› field that is unique inside its table. Queries support a MongoDB-style filter and sort grammar.",
    "fa-IR":
      "یک ذخیره‌ساز سندی بدون اسکیما. جدول‌ها در نخستین درج به‌طور ضمنی ساخته میشوند و هر سند باید فیلد ‹id› غیرتهی داشته باشد که درون جدولش یکتاست. پرس‌وجوها دستور زبان فیلتر و مرتب‌سازی به سبک MongoDB را میپذیرند.",
  },
  "docs.database.operators": {
    "en-US":
      "Updates accept either a plain object (merged into each document) or operator form with ‹$set›, ‹$inc› and ‹$unset›. Results carry ‹_localme› metadata with the created and updated timestamps.",
    "fa-IR":
      "به‌روزرسانی‌ها یا یک شیء ساده میپذیرند (که در هر سند ادغام میشود) یا فرم عملگری با ‹$set›، ‹$inc› و ‹$unset›. نتیجه‌ها فرادادهٔ ‹_localme› را با زمان ساخت و آخرین تغییر حمل میکنند.",
  },
  "docs.database.ids": {
    "en-US":
      "A document's ‹id› is compared as text, so a numeric ‹1› and the string ‹\"1\"› are the same document on both database backends — inserting the second spelling returns 409. A filter value's type is respected: ‹id: 1› matches only a numeric id, never the string.",
    "fa-IR":
      "‹id› یک سند به‌صورت متنی مقایسه میشود، پس ‹1› عددی و ‹\"1\"› رشته‌ای روی هر دو بک‌اند پایگاه‌داده یک سند‌اند — درج شکل دوم ۴۰۹ برمیگرداند. نوع مقدار فیلتر رعایت میشود: ‹id: 1› فقط شناسهٔ عددی را میخواند، هرگز رشته را.",
  },
  "docs.operator.eq": { "en-US": "equal", "fa-IR": "برابر" },
  "docs.operator.ne": { "en-US": "not equal", "fa-IR": "نابرابر" },
  "docs.operator.gt": { "en-US": "greater than (or equal)", "fa-IR": "بزرگ‌تر (یا برابر)" },
  "docs.operator.lt": { "en-US": "less than (or equal)", "fa-IR": "کوچک‌تر (یا برابر)" },
  "docs.operator.in": { "en-US": "member of an array (or not)", "fa-IR": "عضو یک آرایه (یا نبودنش)" },
  "docs.operator.regex": { "en-US": "regular expression match", "fa-IR": "تطابق عبارت باقاعده" },
  "docs.operator.exists": { "en-US": "field is present", "fa-IR": "فیلد موجود است" },
  "docs.operator.logical": { "en-US": "logical composition", "fa-IR": "ترکیب منطقی" },

  // ------------------------------------------------------------- storage
  "docs.storage.body": {
    "en-US":
      "Files are served from your project root, so ‹/static/app.js› works exactly as it would on any static host. Binary files live in blob storage; text files are stored inline and editable in the dashboard.",
    "fa-IR":
      "فایل‌ها از ریشهٔ پروژه سرو میشوند، پس ‹/static/app.js› دقیقاً مثل هر میزبان استاتیک دیگری کار میکند. فایل‌های دودویی در فضای بلاب میمانند؛ فایل‌های متنی درون‌خطی ذخیره و در پیشخوان قابل ویرایش‌اند.",
  },
  "docs.storage.listing": {
    "en-US":
      "Listing accepts a directory: ‹GET /api/storage/list?path=/static› returns names, sizes, modification times and types. Writes that would exceed the account cap are rejected before any bytes are stored.",
    "fa-IR":
      "فهرست‌گیری یک پوشه میپذیرد: ‹GET /api/storage/list?path=/static› نام‌ها، اندازه‌ها، زمان‌های تغییر و نوع‌ها را برمیگرداند. نوشتن‌هایی که از سقف حساب فراتر بروند، پیش از ذخیرهٔ حتی یک بایت رد میشوند.",
  },
  "docs.storage.minify": {
    "en-US":
      "Uploads are minified on save by default: CSS, JavaScript, JSON, HTML and SVG are stripped of comments and dead whitespace before they are stored. Opt out per request with ‹?minify=0› (or force it with ‹?minify=1›), and flip the default platform-wide with ‹storage.minify_on_save›. Anything that declares more than the 10 MB ceiling in ‹Content-Length› is refused with 413 before the body is buffered.",
    "fa-IR":
      "بارگذاری‌ها به‌طور پیش‌فرض هنگام ذخیره کمینه میشوند: کامنت‌ها و فاصله‌های بی‌مورد از CSS، JavaScript، JSON، HTML و SVG حذف میشوند. برای هر درخواست با ‹?minify=0› میتوان انصراف داد (یا با ‹?minify=1› اجبار کرد) و پیش‌فرض را در کل پلتفرم با ‹storage.minify_on_save› عوض کرد. هر چیزی که در ‹Content-Length› بیش از سقف ۱۰ مگابایت اعلام کند، پیش از بافر شدن بدنه با ۴۱۳ رد میشود.",
  },

  // ------------------------------------------------------------- library
  "docs.library.body": {
    "en-US":
      "The library is a CDN for the assets every one of your projects shares — stylesheets, scripts, fonts, images. Upload once and each asset gets one stable public URL under ‹/{username}/library/›; nothing is copied between projects, and HTML is refused because these files are served from the platform origin.",
    "fa-IR":
      "کتابخانه یک CDN برای فایل‌هایی است که همهٔ پروژه‌هایت به اشتراک میگذارند — شیوه‌نامه‌ها، اسکریپت‌ها، فونت‌ها و تصویرها. یک بار بارگذاری کن و هر فایل یک نشانی عمومی پایدار زیر ‹/{username}/library/› میگیرد؛ چیزی بین پروژه‌ها کپی نمیشود و HTML رد میشود چون این فایل‌ها از مبدأ پلتفرم سرو میشوند.",
  },
  "docs.library.reserved": {
    "en-US":
      "‹library› is a reserved folder name, so a relative reference from inside a project resolves to your library and keeps working on a custom domain.",
    "fa-IR":
      "‹library› نام پوشهٔ رزروشده است، پس ارجاع نسبی از درون یک پروژه به کتابخانهٔ تو میرسد و روی دامنهٔ اختصاصی هم کار میکند.",
  },

  // ------------------------------------------------------------- secrets
  "docs.secrets.body": {
    "en-US":
      "Secrets are encrypted with AES-256-GCM and only decrypted server-side. The supported way to use a third-party API without exposing your key is a proxy route: create a route whose path is your own, point it at the provider, and reference secrets in the header map.",
    "fa-IR":
      "اسرار با ‎AES-256-GCM رمزنگاری میشوند و فقط سمت سرور رمزگشایی میشوند. راه پشتیبانی‌شده برای استفاده از API شخص ثالث بدون افشای کلیدت، مسیر پروکسی است: مسیری با نشانی خودت بساز، آن را به سرویس‌دهنده وصل کن و در نقشهٔ هدر به اسرار ارجاع بده.",
  },
  "docs.secrets.substitution": {
    "en-US":
      "Header values support ‹{{KEY_NAME}}› substitution for any stored secret. A proxy route also acts as a mount: when the route pattern is a prefix, the rest of the caller's path is appended to the target path, so ‹/api/stripe/*› can front ‹https://api.stripe.com/v1› while an exact match keeps the target path as written. Secrets can also be read directly with ‹POST /api/secrets/get›, which requires the ‹secrets_admin› permission and is intended for server-to-server calls only.",
    "fa-IR":
      "مقدار هدرها جایگزینی ‹{{KEY_NAME}}› را برای هر راز ذخیره‌شده پشتیبانی میکند. یک مسیر پروکسی همچنین نقش سوارشده را دارد: وقتی الگوی مسیر یک پیشوند باشد، باقی مسیر فراخوان به مسیر هدف اضافه میشود، پس ‹/api/stripe/*› میتواند جلوی ‹https://api.stripe.com/v1› بنشیند، در حالی که تطبیق دقیق مسیر هدف را همان‌طور که نوشته شده نگه میدارد. اسرار را میتوان مستقیم هم با ‹POST /api/secrets/get› خواند؛ این نشانی مجوز ‹secrets_admin› میخواهد و فقط برای فراخوانی سرور به سرور است.",
  },

  // ------------------------------------------------------------- serving
  "docs.serving.intro": { "en-US": "An incoming request is resolved in this order:", "fa-IR": "یک درخواست ورودی به این ترتیب تشخیص داده میشود:" },
  "docs.serving.step1": {
    "en-US": "An exact route match serves its target HTML file.",
    "fa-IR": "تطبیق دقیق مسیر، فایل HTML هدفش را سرو میکند.",
  },
  "docs.serving.step2": {
    "en-US": "A wildcard route match (for example ‹/blog/*›) serves its target.",
    "fa-IR": "تطبیق مسیر با الگوی عام (مثلاً ‹/blog/*›) هدفش را سرو میکند.",
  },
  "docs.serving.step3": {
    "en-US": "A stored file at the requested path is served directly with long-lived caching.",
    "fa-IR": "فایل ذخیره‌شده در مسیر درخواستی مستقیم و با کش بلندمدت سرو میشود.",
  },
  "docs.serving.step4": {
    "en-US": "‹<dir>/index.html› is served for directory paths.",
    "fa-IR": "برای مسیرهای پوشه، ‹<dir>/index.html› سرو میشود.",
  },
  "docs.serving.step5": {
    "en-US": "‹/404.html› is returned with status 404, or the platform page.",
    "fa-IR": "‹/404.html› با وضعیت ۴۰۴ برگردانده میشود، یا صفحهٔ خود پلتفرم.",
  },
  "docs.serving.gates": {
    "en-US":
      "Routes can require a signed-in visitor, a minimum role, and/or a single granular permission (for example ‹analytics_read›) that the visitor's role must carry. A permission requirement implies the auth gate even when ‹requires_auth› is off. Only HTML files are routable — assets are always reachable by their own path. When the watermark is enabled the platform appends a small attribution badge to served HTML, which you can turn off per project in Settings.",
    "fa-IR":
      "مسیرها میتوانند بازدیدکنندهٔ واردشده، یک حداقل نقش، و/یا یک مجوز ریزدانه (مثلاً ‹analytics_read›) بخواهند که نقش بازدیدکننده باید داشته باشد. حتی وقتی ‹requires_auth› خاموش است، داشتن الزام مجوز، دروازهٔ احراز را فعال میکند. فقط فایل‌های HTML مسیرپذیرند — فایل‌های جانبی همیشه با مسیر خودشان در دسترس‌اند. وقتی واترمارک روشن باشد پلتفرم یک نشان کوچک انتساب به HTML سروشده اضافه میکند که میتوانی در تنظیمات هر پروژه خاموشش کنی.",
  },
  "docs.serving.assets": {
    "en-US":
      "Asset and library requests are checked against ‹Referer› and ‹Origin›: direct requests, your own pages (including verified custom domains) and search-engine crawlers pass, external sites get 403. Operators who embed assets cross-origin can disable that check with ‹serving.hotlink_protection› in the system config. Text responses are Brotli/gzip-compressed when the client asks for it, and HTML is always served ‹no-store› while assets get a day of caching and a strong ‹ETag›, so a repeat request with ‹If-None-Match› comes back as a 304. Asset bytes are held in a bounded in-process cache and invalidated the moment a file is written or deleted.",
    "fa-IR":
      "درخواست‌های فایل و کتابخانه در برابر ‹Referer› و ‹Origin› بررسی میشوند: درخواست‌های مستقیم، صفحه‌های خودت (از جمله دامنه‌های اختصاصی تأییدشده) و خزندگان موتور جست‌وجو عبور میکنند و سایت‌های بیرونی ۴۰۳ میگیرند. اپراتورهایی که فایل‌ها را بین‌دامنه‌ای جاسازی میکنند میتوانند این بررسی را با ‹serving.hotlink_protection› در تنظیمات سیستم خاموش کنند. پاسخ‌های متنی در صورت درخواست کلاینت با Brotli/gzip فشرده میشوند، HTML همیشه ‹no-store› سرو میشود و فایل‌های جانبی یک روز کش و یک ‹ETag› قوی میگیرند، پس درخواست تکراری با ‹If-None-Match› به‌صورت ۳۰۴ برمیگردد. بایت‌های فایل در یک کش درون‌فرایندی با سقف مشخص نگه داشته میشوند و به‌محض نوشتن یا حذف یک فایل باطل میشوند.",
  },
  "docs.serving.cronTitle": {
    "en-US": "Scheduled tasks and webhooks",
    "fa-IR": "وظایف زمان‌بندی‌شده و وب‌هوک‌ها",
  },
  "docs.serving.cronBody": {
    "en-US":
      "Nine cron jobs ship with every project. Five are the documented ones — ‹clean_expired_sessions›, ‹clean_old_logs›, ‹generate_daily_stats›, ‹send_daily_summary_webhook› and ‹clean_orphaned_uploads›. Four platform chores are added on top: ‹retry_failed_webhooks›, ‹storage_audit›, ‹heartbeat› and ‹renew_ssl_certificates›. Every one can be toggled per project, run on demand from the dashboard, and switched off platform-wide from the admin console. A task can carry its own cadence: send ‹parameters.schedule = \"0 5 * * *\"› for a standard 5-field cron expression (UTC) or ‹parameters.every_minutes = 30› for an interval, and the platform recomputes the next run after every execution. An unreachable schedule is rejected with 400 rather than silently never firing. An external runner drives the schedule with ‹POST /api/cron/run› plus the ‹x-cron-token› header. Webhooks POST a signed JSON payload; document inserts, updates and deletes emit ‹document.created›, ‹document.updated› and ‹document.deleted›. Deliveries are queued in an outbox and drained inline, so a slow or failing receiver never blocks the request that triggered the event; retries stay off by default, matching the spec's \"Retry: No retries\". Verify ‹x-webhook-signature› using the secret you configured.",
    "fa-IR":
      "نُه کرون‌جاب با هر پروژه میآید. پنج تای مستندشده عبارت‌اند از ‹clean_expired_sessions›، ‹clean_old_logs›، ‹generate_daily_stats›، ‹send_daily_summary_webhook› و ‹clean_orphaned_uploads›. چهار کار پلتفرمی هم روی آن‌ها اضافه میشود: ‹retry_failed_webhooks›، ‹storage_audit›، ‹heartbeat› و ‹renew_ssl_certificates›. هرکدام را میتوان در هر پروژه روشن و خاموش کرد، از پیشخوان به‌صورت دستی اجرا کرد و در کل پلتفرم از کنسول مدیر خاموش کرد. هر وظیفه میتواند آهنگ خودش را داشته باشد: ‹parameters.schedule = \"0 5 * * *\"› برای یک عبارت کرون پنج‌فیلدی استاندارد (UTC) یا ‹parameters.every_minutes = 30› برای یک بازه، و پلتفرم پس از هر اجرا زمان بعدی را دوباره حساب میکند. زمان‌بندی غیرقابل‌رسیدن به‌جای آنکه بی‌صدا هرگز اجرا نشود، با ۴۰۰ رد میشود. یک اجراکنندهٔ بیرونی زمان‌بندی را با ‹POST /api/cron/run› به‌همراه هدر ‹x-cron-token› میراند. وب‌هوک‌ها یک محمولهٔ JSON امضاشده POST میکنند؛ درج، به‌روزرسانی و حذف سند، رویدادهای ‹document.created›، ‹document.updated› و ‹document.deleted› را منتشر میکنند. تحویل‌ها در یک outbox صف میشوند و درون‌خطی تخلیه میشوند، پس گیرندهٔ کند یا خراب هرگز درخواستی را که رویداد را آغاز کرده مسدود نمیکند؛ تلاش مجدد به‌طور پیش‌فرض خاموش است، مطابق «Retry: No retries» در مشخصات. ‹x-webhook-signature› را با رازی که تنظیم کرده‌ای بررسی کن.",
  },

  // --------------------------------------------------------- operations
  "docs.operations.certificates": {
    "en-US":
      "Certificate handling is deliberately opt-in. With ‹ssl.auto_provision› off (the default) the platform never contacts an ACME provider on its own: it stores, reports and renews only what an operator supplies. Turn it on and it uses HTTP-01 — the token is written to ‹/.well-known/acme-challenge/<token>› for the CA to fetch — then stores the certificate encrypted and renews it ‹ssl.renewal_days_before_expiry› days before it expires. ‹ssl.acme_staging› is on by default so a new deployment cannot burn rate limits against the public CA.",
    "fa-IR":
      "رسیدگی به گواهی عمداً انتخابی است. وقتی ‹ssl.auto_provision› خاموش باشد (پیش‌فرض)، پلتفرم هرگز خودسرانه با هیچ ارائه‌دهندهٔ ACME تماس نمیگیرد: فقط آنچه اپراتور میدهد را ذخیره، گزارش و تمدید میکند. آن را روشن کنی، از HTTP-01 استفاده میکند — توکن برای واکشی مرجع CA در ‹/.well-known/acme-challenge/<token>› نوشته میشود — سپس گواهی را رمز‌شده ذخیره میکند و ‹ssl.renewal_days_before_expiry› روز پیش از انقضا تمدیدش میکند. ‹ssl.acme_staging› به‌طور پیش‌فرض روشن است تا یک استقرار تازه سهمیهٔ مراجع عمومی را نسوزاند.",
  },
  "docs.operations.config": {
    "en-US":
      "Platform behaviour outside the request path is configured through the system config (see ‹/api/admin/config›): ‹logging.level›, ‹logging.sink› and ‹logging.file_path› control the structured NDJSON log (credentials are redacted before a record is ever written), ‹serving.hotlink_protection› can relax asset referrer checks for cross-origin embeds, and the ‹webhooks.retry_*› keys control outbox retries.",
    "fa-IR":
      "رفتار پلتفرم بیرون از مسیر درخواست از طریق تنظیمات سیستم پیکربندی میشود (‹/api/admin/config› را ببین): ‹logging.level›، ‹logging.sink› و ‹logging.file_path› لاگ ساخت‌یافتهٔ NDJSON را کنترل میکنند (اطلاعات محرمانه پیش از نوشتن هر رکورد پاک میشوند)، ‹serving.hotlink_protection› میتواند بررسی ارجاع فایل را برای جاسازی بین‌دامنه‌ای تسهیل کند، و کلیدهای ‹webhooks.retry_*› تلاش مجدد outbox را کنترل میکنند.",
  },
  "docs.operations.webhookSafety": {
    "en-US":
      "Webhook targets are validated before they are registered and again before each delivery: ‹http› and ‹https› only, and loopback, private, link-local and cloud-metadata addresses are refused. A project cannot use a webhook to make the platform reach its own network. Every response also carries ‹X-Content-Type-Options: nosniff›, a framing policy, and HSTS.",
    "fa-IR":
      "مقصدهای وب‌هوک پیش از ثبت و دوباره پیش از هر تحویل اعتبارسنجی میشوند: فقط ‹http› و ‹https›، و نشانی‌های لوپ‌بک، خصوصی، لینک‌لوکال و فرادادهٔ ابری رد میشوند. یک پروژه نمیتواند با وب‌هوک، پلتفرم را به شبکهٔ خودش برساند. هر پاسخ همچنین ‹X-Content-Type-Options: nosniff›، یک سیاست قاب‌بندی و HSTS حمل میکند.",
  },
  "docs.operations.backupsTitle": { "en-US": "Backups", "fa-IR": "پشتیبان‌ها" },
  "docs.operations.backupsBody": {
    "en-US":
      "‹bun run backup› takes a consistent snapshot — ‹pg_dump› for the Postgres dialect, a ‹VACUUM INTO› snapshot for SQLite — and prunes anything past the retention window. Add ‹--list› to see what is on disk, ‹--verify <file>› to check an archive before you trust it, and ‹--restore <file>› to load one back. The connection string is read from the environment, never from the command line.",
    "fa-IR":
      "‹bun run backup› یک عکس لحظه‌ای سازگار میگیرد — ‹pg_dump› برای گویش Postgres و ‹VACUUM INTO› برای SQLite — و هر چیزی فراتر از پنجرهٔ نگهداری را هرس میکند. ‹--list› را اضافه کن تا ببینی روی دیسک چیست، ‹--verify <file>› تا پیش از اعتماد یک آرشیو را بررسی کنی، و ‹--restore <file>› تا یکی را برگردانی. رشتهٔ اتصال از محیط خوانده میشود، هرگز از خط فرمان.",
  },

  // ------------------------------------------------------------- console
  "docs.console.body": {
    "en-US":
      "The dashboard is built on the same REST surface. These endpoints act on your account and projects rather than a single project's data; they all require a console session, and the admin endpoints require an administrator account.",
    "fa-IR":
      "پیشخوان روی همان سطح REST ساخته شده است. این نشانی‌ها به‌جای دادهٔ یک پروژه، روی حساب و پروژه‌های تو کار میکنند؛ همه به نشست کنسول نیاز دارند و نشانی‌های مدیر به حساب مدیر.",
  },
  "docs.console.domains": {
    "en-US":
      "Custom domains are verified over DNS: attach a domain to receive a ‹localme-verify=…› token, publish it as a TXT record at ‹_localme-verify.<domain>›, then call the verify endpoint. Once verified, the whole host serves that project.",
    "fa-IR":
      "دامنه‌های اختصاصی روی DNS تأیید میشوند: یک دامنه وصل کن تا توکن ‹localme-verify=…› بگیری، آن را به‌عنوان رکورد TXT در ‹_localme-verify.<domain>› منتشر کن و بعد نشانی تأیید را صدا بزن. پس از تأیید، کل میزبان همان پروژه را سرو میکند.",
  },

  // -------------------------------------------------------------- limits
  "docs.limits.storageTitle": { "en-US": "5 MB account storage", "fa-IR": "۵ مگابایت فضای حساب" },
  "docs.limits.storageBody": {
    "en-US":
      "Shared by every project plus the library. Writes past the cap fail with 402 before data is written.",
    "fa-IR":
      "بین همهٔ پروژه‌ها و کتابخانه مشترک است. نوشتن فراتر از سقف، پیش از نوشتن داده با ۴۰۲ شکست میخورد.",
  },
  "docs.limits.fileTitle": { "en-US": "10 MB per file", "fa-IR": "۱۰ مگابایت برای هر فایل" },
  "docs.limits.fileBody": {
    "en-US": "Hard ceiling on a single upload, multipart or raw body.",
    "fa-IR": "سقف سخت برای یک بارگذاری، چندبخشی یا بدنهٔ خام.",
  },
  "docs.limits.docsTitle": {
    "en-US": "500 documents per query",
    "fa-IR": "۵۰۰ سند در هر پرس‌وجو",
  },
  "docs.limits.docsBody": {
    "en-US":
      "The page size is capped at 500 and a query examines at most 5000 documents, flagging ‹truncated› when it hits that bound. The reported ‹total› is capped with it, so treat it as \"at least this many\" once ‹truncated› is set.",
    "fa-IR":
      "اندازهٔ صفحه روی ۵۰۰ سقف دارد و یک پرس‌وجو حداکثر ۵۰۰۰ سند را بررسی میکند و وقتی به این کران میرسد ‹truncated› را علامت میزند. مقدار ‹total› گزارش‌شده هم با آن سقف میخورد، پس با تنظیم ‹truncated› آن را «دست‌کم این‌تعداد» بخوان.",
  },
  "docs.limits.visitsTitle": {
    "en-US": "100 free visits per project / month",
    "fa-IR": "۱۰۰ بازدید رایگان برای هر پروژه در ماه",
  },
  "docs.limits.visitsBody": {
    "en-US":
      "Only HTML page serves count. Assets, 404s and 403s are free, refreshes inside five minutes are deduplicated, and the counter resets on the first of the month.",
    "fa-IR":
      "فقط سرو صفحه‌های HTML شمرده میشود. فایل‌های جانبی، ۴۰۴ها و ۴۰۳ها رایگان‌اند، نوسازی‌های درون پنج دقیقه تکراری حذف میشوند، و شمارنده در اول ماه صفر میشود.",
  },
  "docs.limits.rateTitle": { "en-US": "Rate limits", "fa-IR": "محدودیت نرخ" },
  "docs.limits.rateBody": {
    "en-US":
      "Every API route is covered by a per-identity fixed window, applied centrally so no endpoint can be added unprotected. Exceeding one returns 429 with ‹Retry-After›. Credentials draw on the tightest budget; database, storage, library, asset and admin calls each have their own.",
    "fa-IR":
      "هر مسیر API با یک پنجرهٔ ثابت به‌ازای هر هویت پوشش داده میشود که مرکزی اعمال میشود تا هیچ نشانی‌ای بدون محافظت اضافه نشود. عبور از آن ۴۲۹ با هدر ‹Retry-After› برمیگرداند. اعتبارها از تنگ‌ترین بودجه سهم میبرند؛ فراخوانی‌های پایگاه‌داده، فضای ذخیره‌سازی، کتابخانه، فایل و مدیریت هرکدام بودجهٔ خودشان را دارند.",
  },
  "docs.limits.sessionTitle": { "en-US": "Session lifetime", "fa-IR": "طول عمر نشست" },
  "docs.limits.sessionBody": {
    "en-US":
      "Console sessions slide on activity and expire after 20 idle minutes. Visitor cookies last 20 minutes and are scoped to their project.",
    "fa-IR":
      "نشست‌های کنسول با فعالیت تمدید میشوند و پس از ۲۰ دقیقه بی‌کاری منقضی میشوند. کوکی بازدیدکننده ۲۰ دقیقه دوام میآورد و به پروژهٔ خودش محدود است.",
  },

  // -------------------------------------------------------------- errors
  "docs.errors.intro": {
    "en-US": "Failures use standard status codes and a consistent JSON body:",
    "fa-IR": "خطاها از کدهای وضعیت استاندارد و بدنهٔ JSON یکسان استفاده میکنند:",
  },
  "docs.error.400": {
    "en-US": "invalid_json, invalid_document, missing_document_id, reserved_path, invalid_target, invalid_schedule",
    "fa-IR": "‎invalid_json، ‎invalid_document، ‎missing_document_id، ‎reserved_path، ‎invalid_target، ‎invalid_schedule",
  },
  "docs.error.401": {
    "en-US": "unauthenticated — sign in or attach credentials",
    "fa-IR": "‎unauthenticated — وارد شو یا اعتبار ضمیمه کن",
  },
  "docs.error.402": {
    "en-US": "visit allowance exhausted for the month, or storage cap exceeded",
    "fa-IR": "سهمیهٔ بازدید این ماه تمام شده یا سقف فضای ذخیره‌سازی رد شده است",
  },
  "docs.error.403": {
    "en-US": "forbidden — missing permission, disabled endpoint, or blocked hotlink",
    "fa-IR": "‎forbidden — مجوز ناقص، نشانی غیرفعال یا لینک داغ مسدودشده",
  },
  "docs.error.404": {
    "en-US": "not_found — no route, file or record matched",
    "fa-IR": "‎not_found — هیچ مسیر، فایل یا رکوردی نخواند",
  },
  "docs.error.409": {
    "en-US": "duplicate_document_id, table_exists, route_exists, domain_exists, project_exists",
    "fa-IR": "‎duplicate_document_id، ‎table_exists، ‎route_exists، ‎domain_exists، ‎project_exists",
  },
  "docs.error.413": {
    "en-US": "file_too_large / payload_too_large — the 10 MB per-file ceiling",
    "fa-IR": "‎file_too_large / payload_too_large — سقف ۱۰ مگابایت برای هر فایل",
  },
  "docs.error.429": {
    "en-US": "rate_limit_exceeded — inspect the Retry-After header",
    "fa-IR": "‎rate_limit_exceeded — هدر ‹Retry-After› را ببین",
  },
  "docs.error.500": {
    "en-US": "internal_error — the platform logged the failure for review",
    "fa-IR": "‎internal_error — پلتفرم خطا را برای بررسی ثبت کرد",
  },

  // ---------------------------------------------------------------- cta
  "docs.cta.title": { "en-US": "Ready to build?", "fa-IR": "آمادهٔ ساختنی؟" },
  "docs.cta.body": {
    "en-US": "Create a project, drop in an HTML file and start calling these endpoints.",
    "fa-IR": "یک پروژه بساز، یک فایل HTML بگذار و شروع کن به صدا زدن این نشانی‌ها.",
  },
  "docs.cta.back": { "en-US": "Back to the site", "fa-IR": "بازگشت به سایت" },
  "docs.cta.signup": { "en-US": "Create an account", "fa-IR": "ساخت حساب" },

  // --------------------------------------------------- endpoint notes
  "docs.note.db.find": {
    "en-US": "Query documents with filter, sort, limit and offset.",
    "fa-IR": "پرس‌وجوی سندها با فیلتر، مرتب‌سازی، limit و offset.",
  },
  "docs.note.db.get": {
    "en-US": "Fetch one document by its id (string or number).",
    "fa-IR": "گرفتن یک سند با شناسهٔ آن (رشته یا عدد).",
  },
  "docs.note.db.count": {
    "en-US": "Count documents matching a filter.",
    "fa-IR": "شمارش سندهای منطبق با یک فیلتر.",
  },
  "docs.note.db.insert": {
    "en-US": "Insert one document. The id field is mandatory and unique per table.",
    "fa-IR": "درج یک سند. فیلد ‹id› اجباری و در هر جدول یکتاست.",
  },
  "docs.note.db.update": {
    "en-US": "Update matching documents, all of them unless many: false.",
    "fa-IR": "به‌روزرسانی سندهای منطبق؛ همهٔ آن‌ها، مگر آنکه ‹many: false› باشد.",
  },
  "docs.note.db.delete": {
    "en-US": "Delete every document matching the filter.",
    "fa-IR": "حذف هر سندی که با فیلتر میخواند.",
  },
  "docs.note.storage.list": {
    "en-US": "List the files in one directory.",
    "fa-IR": "فهرست فایل‌های یک پوشه.",
  },
  "docs.note.storage.status": {
    "en-US": "Bytes used, project allocation and file count.",
    "fa-IR": "بایت مصرف‌شده، سهمیهٔ پروژه و تعداد فایل.",
  },
  "docs.note.storage.upload": {
    "en-US": "Multipart with a file field, or a raw body with ?path= and ?filename=.",
    "fa-IR": "چندبخشی با فیلد ‹file›، یا بدنهٔ خام با ‹?path=› و ‹?filename=›.",
  },
  "docs.note.storage.download": {
    "en-US": "Stream a stored file.",
    "fa-IR": "جریان‌دادن یک فایل ذخیره‌شده.",
  },
  "docs.note.storage.delete": {
    "en-US": "Delete one file by path.",
    "fa-IR": "حذف یک فایل با مسیر.",
  },
  "docs.note.lib.serve": {
    "en-US": "Serve a shared asset. This is the URL you reference; no API key needed.",
    "fa-IR": "سرو یک فایل مشترک. همین نشانی را ارجاع میدهی؛ کلید API لازم نیست.",
  },
  "docs.note.lib.list": {
    "en-US": "List every shared asset for the signed-in account.",
    "fa-IR": "فهرست همهٔ فایل‌های مشترک حساب واردشده.",
  },
  "docs.note.lib.upload": {
    "en-US": "Publish a non-HTML asset: { path, contentBase64 }.",
    "fa-IR": "انتشار یک فایل غیر HTML: ‹{ path, contentBase64 }›.",
  },
  "docs.note.lib.delete": {
    "en-US": "Remove a shared asset (or a whole folder).",
    "fa-IR": "برداشتن یک فایل مشترک (یا یک پوشهٔ کامل).",
  },
  "docs.note.lib.mirror": {
    "en-US": "Project-scoped mirror of the library listing.",
    "fa-IR": "آینهٔ فهرست کتابخانه در محدودهٔ پروژه.",
  },
  "docs.note.lib.cap": {
    "en-US": "Library usage against the library cap.",
    "fa-IR": "مصرف کتابخانه در برابر سقف کتابخانه.",
  },
  "docs.note.lib.upload2": {
    "en-US": "Upload a non-HTML asset into the shared library.",
    "fa-IR": "بارگذاری یک فایل غیر HTML در کتابخانهٔ مشترک.",
  },
  "docs.note.lib.read": {
    "en-US": "Read one library asset.",
    "fa-IR": "خواندن یک فایل کتابخانه.",
  },
  "docs.note.lib.remove": {
    "en-US": "Remove a shared asset by name.",
    "fa-IR": "برداشتن یک فایل مشترک با نام.",
  },
  "docs.note.lib.public": {
    "en-US": "Platform-wide curated library maintained by operators.",
    "fa-IR": "کتابخانهٔ گزینش‌شدهٔ سراسر پلتفرم که اپراتورها نگهش میدارند.",
  },
  "docs.note.lib.health": {
    "en-US": "Liveness + database readiness; 503 when the data layer is unreachable.",
    "fa-IR": "زنده‌بودن و آمادگی پایگاه‌داده؛ ۵۰۳ وقتی لایهٔ داده در دسترس نیست.",
  },
  "docs.note.auth.captcha": {
    "en-US": "Returns a signed SVG math challenge; logins must send its id back.",
    "fa-IR": "یک چالش ریاضی امضاشدهٔ SVG برمیگرداند؛ ورودها باید شناسه‌اش را بفرستند.",
  },
  "docs.note.auth.login": {
    "en-US": "Built-in login page, or your login.html when present.",
    "fa-IR": "صفحهٔ ورود داخلی، یا ‹login.html› خودت وقتی وجود داشته باشد.",
  },
  "docs.note.auth.token": {
    "en-US": "Log in or sign up a visitor; sets auth_{projectId}. Login is captcha-gated.",
    "fa-IR": "ورود یا ثبت‌نام بازدیدکننده؛ کوکی ‹auth_{projectId}› را ست میکند. ورود کپچا دارد.",
  },
  "docs.note.auth.me": {
    "en-US": "Current principal, role and permission list.",
    "fa-IR": "فاعل فعلی، نقش و فهرست مجوزها.",
  },
  "docs.note.auth.logout": {
    "en-US": "Clears the visitor cookie and redirects.",
    "fa-IR": "کوکی بازدیدکننده را پاک و هدایت میکند.",
  },
  "docs.note.console.projects": {
    "en-US": "List the signed-in user's projects.",
    "fa-IR": "فهرست پروژه‌های کاربر واردشده.",
  },
  "docs.note.console.projectPatch": {
    "en-US": "Rename, suspend/resume, or toggle the watermark.",
    "fa-IR": "تغییر نام، تعلیق/فعال‌سازی یا روشن و خاموش کردن واترمارک.",
  },
  "docs.note.console.usage": {
    "en-US": "Daily rollups, this month's visits and storage used.",
    "fa-IR": "گزارش‌های روزانه، بازدید این ماه و فضای مصرف‌شده.",
  },
  "docs.note.console.export": {
    "en-US": "Download the whole project as a ZIP archive.",
    "fa-IR": "دانلود کل پروژه به‌صورت آرشیو ZIP.",
  },
  "docs.note.console.domainsGet": {
    "en-US": "Custom domains with their verification tokens.",
    "fa-IR": "دامنه‌های اختصاصی با توکن‌های تأییدشان.",
  },
  "docs.note.console.domainsPost": {
    "en-US": "Attach a domain; publish the TXT record, then verify.",
    "fa-IR": "اتصال یک دامنه؛ رکورد TXT را منتشر و سپس تأیید کن.",
  },
  "docs.note.console.domainsVerify": {
    "en-US": "Check the _localme-verify TXT record over DNS.",
    "fa-IR": "بررسی رکورد TXT ‹_localme-verify› روی DNS.",
  },
  "docs.note.console.certGet": {
    "en-US": "Certificate state for the deployment: staging mode, counts, expiring domains.",
    "fa-IR": "وضعیت گواهی استقرار: حالت staging، شمارش‌ها و دامنه‌های در حال انقضا.",
  },
  "docs.note.console.certPost": {
    "en-US": "Order a certificate now. Needs ssl.auto_provision on the platform.",
    "fa-IR": "همین حالا گواهی سفارش بده. به ‹ssl.auto_provision› روی پلتفرم نیاز دارد.",
  },
  "docs.note.console.renew": {
    "en-US": "Force renewal of everything inside the renewal window.",
    "fa-IR": "اجبار تمدید هر چیزی که درون پنجرهٔ تمدید است.",
  },
  "docs.note.console.endpointsGet": {
    "en-US": "Alias of /api/endpoints (spec §6.3 path).",
    "fa-IR": "نام مستعار ‹/api/endpoints› (مسیر §۶.۳ مشخصات).",
  },
  "docs.note.console.endpointsPut": {
    "en-US": "Alias of PUT /api/endpoints (spec §6.3 path).",
    "fa-IR": "نام مستعار ‹PUT /api/endpoints› (مسیر §۶.۳ مشخصات).",
  },
  "docs.note.console.account": {
    "en-US": "Change your own password or email.",
    "fa-IR": "تغییر رمز عبور یا ایمیل خودت.",
  },
  "docs.note.console.exportFeature": {
    "en-US": "routes · api · roles · secrets (names only) · cron · webhooks · dns · auth.",
    "fa-IR": "‎routes · api · roles · secrets (فقط نام‌ها) · cron · webhooks · dns · auth.",
  },
  "docs.note.console.importFeature": {
    "en-US": "Validate and overwrite one configuration feature from JSON.",
    "fa-IR": "اعتبارسنجی و بازنویسی یک ویژگی پیکربندی از روی JSON.",
  },
  "docs.note.console.exportAll": {
    "en-US": "ZIP: storage/, lib/, config/config.json and config/secrets.json in clear text.",
    "fa-IR": "‎ZIP: مسیرهای ‎storage/، ‎lib/، ‎config/config.json و ‎config/secrets.json به‌صورت متن خوانا.",
  },
  "docs.note.console.importAll": {
    "en-US":
      "Restore that archive (multipart `file` or a raw ZIP body). Bounded by your storage cap; traversal entries are reported as skipped.",
    "fa-IR":
      "بازیابی همان آرشیو (multipart ‹file› یا بدنهٔ خام ZIP). با سقف فضای ذخیره‌سازی تو محدود است؛ ورودی‌های path traversal به‌عنوان ردشده گزارش میشوند.",
  },
  "docs.note.console.deliveries": {
    "en-US": "Recent webhook deliveries with status codes.",
    "fa-IR": "تحویل‌های اخیر وب‌هوک با کدهای وضعیت.",
  },
  "docs.note.console.testHook": {
    "en-US": "Send a test payload to one webhook or all of them.",
    "fa-IR": "ارسال محمولهٔ آزمایشی به یک وب‌هوک یا به همهٔ آن‌ها.",
  },
  "docs.note.admin.projects": {
    "en-US": "Every project; PATCH suspends one or edits its free-visit quota.",
    "fa-IR": "همهٔ پروژه‌ها؛ ‎PATCH یکی را تعلیق میکند یا سهمیهٔ بازدید رایگانش را ویرایش میکند.",
  },
  "docs.note.admin.cron": {
    "en-US": "Global per-task switches; PUT flips one.",
    "fa-IR": "کلیدهای سراسری هر وظیفه؛ ‎PUT یکی را جابه‌جا میکند.",
  },
  "docs.note.admin.publicLibrary": {
    "en-US": "Assets served at /~public/; PUT publishes, DELETE removes.",
    "fa-IR": "فایل‌هایی که در ‎/~public/ سرو میشوند؛ ‎PUT منتشر میکند و ‎DELETE برمیدارد.",
  },
  "docs.note.admin.totals": {
    "en-US": "Platform totals for operators.",
    "fa-IR": "مجموع‌های سراسر پلتفرم برای اپراتورها.",
  },
  "docs.note.admin.configGet": {
    "en-US": "Effective system configuration and its defaults.",
    "fa-IR": "پیکربندی مؤثر سیستم و پیش‌فرض‌هایش.",
  },
  "docs.note.admin.configPut": {
    "en-US": "Override one system config value.",
    "fa-IR": "بازنویسی یک مقدار پیکربندی سیستم.",
  },
  "docs.note.admin.users": {
    "en-US": "Suspend/resume an account or change its storage cap.",
    "fa-IR": "تعلیق/فعال‌سازی یک حساب یا تغییر سقف فضای ذخیره‌سازی‌اش.",
  },
  "docs.note.admin.aliases": {
    "en-US": "Spec §6.4 aliases of the /api/admin endpoints above.",
    "fa-IR": "نام‌های مستعار §۶.۴ از نشانی‌های ‹/api/admin› بالا.",
  },
  "docs.note.admin.acme": {
    "en-US": "Serves the HTTP-01 challenge token for a domain being validated.",
    "fa-IR": "توکن چالش HTTP-01 را برای دامنه‌ای که در حال اعتبارسنجی است سرو میکند.",
  },
} satisfies MessageGroup;
