// utils/random.ts
export const rand = (min: number, max: number): number =>
  Math.random() * (max - min) + min;

export const pick = <T,>(arr: T[]): T =>
  arr[Math.floor(Math.random() * arr.length)];
