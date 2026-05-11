import type { Config } from "tailwindcss";

/**
 * Tailwind v4 reads tokens from `@theme` in src/app/globals.css.
 * This file remains only to declare content paths (v4 auto-detects in
 * most cases, but keeping these explicit avoids surprises in CI).
 */
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
};

export default config;
