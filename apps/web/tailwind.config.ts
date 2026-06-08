import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        aurora: {
          green: { DEFAULT: "#00C47A", dark: "#009960", light: "#33D494" },
          teal:  { DEFAULT: "#0ABAB5", dark: "#088F8B", light: "#3DCFCB" },
          purple:  { DEFAULT: "#7B2FBE", dark: "#5B21B6", light: "#9B5FD4" },
          violet:  { DEFAULT: "#A855F7", dark: "#8B5CF6", light: "#C084FC" },
          blue:    { DEFAULT: "#3B82F6", dark: "#2563EB", light: "#60A5FA" },
        },
        surface: {
          base:   "#0D1C16",
          card:   "#132B20",
          muted:  "#102319",
          border: "#1E3D2C",
        },
        ink: {
          primary:   "#FFFFFF",
          secondary: "#EBF5F0",
          muted:     "#BBDAD2",
          subtle:    "#7AADA2",
        },
      },
      fontFamily: {
        display: ["Inter", "SF Pro Display", "system-ui", "sans-serif"],
        body:    ["Inter", "SF Pro Text",    "system-ui", "sans-serif"],
        mono:    ["JetBrains Mono", "SF Mono", "Fira Code", "monospace"],
      },
      fontSize: {
        hero: "clamp(3rem, 8vw, 6rem)",
        h1:   "clamp(2rem, 5vw, 3.5rem)",
        h2:   "clamp(1.5rem, 3vw, 2.5rem)",
        h3:   "clamp(1.25rem, 2vw, 1.75rem)",
      },
      animation: {
        "aurora-slow":   "aurora 8s cubic-bezier(0.25,0.1,0.25,1) infinite",
        "aurora-medium": "aurora 6s cubic-bezier(0.25,0.1,0.25,1) infinite",
        "glow-pulse":    "glow-pulse 3s ease-in-out infinite",
        "float":         "float 6s ease-in-out infinite",
        "fade-in-up":    "fade-in-up 0.6s ease-out forwards",
      },
      keyframes: {
        aurora: {
          "0%, 100%": { transform: "translateY(0) scale(1)"        },
          "33%":      { transform: "translateY(-10px) scale(1.05)" },
          "66%":      { transform: "translateY(5px) scale(0.98)"   },
        },
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(0, 196, 122, 0.2)" },
          "50%":      { boxShadow: "0 0 40px rgba(0, 196, 122, 0.4)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%":      { transform: "translateY(-10px)" },
        },
        "fade-in-up": {
          "0%":   { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      backgroundImage: {
        "aurora-gradient": "linear-gradient(110deg, #00C47A 0%, #0ABAB5 45%, #A855F7 100%)",
        "hero-glow":       "radial-gradient(ellipse at 50% 0%, rgba(0,196,122,0.12) 0%, rgba(10,186,181,0.07) 35%, rgba(168,85,247,0.04) 60%, transparent 75%)",
      },
    },
  },
  plugins: [],
};

export default config;
