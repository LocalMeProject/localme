import type { MessageGroup } from "../types";

/**
 * Marketing landing page (`app/page.tsx`).
 *
 * The Persian half of this file is not a translation of the English half. It
 * is written the way an Iranian person actually talks about this product:
 * informal "تو", short sentences, no bullet-point rhythm, and no grand claims.
 * Translated Persian reads like a brochure written abroad, which is exactly
 * what this copy is trying not to be.
 *
 * Two orthographic rules the whole file follows:
 *
 *   • The brand is «لوکال می» in Persian. "LocalMe" is the Latin brand for
 *     URLs and code; inside a Persian sentence it is the Persian name.
 *   • No ZWNJ (نیم‌فاصله) on verbal prefixes. "میکند" / "نمیشود" / "نمیخواهد"
 *     are written joined — "میکند", "نمیشود", "نمیخواهد" — which is how
 *     people type and how the page reads best. The half-space survives only
 *     where Persian spelling genuinely needs it: the plural suffix
 *     (پروژه‌ها) and closed compounds (برنامه‌نویس, پایگاه‌داده). See
 *     `tests/server/i18n-tone.test.ts`, which enforces the prefix rule.
 */
export const landing = {
  // ---------------------------------------------------------------- nav
  "landing.nav.demo": { "en-US": "Live demo", "fa-IR": "دموی زنده" },
  "landing.nav.what": { "en-US": "In plain words", "fa-IR": "به زبان ساده" },
  "landing.nav.example": { "en-US": "An example", "fa-IR": "یک نمونهٔ واقعی" },
  "landing.nav.build": { "en-US": "What you can build", "fa-IR": "چه چیزهایی میسازی" },
  "landing.nav.features": { "en-US": "Features", "fa-IR": "امکانات" },
  "landing.nav.how": { "en-US": "How it works", "fa-IR": "چطور کار میکنه" },
  "landing.nav.useCases": { "en-US": "Use cases", "fa-IR": "کاربردها" },
  "landing.nav.pricing": { "en-US": "Pricing", "fa-IR": "تعرفه" },
  "landing.nav.docs": { "en-US": "Docs", "fa-IR": "مستندات" },

  // --------------------------------------------------------------- hero
  "landing.hero.badge": {
    "en-US": "Instant Setup · Zero DevOps",
    "fa-IR": "شروع سریع و آسان · کاملاً خودکار",
  },
  "landing.hero.title1": { "en-US": "You make the app.", "fa-IR": "اپلیکیشن را تو میسازی." },
  "landing.hero.title2": { "en-US": "We run the hard half.", "fa-IR": "نیم سختش با ما." },
  "landing.hero.body": {
    "en-US":
      "Every project you make here gets a place to keep its information, a place to keep its files, accounts for the people who use it, and a real web address — all ready from the moment you sign up. You bring the page people see; we take care of everything behind it. No server to rent, no monthly bill, and you never have to call yourself a programmer.",
    "fa-IR":
      "هر پروژه‌ای که اینجا میسازی، از همان اول یک جا برای نگه‌داشتن اطلاعات دارد، یک جا برای فایل‌ها، حساب کاربری برای کسانی که از اپلیکیشن استفاده میکنند و یک آدرس واقعی روی اینترنت. همه‌شان آماده‌اند؛ همین الان، قبل از اینکه اولین خط کدت را بنویسی. صفحه را تو میآوری، بقیه‌اش را ما اداره میکنیم. نه سروری میگیری، نه آخر ماه قبضی میبینی، و لازم هم نیست خودت را برنامه‌نویس حساب کنی.",
  },
  "landing.hero.ctaPrimary": { "en-US": "Start free", "fa-IR": "رایگان شروع کن" },
  "landing.hero.ctaSecondary": { "en-US": "See it working", "fa-IR": "اینجوری کار میکنه..." },
  "landing.hero.point1": { "en-US": "No credit card", "fa-IR": "بدون کارت بانکی" },
  "landing.hero.point2": { "en-US": "Nothing to install", "fa-IR": "چیزی نصب نمیکنی" },
  "landing.hero.point3": {
    "en-US": "A working address in under a minute",
    "fa-IR": "آدرس واقعی، زیر یک دقیقه",
  },
  "landing.hero.demoTitle": {
    "en-US": "Try it before you sign up",
    "fa-IR": "قبل از ثبت‌نام امتحانش کن",
  },
  "landing.hero.demoHint": {
    "en-US": "no account needed",
    "fa-IR": "حساب هم نمیخواد",
  },
  "landing.hero.statAccounts": { "en-US": "Accounts", "fa-IR": "حساب کاربری" },
  "landing.hero.statProjects": { "en-US": "Projects", "fa-IR": "پروژه" },
  "landing.hero.statLiveApps": { "en-US": "Live apps", "fa-IR": "اپلیکیشن فعال" },

  // ------------------------------------------------------------ marquee
  "landing.marquee.ariaLabel": { "en-US": "What people build", "fa-IR": "چه چیزهایی میسازند" },
  "landing.app.waitlists": { "en-US": "Waitlists", "fa-IR": "لیست انتظار" },
  "landing.app.dashboards": { "en-US": "Internal dashboards", "fa-IR": "داشبورد داخلی" },
  "landing.app.feedbackBoards": { "en-US": "Feedback boards", "fa-IR": "بورد بازخورد" },
  "landing.app.teamJournals": { "en-US": "Team journals", "fa-IR": "ژورنال تیمی" },
  "landing.app.quizGames": { "en-US": "Quiz games", "fa-IR": "بازی کوییز" },
  "landing.app.bookingForms": { "en-US": "Booking forms", "fa-IR": "فرم رزرو" },
  "landing.app.jobTrackers": { "en-US": "Job trackers", "fa-IR": "پیگیری کارها" },
  "landing.app.readingLists": { "en-US": "Reading lists", "fa-IR": "فهرست مطالعه" },
  "landing.app.clientPortals": { "en-US": "Client portals", "fa-IR": "پرتال مشتریان" },
  "landing.app.inventoryLogs": { "en-US": "Inventory logs", "fa-IR": "ثبت انبار" },
  "landing.app.eventCheckins": { "en-US": "Event check-ins", "fa-IR": "ثبت حضور در رویداد" },
  "landing.app.portfolios": { "en-US": "Portfolios", "fa-IR": "نمونه‌کار" },
  "landing.app.habitTrackers": { "en-US": "Habit trackers", "fa-IR": "پیگیری عادت‌ها" },
  "landing.app.supportDesks": { "en-US": "Support desks", "fa-IR": "میز پشتیبانی" },
  "landing.app.campaignSites": { "en-US": "Campaign microsites", "fa-IR": "میکروسایت کمپین" },
  "landing.app.courseCatalogs": { "en-US": "Course catalogs", "fa-IR": "کاتالوگ دوره" },

  // ------------------------------------------------- problem / solution
  "landing.problem.eyebrow": { "en-US": "the usual story", "fa-IR": "داستان همیشگی" },
  "landing.problem.title": {
    "en-US": "You had an idea. Then the invisible half swallowed it.",
    "fa-IR": "یک ایده داری. بعد نیم پنهانش میبلعدش.",
  },
  "landing.problem.item1": {
    "en-US":
      "Someone quoted you for the page — and the same again for everything behind it",
    "fa-IR": "یکی برای ساختن صفحه به تو قیمت میدهد، و تقریبا همان‌قدر برای آنچه پشت صفحه است",
  },
  "landing.problem.item2": {
    "en-US":
      "You are told the forms need somewhere to send their answers, and that somewhere has to be built",
    "fa-IR": "به تو میگویند فرم‌ها باید یک جا برای فرستادن جوابشان داشته باشند، و آن جا هم باید ساخته شود",
  },
  "landing.problem.item3": {
    "en-US":
      "Uploads, user logins and passwords all turn out to be separate expensive projects",
    "fa-IR": "بارگذاری فایل، ورود کاربر و رمز، هرکدام یک پروژهٔ جدا و گران از آب درمیآید",
  },
  "landing.problem.item4": {
    "en-US": "Someone warns you about keeping keys safe — which means another service to run",
    "fa-IR": "یکی هشدار میدهد که نگه‌داری کلیدها امن نیست، یعنی یک سرویس دیگر هم باید باشد",
  },
  "landing.problem.item5": {
    "en-US": "Months later, the idea is still not online",
    "fa-IR": "چند ماه بعد، هنوز ایده آنلاین نشده",
  },

  "landing.solution.eyebrow": { "en-US": "with localme", "fa-IR": "با لوکال می" },
  "landing.solution.title": {
    "en-US": "You bring the page. LocalMe brings the rest, ready today.",
    "fa-IR": "صفحه را تو میآوری. بقیه را لوکال می میآورد، آماده و همین امروز.",
  },
  "landing.solution.item1": {
    "en-US":
      "Create a project and it has an address, storage and accounts the same second",
    "fa-IR": "پروژه را میسازی؛ همان لحظه آدرس دارد، فضا برای فایل دارد و حساب کاربری دارد",
  },
  "landing.solution.item2": {
    "en-US": "Put your page there and every form already knows where to save its answers",
    "fa-IR": "صفحه‌ات را میگذاری رویش؛ هر فرمی از همان اول میداند جوابش را کجا ذخیره کند",
  },
  "landing.solution.item3": {
    "en-US": "Visitors sign up and log in themselves, with logins already handled for you",
    "fa-IR": "بازدیدکننده‌ها خودشان ثبت‌نام و ورود میکنند، بدون اینکه تو چیزی بسازی",
  },
  "landing.solution.item4": {
    "en-US": "Private keys stay hidden behind the platform, never in your page",
    "fa-IR": "کلیدهای خصوصی پشت پلتفرم میمانند، نه داخل صفحه‌ات",
  },
  "landing.solution.item5": {
    "en-US": "Add your own domain on the day you want it to look professional",
    "fa-IR": "هر وقت خواستی جدی به نظر برسد، دامنهٔ خودت را اضافه میکنی",
  },
  "landing.solution.cta": { "en-US": "Create your first project", "fa-IR": "اولین پروژه‌ات را بساز" },

  // ------------------------------------------------------------ features
  "landing.features.eyebrow": { "en-US": "features", "fa-IR": "امکانات" },
  "landing.features.title": {
    "en-US": "Twelve services you never have to build.",
    "fa-IR": "دوازده چیزی که هرگز لازم نیست بسازی.",
  },
  "landing.features.body": {
    "en-US":
      "Each one is a documented HTTP API with session, API-key and role enforcement, rate limits and a matching console surface for configuration.",
    "fa-IR":
      "هرکدام یک API مستند با HTTP است، با کنترل نشست، کلید و نقش، محدودیت تعداد درخواست، و یک صفحه در کنسول برای تنظیمش.",
  },

  "landing.pillar.data.title": { "en-US": "Data & files", "fa-IR": "داده و فایل" },
  "landing.pillar.data.blurb": {
    "en-US": "Store the things your app creates and serve them back fast.",
    "fa-IR": "هر چیزی که اپلیکیشنت میسازد اینجا ذخیره میشود و سریع برمیگردد.",
  },
  "landing.pillar.people.title": { "en-US": "People & access", "fa-IR": "آدم‌ها و دسترسی" },
  "landing.pillar.people.blurb": {
    "en-US": "Know who is on the page and what they are allowed to do.",
    "fa-IR": "بدان چه کسی دارد میآید و اجازهٔ چه کاری را دارد.",
  },
  "landing.pillar.ship.title": { "en-US": "Ship & operate", "fa-IR": "بیرون دادن و نگه‌داشتن" },
  "landing.pillar.ship.blurb": {
    "en-US": "Everything that turns a folder of files into a product.",
    "fa-IR": "هر چیزی که یک پوشه فایل را تبدیل به محصول میکند.",
  },
  "landing.pillar.trust.title": { "en-US": "Trust & insight", "fa-IR": "اعتماد و شفافیت" },
  "landing.pillar.trust.blurb": {
    "en-US": "The unglamorous parts that decide whether you can sleep.",
    "fa-IR": "بخش‌های بی‌ جلوه‌ای که تعیین میکنند شب راحت بخوابی یا نه.",
  },

  "landing.feature.documentDb": { "en-US": "Document database", "fa-IR": "پایگاه‌دادهٔ سندی" },
  "landing.feature.documentDb.body": {
    "en-US":
      "A JSON store with a Mongo-style query DSL. Tables appear on first insert — no migrations, no schema.",
    "fa-IR":
      "یک انباره JSON با زبان کوئری شبیه مونگو. جدول‌ها با اولین رکورد ساخته میشوند. نه مهاجرت داری، نه شمای بندی.",
  },
  "landing.feature.storage": { "en-US": "File storage", "fa-IR": "فضای فایل" },
  "landing.feature.storage.body": {
    "en-US":
      "Upload and stream any asset inside a hard quota that is checked before a single byte is written.",
    "fa-IR":
      "هر فایلی را میتوانی بارگذاری کنی. سقف حجم از قبل معلوم است و قبل از نوشتن حتی یک بایت بررسی میشود.",
  },
  "landing.feature.library": { "en-US": "Shared asset library", "fa-IR": "کتابخانه فایل مشترک" },
  "landing.feature.library.body": {
    "en-US":
      "Upload an asset once and every project you own references it at /{you}/library/theme.css.",
    "fa-IR":
      "یک فایل را یک بار میگذاری و همه پروژه‌هایت از همان آدرس /{you}/library/theme.css استفاده میکنند.",
  },

  "landing.feature.visitorAccounts": { "en-US": "Visitor accounts", "fa-IR": "حساب بازدیدکننده" },
  "landing.feature.visitorAccounts.body": {
    "en-US":
      "Signup, login, lockouts and a math CAPTCHA, hashed with scrypt-class cryptography. Bring your own login page or use ours.",
    "fa-IR":
      "ثبت‌نام، ورود، قفل شدن حساب و کپچای ریاضی. رمزها با روش scrypt هش میشوند. صفحه ورود خودت را میآوری یا از مال ما استفاده میکنی.",
  },
  "landing.feature.roles": { "en-US": "Roles & permissions", "fa-IR": "نقش و دسترسی" },
  "landing.feature.roles.body": {
    "en-US":
      "Owner, Admin, Member and Guest ship with each project, with 15 granular permissions and your own custom roles.",
    "fa-IR":
      "هر پروژه با نقش‌های مالک، مدیر، عضو و مهمان میآید. ۱۵ دسترسی ریز دارد و اگر خواستی نقش خودت را هم میسازی.",
  },
  "landing.feature.secrets": { "en-US": "Encrypted secrets", "fa-IR": "کلیدهای رمزنگاری‌شده" },
  "landing.feature.secrets.body": {
    "en-US":
      "AES-256-GCM at rest. Keys never reach a browser — call third parties through the proxy instead.",
    "fa-IR":
      "با AES-256-GCM ذخیره میشوند. کلید به مرورگر نمیرسد؛ سرویس‌های بیرونی را از راه پروکسی صدا میزنی.",
  },

  "landing.feature.routing": { "en-US": "Routing engine", "fa-IR": "مسیریابی" },
  "landing.feature.routing.body": {
    "en-US":
      "Point any path at an HTML file and optionally require a login or a minimum role.",
    "fa-IR":
      "هر آدرسی را به یک فایل HTML وصل میکنی. اگر خواستی، میگویی فقط با ورود یا با یک نقش مشخص باز شود.",
  },
  "landing.feature.proxy": { "en-US": "Reverse proxy", "fa-IR": "پروکسی معکوس" },
  "landing.feature.proxy.body": {
    "en-US":
      "Forward requests to Stripe, OpenAI or your own API with {{SECRET}} header injection server-side.",
    "fa-IR":
      "درخواست‌ها را به Stripe، OpenAI یا API خودت میفرستی، با این امکان که {{SECRET}} همان‌جا سمت سرور اضافه شود.",
  },
  "landing.feature.automation": { "en-US": "Cron & webhooks", "fa-IR": "کار زمان‌بندی‌شده و وب‌هوک" },
  "landing.feature.automation.body": {
    "en-US":
      "Five scheduled jobs per project plus nine signed webhook events with a full delivery log.",
    "fa-IR":
      "برای هر پروژه پنج کار زمان‌بندی‌شده، به‌علاوه نُه رویداد وب‌هوک با امضا، و یک گزارش کامل از اینکه هرکدام رسیدند یا نه.",
  },

  "landing.feature.domains": { "en-US": "Custom domains", "fa-IR": "دامنهٔ اختصاصی" },
  "landing.feature.domains.body": {
    "en-US":
      "Prove ownership with a DNS TXT record, then the platform routes the domain and — when certificate provisioning is enabled — obtains and renews its TLS certificate for you.",
    "fa-IR":
      "با یک رکورد TXT در DNS ثابت میکنی دامنه مال توست. بعد پلتفرم خودش مسیر را میچیند و اگر صدور گواهی روشن باشد، گواهی TLS را میگیرد و تمدیدش میکند.",
  },
  "landing.feature.limits": { "en-US": "Usage & limits", "fa-IR": "مصرف و سقف‌ها" },
  "landing.feature.limits.body": {
    "en-US":
      "Storage, visits and rate limits are visible before they bite, with clear 402 and 429 responses.",
    "fa-IR":
      "قبل از اینکه دردسر شوند میبینی چقدر فضا و چند بازدید و چند درخواست رفته. جواب‌های ۴۰۲ و ۴۲۹ هم واضح میگویند چه شده.",
  },
  "landing.feature.backups": { "en-US": "Backups", "fa-IR": "پشتیبان" },
  "landing.feature.backups.body": {
    "en-US":
      "Export a project as a full archive — files, library, configuration and secrets — and restore it anywhere.",
    "fa-IR":
      "کل پروژه را یک فایل آرشیو میگیری. فایل‌ها، کتابخانه، تنظیمات و کلیدها هم داخلش هست. هرجا خواستی برمیگردانی.",
  },

  // ---------------------------------------------------------- how it works
  "landing.how.eyebrow": { "en-US": "how it works", "fa-IR": "چطور کار میکنه" },
  "landing.how.title": {
    "en-US": "From a blank page to a working link in three steps.",
    "fa-IR": "از یک صفحه خالی تا یک لینک که کار میکند، سه قدم.",
  },
  "landing.how.body": {
    "en-US":
      "There is nothing to install and no settings to get wrong. The whole platform is one place that never goes down for maintenance, and every project inside it already has its own address, storage and sign-ins.",
    "fa-IR":
      "نه چیزی نصب میکنی، نه تنظیمی هست که بتوانی خرابش کنی. کل سرویس یک جاست و برای نگه‌داری خاموش نمیشود. هر پروژه هم از قبل آدرس خودش، فضای خودش و ورود خودش را دارد.",
  },
  "landing.how.step1.title": { "en-US": "Create a project", "fa-IR": "یک پروژه بساز" },
  "landing.how.step1.body": {
    "en-US":
      "Type a name and you have a working web address straight away, with storage and sign-ins already set up behind it.",
    "fa-IR": "یک اسم مینویسی و همان لحظه یک آدرس واقعی داری. فضا و ورود هم پشتش از قبل آماده است.",
  },
  "landing.how.step2.title": { "en-US": "Put your page there", "fa-IR": "صفحه‌ات را بگذار رویش" },
  "landing.how.step2.body": {
    "en-US":
      "Upload your files or edit them in the browser. Nothing is compiled, nothing is uploaded to any server of yours, and there is no build step that can fail.",
    "fa-IR": "فایل‌هایت را میگذاری یا همان‌جا در مرورگر ویرایش میکنی. نه چیزی کامپایل میشود، نه روی سرور خودت میرود، نه مرحله‌ای هست که بخورد.",
  },
  "landing.how.step3.title": { "en-US": "Connect it to your information", "fa-IR": " وصلش کن به اطلاعاتت" },
  "landing.how.step3.body": {
    "en-US":
      "Saving a form, storing an uploaded file or checking a password is a single line. The platform does the storage, the security and the serving.",
    "fa-IR": "ذخیره کردن یک فرم، نگه‌داشتن یک فایل یا چک کردن رمز، یک خط است. ذخیره‌سازی، امنیت و سرو کردنش با پلتفرم.",
  },
  "landing.how.codeTitle": { "en-US": "your project", "fa-IR": "پروژهٔ تو" },
  "landing.how.servedAt": { "en-US": "served at /you/app/", "fa-IR": "سرو میشود در /you/app/" },
  "landing.how.statSessions": { "en-US": "Sessions", "fa-IR": "نشست‌ها" },
  "landing.how.statSessionsValue": { "en-US": "20 min sliding", "fa-IR": "۲۰ دقیقه، لغزان" },
  "landing.how.statKeys": { "en-US": "API keys", "fa-IR": "کلیدهای API" },
  "landing.how.statKeysValue": {
    "en-US": "storage-scoped",
    "fa-IR": "محدود به فضای خودت",
  },
  "landing.how.statWebhooks": { "en-US": "Webhooks", "fa-IR": "وب‌هوک‌ها" },
  "landing.how.statWebhooksValue": { "en-US": "HMAC-SHA256", "fa-IR": "HMAC-SHA256" },

  // ----------------------------------------------------------- use cases
  "landing.useCases.eyebrow": { "en-US": "use cases", "fa-IR": "کاربردها" },
  "landing.useCases.title": { "en-US": "Who ships on LocalMe", "fa-IR": "چه کسانی با لوکال می کار میکنند" },
  "landing.useCases.body": {
    "en-US":
      "If your product is a great interface plus stored data, it fits. If it needs long-running server jobs or background workers, it does not — and we will tell you that up front.",
    "fa-IR":
      "اگر محصولت یک رابط خوب است به‌علاوهٔ داده‌ای که باید ذخیره شود، به کارت میآید. اگر کاری داری که باید سمت سرور مدام اجرا شود، نمیآید. همان اول میگوییم.",
  },
  "landing.useCase.indie": { "en-US": "Indie hackers", "fa-IR": "تنهاکارها" },
  "landing.useCase.indie.body": {
    "en-US":
      "Validate an idea this weekend. Waitlists, feedback boards and paid micro-tools without standing up a backend repo.",
    "fa-IR":
      "همین آخر هفته ایده را امتحان کن. لیست انتظار، صفحه بازخورد و یک ابزار کوچک پولی. بدون اینکه بخواهی بک‌اند راه بیندازی.",
  },
  "landing.useCase.aiBuilders": { "en-US": "AI-assisted builders", "fa-IR": "کسانی که با هوش مصنوعی میسازند" },
  "landing.useCase.aiBuilders.body": {
    "en-US":
      "Point your coding agent at the API reference. Every endpoint is documented, so generated frontends work on the first run.",
    "fa-IR":
      "عامل کدنویسی‌ات را نشان بده سند API. همه مسیرها نوشته شده‌اند، برای همین فرانتاندی که میسازد از همان بار اول کار میکند.",
  },
  "landing.useCase.students": { "en-US": "Students & courses", "fa-IR": "دانشجو و دوره" },
  "landing.useCase.students.body": {
    "en-US":
      "Teach real full-stack ideas without provisioning databases. Accounts, data and files are one fetch call away.",
    "fa-IR":
      "مفاهیم واقعی فول‌استک را درس بده بدون اینکه اول پایگاه‌داده راه بیندازی. حساب، داده و فایل همه یک فراخوانی فاصله دارند.",
  },
  "landing.useCase.agencies": { "en-US": "Agencies & freelancers", "fa-IR": "آژانس و فریلنسر" },
  "landing.useCase.agencies.body": {
    "en-US":
      "Ship small client sites with a form inbox, a CMS table and a password-protected preview area. Same account for all of them.",
    "fa-IR":
      "سایت کوچک مشتری را تحویل بده با صندوق فرم، یک جدول ساده محتوا و یک بخش رمزدار برای پیش‌نمایش. همه با یک حساب.",
  },
  "landing.useCase.internal": { "en-US": "Internal tools", "fa-IR": "ابزار داخلی" },
  "landing.useCase.internal.body": {
    "en-US":
      "Ops dashboards, checklists and trackers that live behind a login and cost nothing to keep running.",
    "fa-IR":
      "داشبورد، چک‌لیست و پیگیری‌ای که پشت ورود مخفی است و نگه‌داشتنش هیچ هزینه‌ای ندارد.",
  },
  "landing.useCase.hobby": { "en-US": "Hobby projects", "fa-IR": "کارهای تفریحی" },
  "landing.useCase.hobby.body": {
    "en-US":
      "Give your game, club or community site a real scoreboard, guestbook or poll that survives a refresh.",
    "fa-IR":
      "به بازی، باشگاه یا سایت انجمنت یک جدول امتیاز واقعی، کتاب یادداشت یا نظرسنجی بده که با رفرش از بین نرود.",
  },

  // ---------------------------------------------------------- comparison
  "landing.compare.eyebrow": { "en-US": "comparison", "fa-IR": "مقایسه" },
  "landing.compare.title": { "en-US": "Honest maths, three ways.", "fa-IR": "حساب و کتاب راست، از سه زاویه." },
  "landing.compare.body": {
    "en-US":
      "A plain comparison of what it takes to get the same product live. No straw men — the DIY column is exactly what we did before this existed.",
    "fa-IR":
      "یک مقایسه روشن: رساندن همین محصول به اینترنت با چه هزینه‌ای تمام میشود. بازی با اعداد در کار نیست؛ ستون «خودتان بسازید» دقیقا همان کاری است که قبل از این پروژه میکردیم.",
  },
  "landing.compare.caption": {
    "en-US":
      "Comparison of building a backend yourself, using a traditional BaaS, or using LocalMe",
    "fa-IR": "مقایسهٔ ساختن بک‌اند با دست خودت، BaaS قدیمی، یا لوکال می",
  },
  "landing.compare.colNeed": { "en-US": "What you need", "fa-IR": "چه چیزی لازم داری" },
  "landing.compare.colDiy": { "en-US": "Build it yourself", "fa-IR": "خودتان بسازید" },
  "landing.compare.colBaas": { "en-US": "Traditional BaaS", "fa-IR": "BaaS سنتی" },
  "landing.compare.row1": { "en-US": "Time to a live app", "fa-IR": "زمان تا رسیدن به اپ زنده" },
  "landing.compare.row1.diy": { "en-US": "Days to weeks", "fa-IR": "چند روز تا چند هفته" },
  "landing.compare.row1.baas": { "en-US": "Hours", "fa-IR": "چند ساعت" },
  "landing.compare.row1.localme": { "en-US": "Under a minute", "fa-IR": "کمتر از یک دقیقه" },
  "landing.compare.row2": { "en-US": "Server code to deploy", "fa-IR": "کد سمت سرور برای دیپلوی" },
  "landing.compare.row2.diy": { "en-US": "Yes", "fa-IR": "بله" },
  "landing.compare.row2.baas": { "en-US": "Sometimes", "fa-IR": "گاهی" },
  "landing.compare.row3": { "en-US": "Database included", "fa-IR": "پایگاه‌داده همراه" },
  "landing.compare.row3.diy": { "en-US": "Provision it", "fa-IR": "خودتان راه‌اندازی کنید" },
  "landing.compare.row3.baas": { "en-US": "Yes", "fa-IR": "بله" },
  "landing.compare.row3.localme": { "en-US": "Yes", "fa-IR": "بله" },
  "landing.compare.row4": {
    "en-US": "Visitor accounts & roles",
    "fa-IR": "حساب بازدیدکننده و نقش‌ها",
  },
  "landing.compare.row4.diy": { "en-US": "Build it", "fa-IR": "خودتان بسازید" },
  "landing.compare.row4.baas": { "en-US": "Partial", "fa-IR": "ناقص" },
  "landing.compare.row4.localme": {
    "en-US": "15 permissions, 4 roles",
    "fa-IR": "۱۵ مجوز، ۴ نقش",
  },
  "landing.compare.row5": {
    "en-US": "Secrets & server-side proxy",
    "fa-IR": "اسرار و پروکسی سمت سرور",
  },
  "landing.compare.row5.diy": { "en-US": "Manual", "fa-IR": "دستی" },
  "landing.compare.row5.localme": { "en-US": "Built in", "fa-IR": "داخلی" },
  "landing.compare.row6": {
    "en-US": "Files you can edit in the browser",
    "fa-IR": "فایل‌هایی که در مرورگر ویرایش میشوند",
  },
  "landing.compare.row6.baas": { "en-US": "Partial", "fa-IR": "ناقص" },
  "landing.compare.row6.localme": { "en-US": "Yes", "fa-IR": "بله" },
  "landing.compare.row7": {
    "en-US": "Works with one HTML file",
    "fa-IR": "با یک فایل HTML کار میکند",
  },
  "landing.compare.row8": { "en-US": "Cost to start", "fa-IR": "هزینهٔ شروع" },
  "landing.compare.row8.diy": { "en-US": "Hosting + DB", "fa-IR": "میزبانی + پایگاه‌داده" },
  "landing.compare.row8.baas": {
    "en-US": "Free tier, then paid",
    "fa-IR": "پلن رایگان، بعد پولی",
  },
  "landing.compare.row8.localme": { "en-US": "Free tier", "fa-IR": "پلن رایگان" },

  // ------------------------------------------------------------- pricing
  "landing.pricing.eyebrow": { "en-US": "pricing", "fa-IR": "تعرفه" },
  "landing.pricing.title": {
    "en-US": "Simple, transparent tiers.",
    "fa-IR": "پلن‌های شفاف، متناسب با نیاز و رشد پروژه‌ات.",
  },
  "landing.pricing.body": {
    "en-US":
      "Start free with zero setup. Upgrade smoothly to Plus or Pro as your traffic, storage, and project requirements grow.",
    "fa-IR":
      "با پلن رایگان و بدون هیچ کانفیگ پیچیده‌ای شروع کن. هر زمان پروژه‌ات رشد کرد، به سادگی به پلن‌های پلاس و حرفه‌ای ارتقا بده.",
  },
  "landing.pricing.badge": { "en-US": "pricing tiers", "fa-IR": "تعرفه‌ها" },
  "landing.pricing.price": { "en-US": "$0", "fa-IR": "۰ تومان" },
  "landing.pricing.perMonth": { "en-US": "/ month", "fa-IR": "/ ماه" },
  "landing.pricing.priceBody": {
    "en-US":
      "All core capabilities ready from day one. Scale when you outgrow the caps.",
    "fa-IR":
      "تمام قابلیت‌های اصلی از روز اول آماده‌اند. وقتی نیازت بیشتر شد ارتقا میدهی.",
  },
  "landing.pricing.cta": { "en-US": "Get started", "fa-IR": "شروع استفاده" },
  "landing.pricing.limitStorage": { "en-US": "Account storage", "fa-IR": "فضای حساب" },
  "landing.pricing.limitStorageHint": {
    "en-US": "shared across every project",
    "fa-IR": "مشترک بین همهٔ پروژه‌ها",
  },
  "landing.pricing.limitStorage.value": { "en-US": "5 MB", "fa-IR": "۵ مگابایت" },
  "landing.pricing.limitLibrary": { "en-US": "Shared library", "fa-IR": "کتابخانهٔ مشترک" },
  "landing.pricing.limitLibrary.value": { "en-US": "+5 MB", "fa-IR": "+۵ مگابایت" },
  "landing.pricing.limitViews.value": { "en-US": "100 / mo", "fa-IR": "۱۰۰ / ماه" },
  "landing.pricing.limitUpload.value": { "en-US": "10 MB", "fa-IR": "۱۰ مگابایت" },
  "landing.pricing.limitLibraryHint": {
    "en-US": "one theme for all projects",
    "fa-IR": "یک قالب برای همهٔ پروژه‌ها",
  },
  "landing.pricing.limitViews": { "en-US": "Page views", "fa-IR": "بازدید صفحه" },
  "landing.pricing.limitViewsHint": {
    "en-US": "per project, resets on the 1st",
    "fa-IR": "برای هر پروژه، اول هر ماه ریست میشود",
  },
  "landing.pricing.limitUpload": { "en-US": "Largest upload", "fa-IR": "بزرگ‌ترین فایل" },
  "landing.pricing.limitUploadHint": {
    "en-US": "checked before any write",
    "fa-IR": "قبل از نوشتن بررسی میشود",
  },
  "landing.pricing.includesTitle": {
    "en-US": "Included from the first minute",
    "fa-IR": "از همان دقیقهٔ اول هست",
  },
  "landing.pricing.includes1": {
    "en-US": "Unlimited projects and custom roles",
    "fa-IR": "پروژه و نقش دلخواه، بدون محدودیت",
  },
  "landing.pricing.includes2": {
    "en-US": "Document database with the full query DSL",
    "fa-IR": "پایگاه‌دادهٔ سندی با کل زبان کوئری",
  },
  "landing.pricing.includes3": {
    "en-US": "Visitor signup, login and sessions",
    "fa-IR": "ثبت‌نام، ورود و نشست بازدیدکننده",
  },
  "landing.pricing.includes4": {
    "en-US": "Routing with login and role gates",
    "fa-IR": "مسیریابی با قفل ورود و نقش",
  },
  "landing.pricing.includes5": {
    "en-US": "Encrypted secrets and reverse proxy",
    "fa-IR": "کلید رمزنگاری‌شده و پروکسی معکوس",
  },
  "landing.pricing.includes6": {
    "en-US": "Cron jobs, webhooks and delivery logs",
    "fa-IR": "کار زمان‌بندی‌شده، وب‌هوک و گزارش تحویل",
  },
  "landing.pricing.includes7": {
    "en-US": "Custom domains with optional ACME certificate provisioning",
    "fa-IR": "دامنهٔ اختصاصی، با امکان صدور گواهی ACME",
  },
  "landing.pricing.includes8": {
    "en-US": "Backups, restore and usage reporting",
    "fa-IR": "پشتیبان، بازیابی و گزارش مصرف",
  },
  "landing.pricing.exitTitle": {
    "en-US": "Your data, your files, one click out",
    "fa-IR": "داده و فایل‌های تو، با یک کلیک بیرون",
  },
  "landing.pricing.exitBody": {
    "en-US":
      "Export any project as an archive and import it somewhere else. Deletion is permanent, so the console asks you to confirm and offers a backup first.",
    "fa-IR":
      "هر پروژه را آرشیو میگیری و هرجا خواستی برمیگردانی. حذف برگشت ندارد، برای همین کنسول اول میپرسد و پیشنهاد میکند اول پشتیبان بگیری.",
  },

  // ----------------------------------------------------------------- faq
  "landing.faq.eyebrow": { "en-US": "faq", "fa-IR": "پرسش‌های پرتکرار" },
  "landing.faq.title": {
    "en-US": "Questions people ask before signing up",
    "fa-IR": "چیزهایی که قبل از ثبت‌نام میپرسند",
  },
  "landing.faq.body": {
    "en-US":
      "Still unsure? The full HTTP surface is documented end to end, including every error code and limit.",
    "fa-IR":
      "هنوز مطمئن نیستی؟ کل HTTP از اول تا آخر نوشته شده، از هر کد خطا و هر سقفی.",
  },
  "landing.faq.readDocs": { "en-US": "Read the API reference", "fa-IR": "سند API را بخوان" },
  "landing.faq.q1": {
    "en-US": "Do I need to know a backend language?",
    "fa-IR": "باید زبان بک‌اند بلد باشم؟",
  },
  "landing.faq.a1": {
    "en-US":
      "No. A LocalMe project is HTML, CSS and JavaScript. You call the platform's REST API from the browser with fetch, and the platform handles storage, data, accounts, permissions, secrets and delivery.",
    "fa-IR":
      "نه. یک پروژه لوکال می یعنی HTML، CSS و جاوااسکریپت. از مرورگر با fetch به REST API پلتفرم میگویی، و پلتفرم ذخیره‌سازی، داده، حساب کاربری، دسترسی‌ها، کلیدها و تحویل را اداره میکند.",
  },
  "landing.faq.q2": {
    "en-US": "Is my app's code executed on your servers?",
    "fa-IR": "کد اپلیکیشنم روی سرور شما اجرا میشود؟",
  },
  "landing.faq.a2": {
    "en-US":
      "Never. The platform deliberately runs zero server-side user code: it only stores and serves your files and answers API requests. That removes a whole category of security risk and means there is nothing to containerise or deploy.",
    "fa-IR":
      "هرگز. پلتفرم عمدا هیچ کد سمت سروری از تو اجرا نمیکند. فقط فایل‌هایت را نگه میدارد و سرو میکند و به درخواست‌های API جواب میدهد. این یک دسته کامل از ریسک امنیتی را حذف میکند، و یعنی چیزی برای کانتینر کردن یا دیپلوی وجود ندارد.",
  },
  "landing.faq.q3": { "en-US": "How does the database work?", "fa-IR": "پایگاه‌داده چطور کار میکند؟" },
  "landing.faq.a3": {
    "en-US":
      "It is a schema-less JSON document store. Tables appear on first insert and every document needs a unique id field. Queries use a MongoDB-style filter grammar with $eq, $gt, $in, $regex, $and, $or and more, plus sort, limit and offset.",
    "fa-IR":
      "یک انباره سند JSON بدون شمای بندی است. جدول‌ها با اولین رکورد ساخته میشوند و هر سند یک فیلد شناسه یکتا میخواهد. کوئری‌ها با زبان فیلتر شبیه مونگو کار میکنند: ‏$eq، ‏$gt، ‏$in، ‏$regex، ‏$and، ‏$or و بیشتر، به‌علاوهٔ sort، limit و offset.",
  },
  "landing.faq.q4": {
    "en-US": "Can visitors sign up and log in?",
    "fa-IR": "بازدیدکننده میتواند ثبت‌نام کند و وارد شود؟",
  },
  "landing.faq.a4": {
    "en-US":
      "Yes. Each project has its own visitors, roles and permissions. The platform serves a working login page at /auth/login, or you can upload your own login.html to replace the design. Passwords use scrypt-class hashing and login attempts are rate limited and locked out.",
    "fa-IR":
      "بله. هر پروژه بازدیدکننده، نقش و دسترسی خودش را دارد. پلتفرم یک صفحه ورود آماده در ‎/auth/login میگذارد، یا اگر خواستی login.html خودت را میگذاری و ظاهرش را عوض میکنی. رمزها با scrypt هش میشوند و تلاش‌های ناموفق ورود محدود است و در نهایت قفل میکند.",
  },
  "landing.faq.q5": {
    "en-US": "How do I use an API key without exposing it?",
    "fa-IR": "کلید API را چطور استفاده کنم که لو نرود؟",
  },
  "landing.faq.a5": {
    "en-US":
      "Store it as an encrypted secret and create a proxy route that forwards to the provider. Header values support {{SECRET_NAME}} substitution, so the key is injected server-side and never appears in your frontend.",
    "fa-IR":
      "کلید را رمزنگاری‌شده ذخیره میکنی و یک مسیر پروکسی میسازی که درخواست را به آن سرویس بفرستد. داخل هدر میشود ‎{{SECRET_NAME}} گذاشت، پس کلید همان‌جا سمت سرور اضافه میشود و هیچ‌وقت در فرانت تو دیده نمیشود.",
  },
  "landing.faq.q6": { "en-US": "What are the free-tier limits?", "fa-IR": "سقف‌های پلن رایگان چقدر است؟" },
  "landing.faq.a6": {
    "en-US":
      "Every account gets 5 MB of storage plus a 5 MB shared library, and each project gets 100 page views per month. Files are capped at 10 MB, queries return up to 500 documents, and API calls are rate limited per identity. There is no credit card and no expiry.",
    "fa-IR":
      "هر حساب ۵ مگابایت فضا دارد به‌علاوهٔ ۵ مگابایت کتابخانهٔ مشترک. هر پروژه ماهی ۱۰۰ بازدید. حجم هر فایل تا ۱۰ مگابایت، هر کوئری تا ۵۰۰ سند. تعداد فراخوانی API هم برای هر هویت محدود است. نه کارت بانکی میخواهد، نه تاریخ انقضا دارد.",
  },
  "landing.faq.q7": { "en-US": "What happens if I go over a limit?", "fa-IR": "اگر از سقف بگذرم چه میشود؟" },
  "landing.faq.a7": {
    "en-US":
      "Nothing breaks silently. An upload that would exceed your storage quota is rejected before any bytes are written, a project past its view allowance returns a clear 402 page, and rate-limited calls return 429 with a Retry-After header.",
    "fa-IR":
      "چیزی بی‌سروصدا نمیشکند. بارگذاری‌ای که از فضای تو بیرون بزند، قبل از نوشتن حتی یک بایت رد میشود. پروژه‌ای که بازدیدش تمام شده باشد یک صفحه روشن ۴۰۲ میدهد. و فراخوانی محدودشده ۴۲۹ میدهد با هدر Retry-After.",
  },
  "landing.faq.q8": { "en-US": "Can I connect my own domain?", "fa-IR": "میتوانم دامنهٔ خودم را وصل کنم؟" },
  "landing.faq.a8": {
    "en-US":
      "Yes. Register the domain in the console, add the DNS TXT record the platform gives you to prove ownership, and it will serve your project on that host rather than a shared path. TLS is terminated by your edge: enable certificate provisioning and the platform obtains an ACME certificate over HTTP-01 and renews it before expiry, otherwise point your proxy at the host and bring your own certificate.",
    "fa-IR":
      "بله. دامنه را در کنسول ثبت میکنی، رکورد TXT که به تو میدهند را در DNS میگذاری تا مالکیت ثابت شود. بعد پروژه‌ات روی همان دامنه سرو میشود، نه روی یک مسیر مشترک. TLS را لبه شبکه میبندد: اگر صدور گواهی را روشن کنی، پلتفرم گواهی ACME را با روش HTTP-01 میگیرد و قبل از انقضا تمدیدش میکند. وگرنه پروکسی‌ات را به آن دامنه وصل کن و گواهی خودت را بیاور.",
  },
  "landing.faq.q9": { "en-US": "Can I get my data out?", "fa-IR": "میتوانم داده‌هایم را بیرون ببرم؟" },
  "landing.faq.a9": {
    "en-US":
      "Any project can be exported as an archive containing its files, shared library, routes, API policy, roles, cron, webhooks, domains and secrets, and imported again later. Password hashes are never exported, so restored visitors start disabled. Deletion is permanent, so export first if you are removing a project.",
    "fa-IR":
      "هر پروژه را میشود آرشیو گرفت؛ فایل‌ها، کتابخانه، مسیرها، سیاست API، نقش‌ها، کارهای زمان‌بندی‌شده، وب‌هوک‌ها، دامنه‌ها و کلیدها همه داخلش هست. بعدا هم میشود برگرداند. هش رمزها هرگز بیرون نمیرود، برای همین بازدیدکننده‌های بازیابی‌شده از اول غیرفعالند. حذف برگشت ندارد، پس اگر داری پاک میکنی اول آرشیو بگیر.",
  },

  // ----------------------------------------------------------- final cta
  "landing.cta.badge": { "en-US": "ready when you are", "fa-IR": "هر وقت آماده باشی" },
  "landing.cta.title": {
    "en-US": "Your first project is live in under a minute.",
    "fa-IR": "اولین پروژه‌ات در کمتر از یک دقیقه زنده میشود.",
  },
  "landing.cta.body": {
    "en-US":
      "Name a project, drop in an HTML file and start calling the API. If you liked the demo above, one click turns it into your own project.",
    "fa-IR":
      "به پروژه یک نام بده، یک فایل HTML بگذار و شروع کن به صدا زدن API. اگر دموی بالا را دوست داشتی، یک کلیک آن را به پروژهٔ خودت تبدیل میکند.",
  },
  "landing.cta.primary": { "en-US": "Start building free", "fa-IR": "رایگان شروع کن" },
  "landing.cta.secondary": { "en-US": "Play with the demo again", "fa-IR": "دوباره با دمو بازی کن" },
  "landing.cta.finePrint": {
    "en-US": "Free tier · no credit card · nothing to install",
    "fa-IR": "پلن رایگان · بدون کارت بانکی · بدون نصب چیزی",
  },

  // -------------------------------------------------------------- footer
  "landing.footer.about": {
    "en-US":
      "LocalMe hosts applications built from HTML, CSS and JavaScript and provides everything a backend normally would. No user-supplied server code is ever executed.",
    "fa-IR":
      "لوکال می اپلیکیشن‌هایی را که با HTML، CSS و جاوااسکریپت ساخته میشوند میزبانی میکند و هر چیزی را که یک بک‌اند معمولی فراهم میکند میدهد. هیچ کد سمت سروری از تو هیچ‌وقت اجرا نمیشود.",
  },
  "landing.footer.groupProduct": { "en-US": "Product", "fa-IR": "محصول" },
  "landing.footer.groupDevelopers": { "en-US": "Developers", "fa-IR": "توسعه‌دهندگان" },
  "landing.footer.groupPlatform": { "en-US": "Platform", "fa-IR": "پلتفرم" },
  "landing.footer.apiReference": { "en-US": "API reference", "fa-IR": "سند API" },
  "landing.footer.consoleSignIn": { "en-US": "Console sign in", "fa-IR": "ورود به کنسول" },
  "landing.footer.createAccount": { "en-US": "Create an account", "fa-IR": "ساخت حساب کاربری" },
  "landing.footer.faq": { "en-US": "FAQ", "fa-IR": "پرسش‌های پرتکرار" },
  "landing.footer.health": { "en-US": "Health endpoint", "fa-IR": "نقطهٔ سلامت سرویس" },
  "landing.footer.hostedApps": { "en-US": "Hosted apps", "fa-IR": "اپلیکیشن‌های میزبانی‌شده" },
  "landing.footer.policy": { "en-US": "Terms & Policy", "fa-IR": "قوانین و حریم خصوصی" },
  "landing.footer.skillMcp": { "en-US": "Agent Skill & MCP", "fa-IR": "اسکیل و سرور MCP" },
  "landing.footer.singleDeployment": {
    "en-US": "Single deployment, every project",
    "fa-IR": "یک دیپلوی، برای همهٔ پروژه‌ها",
  },
  "landing.footer.status": { "en-US": "Status", "fa-IR": "وضعیت سرویس" },
  "landing.footer.startFree": { "en-US": "Start free", "fa-IR": "رایگان شروع کن" },
  "landing.footer.liveDemo": { "en-US": "Live demo", "fa-IR": "دموی زنده" },

  // ------------------------------------------------------- live demo chrome
  // The demo *applications* are localised too — `lib/demo-apps.ts` builds their
  // markup from this catalog, so a Persian visitor sees a Persian app in the
  // same language as the page around it. The English variant still ships the
  // English file, because "View source" shows the exact file the signup flow
  // would write into your own project.
  "demo.tab.aria": { "en-US": "Example applications", "fa-IR": "اپلیکیشن‌های نمونه" },
  "demo.name.todo": { "en-US": "Task tracker", "fa-IR": "کارها" },
  "demo.name.guestbook": { "en-US": "Guestbook", "fa-IR": "کتاب یادداشت" },
  "demo.name.poll": { "en-US": "Live poll", "fa-IR": "نظرسنجی زنده" },
  "demo.stage.aria": { "en-US": "{name} example", "fa-IR": "نمونهٔ {name}" },
  "demo.stage.title": { "en-US": "{name} — running LocalMe example app", "fa-IR": "‎{name} — اپ نمونهٔ لوکال می، در حال اجرا" },
  "demo.stage.live": { "en-US": "live sandbox", "fa-IR": "محیط زنده" },
  "demo.stage.usernamePlaceholder": {
    "en-US": "/{your-username}/{id}-app/",
    "fa-IR": "/{your-username}/{id}-app/",
  },
  "demo.stage.requests": { "en-US": "requests", "fa-IR": "درخواست" },
  "demo.stage.average": { "en-US": "avg {ms} ms", "fa-IR": "میانگین {ms} میلی‌ثانیه" },
  "demo.stage.ms": { "en-US": "{ms} ms", "fa-IR": "{ms} میلی‌ثانیه" },
  "demo.stage.failed": { "en-US": "{count} failed", "fa-IR": "{count} ناموفق" },
  "demo.stage.viewSource": { "en-US": "View source", "fa-IR": "دیدن کد" },
  "demo.stage.hideSource": { "en-US": "Hide source", "fa-IR": "بستن کد" },
  "demo.stage.reset": { "en-US": "Reset", "fa-IR": "از نو" },
  "demo.stage.empty": {
    "en-US":
      "This is a real app. Add a task, sign the guestbook or cast a vote — every request it makes lands here.",
    "fa-IR":
      "این یک اپ واقعی است. یک کار اضافه کن، توی کتاب یادداشت امضا بگذار یا رأی بده. هر درخواستی که میزند همین‌جا میافتد.",
  },
  "demo.stage.block": { "en-US": "{path} · app code — styles are added when you save it", "fa-IR": "‎{path} · کد اپ — استایل‌ها موقع ذخیره اضافه میشوند" },
  "demo.block.request": { "en-US": "request", "fa-IR": "درخواست" },
  "demo.block.response": { "en-US": "response", "fa-IR": "پاسخ" },
  "demo.summary.documents": { "en-US": "{count} documents", "fa-IR": "{count} سند" },
  "demo.summary.total": { "en-US": "{count} total", "fa-IR": "در مجموع {count}" },
  "demo.summary.deleted": { "en-US": "{count} deleted", "fa-IR": "{count} حذف شد" },
  "demo.summary.matched": { "en-US": "{count} matched", "fa-IR": "{count} پیدا شد" },
  "demo.summary.written": { "en-US": "1 document written", "fa-IR": "۱ سند نوشته شد" },
  "demo.summary.ok": { "en-US": "ok", "fa-IR": "اوکی" },
  "demo.handoff.title": { "en-US": "Keep this app — it takes one click", "fa-IR": "این اپ را نگه دار، یک کلیک بیشتر" },
  "demo.handoff.body": {
    "en-US":
      "Create a free account and LocalMe creates the project, writes {path} with the exact file above and hands you the live URL.",
    "fa-IR":
      "یک حساب رایگان بساز. لوکال می پروژه را میسازد، ‎{path} را با همان فایلی که بالای صفحه میبینی پر میکند و آدرس زنده را میدهد.",
  },
  "demo.handoff.cta": { "en-US": "Get this app", "fa-IR": "این اپ را بردار" },

  // ------------------------------------------------- how it works: chips
  // Short, non-technical captions on the three steps. The old version put a
  // raw API path next to each step, which read as "you must handle this".
  "landing.meta.title": {
    "en-US": "Give your app a database, files and user accounts — without a programmer",
    "fa-IR": "به اپلیکیشنت پایگاه‌داده، فایل و حساب کاربری بده — بدون برنامه‌نویس",
  },
  "landing.meta.description": {
    "en-US":
      "LocalMe gives every project a database, files, visitor accounts, and a real web address — all automated from the moment you sign up. Zero DevOps, no server to configure.",
    "fa-IR":
      "لوکال می به هر پروژه‌ای دیتابیس، فضای فایل، حساب کاربری و یک آدرس واقعی روی اینترنت میدهد — کاملاً خودکار و آماده از لحظهٔ ثبت‌نام. بدون نیاز به سرور و کانفیگ‌های پیچیده.",
  },
  // Pipe-separated so one string stays one catalog row; `app/page.tsx` splits
  // it into the `<meta keywords>` list.
  "landing.meta.keywords": {
    "en-US":
      "free backend | backend as a service free | no code backend | app hosting for non-programmers | free database for my app | user accounts for my website | free file storage | static site backend | app without a server | LocalMe",
    "fa-IR":
      "بک‌اند رایگان | سرور رایگان اپلیکیشن | بک‌اند بدون کدنویسی | میزبانی اپلیکیشن بدون برنامه‌نویس | پایگاه‌داده رایگان | حساب کاربری سایت | فضای ابری رایگان | لوکال می",
  },
  "landing.how.step1.tag": { "en-US": "a real address", "fa-IR": "یک نشانی واقعی" },
  "landing.how.step2.tag": { "en-US": "your own files", "fa-IR": "فایل‌های خودت" },
  "landing.how.step3.tag": { "en-US": "nothing to install", "fa-IR": "هیچی نصب نمیکنی" },

  // ------------------------------------------------------- plain language
  // The single most important block on the page. Everything above it assumes
  // the reader already knows what a backend is; this section removes that
  // assumption by describing the product entirely in outcomes.
  "landing.plain.eyebrow": { "en-US": "in one sentence", "fa-IR": "در یک جمله" },
  "landing.plain.title": {
    "en-US": "Every app has two halves. You only build one of them.",
    "fa-IR": "هر اپلیکیشنی دو نیم دارد. تو فقط یکیش را میسازی.",
  },
  "landing.plain.body": {
    "en-US":
      "There is the part people see — the pages and forms. And there is the part that remembers what people typed, keeps their files, and decides who gets in. That second part is normally the expensive half: it needs a programmer, a server and months. LocalMe already has it. You make the visible half; we run the hidden one.",
    "fa-IR":
      "یک نیم را مردم میبینند؛ صفحه‌ها و فرم‌ها. یک نیم هم هست که آنچه مردم تایپ کردند را نگه میدارد، فایل‌هایشان را و تصمیم میگیرد چه کسی بیاید تو. همین نیم دوم گران است. برنامه‌نویس میخواهد، سرور میخواهد و چند ماه وقت. لوکال می این را از قبل دارد. نیم دیدنی را تو میسازی، نیم پنهان را ما.",
  },
  "landing.plain.col1.title": { "en-US": "The part you make", "fa-IR": "نیمی که تو میسازی" },
  "landing.plain.col1.body": {
    "en-US":
      "The pages and forms people look at and fill in. Built with ordinary website files, or handed to you ready-made.",
    "fa-IR":
      "صفحه‌ها و فرم‌هایی که مردم نگاه میکنند و پر میکنند. با فایل‌های معمولی وب ساخته میشود، یا آماده دستت داده میشود.",
  },
  "landing.plain.col2.title": { "en-US": "The part LocalMe keeps", "fa-IR": "نیمی که لوکال می نگه میدارد" },
  "landing.plain.col2.body": {
    "en-US":
      "Your information, your files, your users' accounts and passwords, your private keys. Running, backed up and protected whether or not you understand any of it.",
    "fa-IR":
      "اطلاعاتت، فایل‌هایت، حساب و رمز کاربرانت، کلیدهای خصوصی‌ات. روشن است، پشتیبان میگیرد و محافظت میشود؛ چه درباره‌اش بدانی چه ندانی.",
  },
  "landing.plain.col3.title": { "en-US": "What people get", "fa-IR": "چیزی که مردم میگیرند" },
  "landing.plain.col3.body": {
    "en-US":
      "A working link that opens on any phone or computer — on your own domain if you ever want one.",
    "fa-IR":
      "یک لینک که روی هر گوشی و هر کامپیوتری باز میشود. اگر روزی خواستی، روی دامنهٔ خودت.",
  },

  // ------------------------------------------------------------ one story
  // A worked example in the target reader's own terms.
  // Agent-first: Idea to production via a single prompt, MCP, and auto AAT.
  "landing.story.eyebrow": { "en-US": "idea to production", "fa-IR": "از ایده تا اپلیکیشن زنده" },
  "landing.story.title": {
    "en-US": "Say you run a cake shop and need an ordering website.",
    "fa-IR": "فرض کن یک قنادی داری و برای ثبت سفارش مشتری یک سایت میخواهی.",
  },
  "landing.story.body": {
    "en-US":
      "You don't need to write backend code, configure SQL databases, or configure servers. You give your AI agent a single prompt pointing to our Skill and MCP server — the agent builds and ships it all.",
    "fa-IR":
      "اصلا لازم نیست کد بک‌اند بنویسی یا سرور و دیتابیس راه بیندازی. فقط یک پیام به هوش مصنوعی میدهی و اسکیل و سرور MCP لوکال می را معرفی میکنی؛ ایجنت همه چیز را میسازد و منتشر میکند.",
  },
  "landing.story.step1.title": { "en-US": "1. Prompt your AI Agent", "fa-IR": "۱. به هوش مصنوعی میگویی" },
  "landing.story.step1.body": {
    "en-US":
      "Tell Claude, Cursor, ChatGPT, or Antigravity what you need and point it to the LocalMe Skill at https://localme.ir/skills/localme/SKILL.md.",
    "fa-IR":
      "به کلود، کرسر، چت‌جی‌پی‌تی یا هر ایجنتی که داری میگویی سایت قنادی میخواهی و آدرس اسکیل لوکال می (https://localme.ir/skills/localme/SKILL.md) را به آن میدهی.",
  },
  "landing.story.step2.title": { "en-US": "2. Confirm Access with One Click", "fa-IR": "۲. با یک کلیک تایید میکنی" },
  "landing.story.step2.body": {
    "en-US":
      "The agent requests a temporary Agent Access Token (AAT). You approve it in your browser with one click — no API keys to copy or expose.",
    "fa-IR":
      "ایجنت دسترسی موقت (AAT) درخواست میکند. صفحه تایید در مرورگرت باز میشود و با یک کلیک تاییدش میکنی؛ بدون هیچ کپی کردن کلید یا نگرانی امنیتی.",
  },
  "landing.story.step3.title": { "en-US": "3. Agent Deploys via MCP", "fa-IR": "۳. ایجنت با MCP منتشر میکند" },
  "landing.story.step3.body": {
    "en-US":
      "Your agent creates the project, provisions database tables, and uploads the responsive ordering app straight to LocalMe through the MCP server.",
    "fa-IR":
      "ایجنت پروژه را از طریق سرور MCP لوکال می میسازد، جداول دیتابیس سفارش‌ها را ایجاد میکند و فایل‌های سایت را مستقیما بارگذاری میکند.",
  },
  "landing.story.step4.title": { "en-US": "4. Live Website & Real-Time Orders", "fa-IR": "۴. سایت زنده و دریافت سفارش‌ها" },
  "landing.story.step4.body": {
    "en-US":
      "Customers open cakeshop.localme.ir on their phones and place orders. You see every order land live in your dashboard — ready for business.",
    "fa-IR":
      "سایتت بلافاصله آنلاین است. مشتری‌ها با گوشی سفارش میدهند و تمام سفارش‌ها را همان لحظه در پیشخوانت میبینی.",
  },
  "landing.story.cta": {
    "en-US": "Try it with your AI assistant today",
    "fa-IR": "همین امروز با دستیار هوش مصنوعیت امتحان کن",
  },
  "landing.prompt.title": {
    "en-US": "Idea to Live Website: The One-Prompt Recipe",
    "fa-IR": "از ایده تا سایت واقعی: دستور یک‌خطی به هوش مصنوعی",
  },
  "landing.prompt.subtitle": {
    "en-US": "Copy and paste this prompt directly into Claude Code, Cursor, ChatGPT, or Antigravity:",
    "fa-IR": "این متن را کپی کن و به کلود، کرسر، چت‌جی‌پی‌تی یا هر مدل هوش مصنوعی بده:",
  },
  "landing.prompt.text": {
    "en-US": "Create a modern, mobile-friendly cake shop web app with a cake catalog, customer phone and address ordering form, and an orders list. Deploy it to my LocalMe account using the Skill at https://localme.ir/skills/localme/SKILL.md and MCP server at https://localme.ir/api/mcp.",
    "fa-IR": "یک وب‌اپلیکیشن شیک و مناسب موبایل برای قنادی من بساز با کاتالوگ کیک‌ها، فرم نام و شماره و آدرس مشتری برای ثبت سفارش، و صفحه مدیریت سفارش‌ها. سپس با استفاده از اسکیل لوکال می در https://localme.ir/skills/localme/SKILL.md و سرور MCP در https://localme.ir/api/mcp آن را در حساب لوکال می من منتشر کن.",
  },
  "landing.prompt.copy": { "en-US": "Copy Prompt", "fa-IR": "کپی دستور" },
  "landing.prompt.copied": { "en-US": "Copied to Clipboard!", "fa-IR": "دستور کپی شد!" },

  // ------------------------------------------------- what people actually build
  // Replaces the persona list as the main "is this for me" signal. Concrete
  // small-business and community tasks beat audience labels.
  "landing.build.eyebrow": { "en-US": "what people build", "fa-IR": "مردم چه میسازند" },
  "landing.build.title": {
    "en-US": "If it collects something, or shows it back, it belongs here.",
    "fa-IR": "اگر چیزی جمع میکند یا دوباره نشانش میدهد، جای درستش اینجاست.",
  },
  "landing.build.body": {
    "en-US":
      "Almost everything people want a website to do comes down to one of these few shapes.",
    "fa-IR":
      "تقریبا هر چیزی که مردم از یک سایت میخواهند، به یکی از همین چند شکل برمیگردد.",
  },
  "landing.build.signups": { "en-US": "Sign-up and wait lists", "fa-IR": "ثبت‌نام و لیست انتظار" },
  "landing.build.signups.body": {
    "en-US": "Collect names, emails and phone numbers into one list that belongs to you.",
    "fa-IR": "اسم، ایمیل و شماره را جمع میکنی در یک فهرست که مال خودت است.",
  },
  "landing.build.orders": { "en-US": "Orders and bookings", "fa-IR": "سفارش و رزرو" },
  "landing.build.orders.body": {
    "en-US":
      "A booking form for a salon, a class, a table or an appointment, with the day's list on one screen.",
    "fa-IR": "فرم نوبت برای آرایشگاه، کلاس، میز یا وقت ویزیت. فهرست همان روز هم روی یک صفحه.",
  },
  "landing.build.surveys": { "en-US": "Surveys and feedback", "fa-IR": "نظرسنجی و بازخورد" },
  "landing.build.surveys.body": {
    "en-US": "Ask people what they think and read the answers as they arrive.",
    "fa-IR": "از مردم میپرسی چی فکر میکنند و جواب‌ها را همان‌طور که میآیند میخوانی.",
  },
  "landing.build.attend": { "en-US": "Attendance and sign-in", "fa-IR": "حضور و غیاب" },
  "landing.build.attend.body": {
    "en-US": "Mark who turned up at class, practice, club night or the seminar.",
    "fa-IR": "ثبت میکنی چه کسی سر کلاس، تمرین، شب باشگاه یا سمینار آمد.",
  },
  "landing.build.inventory": { "en-US": "Stock and inventory", "fa-IR": "انبار و موجودی" },
  "landing.build.inventory.body": {
    "en-US": "Track what you have and what you sold, from your phone, as you sell.",
    "fa-IR": "موجودی و فروش را همان لحظه با گوشی ثبت میکنی.",
  },
  "landing.build.members": { "en-US": "Members and directories", "fa-IR": "اعضا و فهرست‌ها" },
  "landing.build.members.body": {
    "en-US":
      "Keep a list of members, students or volunteers with their details and their history.",
    "fa-IR": "فهرست اعضا، دانش‌آموزها یا داوطلب‌ها را با مشخصات و سابقه‌شان نگه میداری.",
  },
  "landing.build.uploads": { "en-US": "Submissions and files", "fa-IR": "ارسالی و فایل" },
  "landing.build.uploads.body": {
    "en-US": "Let people send you a photo or a document and keep every one of them.",
    "fa-IR": "مردم برایت عکس یا فایل میفرستند و تو همه‌شان را نگه میداری.",
  },
  "landing.build.private": { "en-US": "Private pages", "fa-IR": "صفحه‌های خصوصی" },
  "landing.build.private.body": {
    "en-US": "Put a page behind a password so that only your team can open it.",
    "fa-IR": "یک صفحه را پشت رمز میگذاری که فقط تیم خودت بازش کند.",
  },

  // --------------------------------------------- faq: non-technical answers
  // The original nine were all written for someone who already knows what a
  // session or a rate limit is. These four are the questions that actually
  // stop a non-technical reader from signing up.
  "landing.faq.q10": {
    "en-US": "I don't know how to code at all. Can I still use this?",
    "fa-IR": "اصلا کدنویسی بلد نیستم. باز هم میشود از این استفاده کرد؟",
  },
  "landing.faq.a10": {
    "en-US":
      "Yes. A new project already comes with a working welcome page, a dashboard for uploading files, and a live address — none of which need typing code. If you do write code, the visible part is ordinary HTML, CSS and JavaScript, which is the simplest kind there is.",
    "fa-IR":
      "بله. یک پروژهٔ تازه از همان اول یک صفحه خوش‌آمد کارآمد، یک پیشخوان برای بارگذاری فایل و یک آدرس زنده دارد. هیچ‌کدامش هم نیازی به نوشتن کد ندارند. اگر خواستی کد هم بنویسی، بخش دیدنی همان HTML، CSS و جاوااسکریپت معمولی است؛ ساده‌ترین کدی که اصلا وجود دارد.",
  },
  "landing.faq.q11": {
    "en-US": "Do I have to pay for hosting or a server?",
    "fa-IR": "باید هزینه میزبانی یا سرور بدهم؟",
  },
  "landing.faq.a11": {
    "en-US":
      "No. Hosting, the database, daily backups and the security certificate are all part of the free plan. There is nothing to rent, nothing to renew and no bill arriving.",
    "fa-IR":
      "نه. میزبانی، پایگاه‌داده، پشتیبان روزانه و گواهی امنیتی، همه داخل پلن رایگان‌اند. چیزی برای اجاره نیست، چیزی برای تمدید نیست و قبضی هم نمیآید.",
  },
  "landing.faq.q12": {
    "en-US": "What happens to my information if I leave?",
    "fa-IR": "اگر بروم، اطلاعاتم چه میشود؟",
  },
  "landing.faq.a12": {
    "en-US":
      "You can download a complete copy of any project whenever you like — files, information, accounts and settings — as a single archive file. You are never locked in.",
    "fa-IR":
      "هر وقت بخواهی یک نسخه کامل از هر پروژه را میگیری؛ فایل‌ها، اطلاعات، حساب‌ها و تنظیمات، همه در یک فایل آرشیو. هیچ‌وقت در سیستم گیر نمیکنی.",
  },
  "landing.faq.q13": {
    "en-US": "Is my information safe?",
    "fa-IR": "اطلاعات من امن است؟",
  },
  "landing.faq.a13": {
    "en-US":
      "Passwords are stored scrambled rather than as readable text, private keys are encrypted, and repeated sign-in attempts are locked out. You can also put a password or a login in front of any page you want to protect.",
    "fa-IR":
      "رمزها به شکل ناخوانا ذخیره میشوند، نه متن ساده. کلیدهای خصوصی رمزنگاری میشوند. و اگر کسی پشت سر هم رمز را اشتباه بزند، حساب قفل میشود. در کنار اینها میتوانی جلوی هر صفحه‌ای که خواستی هم رمز بگذاری هم ورود.",
  },
} satisfies MessageGroup;