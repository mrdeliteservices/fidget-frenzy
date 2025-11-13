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

// -------------------- Sounds: Balloon Popper --------------------
export const popSounds = [
  require("./sounds/balloon-pop-1.mp3"),
  require("./sounds/balloon-pop-2.mp3"),
  require("./sounds/balloon-pop-3.mp3"),
  require("./sounds/balloon-pop-4.mp3"),
  require("./sounds/balloon-pop-5.mp3"),
  require("./sounds/balloon-pop-6.mp3"),
];

export const slashSounds = [
  require("./sounds/sword-slashing-1.mp3"),
  require("./sounds/sword-slashing-2.mp3"),
];

// -------------------- Sounds: Spinner --------------------
export const spinnerSounds = [
  require("./sounds/fidget-spinner.mp3"),
  require("./sounds/mechanical-wheel-whir.mp3"),
  require("./sounds/whoosh-1.mp3"),
  require("./sounds/whoosh-2.mp3"),
];

// -------------------- Sounds: Stress Ball --------------------
export const bubbleSounds = [
  require("./sounds/bubble.mp3"),
];

export const squishSounds = [
  require("./sounds/squish.mp3"),
];

export const popSoundsStress = [
  require("./sounds/pop.mp3"),
];
