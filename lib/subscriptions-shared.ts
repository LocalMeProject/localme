/**
 * Shared Subscription Plans definitions and defaults.
 * Safe to import from both server and client modules.
 */

export interface SubscriptionPlan {
  id: "free" | "plus" | "pro";
  name: string;
  nameFa: string;
  badge?: string;
  badgeFa?: string;
  priceToman: number; // 0 for free
  period: string; // e.g. "month"
  periodFa: string; // e.g. "ماه"
  description: string;
  descriptionFa: string;
  maxProjects: number;
  projectStorageCapMb: number;
  libraryStorageCapMb: number;
  monthlyVisits: number;
  features: string[];
  featuresFa: string[];
  isPopular?: boolean;
  enabled: boolean;
}

export const DEFAULT_PLANS: SubscriptionPlan[] = [
  {
    id: "free",
    name: "Free",
    nameFa: "رایگان",
    badge: "Instant Start",
    badgeFa: "شروع سریع",
    priceToman: 0,
    period: "month",
    periodFa: "همیشگی برای شروع",
    description: "Everything you need to build and host your first web apps and prototypes.",
    descriptionFa: "هر آنچه برای ساخت و میزبانی اولین اپلیکیشن‌ها و نمونه‌های اولیه نیاز داری.",
    maxProjects: 3,
    projectStorageCapMb: 3,
    libraryStorageCapMb: 3,
    monthlyVisits: 500,
    features: [
      "3 Hosted Web Projects",
      "Integrated SQLite & Document Database",
      "Built-in Visitor Auth & Sessions",
      "Free Subdomain on localme.ir",
      "Automated Deployments & AI Tools",
    ],
    featuresFa: [
      "۳ پروژهٔ وب مستقل و فعال",
      "دیتابیس ابری داخلی برای هر پروژه",
      "سیستم احراز هویت و سشن خودکار",
      "زیردامنه رایگان روی localme.ir",
      "دیپلوی خودکار و اتصال به ابزارهای هوش مصنوعی",
    ],
    isPopular: false,
    enabled: true,
  },
  {
    id: "plus",
    name: "Plus",
    nameFa: "پلاس",
    badge: "Most Popular",
    badgeFa: "محبوب‌ترین",
    priceToman: 199000,
    period: "month",
    periodFa: "ماهانه",
    description: "Expanded capacity and custom domains for growing apps and side-projects.",
    descriptionFa: "ظرفیت ارتقایافته و اتصال دامنه اختصاصی برای پروژه‌های فعال و کسب‌وکارهای نوپا.",
    maxProjects: 50,
    projectStorageCapMb: 50,
    libraryStorageCapMb: 50,
    monthlyVisits: 50000,
    features: [
      "Everything in Free tier",
      "Custom Domains with Auto SSL",
      "Up to 50 Concurrent Projects",
      "50 MB Storage per Project & Library",
      "Automated Cron Jobs & Webhooks",
      "Priority API & AI Agent Access",
    ],
    featuresFa: [
      "تمامی امکانات پلن رایگان",
      "اتصال دامنه اختصاصی با SSL رایگان خودکار",
      "تا ۵۰ پروژه فعال همزمان",
      "۵۰ مگابایت حافظه برای هر پروژه و کتابخانه",
      "کران جاب‌های خودکار و وب‌هوک‌های ارسالی",
      "دسترسی با اولویت بالا به API و Agentها",
    ],
    isPopular: true,
    enabled: true,
  },
  {
    id: "pro",
    name: "Pro",
    nameFa: "حرفه‌ای",
    badge: "Production Power",
    badgeFa: "ویژه سازمان و پروژه‌های تجاری",
    priceToman: 499000,
    period: "month",
    periodFa: "ماهانه",
    description: "Heavyweight limits, dedicated scale, and unlimited agency workflow.",
    descriptionFa: "بالاترین سطح منابع، مناسب آژانس‌ها، فریلنسرها و پروژه‌های پرترافیک تجاری.",
    maxProjects: 200,
    projectStorageCapMb: 500,
    libraryStorageCapMb: 500,
    monthlyVisits: 500000,
    features: [
      "Everything in Plus tier",
      "Up to 200 Concurrent Projects",
      "500 MB Storage per Project & Library",
      "500,000 Monthly Visits",
      "Extended Log Retention & Audit",
      "Direct Priority Operator Support",
    ],
    featuresFa: [
      "تمامی امکانات پلن پلاس",
      "امکان ایجاد تا ۲۰۰ پروژه همزمان",
      "۵۰۰ مگابایت حافظه اختصاصی برای هر پروژه",
      "۵۰۰,۰۰۰ بازدید در ماه",
      "نگهداری طولانی‌مدت لاگ‌ها و گزارش‌های تحلیلی",
      "پشتیبانی مستقیم و اختصاصی",
    ],
    isPopular: false,
    enabled: true,
  },
];
