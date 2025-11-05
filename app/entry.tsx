// app/entry.tsx
import "react-native-gesture-handler";
import { ExpoRoot } from "expo-router";
import React from "react";

// 👇 add this line so TypeScript knows about require.context
declare const require: {
  context: (path: string, deep?: boolean, filter?: RegExp) => any;
};

export default function App() {
  const ctx = require.context("./", true, /.*/);
  return <ExpoRoot context={ctx} />;
}
