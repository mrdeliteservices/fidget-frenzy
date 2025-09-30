// assets/index.ts
// Centralized asset exports for Fidget Frenzy

// -------------------- Types --------------------
export type BalloonColor =
  | "blue"
  | "green"
  | "orange"
  | "pink"
  | "purple"
  | "red"
  | "yellow";

// -------------------- Balloons --------------------
export const balloonImages: Record<BalloonColor, any> = {
  blue: require("./balloons/balloon-blue.png"),
  green: require("./balloons/balloon-green.png"),
  orange: require("./balloons/balloon-orange.png"),
  pink: require("./balloons/balloon-pink.png"),
  purple: require("./balloons/balloon-purple.png"),
  red: require("./balloons/balloon-red.png"),
  yellow: require("./balloons/balloon-yellow.png"),
};

// -------------------- Clouds --------------------
export const cloudImages: any[] = [
  require("./clouds/clouds-1.png"),
  require("./clouds/clouds-2.png"),
  require("./clouds/clouds-3.png"),
];

// -------------------- Sounds: Bubble Popper --------------------
export const popSounds = [
  require("./sounds/bubble-pop-02-293341.mp3"),
  require("./sounds/bubble-pop-04-323580.mp3"),
  require("./sounds/bubble-pop-05-323639.mp3"),
  require("./sounds/bubble-pop-06-351337.mp3"),
  require("./sounds/bubble-pop-07-351339.mp3"),
];

export const slashSounds = [
  require("./sounds/sword-slashing-game-sound-effect-1-379228.mp3"),
  require("./sounds/sword-slashing-game-sound-effect-2-379229.mp3"),
];

// -------------------- Sounds: Spinner --------------------
export const spinnerSounds = [
  require("./sounds/fidget-spinner1-30616.mp3"),
  require("./sounds/mechanical-wheel-whir-whirr-76870.mp3"),
  require("./sounds/whoosh-370024.mp3"),
  require("./sounds/whoosh-sound-effect-240257.mp3"),
];
