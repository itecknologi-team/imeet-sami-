import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "brand-blue": "var(--brand-blue)",
        "brand-blue-dark": "var(--brand-blue-dark)",
        "brand-cyan": "var(--brand-cyan)",
        "brand-teal": "var(--brand-teal)",
        "brand-green": "var(--brand-green)",
        "brand-olive": "var(--brand-olive)",
        "brand-orange": "var(--brand-orange)",
        danger: "var(--danger)",
        surface: "var(--surface)",
        border: "var(--border)",
        text: "var(--text)",
        muted: "var(--muted)",
      },
      fontFamily: {
        sans: ["Poppins", "Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 4px 24px rgba(16,42,67,0.06)",
      },
    },
  },
  plugins: [],
} satisfies Config;
