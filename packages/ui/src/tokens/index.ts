// ─── Aurora Borealis Theme System ────────────────────────────────

export const colors = {
  // Primary Aurora Colors
  aurora: {
    green: { DEFAULT: "#00D68F", dark: "#00B376", light: "#34E8A5" },
    teal: { DEFAULT: "#0ABAB5", dark: "#088F8F", light: "#3DD1CD" },
    purple: { DEFAULT: "#7B2FBE", dark: "#5B21B6", light: "#9B5FD4" },
    violet: { DEFAULT: "#A855F7", dark: "#8B5CF6", light: "#C084FC" },
    blue: { DEFAULT: "#3B82F6", dark: "#2563EB", light: "#60A5FA" },
  },

  // Backgrounds
  bg: {
    deepSpace: "#0A0A1A",
    midnight: "#0F172A",
    nebula: "#1E1B4B",
    card: "rgba(15, 23, 42, 0.6)",
    cardHover: "rgba(15, 23, 42, 0.8)",
    glass: "rgba(255, 255, 255, 0.05)",
    glassHover: "rgba(255, 255, 255, 0.1)",
  },

  // Text
  text: {
    primary: "#F8FAFC",
    secondary: "#94A3B8",
    dim: "#64748B",
    accent: "#E2E8F0",
  },

  // Semantic
  semantic: {
    success: "#00D68F",
    calm: "#A855F7",
    energy: "#F59E0B",
    alert: "#EF4444",
    info: "#3B82F6",
  },

  // Persona accents
  persona: {
    altheo: "#00D68F",
    kairo: "#A855F7",
  },
} as const;

export const gradients = {
  aurora:
    "linear-gradient(135deg, #00D68F 0%, #0ABAB5 25%, #3B82F6 50%, #7B2FBE 75%, #A855F7 100%)",
  auroraSubtle:
    "linear-gradient(135deg, rgba(0,214,143,0.2) 0%, rgba(10,186,181,0.2) 50%, rgba(168,85,247,0.2) 100%)",
  altheo: "linear-gradient(135deg, #00D68F 0%, #0ABAB5 100%)",
  kairo: "linear-gradient(135deg, #7B2FBE 0%, #A855F7 100%)",
  darkFade:
    "linear-gradient(180deg, #0A0A1A 0%, #0F172A 50%, #1E1B4B 100%)",
  heroGlow:
    "radial-gradient(ellipse at 50% 0%, rgba(0,214,143,0.15) 0%, rgba(10,186,181,0.1) 30%, rgba(168,85,247,0.05) 60%, transparent 80%)",
} as const;

export const shadows = {
  glow: {
    green: "0 0 20px rgba(0, 214, 143, 0.3)",
    purple: "0 0 20px rgba(168, 85, 247, 0.3)",
    teal: "0 0 20px rgba(10, 186, 181, 0.3)",
    subtle: "0 0 40px rgba(0, 214, 143, 0.1)",
  },
  card: "0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -2px rgba(0, 0, 0, 0.2)",
  elevated:
    "0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -4px rgba(0, 0, 0, 0.3)",
} as const;

export const typography = {
  fontFamily: {
    display: '"Inter", "SF Pro Display", system-ui, sans-serif',
    body: '"Inter", "SF Pro Text", system-ui, sans-serif',
    mono: '"JetBrains Mono", "SF Mono", "Fira Code", monospace',
  },
  fontSize: {
    hero: "clamp(3rem, 8vw, 6rem)",
    h1: "clamp(2rem, 5vw, 3.5rem)",
    h2: "clamp(1.5rem, 3vw, 2.5rem)",
    h3: "clamp(1.25rem, 2vw, 1.75rem)",
    body: "1rem",
    small: "0.875rem",
    caption: "0.75rem",
  },
  fontWeight: {
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },
} as const;

export const spacing = {
  section: "clamp(4rem, 10vw, 8rem)",
  container: "max(1rem, calc((100vw - 1280px) / 2))",
  cardPadding: "1.5rem",
} as const;

export const animation = {
  duration: {
    fast: "150ms",
    normal: "300ms",
    slow: "500ms",
    aurora: "8s",
  },
  easing: {
    smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
    bounce: "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
    aurora: "cubic-bezier(0.25, 0.1, 0.25, 1)",
  },
} as const;

export const borderRadius = {
  sm: "0.375rem",
  md: "0.5rem",
  lg: "0.75rem",
  xl: "1rem",
  full: "9999px",
} as const;
