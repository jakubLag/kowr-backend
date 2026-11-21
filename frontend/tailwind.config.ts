import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Lato",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          '"Helvetica Neue"',
          "Arial",
          "sans-serif",
        ],
        mono: [
          '"JetBrains Mono"',
          '"SFMono-Regular"',
          "Consolas",
          '"Liberation Mono"',
          "Menlo",
          "monospace",
        ],
      },
      colors: {
        gov: {
          navy: "#0B2240",
          blue: "#0052A5",
          "blue-hover": "#003D7A",
          "blue-light": "#F0F5FA",
          red: "#D4213D",
          text: "#1B1B1B",
          secondary: "#4A5568",
          muted: "#64707D",
          bg: "#FFFFFF",
          surface: "#F3F5F8",
          border: "#D2D6DC",
          "input-border": "#76808F",
          success: "#156534",
          "success-bg": "#F2F8F4",
          warning: "#B45309",
          "warning-bg": "#FDF8F0",
          danger: "#C81E1E",
          "danger-bg": "#FCF2F2",
        },
      },
      screens: {
        print: { raw: "print" },
      },
    },
  },
  plugins: [],
};

export default config;
