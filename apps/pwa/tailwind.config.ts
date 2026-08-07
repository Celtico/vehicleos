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
    // Sin esto Tailwind no genera las clases que solo aparecen dentro del
    // paquete de componentes: los paneles salían sin padding y las
    // insignias sin ancho mínimo, y costó ver por qué.
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Leen las variables de globals.css, así el tema entero cambia de
        // día a noche sin tocar ni una clase.
        cockpit: "rgb(var(--c-bg) / <alpha-value>)",
        panel: "rgb(var(--c-panel) / <alpha-value>)",
        accent: "rgb(var(--c-accent) / <alpha-value>)",
        silver: "rgb(var(--c-silver) / <alpha-value>)",
        muted: "rgb(var(--c-muted) / <alpha-value>)",
        warn: "rgb(var(--c-warning) / <alpha-value>)",
        danger: "rgb(var(--c-danger) / <alpha-value>)",
        okgreen: "rgb(var(--c-ok) / <alpha-value>)",
        linea: "rgb(var(--c-border) / <alpha-value>)",
      },
      fontFamily: {
        thin: ['"Helvetica Neue"', "-apple-system", '"Segoe UI"', "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
