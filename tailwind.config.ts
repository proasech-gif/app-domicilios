import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1F2430",
        muted: "#5B6270",
        surface: "#F7F8FA",
        card: "#FFFFFF",
        border: "#E2E5EA",
        brand: {
          50: "#EEF2F9",
          100: "#D6E0F0",
          400: "#4A6FA5",
          600: "#2A4B7C",
          700: "#1E3860",
        },
        accent: {
          teal: "#0F6E56",
          amber: "#BA7517",
          coral: "#D85A30",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "10px",
      },
    },
  },
  plugins: [],
};

export default config;
