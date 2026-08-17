import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", "system-ui", "sans-serif"],
        // Instrument Serif는 한글 글리프가 없다. Noto Serif KR 폴백이 반드시 뒤따라야 한다.
        display: ["'Instrument Serif'", "'Noto Serif KR'", "Georgia", "serif"],
        serif: ["'Instrument Serif'", "'Noto Serif KR'", "Georgia", "serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
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
        book: {
          1: "hsl(var(--book-spine-1))",
          2: "hsl(var(--book-spine-2))",
          3: "hsl(var(--book-spine-3))",
          4: "hsl(var(--book-spine-4))",
          5: "hsl(var(--book-spine-5))",
          6: "hsl(var(--book-spine-6))",
        },
        bookmark: {
          lent: "hsl(var(--bookmark-lent))",
          "lent-foreground": "hsl(var(--bookmark-lent-foreground))",
          borrowed: "hsl(var(--bookmark-borrowed))",
          "borrowed-foreground": "hsl(var(--bookmark-borrowed-foreground))",
        },
        // Bookshelf Refresh
        faint: "hsl(var(--faint))",              // eyebrow / 흐린 텍스트
        "spine-text": "hsl(var(--book-spine-text))",
        "ghost-dash": "hsl(var(--ghost-dash))",
      },
      // 전부 px. rem으로 두면 html{font-size:108.5%}에 따라 모서리까지 커진다.
      // 값은 현재 렌더되는 값(rem × 1.085)을 그대로 굳힌 것 — 겉모습은 안 바뀐다.
      borderRadius: {
        lg: "var(--radius)",              /* 15px — 카드 */
        md: "calc(var(--radius) - 2px)",  /* 13px */
        sm: "calc(var(--radius) - 4px)",  /* 11px */
        xl: "13px",                       /* 0.75rem → 13.02px 였다 */
        "2xl": "17px",                    /* 1rem   → 17.36px */
        "3xl": "26px",                    /* 1.5rem → 26.04px */
        "4xl": "35px",                    /* 2rem   → 34.72px */
      },
      boxShadow: {
        "book": "2px 0 8px rgba(0,0,0,0.15), inset -2px 0 4px rgba(0,0,0,0.2)",
        "hip": "0 4px 24px -4px rgba(0,0,0,0.12)",
        "hip-lg": "0 8px 40px -8px rgba(0,0,0,0.15)",
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
        "book-pop": {
          "0%": { transform: "translateZ(0) rotateY(0)" },
          "50%": { transform: "translateZ(30px) rotateY(-5deg)" },
          "100%": { transform: "translateZ(60px) rotateY(-10deg)" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "slide-up": {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "book-pop": "book-pop 0.4s ease-out forwards",
        "fade-up": "fade-up 0.5s ease-out",
        "scale-in": "scale-in 0.3s ease-out",
        "slide-up": "slide-up 0.4s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
