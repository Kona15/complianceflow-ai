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
        slate: {
          850: "#1e293b",
          900: "#0f172a",
          950: "#020617",
        },
        emerald: {
          450: "#10b981",
        },
        agent: {
          auditor: "#3b82f6",
          negotiator: "#f59e0b",
          closer: "#10b981",
          orchestrator: "#8b5cf6",
        }
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "slide-up": "slideUp 0.5s ease-out",
        "fade-in": "fadeIn 0.3s ease-out",
        "typing": "typing 1.5s steps(20) infinite",
      },
      keyframes: {
        slideUp: {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        typing: {
          "0%": { width: "0%" },
          "100%": { width: "100%" },
        },
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
  ],
};

export default config;