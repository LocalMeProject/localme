/**
 * The landing-page live demo.
 *
 * Each entry is a *real* single-file LocalMe application: plain HTML, CSS and
 * JavaScript that talks to `/api/db/*` exactly like a hosted project would.
 * `demoDocument()` inlines the same markup with a simulated API layer, so the
 * demo runs entirely in the browser — no account, no network, no backend — and
 * streams every request/response pair it makes to the surrounding page.
 *
 * After signup the identical file is written into a real project
 * (`/dashboard?import=<id>`), so whatever the visitor played with becomes
 * something they own.
 */

export type DemoId = "todo" | "guestbook" | "poll";

/**
 * Per-culture wording for the demo applications.
 *
 * These strings live here rather than in `lib/i18n/messages/*` on purpose. The
 * demo is a *file*: "View source" shows the exact bytes the signup flow writes
 * into your own project, and `demoFile()` is what lands on disk. If an operator
 * could edit a demo string from the console, the source view would stop
 * matching the file — the one promise the demo makes. So the demo's own copy
 * travels with the demo, and the landing page's copy stays in the catalog.
 *
 * Values are looked up two ways: `{{key}}` placeholders inside the markup, and
 * `t("key")` inside the demo's own scripts (see `injectStrings`).
 */
const DEMO_STRINGS = {
  "en-US": {
    "todo.title": "Tasks",
    "todo.heading": "Today",
    "todo.ready": "ready",
    "todo.busy": "request…",
    "todo.placeholder": "What needs doing?",
    "todo.newTask": "New task",
    "todo.add": "Add",
    "todo.filter": "Filter",
    "todo.all": "All",
    "todo.open": "Open",
    "todo.done": "Done",
    "todo.saved": "Saved",
    "todo.deleted": "Deleted",
    "todo.insertFailed": "Insert failed",
    "todo.empty": "Nothing here yet",
    "todo.emptyHint": "Add your first task above — it is a single POST to /api/db/insert.",
    "todo.toggle": "Toggle",
    "todo.delete": "Delete",
    "todo.countSuffix": "tasks",
    "todo.countLine": "{open} open · {shown} shown",
    "todo.seed1": "Wire up the task list",
    "todo.seed2": "Point a custom domain at it",
    "todo.seed3": "Invite a teammate as Member",
    "guest.title": "Guestbook",
    "guest.heading": "Guestbook",
    "guest.name": "Your name",
    "guest.note": "Leave a note for the team",
    "guest.sign": "Sign the guestbook",
    "guest.saved": "Saved",
    "guest.first": "Be the first to sign",
    "guest.firstHint": "Every entry is stored and paged with a single query.",
    "guest.seed1": "Shipped a customer dashboard in an afternoon. No backend repo at all.",
    "guest.seed2": "The proxy route with {{OPENAI_KEY}} is the part that sold my team.",
    "guest.anonymous": "Anonymous",
    "poll.title": "Feature poll",
    "poll.question": "What should we ship next?",
    "poll.voted": "Vote recorded",
    "poll.votedAgain": "Vote updated",
    "poll.alreadyVoted": "Already voted as this visitor",
    "poll.justNow": "just now",
    "poll.votesLabel": "votes",
    "poll.leadingLabel": "leading",
    "poll.updatedLabel": "updated",
    "poll.hint": "One vote per visitor, tracked by the platform's visitor cookie.",
    "poll.footNote": "vote stored as a document",
    "poll.opt1": "Realtime subscriptions",
    "poll.opt2": "File versioning",
    "poll.opt3": "Built-in email",
    "common.empty": "Nothing yet",
  },
  "fa-IR": {
    "todo.title": "کارها",
    "todo.heading": "امروز",
    "todo.ready": "آماده",
    "todo.busy": "در حال درخواست…",
    "todo.placeholder": "چه کاری باید شود؟",
    "todo.newTask": "کار تازه",
    "todo.add": "اضافه",
    "todo.filter": "فیلتر",
    "todo.all": "همه",
    "todo.open": "باز",
    "todo.done": "انجام‌شده",
    "todo.saved": "ذخیره شد",
    "todo.deleted": "پاک شد",
    "todo.insertFailed": "ثبت نشد",
    "todo.empty": "هنوز چیزی اینجا نیست",
    "todo.emptyHint": "اولین کار را بالا اضافه کن؛ فقط یک POST به ‎/api/db/insert است.",
    "todo.toggle": "تغییر وضعیت",
    "todo.delete": "پاک کردن",
    "todo.countSuffix": "کار",
    "todo.seed1": "لیست کارها را وصل کن",
    "todo.seed2": "دامنه اختصاصی را وصل کن",
    "todo.seed3": "یک همکار را با نقش عضو دعوت کن",
    "todo.countLine": "{open} باز · {shown} نمایش",
    "guest.title": "کتاب یادداشت",
    "guest.heading": "کتاب یادداشت",
    "guest.name": "اسمت",
    "guest.note": "یادداشتی برای تیم بگذار",
    "guest.sign": "امضا میکنم",
    "guest.saved": "ثبت شد",
    "guest.first": "اولین امضاکننده باش",
    "guest.firstHint": "هر یادداشت ذخیره میشود و با یک کوئری صفحه‌بندی میشود.",
    "guest.seed1": "یک داشبورد برای مشتری ساختم، در یک بعدازظهر. بدون هیچ ریپوی بک‌اند.",
    "guest.seed2": "مسیر پروکسی با {{OPENAI_KEY}} همان چیزی بود که تیمم را قانع کرد.",
    "poll.title": "نظرسنجی امکانات",
    "poll.question": "چه چیزی را بعدا بسازیم؟",
    "poll.voted": "رأیت ثبت شد",
    "poll.votedAgain": "رأیت به‌روز شد",
    "poll.alreadyVoted": "به‌عنوان همین بازدیدکننده قبلا رأی داده‌ای",
    "poll.justNow": "همین الان",
    "poll.votesLabel": "رأی",
    "poll.leadingLabel": "صدرنشین",
    "poll.updatedLabel": "به‌روزرسانی",
    "poll.hint": "هر بازدیدکننده یک رأی. پلتفرم با کوکی خودش تشخیص میدهد چه کسی رای داده.",
    "poll.footNote": "هر رأی یک سند است",
    "poll.opt1": "اشتراک زنده",
    "poll.opt2": "نسخه‌بندی فایل",
    "poll.opt3": "ارسال ایمیل داخلی",
    "common.empty": "هنوز چیزی نیست",
  },
} as const satisfies Record<string, Record<string, string>>;

type DemoStringKey = keyof (typeof DEMO_STRINGS)["en-US"];

/** Translate a demo string, falling back to English for any key Persian lacks. */
export function demoText(locale: string, key: DemoStringKey): string {
  const table = DEMO_STRINGS[locale as keyof typeof DEMO_STRINGS] ?? DEMO_STRINGS["en-US"];
  return table[key as keyof typeof table] ?? DEMO_STRINGS["en-US"][key];
}

/**
 * Fill `{{key}}` placeholders in the demo markup.
 *
 * The pattern is built from the *known key set*, not a loose `\{\{\w+\}\}`.
 * The guestbook seed contains the literal `{{OPENAI_KEY}}` to show secret
 * substitution, and a generic pattern would happily replace it with
 * `undefined`.
 *
 * A replacer function, not a replacement string: the markup contains `$&` and
 * friends inside its inline JavaScript, which `String.replace` would otherwise
 * interpret.
 */
const PLACEHOLDER = new RegExp(
  `\\{\\{(${Object.keys(DEMO_STRINGS["en-US"])
    .map((key) => key.replace(/\./g, "\\."))
    .join("|")})\\}\\}`,
  "g",
);

export function localize(markup: string, locale: string): string {
  return markup.replace(PLACEHOLDER, (_match, key: string) =>
    demoText(locale, key as DemoStringKey),
  );
}

export interface DemoApp {
  id: DemoId;
  name: string;
  tagline: string;
  blurb: string;
  /** Path the file is stored at inside a project. */
  path: string;
  /** Tailwind colour token used as the demo accent. */
  accent: string;
  /** Surface this demo exercises, shown in the UI chrome. */
  surface: string;
  html: string;
}

const BASE_CSS = `
  :root {
    --bg: #0b1220;
    --surface: #111a2c;
    --surface-2: #17233a;
    --line: #24344f;
    --text: #eef2f8;
    --muted: #94a3b8;
    --signal: #ff6b2c;
    --blueprint: #38bdf8;
    --radius: 10px;
  }
  * { box-sizing: border-box; }
  html, body { height: 100%; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font-family: Inter, ui-sans-serif, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
    font-size: 14px;
    line-height: 1.45;
    -webkit-font-smoothing: antialiased;
  }
  .app { display: flex; flex-direction: column; height: 100%; background-image: linear-gradient(rgba(56,189,248,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,.045) 1px, transparent 1px); background-size: 28px 28px; }
  .app-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 16px; border-bottom: 1px solid var(--line); background: rgba(11,18,32,.72); backdrop-filter: blur(8px); }
  .app-title { font-size: 15px; font-weight: 600; letter-spacing: -.01em; margin: 0; }
  .app-sub { margin: 2px 0 0; color: var(--muted); font-size: 11px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  .body { flex: 1; overflow-y: auto; padding: 16px; }
  .row { display: flex; gap: 8px; }
  .stack { display: flex; flex-direction: column; gap: 8px; }
  .field, select {
    flex: 1; min-height: 44px; padding: 10px 12px; border-radius: var(--radius);
    border: 1px solid var(--line); background: var(--surface); color: var(--text); font: inherit;
    transition: border-color .15s ease, box-shadow .15s ease;
  }
  .field::placeholder { color: #64748b; }
  .field:focus-visible, button:focus-visible, select:focus-visible { outline: 2px solid var(--blueprint); outline-offset: 2px; border-color: var(--blueprint); }
  button { font: inherit; cursor: pointer; border: 0; background: none; color: inherit; }
  .btn { min-height: 44px; padding: 0 16px; border-radius: var(--radius); border: 1px solid var(--line); background: var(--surface-2); font-weight: 500; transition: transform .12s ease, background .15s ease, border-color .15s ease; }
  .btn:hover { border-color: #3b4f70; }
  .btn:active { transform: translateY(1px); }
  .btn-primary { background: var(--signal); border-color: transparent; color: #1b0f06; font-weight: 600; }
  .btn-primary:hover { background: #ff7f47; }
  .btn-icon { min-width: 44px; display: inline-flex; align-items: center; justify-content: center; color: var(--muted); }
  .btn-icon:hover { color: #f87171; }
  .chips { display: flex; gap: 6px; margin-top: 12px; }
  .chip { min-height: 34px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--line); color: var(--muted); font-size: 12px; transition: all .15s ease; }
  .chip[aria-pressed="true"] { background: rgba(255,107,44,.14); border-color: rgba(255,107,44,.5); color: var(--signal); }
  .list { list-style: none; margin: 14px 0 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .item { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface); animation: pop .28s cubic-bezier(.22,1,.36,1) both; }
  .item-body { flex: 1; min-width: 0; }
  .item-title { font-size: 13.5px; overflow-wrap: anywhere; }
  .item-title.done { color: var(--muted); text-decoration: line-through; }
  .item-meta { color: var(--muted); font-size: 11px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  .check { width: 22px; height: 22px; flex: none; border-radius: 6px; border: 1.5px solid #3b4f70; display: inline-flex; align-items: center; justify-content: center; }
  .check[aria-checked="true"] { background: var(--signal); border-color: var(--signal); color: #1b0f06; }
  .check span { font-size: 13px; line-height: 1; opacity: 0; }
  .check[aria-checked="true"] span { opacity: 1; }
  .empty { margin-top: 22px; padding: 26px 16px; text-align: center; border: 1px dashed var(--line); border-radius: var(--radius); color: var(--muted); font-size: 12.5px; }
  .empty strong { display: block; color: var(--text); font-size: 13.5px; margin-bottom: 4px; }
  .foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 16px; border-top: 1px solid var(--line); color: var(--muted); font-size: 11px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  .pill { display: inline-flex; align-items: center; gap: 6px; padding: 3px 9px; border-radius: 999px; border: 1px solid var(--line); background: var(--surface); font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
  .dot { width: 6px; height: 6px; border-radius: 999px; background: #34d399; }
  .dot.busy { background: #fbbf24; }
  .options { display: flex; flex-direction: column; gap: 10px; margin-top: 14px; }
  .option { position: relative; overflow: hidden; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface); text-align: left; width: 100%; }
  .option:hover { border-color: #3b4f70; }
  .option[aria-pressed="true"] { border-color: rgba(255,107,44,.55); }
  .option-fill { position: absolute; inset: 0 auto 0 0; background: linear-gradient(90deg, rgba(255,107,44,.22), rgba(255,107,44,.04)); transition: width .45s cubic-bezier(.22,1,.36,1); }
  .option-label, .option-count { position: relative; }
  .option-count { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: var(--muted); }
  .kv { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 14px; }
  .kv div { border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface); padding: 10px; }
  .kv b { display: block; font-size: 17px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  .kv span { color: var(--muted); font-size: 10.5px; text-transform: uppercase; letter-spacing: .1em; }
  .skeleton { height: 46px; border-radius: var(--radius); background: linear-gradient(90deg, var(--surface), var(--surface-2), var(--surface)); background-size: 200% 100%; animation: shimmer 1.2s linear infinite; }
  .toast { position: fixed; left: 50%; bottom: 14px; transform: translateX(-50%); background: #1b2a44; border: 1px solid var(--line); color: var(--text); padding: 8px 14px; border-radius: 999px; font-size: 12px; opacity: 0; transition: opacity .2s ease; pointer-events: none; }
  .toast.on { opacity: 1; }
  @keyframes pop { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  @keyframes shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
  @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
`;

/**
 * A faithful, in-browser stand-in for the LocalMe data API. Real projects get
 * the identical request and response shapes from the platform itself.
 */
const API_SHIM = `
(function () {
  var tables = {};
  var seed = window.__LOCALME_SEED__ || {};
  Object.keys(seed).forEach(function (name) {
    tables[name] = seed[name].map(function (doc) { return Object.assign({}, doc); });
  });
  function table(name) { if (!tables[name]) tables[name] = []; return tables[name]; }
  function get(doc, path) { return path.split('.').reduce(function (acc, key) { return acc == null ? acc : acc[key]; }, doc); }
  function compare(a, b) { if (a === b) return 0; if (a == null) return -1; if (b == null) return 1; return a < b ? -1 : 1; }
  function test(doc, filter) {
    if (!filter) return true;
    return Object.keys(filter).every(function (key) {
      var cond = filter[key];
      if (key === '$and') return cond.every(function (f) { return test(doc, f); });
      if (key === '$or') return cond.some(function (f) { return test(doc, f); });
      if (key === '$not') return !test(doc, cond);
      var value = get(doc, key);
      if (cond && typeof cond === 'object' && !Array.isArray(cond) && Object.keys(cond).some(function (k) { return k.charAt(0) === '$'; })) {
        return Object.keys(cond).every(function (op) {
          var arg = cond[op];
          if (op === '$eq') return value === arg;
          if (op === '$ne') return value !== arg;
          if (op === '$gt') return compare(value, arg) > 0;
          if (op === '$gte') return compare(value, arg) >= 0;
          if (op === '$lt') return compare(value, arg) < 0;
          if (op === '$lte') return compare(value, arg) <= 0;
          if (op === '$in') return arg.indexOf(value) !== -1;
          if (op === '$nin') return arg.indexOf(value) === -1;
          if (op === '$exists') return (value !== undefined) === !!arg;
          if (op === '$regex') { try { return new RegExp(arg).test(String(value)); } catch (e) { return false; } }
          return true;
        });
      }
      if (cond && typeof cond === 'object' && !Array.isArray(cond)) {
        return Object.keys(cond).every(function (k) { return (value || {})[k] === cond[k]; });
      }
      if (Array.isArray(value) && !Array.isArray(cond)) return value.indexOf(cond) !== -1;
      return value === cond;
    });
  }
  function sortRows(rows, sort) {
    if (!sort) return rows;
    var keys = Object.keys(sort);
    return rows.slice().sort(function (a, b) {
      for (var i = 0; i < keys.length; i++) {
        var dir = sort[keys[i]] < 0 ? -1 : 1;
        var result = compare(get(a, keys[i]), get(b, keys[i]));
        if (result !== 0) return result * dir;
      }
      return 0;
    });
  }
  function stamp(doc) {
    var now = new Date().toISOString();
    var existing = doc._localme || {};
    return Object.assign({}, doc, { _localme: { createdAt: existing.createdAt || now, updatedAt: now } });
  }
  function report(entry) {
    entry.source = 'localme-demo';
    try { parent.postMessage(entry, '*'); } catch (e) {}
  }
  function respond(status, payload) {
    return new Response(JSON.stringify(payload), { status: status, headers: { 'Content-Type': 'application/json' } });
  }
  var originalFetch = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    var method = ((init && init.method) || 'POST').toUpperCase();
    var parts = url.split('?')[0].split('/');
    var tableName = parts[parts.length - 1];
    if (url.indexOf('/api/db/') === -1 || !originalFetch) {
      if (url.indexOf('/api/') === -1) return originalFetch ? originalFetch(input, init) : Promise.reject(new Error('offline'));
      return Promise.resolve(respond(404, { error: 'No endpoint matches ' + url, code: 'not_found' }));
    }
    var body = {};
    try { body = JSON.parse((init && init.body) || '{}'); } catch (e) {}
    var started = performance.now();
    return new Promise(function (resolve) {
      setTimeout(function () {
        var status = 200;
        var payload = {};
        var name = body.table || tableName;
        if (tableName === 'find') {
          var rows = table(name).filter(function (doc) { return test(doc, body.filter); });
          var sorted = sortRows(rows, body.sort);
          var offset = body.offset || 0;
          var limit = Math.min(body.limit || 50, 500);
          payload = { data: sorted.slice(offset, offset + limit), total: sorted.length, limit: limit, offset: offset, truncated: false };
        } else if (tableName === 'insert') {
          var doc = stamp(body.document || {});
          if (doc.id === undefined || doc.id === null) { status = 400; payload = { error: 'Every document needs a unique id field', code: 'missing_document_id' }; }
          else if (table(name).some(function (row) { return row.id === doc.id; })) { status = 409; payload = { error: 'Document ' + doc.id + ' already exists in ' + name, code: 'duplicate_document_id' }; }
          else { table(name).push(doc); payload = { success: true, document: doc }; }
        } else if (tableName === 'update') {
          var matched = 0;
          var update = body.update || {};
          var usesOperators = Object.keys(update).some(function (key) { return key.charAt(0) === '$'; });
          table(name).forEach(function (row, index) {
            if (!test(row, body.filter)) return;
            matched += 1;
            var next = Object.assign({}, row);
            if (usesOperators) {
              if (update.$set) Object.assign(next, update.$set);
              if (update.$inc) Object.keys(update.$inc).forEach(function (key) { next[key] = (next[key] || 0) + update.$inc[key]; });
              if (update.$unset) Object.keys(update.$unset).forEach(function (key) { delete next[key]; });
            } else { Object.assign(next, update); }
            table(name)[index] = stamp(next);
          });
          payload = { success: true, matched: matched, modified: matched };
        } else if (tableName === 'delete') {
          var before = table(name).length;
          tables[name] = table(name).filter(function (row) { return !test(row, body.filter); });
          payload = { success: true, deleted: before - tables[name].length };
        } else {
          status = 404;
          payload = { error: 'Unknown route ' + url, code: 'not_found' };
        }
        report({
          method: method, path: '/api/db/' + tableName, status: status,
          ms: Math.round(performance.now() - started + Math.random() * 40 + 60),
          request: Object.assign({ table: name }, body.table ? { filter: body.filter, document: body.document, update: body.update, sort: body.sort, limit: body.limit } : {}),
          response: payload
        });
        resolve(respond(status, payload));
      }, 90 + Math.random() * 140);
    });
  };
})();
`;

/**
 * Persian typefaces for the demo document.
 *
 * A `srcdoc` iframe gets its own document and does not inherit the parent's
 * `@font-face` rules, so the demo has to declare the ones it needs. The paths
 * are absolute so they resolve against the platform host. On a custom domain
 * they 404 and the stack falls through to the system Persian face, which is a
 * fine degradation — the demo still works.
 */
const PERSIAN_FONT_CSS = `
@font-face { font-family: "Iransans"; font-style: normal; font-weight: 400; font-display: swap;
  src: url("/fonts/iransans-regular.woff2") format("woff2"); }
@font-face { font-family: "Iransans"; font-style: normal; font-weight: 700; font-display: swap;
  src: url("/fonts/iransans-bold.woff2") format("woff2"); }
`;

/** Right-to-left layout for the Persian document: mirror the flex/grid boxes. */
const RTL_CSS = `
html[dir="rtl"] .row, html[dir="rtl"] .app-head, html[dir="rtl"] .item, html[dir="rtl"] .foot,
html[dir="rtl"] .item-body, html[dir="rtl"] .field { direction: rtl; text-align: right; }
html[dir="rtl"] .app-sub, html[dir="rtl"] .item-meta, html[dir="rtl"] .foot { direction: ltr; text-align: right; }
html[dir="rtl"] .foot span:first-child { direction: rtl; }
`;

function head(extra: string, locale: string) {
  const rtl = locale === "fa-IR";
  const extraCss = rtl ? `${PERSIAN_FONT_CSS}${RTL_CSS}` : "";
  const fontOverride = rtl
    ? `font-family: "Iransans", Tahoma, "Segoe UI", sans-serif;`
    : "";
  return `<head>\n${extra}\n<style>${BASE_CSS}${extraCss}</style>\n<style>body{${fontOverride}}</style>`;
}

/** The document attributes for a culture, for the demo's own `<html>`. */
function htmlAttrs(locale: string): string {
  return locale === "fa-IR" ? `lang="fa" dir="rtl"` : `lang="en" dir="ltr"`;
}

/**
 * The exact file that belongs in a project: complete, standalone and styled.
 * This is what the console writes when a visitor keeps the demo app.
 *
 * A replacer function, not a replacement string: the payload contains `$'`
 * and similar sequences that `String.replace` would otherwise treat as
 * patterns.
 */
export function demoFile(demo: DemoApp, locale = "en-US") {
  return localize(demo.html, locale)
    .replace("<head>", () => head("", locale))
    .replace(/<html [^>]*>/, () => `<html ${htmlAttrs(locale)}>`);
}

/** The sandboxed document: the same file plus a seed and the simulated API. */
function buildDocument(demo: DemoApp, locale: string) {
  const injected =
    `<script>window.__LOCALME_SEED__ = ${JSON.stringify(seedFor(demo.id, locale))};</script>\n` +
    `<script>${API_SHIM}</script>`;
  return localize(demo.html, locale)
    .replace("<head>", () => head(injected, locale))
    .replace(/<html [^>]*>/, () => `<html ${htmlAttrs(locale)}>`);
}

/** The demo apps, in the order the landing page offers them. */
export const DEMOS: DemoApp[] = [
  {
    id: "todo",
    name: "Task tracker",
    tagline: "Insert, filter, update and delete — the whole data API.",
    blurb:
      "A task list backed by the document store. Adding, completing, filtering and deleting each hit a different endpoint.",
    path: "/index.html",
    accent: "text-signal",
    surface: "db + routes",
    html: `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{todo.title}}</title>
</head>
<body>
<div class="app">
  <header class="app-head">
    <div>
      <h1 class="app-title">{{todo.heading}}</h1>
      <p class="app-sub">table: todos</p>
    </div>
    <span class="pill"><i class="dot" id="status"></i><span id="status-text">{{todo.ready}}</span></span>
  </header>
  <div class="body">
    <form class="row" id="form">
      <input class="field" id="text" placeholder="{{todo.placeholder}}" autocomplete="off" aria-label="{{todo.newTask}}">
      <button class="btn btn-primary" type="submit">{{todo.add}}</button>
    </form>
    <div class="chips" role="group" aria-label="{{todo.filter}}">
      <button class="chip" type="button" data-filter="all" aria-pressed="true">{{todo.all}}</button>
      <button class="chip" type="button" data-filter="open" aria-pressed="false">{{todo.open}}</button>
      <button class="chip" type="button" data-filter="done" aria-pressed="false">{{todo.done}}</button>
    </div>
    <ul class="list" id="list"></ul>
  </div>
  <div class="foot"><span id="count">0 {{todo.countSuffix}}</span><span>GET /api/db/find</span></div>
</div>
<div class="toast" id="toast">{{todo.saved}}</div>
<script>
(function () {
  var seed = window.__LOCALME_SEED__ || { todos: [] };
  var state = { filter: 'all', busy: false };
  var list = document.getElementById('list');
  var count = document.getElementById('count');
  function toast(text) { var node = document.getElementById('toast'); node.textContent = text; node.classList.add('on'); setTimeout(function () { node.classList.remove('on'); }, 1200); }
  function setBusy(busy) {
    state.busy = busy;
    document.getElementById('status').className = 'dot' + (busy ? ' busy' : '');
    document.getElementById('status-text').textContent = busy ? '{{todo.busy}}' : '{{todo.ready}}';
  }
  function api(action, body) {
    setBusy(true);
    return fetch('/api/db/' + action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body)
    }).then(function (response) { return response.json().then(function (payload) { return { status: response.status, payload: payload }; }); })
      .finally(function () { setBusy(false); });
  }
  function render(rows) {
    var visible = rows.filter(function (row) { return state.filter === 'all' || (state.filter === 'done') === !!row.done; });
    list.innerHTML = '';
    if (!visible.length) {
      list.innerHTML = '<li class="empty"><strong>{{todo.empty}}</strong>{{todo.emptyHint}}</li>';
    }
    visible.forEach(function (row) {
      var li = document.createElement('li');
      li.className = 'item';
      li.innerHTML = '<button class="check" role="checkbox" aria-checked="' + (row.done ? 'true' : 'false') + '" aria-label="{{todo.toggle}}"><span>✓</span></button>' +
        '<div class="item-body"><div class="item-title' + (row.done ? ' done' : '') + '"></div><div class="item-meta"></div></div>' +
        '<button class="btn-icon" aria-label="{{todo.delete}}">✕</button>';
      li.querySelector('.item-title').textContent = row.text;
      li.querySelector('.item-meta').textContent = 'id ' + row.id;
      li.querySelector('.check').addEventListener('click', function () {
        api('update', { table: 'todos', filter: { id: row.id }, update: { done: !row.done }, many: false }).then(load);
      });
      li.querySelector('.btn-icon').addEventListener('click', function () {
        api('delete', { table: 'todos', filter: { id: row.id } }).then(function () { toast('{{todo.deleted}}'); load(); });
      });
      list.appendChild(li);
    });
    count.textContent = rows.filter(function (row) { return !row.done; }).length + ' open · ' + visible.length + ' shown';
  }
  function load() {
    return api('find', { table: 'todos', filter: {}, sort: { createdAt: 1 }, limit: 100 })
      .then(function (result) { render((result.payload && result.payload.data) || []); });
  }
  document.getElementById('form').addEventListener('submit', function (event) {
    event.preventDefault();
    var input = document.getElementById('text');
    var text = input.value.trim();
    if (!text) return;
    input.value = '';
    api('insert', { table: 'todos', document: { id: 'task-' + Date.now(), text: text, done: false, createdAt: new Date().toISOString() } })
      .then(function (result) {
        if (result.status !== 201 && result.status !== 200) toast(result.payload.error || '{{todo.insertFailed}}');
        return load();
      });
  });
  Array.prototype.forEach.call(document.querySelectorAll('.chip'), function (chip) {
    chip.addEventListener('click', function () {
      state.filter = chip.getAttribute('data-filter');
      Array.prototype.forEach.call(document.querySelectorAll('.chip'), function (other) {
        other.setAttribute('aria-pressed', String(other === chip));
      });
      load();
    });
  });
  load();
})();
</script>
</body>
</html>
`,
  },
  {
    id: "guestbook",
    name: "Guestbook",
    tagline: "Visitor identity, signed messages and paged reads.",
    blurb:
      "A guestbook where writes and reads both flow through the platform. The same table powers the moderation list.",
    path: "/index.html",
    accent: "text-blueprint",
    surface: "db + visitors",
    html: `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{guest.title}}</title>
</head>
<body>
<div class="app">
  <header class="app-head">
    <div>
      <h1 class="app-title">{{guest.heading}}</h1>
      <p class="app-sub">table: entries</p>
    </div>
    <span class="pill"><i class="dot" id="status"></i><span id="status-text">{{todo.ready}}</span></span>
  </header>
  <div class="body">
    <form class="stack" id="form">
      <input class="field" id="name" placeholder="{{guest.name}}" autocomplete="name" aria-label="{{guest.name}}">
      <textarea class="field" id="message" rows="2" placeholder="{{guest.note}}" aria-label="{{guest.note}}"
        style="resize:vertical; min-height:60px; font-family:inherit;"></textarea>
      <button class="btn btn-primary" type="submit">{{guest.sign}}</button>
    </form>
    <ul class="list" id="list"></ul>
  </div>
  <div class="foot"><span id="count">0 entries</span><span>POST /api/db/insert</span></div>
</div>
<div class="toast" id="toast">{{guest.saved}}</div>
<script>
(function () {
  var list = document.getElementById('list');
  function toast(text) { var node = document.getElementById('toast'); node.textContent = text; node.classList.add('on'); setTimeout(function () { node.classList.remove('on'); }, 1200); }
  function setBusy(busy) {
    document.getElementById('status').className = 'dot' + (busy ? ' busy' : '');
    document.getElementById('status-text').textContent = busy ? '{{todo.busy}}' : '{{todo.ready}}';
  }
  function api(action, body) {
    setBusy(true);
    return fetch('/api/db/' + action, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify(body)
    }).then(function (response) { return response.json(); }).finally(function () { setBusy(false); });
  }
  function ago(iso) {
    var seconds = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    if (seconds < 60) return seconds + 's ago';
    if (seconds < 3600) return Math.round(seconds / 60) + 'm ago';
    return Math.round(seconds / 3600) + 'h ago';
  }
  function render(rows) {
    list.innerHTML = '';
    if (!rows.length) {
      list.innerHTML = '<li class="empty"><strong>{{guest.first}}</strong>{{guest.firstHint}}</li>';
    }
    rows.forEach(function (row) {
      var li = document.createElement('li');
      li.className = 'item';
      li.innerHTML = '<div class="item-body"><div class="item-title"></div><div class="item-meta"></div></div><button class="btn-icon" aria-label="{{todo.delete}}">✕</button>';
      li.querySelector('.item-title').textContent = row.message;
      li.querySelector('.item-meta').textContent = row.name + ' · ' + ago(row.createdAt);
      li.querySelector('.btn-icon').addEventListener('click', function () {
        api('delete', { table: 'entries', filter: { id: row.id } }).then(function () { toast('{{todo.deleted}}'); load(); });
      });
      list.appendChild(li);
    });
    document.getElementById('count').textContent = rows.length + ' entries';
  }
  function load() {
    return api('find', { table: 'entries', filter: {}, sort: { createdAt: -1 }, limit: 20 })
      .then(function (result) { render(result.data || []); });
  }
  document.getElementById('form').addEventListener('submit', function (event) {
    event.preventDefault();
    var name = document.getElementById('name');
    var message = document.getElementById('message');
    if (!message.value.trim()) return;
    api('insert', {
      table: 'entries',
      document: { id: 'entry-' + Date.now(), name: name.value.trim() || 'Anonymous', message: message.value.trim(), createdAt: new Date().toISOString() }
    }).then(function () { message.value = ''; toast('{{guest.saved}}'); return load(); });
  });
  load();
})();
</script>
</body>
</html>
`,
  },
  {
    id: "poll",
    name: "Live poll",
    tagline: "Aggregate writes into a live chart with one query.",
    blurb: "A one-question poll. Each vote is an insert; the bars are a single find with a sort.",
    path: "/index.html",
    accent: "text-emerald-400",
    surface: "db + cron",
    html: `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{poll.title}}</title>
</head>
<body>
<div class="app">
  <header class="app-head">
    <div>
      <h1 class="app-title">{{poll.question}}</h1>
      <p class="app-sub">table: votes</p>
    </div>
    <span class="pill"><i class="dot" id="status"></i><span id="status-text">{{todo.ready}}</span></span>
  </header>
  <div class="body">
    <div class="options" id="options"></div>
    <div class="kv">
      <div><b id="total">0</b><span>{{poll.votesLabel}}</span></div>
      <div><b id="leader">—</b><span>{{poll.leadingLabel}}</span></div>
      <div><b id="updated">now</b><span>{{poll.updatedLabel}}</span></div>
    </div>
    <p class="app-sub" style="margin-top:14px">{{poll.hint}}</p>
  </div>
  <div class="foot"><span id="query">GET /api/db/find</span><span>{{poll.footNote}}</span></div>
</div>
<div class="toast" id="toast">{{poll.voted}}</div>
<script>
(function () {
  var OPTIONS = ['{{poll.opt1}}', '{{poll.opt2}}', '{{poll.opt3}}'];
  var voted = null;
  function toast(text) { var node = document.getElementById('toast'); node.textContent = text; node.classList.add('on'); setTimeout(function () { node.classList.remove('on'); }, 1200); }
  function setBusy(busy) {
    document.getElementById('status').className = 'dot' + (busy ? ' busy' : '');
    document.getElementById('status-text').textContent = busy ? '{{todo.busy}}' : '{{todo.ready}}';
  }
  function api(action, body) {
    setBusy(true);
    document.getElementById('query').textContent = 'POST /api/db/' + action;
    return fetch('/api/db/' + action, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify(body)
    }).then(function (response) { return response.json(); }).finally(function () { setBusy(false); });
  }
  function tally(rows) {
    var counts = {};
    OPTIONS.forEach(function (option) { counts[option] = 0; });
    rows.forEach(function (row) { counts[row.option] = (counts[row.option] || 0) + 1; });
    return counts;
  }
  function render(rows) {
    var counts = tally(rows);
    var total = rows.length;
    var leader = OPTIONS.slice().sort(function (a, b) { return counts[b] - counts[a]; })[0];
    document.getElementById('total').textContent = String(total);
    document.getElementById('leader').textContent = total ? leader.split(' ')[0] : '—';
    document.getElementById('updated').textContent = '{{poll.justNow}}';
    var container = document.getElementById('options');
    container.innerHTML = '';
    OPTIONS.forEach(function (option) {
      var share = total ? Math.round((counts[option] / total) * 100) : 0;
      var button = document.createElement('button');
      button.className = 'option';
      button.type = 'button';
      button.setAttribute('aria-pressed', String(voted === option));
      button.innerHTML = '<span class="option-fill" style="width:' + share + '%"></span>' +
        '<span class="option-label"></span><span class="option-count">' + counts[option] + ' · ' + share + '%</span>';
      button.querySelector('.option-label').textContent = option;
      button.addEventListener('click', function () {
        if (voted) { toast('{{poll.alreadyVoted}}'); return; }
        voted = option;
        api('insert', { table: 'votes', document: { id: 'vote-' + Date.now(), option: option, createdAt: new Date().toISOString() } })
          .then(function () { toast('{{poll.voted}}'); return load(); });
      });
      container.appendChild(button);
    });
  }
  function load() {
    return api('find', { table: 'votes', filter: {}, limit: 500 }).then(function (result) { render(result.data || []); });
  }
  load();
})();
</script>
</body>
</html>
`,
  },
];

/** Seed rows injected into the sandbox so demos never start empty. */
function seedFor(id: DemoId, locale: string) {
  const now = Date.now();
  if (id === "todo") {
    return {
      todos: [
        { id: "task-1", text: demoText(locale, "todo.seed1"), done: true, createdAt: new Date(now - 900_000).toISOString(), _localme: {} },
        { id: "task-2", text: demoText(locale, "todo.seed2"), done: false, createdAt: new Date(now - 600_000).toISOString(), _localme: {} },
        { id: "task-3", text: demoText(locale, "todo.seed3"), done: false, createdAt: new Date(now - 300_000).toISOString(), _localme: {} },
      ],
    };
  }
  if (id === "guestbook") {
    return {
      entries: [
        {
          id: "entry-1",
          name: "Priya",
          message: demoText(locale, "guest.seed1"),
          createdAt: new Date(now - 1_800_000).toISOString(),
          _localme: {},
        },
        {
          id: "entry-2",
          name: "Sam",
          message: demoText(locale, "guest.seed2"),
          createdAt: new Date(now - 420_000).toISOString(),
          _localme: {},
        },
      ],
    };
  }
  const votes = [
    { option: demoText(locale, "poll.opt1"), n: 7 },
    { option: demoText(locale, "poll.opt2"), n: 4 },
    { option: demoText(locale, "poll.opt3"), n: 5 },
  ];
  const rows: Record<string, unknown>[] = [];
  votes.forEach((vote, index) => {
    for (let i = 0; i < vote.n; i += 1) {
      rows.push({
        id: `vote-${index}-${i}`,
        option: vote.option,
        createdAt: new Date(now - (i + index) * 60_000).toISOString(),
        _localme: {},
      });
    }
  });
  return { votes: rows };
}

/** Full `srcdoc` document for the sandboxed demo iframe. */
export function demoDocument(demo: DemoApp, locale = "en-US") {
  return buildDocument(demo, locale);
}

export function getDemo(id: string | null | undefined) {
  return DEMOS.find((demo) => demo.id === id);
}

/* ------------------------------------------------------------------ *
 * Handoff: play on the landing page, then keep it after signing up.
 * ------------------------------------------------------------------ */

const IMPORT_KEY = "localme.pending-import";

export function stageDemoImport(id: DemoId) {
  try {
    window.localStorage.setItem(IMPORT_KEY, id);
  } catch {
    /* storage unavailable — the query parameter still carries the intent */
  }
}

export function readDemoImport(): DemoId | null {
  try {
    const value = window.localStorage.getItem(IMPORT_KEY);
    return getDemo(value)?.id ?? null;
  } catch {
    return null;
  }
}

export function clearDemoImport() {
  try {
    window.localStorage.removeItem(IMPORT_KEY);
  } catch {
    /* ignore */
  }
}
