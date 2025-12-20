// app/theme/frenzyTheme.ts
export const frenzyTheme = {
  colors: {
    // App "world" background (Hot Wheels Blue)
    appBgTop: "#123A7A",
    appBgBottom: "#0E2A5A",

    // Premium neutrals
    ink: "#0B0B0F",
    textDark: "#0B1220",
    mutedDark: "rgba(11,18,32,0.65)",

    // Stage / cards
    stageTop: "#171A27",
    stageBottom: "#0E101A",
    stageStroke: "rgba(255,255,255,0.10)",
    stageHighlight: "rgba(255,255,255,0.08)",

    // Header pill (frosted)
    headerPill: "rgba(255,255,255,0.55)",
    headerPillStroke: "rgba(255,255,255,0.28)",

    // Accent (Fidget Frenzy = gold/sherbet energy)
    accent: "#FDD017",
    accentDeep: "#D8AF00",
  },

  radii: {
    stage: 22,
    card: 20,
    pill: 18,
  },

  spacing: {
    screenPad: 14,
    stageMarginH: 12,
    stageMarginTop: 10,
    stageMarginBottom: 12,
  },

  shadow: {
    stage: {
      shadowColor: "#000",
      shadowOpacity: 0.32,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 12 },
      elevation: 10,
    },
    header: {
      shadowColor: "#000",
      shadowOpacity: 0.18,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
    card: {
      shadowColor: "#000",
      shadowOpacity: 0.18,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },
  },
};
