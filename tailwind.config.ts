import animate from "tailwindcss-animate";
import plugin from "tailwindcss/plugin";
import type { Config } from "tailwindcss";

/**
 * Font sizes are multiplied by `--font-scale` so a culture can shrink its own
 * type without touching a single component.
 *
 * Persian faces (Iransans, Vazir) have a larger apparent size than Inter at
 * the same nominal px — wider, taller and with more vertical whitespace — so
 * `fa-IR` renders everything at a fraction smaller. Doing it here rather than
 * with `html { font-size }` matters: a root-font-size change would scale
 * padding, gaps and icon boxes along with the text, reflowing layouts that
 * have nothing to do with reading. `--font-scale` only ever multiplies
 * `font-size`.
 *
 * Line heights are unitless for the same reason — they track the size they
 * belong to, so they shrink with it.
 */
type Size = [string, { lineHeight: string; letterSpacing?: string }];

/**
 * `lineHeight` is `inherit` for the sizes that used to be arbitrary values
 * (`text-[13px]`), which emits no line-height of its own. `line-height` is an
 * inherited property, so naming it explicitly is the same rendering as
 * omitting it — but it satisfies the config type, which requires the pair.
 *
 * Numbers are accepted for readability and emitted as unitless strings, which
 * is what makes the leading shrink along with the size.
 */
function scaled(size: string, lineHeight: string | number = "inherit", letterSpacing?: string): Size {
  const fontSize = `calc(${size} * var(--font-scale))`;
  const value = String(lineHeight);
  return [fontSize, letterSpacing ? { lineHeight: value, letterSpacing } : { lineHeight: value }];
}

const tailwindConfig: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1.25rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "Inter",
          "ui-sans-serif",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        display: [
          "var(--font-display)",
          "Inter Tight",
          "Inter",
          "ui-sans-serif",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "var(--font-mono)",
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "Liberation Mono",
          "monospace",
        ],
      },
      // The whole scale is redefined rather than extended, so nothing can slip
      // through unscaled: the Tailwind defaults are rem literals, and a single
      // `text-lg` left behind would be the one size `fa-IR` cannot shrink.
      fontSize: {
        "2xs": scaled("0.6875rem", 1),
        xs: scaled("0.75rem", 1),
        sm: scaled("0.875rem", 1.25),
        base: scaled("1rem", 1.5),
        lg: scaled("1.125rem", 1.75),
        xl: scaled("1.25rem", 1.75),
        "2xl": scaled("1.5rem", 2),
        "3xl": scaled("1.875rem", 2.25),
        "4xl": scaled("2.25rem", 2.5),
        "5xl": scaled("3rem", 1),
        "6xl": scaled("3.75rem", 1),
        "7xl": scaled("4.5rem", 1),
        "8xl": scaled("6rem", 1),
        "9xl": scaled("8rem", 1),

        // Sizes the design uses below Tailwind's own scale, named after the
        // px value they produce at the 16px root. They replace what used to be
        // `text-[13px]` and friends, which bypassed the scale entirely.
        "9px": scaled("0.5625rem"),
        "10px": scaled("0.625rem"),
        "10.5px": scaled("0.65625rem"),
        "11px": scaled("0.6875rem"),
        "11.5px": scaled("0.71875rem"),
        "12px": scaled("0.75rem"),
        "12.5px": scaled("0.78125rem"),
        "13px": scaled("0.8125rem"),
        "14px": scaled("0.875rem"),
        "15px": scaled("0.9375rem"),
        "16px": scaled("1rem"),
        "18px": scaled("1.125rem"),
        "20px": scaled("1.25rem"),
        "22px": scaled("1.375rem"),
        "24px": scaled("1.5rem"),
        "28px": scaled("1.75rem"),
        "30px": scaled("1.875rem"),
        "34px": scaled("2.125rem"),
        "36px": scaled("2.25rem"),
        "40px": scaled("2.5rem"),
        "48px": scaled("3rem"),
        "56px": scaled("3.5rem"),

        "display-sm": scaled("1.75rem", 1.15, "-0.02em"),
        "display-md": scaled("2.25rem", 1.1, "-0.025em"),
        "display-lg": scaled("3rem", 1.05, "-0.03em"),
        "display-xl": scaled("3.75rem", 1.02, "-0.035em"),
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        paper: "hsl(var(--paper))",
        ink: "hsl(var(--ink))",
        signal: {
          DEFAULT: "hsl(var(--signal))",
          foreground: "hsl(var(--signal-foreground))",
          soft: "hsl(var(--signal) / 0.12)",
        },
        blueprint: {
          DEFAULT: "hsl(var(--blueprint))",
          soft: "hsl(var(--blueprint) / 0.12)",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        panel: "0 1px 2px hsl(var(--shadow-color) / 0.06), 0 8px 24px -12px hsl(var(--shadow-color) / 0.18)",
        raised: "0 2px 4px hsl(var(--shadow-color) / 0.06), 0 18px 40px -20px hsl(var(--shadow-color) / 0.30)",
        glow: "0 0 0 1px hsl(var(--signal) / 0.25), 0 12px 40px -16px hsl(var(--signal) / 0.55)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        sweep: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        "caret-blink": {
          "0%,45%": { opacity: "1" },
          "50%,100%": { opacity: "0" },
        },
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        "marquee-x": {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-up": "fade-up 0.6s cubic-bezier(0.22, 1, 0.36, 1) both",
        "fade-in": "fade-in 0.4s ease-out both",
        "scale-in": "scale-in 0.35s cubic-bezier(0.22, 1, 0.36, 1) both",
        sweep: "sweep 3.5s linear infinite",
        "caret-blink": "caret-blink 1.1s steps(1) infinite",
        float: "float 6s ease-in-out infinite",
        "marquee-x": "marquee-x 38s linear infinite",
      },
    },
  },
  plugins: [
    animate,
    plugin(({ addVariant }) => {
      // Real touch targets on touch hardware, compact controls with a mouse.
      addVariant("touch", "@media (pointer: coarse)");
      addVariant("no-touch", "@media (pointer: fine)");
    }),
  ],
};

export default tailwindConfig;
