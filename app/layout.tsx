import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./globals.css";
import { Providers } from "./providers";
import { SITE_NAME, DEFAULT_TITLE, DEFAULT_DESCRIPTION, DEFAULT_IMAGE, siteOrigin } from "@/lib/seo";
import { LOCALE_META } from "@/lib/i18n/locales";
import { resolveRequestLocale } from "@/lib/i18n/server";

const inter = { variable: "--font-sans" };
const interTight = { variable: "--font-display" };
const jetbrainsMono = { variable: "--font-mono" };

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: {
    default: DEFAULT_TITLE,
    template: `%s — ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: DEFAULT_IMAGE,
  },
  manifest: "/site.webmanifest",
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    images: [{ url: DEFAULT_IMAGE, width: 1200, height: 630, alt: SITE_NAME }],
  },
  twitter: { card: "summary_large_image", images: [DEFAULT_IMAGE] },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0e14" },
    { media: "(prefers-color-scheme: light)", color: "#f7f7f5" },
  ],
};

// Runs before the body is parsed: applies the persisted theme, applies the
// persisted culture, and marks the document as script-capable so scroll-reveal
// styles may hide elements.
//
// Culture has to be applied here rather than in an effect because `dir` is a
// layout property — flipping it after paint means the whole page reflows from
// the wrong edge, which is exactly the jarring flash RTL support exists to
// prevent. The server already rendered the correct `lang`/`dir` from the
// cookie; this only covers the case where localStorage is newer than it.
const themeScript = `(function(){var d=document.documentElement;d.classList.add("js");try{var t=localStorage.getItem("localme.theme");if(t==="dark"){d.classList.add("dark")}else{d.classList.remove("dark")}}catch(e){d.classList.remove("dark")}try{var l=localStorage.getItem("localme.locale");if(l==="fa-IR"||l==="en-US"){d.lang=l;d.dir=(l==="fa-IR")?"rtl":"ltr"}}catch(e){}})()`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await resolveRequestLocale();
  const meta = LOCALE_META[locale];

  return (
    <html lang={meta.intlTag} dir={meta.dir} className="light" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${interTight.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <Providers initialLocale={locale}>{children}</Providers>
        {/* Sonner positions itself physically; the toast corner has to move
            to the opposite side or it sits under the primary nav in RTL. */}
        <Toaster position={meta.dir === "rtl" ? "bottom-left" : "bottom-right"} richColors />
      </body>
    </html>
  );
}
