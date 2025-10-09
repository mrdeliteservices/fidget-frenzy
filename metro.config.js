const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname, { isCSSEnabled: true });

// Tell Metro to look in the app directory for routes
config.resolver.sourceExts.push("mjs", "ts", "tsx", "jsx");

module.exports = config;
