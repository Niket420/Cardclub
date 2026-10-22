import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "ui-sans-serif", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
      },
      colors: {
        ink: {
          950: "#06080d",
          900: "#0b0f17",
          850: "#10151f",
          800: "#151b27",
          700: "#1e2635",
          600: "#2a3446",
          500: "#3b4659",
          400: "#64708a",
          300: "#94a0b8",
          200: "#c5cddd",
          100: "#e6eaf2",
        },
        gold: {
          300: "#ffe29a",
          400: "#f8cf6a",
          500: "#ebb53f",
          600: "#c9922a",
        },
        felt: {
          900: "#062419",
          800: "#0a3324",
          700: "#0d4430",
          600: "#11573d",
        },
      },
      boxShadow: {
        card: "0 1px 1px rgba(0,0,0,.18), 0 4px 10px -2px rgba(0,0,0,.35)",
        lift: "0 10px 30px -8px rgba(0,0,0,.55)",
        glow: "0 0 0 2px rgba(248,207,106,.9), 0 0 24px rgba(248,207,106,.45)",
      },
      keyframes: {
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgba(248,207,106,.55)" },
          "100%": { boxShadow: "0 0 0 14px rgba(248,207,106,0)" },
        },
        float: {
          "0%": { transform: "translateY(0) scale(.6)", opacity: "0" },
          "15%": { transform: "translateY(-10px) scale(1.1)", opacity: "1" },
          "100%": { transform: "translateY(-46px) scale(1)", opacity: "0" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        spinslow: { to: { transform: "rotate(360deg)" } },
      },
      animation: {
        "pulse-ring": "pulse-ring 1.4s ease-out infinite",
        float: "float 2.6s ease-out forwards",
        shimmer: "shimmer 2.2s linear infinite",
        spinslow: "spinslow 24s linear infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
