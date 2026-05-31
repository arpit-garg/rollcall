export const palette = {
  background: "#071014",
  backgroundRaised: "#0d171d",
  surface: "#101b22",
  surfaceSoft: "#13232c",
  border: "rgba(226, 232, 240, 0.09)",
  borderStrong: "rgba(125, 211, 252, 0.24)",
  text: "#f8fafc",
  textMuted: "#94a3b8",
  textSubtle: "#64748b",
  accent: "#38bdf8",
  accentStrong: "#06b6d4",
  success: "#34d399",
  warning: "#fbbf24",
  danger: "#fb7185",
  ink: "#061116"
};

const tonePalettes = {
  neutral: {
    background: "rgba(148, 163, 184, 0.08)",
    border: "rgba(148, 163, 184, 0.16)",
    accent: "#cbd5e1",
    label: "#94a3b8",
    text: "#f8fafc"
  },
  accent: {
    background: "rgba(56, 189, 248, 0.11)",
    border: "rgba(56, 189, 248, 0.24)",
    accent: "#38bdf8",
    label: "#7dd3fc",
    text: "#e0f2fe"
  },
  success: {
    background: "rgba(52, 211, 153, 0.1)",
    border: "rgba(52, 211, 153, 0.24)",
    accent: "#34d399",
    label: "#86efac",
    text: "#d1fae5"
  },
  warning: {
    background: "rgba(251, 191, 36, 0.11)",
    border: "rgba(251, 191, 36, 0.24)",
    accent: "#fbbf24",
    label: "#fde68a",
    text: "#fef3c7"
  },
  danger: {
    background: "rgba(251, 113, 133, 0.11)",
    border: "rgba(251, 113, 133, 0.24)",
    accent: "#fb7185",
    label: "#fecdd3",
    text: "#ffe4e6"
  }
};

const shadowLevels = {
  soft: {
    elevation: 3,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16
  },
  raised: {
    elevation: 8,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 24
  }
};

export function getTonePalette(tone = "neutral") {
  return tonePalettes[tone] || tonePalettes.neutral;
}

export function getPressedScaleStyle(pressed, { disabled = false, scale = 0.97 } = {}) {
  if (!pressed || disabled) {
    return null;
  }

  return {
    opacity: 0.92,
    transform: [{ scale }]
  };
}

export function getSurfaceShadowStyle(level = "soft", platformOS = "default") {
  const shadow = shadowLevels[level] || shadowLevels.soft;

  if (platformOS === "android") {
    return {
      elevation: shadow.elevation
    };
  }

  return {
    shadowColor: "#000000",
    shadowOffset: shadow.shadowOffset,
    shadowOpacity: shadow.shadowOpacity,
    shadowRadius: shadow.shadowRadius
  };
}
