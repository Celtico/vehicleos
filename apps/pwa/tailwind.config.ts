import type { Config } from "tailwindcss";

/**
 * Tema Tailwind del cockpit: negro profundo, acento cian-turquesa MBUX,
 * plateados y tipografía fina.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./store/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cockpit: "#05080a",
        panel: "#0c1418",
        accent: "#00d2be",
        silver: "#c8d2d6",
        muted: "#7f9299",
        warn: "#ffb020",
        danger: "#ff4d5a",
        okgreen: "#38e07d",
      },
      fontFamily: {
        thin: ['"Helvetica Neue"', "-apple-system", '"Segoe UI"', "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
