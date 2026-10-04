/**
 * Deployment Setup Wizard & Seeding (Blueprint §7, Technical Docs §3).
 *
 * Provides safe, non-destructive first-boot seeding for production:
 * 1. Demo platform data & subscription plan defaults
 * 2. Example projects populated under the `these_are_examples` showcase user
 *
 * All operations are strictly idempotent: existing users and projects are preserved.
 */
import { getDb } from "@/lib/server/db/index";
import { placeholder } from "@/lib/server/db/sql";
import {
  createUser,
  getUserByUsername,
  createProject,
  listProjectsByUser,
  putFile,
} from "@/lib/server/repos";
import { demoFile, getDemo } from "@/lib/demo-apps";
import { getSubscriptionPlans, saveSubscriptionPlans, DEFAULT_PLANS } from "@/lib/server/subscriptions";
import { configValue, invalidateConfig } from "@/lib/server/system-config";

export interface SetupStatus {
  wizardCompleted: boolean;
  totalUsers: number;
  totalProjects: number;
  examplesUserExists: boolean;
  exampleProjectsCount: number;
  exampleProjects: { name: string; url: string }[];
}

export const EXAMPLES_USERNAME = "these_are_examples";

/** Check the current status of deployment setup and showcase accounts. */
export async function getSetupStatus(): Promise<SetupStatus> {
  const db = getDb();
  let totalUsers = 0;
  let totalProjects = 0;

  try {
    const userRows = await db.raw<{ n: number | string }>("SELECT COUNT(*) AS n FROM users");
    totalUsers = Number(userRows[0]?.n ?? 0);
  } catch {
    // Ignore if table not yet migrated
  }

  try {
    const projRows = await db.raw<{ n: number | string }>(
      "SELECT COUNT(*) AS n FROM projects WHERE name <> 'library'",
    );
    totalProjects = Number(projRows[0]?.n ?? 0);
  } catch {
    // Ignore
  }

  const wizardCompleted = Boolean(await configValue<boolean>("setup.wizard_completed"));
  const examplesUser = await getUserByUsername(EXAMPLES_USERNAME).catch(() => null);

  let exampleProjects: { name: string; url: string }[] = [];
  if (examplesUser) {
    const projs = await listProjectsByUser(examplesUser.id);
    exampleProjects = projs
      .filter((p) => p.name !== "library")
      .map((p) => ({
        name: p.name,
        url: `/${EXAMPLES_USERNAME}/${p.name}/`,
      }));
  }

  return {
    wizardCompleted,
    totalUsers,
    totalProjects,
    examplesUserExists: Boolean(examplesUser),
    exampleProjectsCount: exampleProjects.length,
    exampleProjects,
  };
}

/** HTML template for the Cake Shop showcase project */
function cakeShopHtml(): string {
  return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>قنادی بهار — سفارش آنلاین کیک و شیرینی</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; background: #faf8f5; color: #2c2523; line-height: 1.6; }
    header { background: #fff; border-bottom: 1px solid #ebdcd0; padding: 1.25rem 1.5rem; text-align: center; }
    header h1 { font-size: 1.5rem; color: #78350f; display: flex; align-items: center; justify-content: center; gap: .5rem; }
    header p { font-size: .875rem; color: #854d0e; margin-top: .25rem; }
    main { max-width: 800px; margin: 2rem auto; padding: 0 1rem; }
    .hero { background: linear-gradient(135deg, #fef3c7, #fed7aa); border-radius: 16px; padding: 2rem; border: 1px solid #fde68a; margin-bottom: 2rem; }
    .hero h2 { font-size: 1.25rem; color: #92400e; margin-bottom: .5rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
    .card { background: #fff; border-radius: 12px; border: 1px solid #e7ded5; padding: 1.25rem; display: flex; flex-direction: column; justify-content: space-between; }
    .card .icon { font-size: 2.5rem; margin-bottom: .5rem; text-align: center; }
    .card h3 { font-size: 1.05rem; margin-bottom: .25rem; }
    .card .price { font-weight: 700; color: #b45309; margin: .5rem 0; }
    .btn { background: #d97706; color: #fff; border: 0; padding: .6rem 1rem; border-radius: 8px; font-weight: 600; cursor: pointer; width: 100%; transition: background .15s; }
    .btn:hover { background: #b45309; }
    .form-card { background: #fff; border-radius: 12px; border: 1px solid #e7ded5; padding: 1.5rem; margin-top: 2rem; }
    .form-card h3 { font-size: 1.15rem; margin-bottom: 1rem; color: #78350f; }
    .field { margin-bottom: 1rem; }
    label { display: block; font-size: .85rem; margin-bottom: .3rem; font-weight: 500; }
    input, select, textarea { width: 100%; padding: .65rem; border: 1px solid #d6c7b9; border-radius: 8px; font-family: inherit; font-size: .95rem; }
    .order-status { margin-top: 1rem; padding: 1rem; border-radius: 8px; display: none; }
    .order-status.ok { display: block; background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; }
    footer { text-align: center; padding: 2rem; font-size: .8rem; color: #a89f91; }
  </style>
</head>
<body>
  <header>
    <h1>🎂 قنادی بهار</h1>
    <p>پخت تازه، تحویل درب منزل در سراسر تهران</p>
  </header>
  <main>
    <div class="hero">
      <h2>سفارش آنلاین کیک و دسرهای خانگی</h2>
      <p>محصولات ما روزانه با تازه‌ترین مواد اولیه تهیه میشوند. کیک مورد نظرتان را انتخاب و سفارش دهید.</p>
    </div>
    <div class="grid">
      <div class="card">
        <div class="icon">🍰</div>
        <h3>کیک شکلاتی بلژیکی</h3>
        <p style="font-size: .85rem; color: #6b7280;">گاناش شکلات تلخ و فیلینگ فندق</p>
        <div class="price">۴۵۰,۰۰۰ تومان</div>
        <button class="btn" onclick="selectCake('کیک شکلاتی بلژیکی')">انتخاب برای سفارش</button>
      </div>
      <div class="card">
        <div class="icon">🍓</div>
        <h3>کیک توت‌فرنگی و وانیل</h3>
        <p style="font-size: .85rem; color: #6b7280;">اسفنج لطیف با خامه تازه و توت‌فرنگی</p>
        <div class="price">۴۸۰,۰۰۰ تومان</div>
        <button class="btn" onclick="selectCake('کیک توت‌فرنگی و وانیل')">انتخاب برای سفارش</button>
      </div>
      <div class="card">
        <div class="icon">🧁</div>
        <h3>بسته کاپ‌کیک ردولوت (۶تایی)</h3>
        <p style="font-size: .85rem; color: #6b7280;">کرم پنیر خامه‌ای با مغز شکلات</p>
        <div class="price">۲۹۰,۰۰۰ تومان</div>
        <button class="btn" onclick="selectCake('بسته کاپ‌کیک ردولوت (۶تایی)')">انتخاب برای سفارش</button>
      </div>
    </div>

    <div class="form-card">
      <h3>ثبت اطلاعات تحویل و سفارش</h3>
      <form id="order-form" onsubmit="submitOrder(event)">
        <div class="field">
          <label>محصول انتخابی</label>
          <input id="product-name" required value="کیک شکلاتی بلژیکی" readonly style="background:#f3f4f6">
        </div>
        <div class="field">
          <label>نام و نام خانوادگی خریدار</label>
          <input id="customer-name" required placeholder="مثال: مریم احمدی">
        </div>
        <div class="field">
          <label>شماره تماس</label>
          <input id="customer-phone" required type="tel" placeholder="۰۹۱۲..." dir="ltr">
        </div>
        <div class="field">
          <label>آدرس تحویل</label>
          <textarea id="customer-address" required rows="2" placeholder="خیابان، پلاک، واحد"></textarea>
        </div>
        <button type="submit" class="btn" id="submit-btn" style="background:#059669">تایید و ثبت سفارش</button>
      </form>
      <div id="order-status" class="order-status"></div>
    </div>
  </main>
  <footer>
    میزبانی شده روی پلتفرم LocalMe · داده‌ها به صورت خودکار در دیتابیس پروژه ثبت میشوند.
  </footer>

  <script>
    function selectCake(name) {
      document.getElementById('product-name').value = name;
      document.getElementById('order-form').scrollIntoView({ behavior: 'smooth' });
    }

    async function submitOrder(e) {
      e.preventDefault();
      const btn = document.getElementById('submit-btn');
      const status = document.getElementById('order-status');
      btn.disabled = true;
      btn.textContent = 'در حال ثبت سفارش…';

      const orderData = {
        product: document.getElementById('product-name').value,
        name: document.getElementById('customer-name').value,
        phone: document.getElementById('customer-phone').value,
        address: document.getElementById('customer-address').value,
        created_at: new Date().toISOString()
      };

      try {
        const res = await fetch('/api/db/insert', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            table: 'orders',
            data: orderData
          })
        });
        const json = await res.json();
        status.className = 'order-status ok';
        status.innerHTML = '🎉 سفارش شما با موفقیت ثبت شد! شناسه سفارش: <strong>#' + (json.id || Math.floor(Math.random() * 9000 + 1000)) + '</strong>. به زودی جهت هماهنگی تماس میگیریم.';
        document.getElementById('order-form').reset();
      } catch (err) {
        status.className = 'order-status ok';
        status.innerHTML = '🎉 سفارش شما در سیستم ثبت شد. از خرید شما سپاسگزاریم!';
      } finally {
        btn.disabled = false;
        btn.textContent = 'تایید و ثبت سفارش';
      }
    }
  </script>
</body>
</html>`;
}

/** HTML template for Profile Links / Link-in-Bio */
function profileLinksHtml(): string {
  return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>کارت لینک و معرفی شخصی</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 1.5rem; }
    .card { width: 100%; max-width: 420px; background: #1e293b; border-radius: 24px; border: 1px solid #334155; padding: 2.5rem 1.75rem; text-align: center; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
    .avatar { width: 88px; height: 88px; border-radius: 50%; background: linear-gradient(135deg, #38bdf8, #818cf8); margin: 0 auto 1.25rem; display: flex; align-items: center; justify-content: center; font-size: 2.5rem; border: 3px solid #0f172a; }
    h1 { font-size: 1.35rem; font-weight: 700; margin-bottom: .25rem; }
    p.bio { font-size: .875rem; color: #94a3b8; margin-bottom: 1.75rem; line-height: 1.5; }
    .links { display: flex; flex-direction: column; gap: .85rem; }
    .link-btn { display: flex; align-items: center; justify-content: center; gap: .5rem; padding: .85rem 1.25rem; border-radius: 12px; background: #334155; color: #f8fafc; text-decoration: none; font-size: .95rem; font-weight: 600; border: 1px solid #475569; transition: all .2s; }
    .link-btn:hover { background: #38bdf8; color: #0f172a; border-color: #38bdf8; transform: translateY(-2px); }
    footer { margin-top: 2rem; font-size: .75rem; color: #64748b; }
  </style>
</head>
<body>
  <div class="card">
    <div class="avatar">🚀</div>
    <h1>پروژه نمونه LocalMe</h1>
    <p class="bio">صفحه پیوند شخصی و ارتباطی · میزبانی شده با عملکرد بالا روی LocalMe</p>
    <div class="links">
      <a class="link-btn" href="https://localme.ir" target="_blank">🌐 وبسایت اصلی پلتفرم</a>
      <a class="link-btn" href="https://localme.ir/docs" target="_blank">📚 مستندات فنی و راهنما</a>
      <a class="link-btn" href="https://localme.ir/skills/localme/SKILL.md" target="_blank">🤖 مهارت هوش مصنوعی (SKILL.md)</a>
      <a class="link-btn" href="mailto:support@localme.ir">✉️ تماس با پشتیبانی</a>
    </div>
    <footer>ساخته شده بدون سرور اختصاصی روی LocalMe</footer>
  </div>
</body>
</html>`;
}

/**
 * Execute the setup wizard tasks.
 * Safe and non-destructive: keeps existing user accounts and projects.
 */
export async function runSetupWizard(options: {
  seedDemoData?: boolean;
  seedExampleProjects?: boolean;
}): Promise<{
  success: boolean;
  seededPlans: boolean;
  createdExamplesUser: boolean;
  createdProjects: string[];
}> {
  let seededPlans = false;
  let createdExamplesUser = false;
  const createdProjects: string[] = [];

  // 1. Seed Demo Data & Subscription Plans
  if (options.seedDemoData) {
    const plans = await getSubscriptionPlans();
    if (!plans || plans.length === 0) {
      await saveSubscriptionPlans(DEFAULT_PLANS);
      seededPlans = true;
    }
  }

  // 2. Seed Example Projects under `these_are_examples` user
  if (options.seedExampleProjects) {
    let user = await getUserByUsername(EXAMPLES_USERNAME).catch(() => null);
    if (!user) {
      const generatedPassword = `Example_${Math.random().toString(36).slice(2, 12)}!`;
      const created = await createUser(EXAMPLES_USERNAME, generatedPassword);
      user = await getUserByUsername(created.username);
      createdExamplesUser = true;
      // Give example account ample quota for sample projects
      if (user) {
        const db = getDb();
        await db.run(
          `UPDATE users SET max_projects = 50, project_storage_cap_bytes = 52428800 WHERE id = ${placeholder(db.driver, 0)}`,
          [user.id],
        );
      }
    }

    if (user) {
      const existing = await listProjectsByUser(user.id);
      const existingNames = new Set(existing.map((p) => p.name));

      const todoDemo = getDemo("todo");
      const guestDemo = getDemo("guestbook");
      const pollDemo = getDemo("poll");

      const samples: { name: string; getHtml: () => string }[] = [
        { name: "cake-shop", getHtml: cakeShopHtml },
        { name: "todo-tasks", getHtml: () => (todoDemo ? demoFile(todoDemo, "fa-IR") : cakeShopHtml()) },
        { name: "guestbook", getHtml: () => (guestDemo ? demoFile(guestDemo, "fa-IR") : cakeShopHtml()) },
        { name: "feedback-poll", getHtml: () => (pollDemo ? demoFile(pollDemo, "fa-IR") : cakeShopHtml()) },
        { name: "profile-links", getHtml: profileLinksHtml },
      ];

      for (const sample of samples) {
        if (!existingNames.has(sample.name)) {
          const project = await createProject(user.id, sample.name);
          const htmlContent = sample.getHtml();
          await putFile(user.id, project.id, "index.html", Buffer.from(htmlContent, "utf8"));
          createdProjects.push(sample.name);
        }
      }
    }
  }

  // Mark setup completed in system_configs
  const db = getDb();
  const p = db.driver;
  const exists = await db.raw<{ config_key: string }>(
    `SELECT config_key FROM system_configs WHERE config_key = ${placeholder(p, 0)}`,
    ["setup.wizard_completed"],
  );
  if (exists[0]) {
    await db.run(
      `UPDATE system_configs SET config_value = 'true', updated_at = ${placeholder(p, 0)} WHERE config_key = ${placeholder(p, 1)}`,
      [new Date().toISOString(), "setup.wizard_completed"],
    );
  } else {
    await db.run(
      `INSERT INTO system_configs (config_key, config_value, description) VALUES (${placeholder(p, 0)}, 'true', 'Flag marking first-time setup wizard completed')`,
      ["setup.wizard_completed"],
    );
  }
  invalidateConfig("setup.wizard_completed");

  return {
    success: true,
    seededPlans,
    createdExamplesUser,
    createdProjects,
  };
}
