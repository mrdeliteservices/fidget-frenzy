import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
  View,
  Pressable,
  StyleSheet,
  Dimensions,
  Text,
  Platform,
} from "react-native";
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Rect,
  Path,
  G,
  Ellipse,
  Circle,
  ClipPath,
} from "react-native-svg";
import { Audio } from "expo-av";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: W, height: H } = Dimensions.get("window");

// Palette (kept close to your concept)
const COLORS = {
  room: "#0D2442",
  dome: "#0C0C0C",
  domeInner: "#101010",
  bulbOutline: "rgba(255,255,255,0.35)",
  filament: "#FFB84D",
  coneTop: "rgba(255,190,90,0.70)",      // bright near the dome
  coneMid: "rgba(255,190,90,0.22)",      // fades quickly
  coneBottom: "rgba(255,190,90,0.06)",   // very dim near floor
  poolLeft: "rgba(255,190,90,0.35)",
  poolMid: "rgba(255,190,90,0.2)",
  poolRight: "rgba(255,190,90,0.35)",
  switchBody: "#2A3951",
  switchFace: "#FFFFFF",
  switchBezel: "#C2A963",
  switchShadow: "rgba(0,0,0,0.35)",
};

const HEADER_H = 56;

export default function SliderSwitchScreen() {
  const insets = useSafeAreaInsets();
  const [isOn, setIsOn] = useState(false);
  const [sound, setSound] = useState<Audio.Sound | null>(null);

  // Load click sound once
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const s = new Audio.Sound();
        await s.loadAsync(require("../../assets/sounds/click.mp3"));
        if (mounted) setSound(s);
      } catch {
        // no-op if asset missing; UI still works
      }
    })();
    return () => {
      setSound((prev) => {
        prev?.unloadAsync();
        return null;
      });
    };
  }, []);

  const playClick = useCallback(async () => {
    try {
      if (sound) {
        await sound.replayAsync();
      }
    } catch {}
  }, [sound]);

  const toggle = useCallback(async () => {
    await playClick();
    setIsOn((v) => !v);
  }, [playClick]);

  // Layout metrics relative to screen size
  const m = useMemo(() => {
    const contentTop = insets.top + HEADER_H + 8;

    // Dome + bulb metrics
    const domeW = Math.min(W * 0.56, 340);
    const domeH = domeW * 0.5;
    const domeCx = W / 2;
    const domeTop = contentTop + 16;
    const domeBottomY = domeTop + domeH; // **start of cone**

    // Bulb sizing (only lower part showing)
    const bulbH = domeH * 0.76;
    const bulbW = bulbH * 0.62;
    const bulbCx = domeCx;
    const bulbTop = domeBottomY - bulbH * 0.38; // tucks under dome
    const bulbBottom = bulbTop + bulbH;

    // Cone
    const coneBottomY = H * 0.86; // reaches beyond switch (per your instruction)
    const coneTopY = domeBottomY; // **exactly bottom of the dome**

    // Floor pool
    const poolCY = coneBottomY - 6;
    const poolRX = Math.min(W * 0.32, domeW * 0.95);
    const poolRY = Math.max(20, poolRX * 0.28);

    // Switch
    const switchW = 112;
    const switchH = 232;
    const switchX = W / 2 - switchW / 2;
    const switchY = coneBottomY - switchH / 2 - 6;

    // Face/knob travel (clear, noticeable)
    const faceSize = 92;
    const faceX = W / 2 - faceSize / 2;
    const faceOffY = switchY + switchH - faceSize - 22;
    const faceOnY = switchY + 20; // slides high, obvious

    return {
      contentTop,
      domeW,
      domeH,
      domeCx,
      domeTop,
      domeBottomY,
      bulbH,
      bulbW,
      bulbCx,
      bulbTop,
      bulbBottom,
      coneTopY,
      coneBottomY,
      poolCY,
      poolRX,
      poolRY,
      switchW,
      switchH,
      switchX,
      switchY,
      faceSize,
      faceX,
      faceOffY,
      faceOnY,
    };
  }, [insets.top]);

  // Simple helpers
  const knobY = isOn ? m.faceOnY : m.faceOffY;

  return (
    <View style={[styles.screen, { backgroundColor: COLORS.room }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Pressable hitSlop={12} onPress={() => { /* hook up your navigation */ }}>
          <Svg width={28} height={28} viewBox="0 0 24 24">
            <Path
              d="M14.5 5.5L8 12l6.5 6.5"
              stroke="#C6D4FF"
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Pressable>
        <View style={styles.counterWrap}>
          <Text style={styles.counterText}>{isOn ? "1" : "0"}</Text>
        </View>
        <Pressable hitSlop={12} onPress={() => { /* open settings */ }}>
          <Svg width={28} height={28} viewBox="0 0 24 24">
            <Path
              d="M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zm8 3l-1.7-.3a6.9 6.9 0 00-.7-1.7l1-1.4-1.4-1.4-1.4 1a7 7 0 00-1.7-.7L13.5 4h-3L9.2 5.7a7 7 0 00-1.7.7l-1.4-1-1.4 1.4 1 1.4a6.9 6.9 0 00-.7 1.7L3 11.5v3l1.7.3c.1.6.4 1.2.7 1.7l-1 1.4 1.4 1.4 1.4-1c.5.3 1.1.6 1.7.7l.3 1.7h3l.3-1.7c.6-.1 1.2-.4 1.7-.7l1.4 1 1.4-1.4-1-1.4c.3-.5.6-1.1.7-1.7l1.7-.3v-3z"
              fill="#C6D4FF"
            />
          </Svg>
        </Pressable>
      </View>

      {/* Illustration */}
      <Svg width={W} height={H}>

        {/* ===== Dome (half-domed, industrial) ===== */}
        <G x={m.domeCx - m.domeW / 2} y={m.domeTop}>
          {/* outer rim shadow */}
          <Path
            d={`M0 ${m.domeH} Q ${m.domeW / 2} 0 ${m.domeW} ${m.domeH}`}
            fill={COLORS.dome}
          />
          {/* inner lip */}
          <Path
            d={`M ${m.domeW * 0.03} ${m.domeH} Q ${m.domeW / 2} ${m.domeH * 0.14} ${
              m.domeW * 0.97
            } ${m.domeH}`}
            stroke={COLORS.domeInner}
            strokeWidth={Math.max(2, m.domeW * 0.01)}
            fill="none"
            opacity={0.7}
          />
          {/* tiny cap */}
          <Circle
            cx={m.domeW / 2}
            cy={-6}
            r={2}
            fill="#DDE6FF"
            opacity={0.9}
          />
        </G>

        {/* ===== Light Cone: starts EXACTLY at dome bottom, fades down ===== */}
        <Defs>
          {/* vertical fade (brighter at top, dims to bottom) */}
          <LinearGradient id="coneFade" x1="0" y1={m.coneTopY} x2="0" y2={m.coneBottomY}>
            <Stop offset="0%" stopColor={COLORS.coneTop} />
            <Stop offset="55%" stopColor={COLORS.coneMid} />
            <Stop offset="100%" stopColor={COLORS.coneBottom} />
          </LinearGradient>

          {/* very soft glow around bulb (radial) */}
          <RadialGradient id="bulbAura" cx={m.bulbCx} cy={m.bulbTop + m.bulbH * 0.42} rx={m.bulbW*1.6} ry={m.bulbH*1.6}>
            <Stop offset="0%" stopColor="rgba(255,198,90,0.45)" />
            <Stop offset="65%" stopColor="rgba(255,198,90,0.10)" />
            <Stop offset="100%" stopColor="rgba(255,198,90,0.0)" />
          </RadialGradient>

          {/* mask to make the cone edges follow the dome angle */}
          <ClipPath id="coneClip">
            {/*
              Two slanted edges pivoting from domeBottomY to the bottom
              so the cone shares the same angle on both sides.
            */}
            <Path
              d={`M 0 ${m.coneBottomY}
                 L ${m.domeCx - m.domeW * 0.45} ${m.coneTopY}
                 L ${m.domeCx + m.domeW * 0.45} ${m.coneTopY}
                 L ${W} ${m.coneBottomY} Z`}
              fill="#000"
            />
          </ClipPath>

          {/* floor pool gradient */}
          <LinearGradient id="poolGrad" x1={m.domeCx - m.poolRX} y1={m.poolCY} x2={m.domeCx + m.poolRX} y2={m.poolCY}>
            <Stop offset="0%" stopColor={COLORS.poolLeft} />
            <Stop offset="50%" stopColor={COLORS.poolMid} />
            <Stop offset="100%" stopColor={COLORS.poolRight} />
          </LinearGradient>
        </Defs>

        {/* Apply cone only when ON */}
        {isOn && (
          <>
            {/* Bulb aura */}
            <Ellipse
              cx={m.bulbCx}
              cy={m.bulbTop + m.bulbH * 0.42}
              rx={m.bulbW * 1.6}
              ry={m.bulbH * 1.3}
              fill="url(#bulbAura)"
            />
            {/* main cone fill with gradient + clipped to angled shape */}
            <Rect
              x={0}
              y={m.coneTopY}
              width={W}
              height={Math.max(1, m.coneBottomY - m.coneTopY)}
              fill="url(#coneFade)"
              clipPath="url(#coneClip)"
            />
            {/* floor pool */}
            <Ellipse
              cx={m.domeCx}
              cy={m.poolCY}
              rx={m.poolRX}
              ry={m.poolRY}
              fill="url(#poolGrad)"
            />
          </>
        )}

        {/* ===== Bulb (Edison, clear glass with filament) ===== */}
        {/* glass outline */}
        <Path
          d={makeBulbPath(m.bulbCx, m.bulbTop, m.bulbW, m.bulbH)}
          fill="none"
          stroke={COLORS.bulbOutline}
          strokeWidth={2}
          opacity={isOn ? 0.9 : 0.35}
        />
        {/* stem */}
        <Path
          d={makeStemPath(m.bulbCx, m.bulbTop, m.bulbH)}
          fill="none"
          stroke={COLORS.bulbOutline}
          strokeWidth={2}
          opacity={isOn ? 0.9 : 0.35}
        />
        {/* filament */}
        <Path
          d={makeFilamentPath(m.bulbCx, m.bulbTop, m.bulbW, m.bulbH)}
          fill="none"
          stroke={COLORS.filament}
          strokeWidth={3}
          strokeLinecap="round"
          opacity={isOn ? 0.95 : 0.15}
        />

      </Svg>

      {/* ===== Switch (press to toggle) ===== */}
      <View
        style={[
          styles.switch,
          {
            width: m.switchW,
            height: m.switchH,
            left: m.switchX,
            top: m.switchY,
            borderColor: COLORS.switchBezel,
            backgroundColor: COLORS.switchBody,
            shadowColor: "#000",
          },
        ]}
      >
        <Pressable
          onPress={toggle}
          style={[
            styles.knob,
            {
              width: m.faceSize,
              height: m.faceSize,
              left: m.faceX - m.switchX,
              top: knobY - m.switchY,
              backgroundColor: COLORS.switchFace,
              shadowColor: COLORS.switchShadow,
            },
          ]}
        />
      </View>
    </View>
  );
}

/** Edison bulb outline (clear glass, slight pear shape). */
function makeBulbPath(cx: number, topY: number, w: number, h: number) {
  const x0 = cx - w / 2;
  const x1 = cx + w / 2;
  const neckH = h * 0.28;
  const bellyY = topY + h * 0.58;
  const tipY = topY + h * 0.92;

  return [
    `M ${cx} ${topY + 6}`,
    `V ${topY + neckH}`,
    // left curve to belly
    `C ${cx - w * 0.52} ${topY + neckH + h * 0.08}, ${x0} ${bellyY - h * 0.1}, ${x0 + w * 0.14} ${bellyY}`,
    // down to tip and back up right side
    `S ${cx - w * 0.12} ${tipY}, ${cx} ${tipY}`,
    `S ${cx + w * 0.12} ${tipY}, ${x1 - w * 0.14} ${bellyY}`,
    `S ${x1} ${bellyY - h * 0.1}, ${cx + w * 0.52} ${topY + neckH + h * 0.08}`,
    `S ${cx} ${topY + neckH}, ${cx} ${topY + neckH}`,
  ].join(" ");
}

/** Inner glass stem lines */
function makeStemPath(cx: number, topY: number, h: number) {
  const neckH = h * 0.28;
  const stemTop = topY + 6;
  const stemBottom = topY + neckH + h * 0.02;
  const gap = 6;
  return [
    `M ${cx - gap} ${stemTop} V ${stemBottom}`,
    `M ${cx + gap} ${stemTop} V ${stemBottom}`,
  ].join(" ");
}

/** Filament loop (warm) */
function makeFilamentPath(cx: number, topY: number, w: number, h: number) {
  const baseY = topY + h * 0.36;
  const loopH = h * 0.12;
  const loopW = w * 0.28;
  return [
    `M ${cx - loopW} ${baseY}`,
    `Q ${cx - loopW * 0.2} ${baseY - loopH}, ${cx} ${baseY - loopH}`,
    `Q ${cx + loopW * 0.2} ${baseY - loopH}, ${cx + loopW} ${baseY}`,
  ].join(" ");
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    height: HEADER_H,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  counterWrap: {
    backgroundColor: "rgba(8,20,40,0.6)",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  counterText: {
    color: "#EAF1FF",
    fontSize: 18,
    fontWeight: "600",
  },
  switch: {
    position: "absolute",
    borderRadius: 20,
    borderWidth: 2,
    justifyContent: "flex-start",
    shadowOpacity: Platform.OS === "ios" ? 0.45 : 0.6,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  knob: {
    position: "absolute",
    borderRadius: 16,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
});
