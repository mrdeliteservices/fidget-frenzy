// constants/appIdentity.ts
// Single source of truth for in-app identity strings.
// Keep this separate from app.json "name" (App Store/TestFlight display name).

export const APP_IDENTITY = {
  // In-app brand name (trademark name once approved)
  displayName: "Fidget Frenzy",

  // Expo project slug (matches app.json)
  slug: "fidget-frenzy",

  // Deep link scheme (matches app.json)
  scheme: "fidgetfrenzyelite",
} as const;
