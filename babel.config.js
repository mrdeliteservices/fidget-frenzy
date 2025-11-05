// babel.config.js — updated for Expo SDK 54 + alias support
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          alias: {
            '@assets': './assets',        // 🎵 sounds, images, etc.
            '@components': './components', // 🧩 shared UI components
            '@screens': './app/screens',   // 🎮 each mini-game or screen
            '@utils': './utils',       // 🧠 helpers (soundManager, etc.)
          },
        },
      ],
    ],
  };
};
