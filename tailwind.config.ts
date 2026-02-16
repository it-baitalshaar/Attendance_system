import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        /* Theme-aware colors (use CSS variables so department theme can override) */
        "theme-primary": "var(--theme-primary, #0E4C82)",
        "theme-accent": "var(--theme-accent, #1A1A1A)",
        "theme-white": "var(--theme-white, #FFFFFF)",
        "theme-subtle": "var(--theme-subtle, #F8FAFC)",
        "theme-card-bg": "var(--theme-card-bg, var(--theme-white))",
      },
      fontFamily: {
        "heading-en": ["var(--font-heading-en)", "Georgia", "serif"],
        "heading-ar": ["var(--font-heading-ar)", "sans-serif"],
      },
      borderRadius: {
        "theme-card": "var(--theme-radius, 2px)",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [],
};
export default config;
