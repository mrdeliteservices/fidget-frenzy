// app/_layout.tsx
import React from "react";
import Welcome from "./welcome";

export default function RootLayout() {
  // 🚀 Temporary direct render (bypasses expo-router)
  return <Welcome />;
}
