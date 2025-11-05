const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

config.resolver.alias = {
  "@components": path.resolve(__dirname, "components"),
  "@screens": path.resolve(__dirname, "app/screens"),
  "@assets": path.resolve(__dirname, "assets"),
};

module.exports = config;
