// babel.config.js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      // If you have other plugins, put them above, e.g.:
      // "expo-router/babel",
      // ["module-resolver", { root: ["./"] }],

      "react-native-reanimated/plugin", // 👈 MUST be last
    ],
  };
};
