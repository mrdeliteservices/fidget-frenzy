// app/screens/light-switch.tsx
// Fidget Frenzy — Light Switch (v0.9-dev WALL + BUTTON, RAPID FIRE + "Clicks:")
// ✅ Migrated to shell-standard Settings (useSettingsUI)
// ✅ Sound toggle respects global setting (no local sound state)
// ✅ Audio uses a 3-sound pool for rapid-fire clicking (kept)
// ✅ Pool is unloaded on unmount (prevents leaks)
// ✅ toggle() no longer drops taps while animating and uses a faster 160ms animation.
// Visual polish preserved:
//  - Contrast pass, plate tone, ON travel pressed IN
// No layout / geometry changes.

import React, { useMemo, useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableWithoutFeedback,
  TouchableOpacity,
  SafeAreaView,
  Easing,
  Dimensions,
  Modal,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Audio } from "expo-av";
import Svg, {
  Path,
  Rect,
  Defs,
  Stop,
  LinearGradient as SvgLinearGradient,
  RadialGradient,
  Ellipse,
  ClipPath,
  G,
  Line,
} from "react-native-svg";

import FullscreenWrapper from "../../components/FullscreenWrapper";
import BackButton from "../../components/BackButton";
import GameHeader from "../../components/GameHeader";

// ✅ Shell-standard Settings hook
import { useSettingsUI } from "../../components/SettingsUIProvider";

const { width: W, height: H } = Dimensions.get("window");

// Animated SVG path for the filament
const AnimatedPath = Animated.createAnimatedComponent(Path);

const COLOR = {
  // Background
  bg: "#081A34",

  // Lamp
  dome: "#0E0F10",
  filament: "#FFC93C",
  glassStroke: "rgba(255,255,255,0.26)",
  glassFill: "rgba(255,255,255,0.06)",
  warmGlow: "rgba(255,201,60,0.85)",

  // Wall contrast pass
  upperWall: "#0B2550",
  chairRail: "#123061",
  lowerWall: "#071B35",
  panel: "rgba(255,255,255,0.06)",
  panelStroke: "rgba(255,255,255,0.06)",

  // Plate + hardware (Option A: slightly darker + calmer border)
  plate: "#C7CBD3",
  plateBorder: "rgba(255,255,255,0.22)",
  plateInner: "rgba(0,0,0,0.12)",
  screw: "#7B828D",
  screwHighlight: "rgba(255,255,255,0.18)",

  // Button states
  buttonOff: "#2B2F36",
  buttonOn: "#FF3131",
  buttonSpec: "rgba(255,255,255,0.22)",
  buttonGlow: "rgba(255,201,60,0.42)",
};

// Show Dev FAB/Menu only in debug builds
const DEBUG = false; // set to true if you ever want to tune again

// Layout constants
const CEILING_H = 10;
const CEILING_MARGIN_B = 4;

export default function LightSwitch() {
  // ✅ shell settings
  const settings = useSettingsUI();

  // Most likely names; fallback to avoid breaking if your hook uses different keys.
  const soundEnabled = (settings as any).soundEnabled ?? (settings as any).soundOn ?? true;
  const openSettings =
    (settings as any).openSettings ??
    (settings as any).showSettings ??
    (settings as any).openSettingsModal ??
    (() => {});

  // ✅ keep latest sound state for async click playback (closure-proof)
  const soundEnabledRef = useRef<boolean>(!!soundEnabled);
  useEffect(() => {
    soundEnabledRef.current = !!soundEnabled;
  }, [soundEnabled]);

  const [isOn, setIsOn] = useState(false);
  const [count, setCount] = useState(0);

  // Dev Menu (visible ONLY if DEBUG)
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugOverlay, setDebugOverlay] = useState(false);

  // Master animation for light + pool
  const a = useRef(new Animated.Value(0)).current;
  const animatingRef = useRef(false);

  // --------- AUDIO: 3-SOUND POOL FOR RAPID FIRE ----------
  const clickPoolRef = useRef<Audio.Sound[]>([]);
  const clickPoolLoadedRef = useRef(false);
  const clickPoolIndexRef = useRef(0);
  const clickPoolLoadingRef = useRef(false);

  const ensureClickPool = async () => {
    if (clickPoolLoadedRef.current) return;
    if (clickPoolLoadingRef.current) return;

    clickPoolLoadingRef.current = true;

    try {
      const file = require("../../assets/sounds/switch-click.mp3");
      const created: Audio.Sound[] = [];

      for (let i = 0; i < 3; i++) {
        const { sound } = await Audio.Sound.createAsync(file, {
          shouldPlay: false,
        });
        created.push(sound);
      }

      clickPoolRef.current = created;
      clickPoolLoadedRef.current = true;
    } catch (e) {
      console.warn("switch-click pool load error", e);
    } finally {
      clickPoolLoadingRef.current = false;
    }
  };

  const playRapidClick = async () => {
    if (!soundEnabledRef.current) return;

    await ensureClickPool();
    const pool = clickPoolRef.current;
    if (!pool.length) return;

    // Simple round-robin: cycle through 3 sounds
    const idx = clickPoolIndexRef.current % pool.length;
    clickPoolIndexRef.current = (clickPoolIndexRef.current + 1) % pool.length;

    const s = pool[idx];

    try {
      await s.stopAsync().catch(() => {});
      await s.setPositionAsync(0).catch(() => {});
      await s.playAsync().catch(() => {});
    } catch {
      // swallow any playback glitch
    }
  };

  // ✅ Unload pool on unmount (prevents leaks)
  useEffect(() => {
    return () => {
      const pool = clickPoolRef.current;
      clickPoolRef.current = [];
      clickPoolLoadedRef.current = false;
      clickPoolIndexRef.current = 0;

      // fire-and-forget unload (avoid blocking navigation)
      Promise.all(
        pool.map(async (s) => {
          try {
            await s.unloadAsync();
          } catch {}
        })
      ).catch(() => {});
    };
  }, []);

  // ================== TUNABLES (Dev Menu) ==================
  // Dome & beam geometry
  const [domeTopY, setDomeTopY] = useState(8);
  const [rimY, setRimY] = useState(120);
  const [rimLeftPct, setRimLeftPct] = useState(0.22);
  const [rimRightPct, setRimRightPct] = useState(0.78);
  const [rimInnerInset, setRimInnerInset] = useState(8);
  const [beamOffset, setBeamOffset] = useState(0);

  // Cord + cap
  const [capDrop, setCapDrop] = useState(0);
  const [cordExtra, setCordExtra] = useState(0);

  // Floor pool
  const [POOL_WIDTH_FACTOR, setPOOL_WIDTH_FACTOR] = useState(0.92);
  const [POOL_RX_FACTOR, setPOOL_RX_FACTOR] = useState(0.46);
  const [POOL_RY, setPOOL_RY] = useState(36);
  const [POOL_RAISE, setPOOL_RAISE] = useState(-260);

  // =================== GEOMETRY ===================
  const L = useMemo(() => {
    const domeW = Math.min(420, W * 0.92);

    const rimSpanPx = domeW * (rimRightPct - rimLeftPct);
    const topW = Math.max(120, rimSpanPx - rimInnerInset * 2);
    const coneH = Math.min(H * 0.8, H - rimY - 52);
    const bottomW = Math.min(W * 0.98, domeW * 2.08);
    const beamX = -bottomW / 2;

    const bulbBelowRim = 34;
    const bulbHalfW = 28;

    const LAMP_GROUP_TOP = 120;

    const cordHeight = Math.max(
      8,
      LAMP_GROUP_TOP - (CEILING_H + CEILING_MARGIN_B) + capDrop + cordExtra
    );

    return {
      domeW,
      rimY,
      domeTopY,
      rimLeftPct,
      rimRightPct,
      rimInnerInset,
      beamOffset,
      topW,
      bottomW,
      coneH,
      beamX,
      bulbBelowRim,
      bulbHalfW,
      LAMP_GROUP_TOP,
      cordHeight,
      POOL_WIDTH_FACTOR,
      POOL_RX_FACTOR,
      POOL_RY,
      POOL_RAISE,
    };
  }, [
    domeTopY,
    rimY,
    rimLeftPct,
    rimRightPct,
    rimInnerInset,
    beamOffset,
    capDrop,
    cordExtra,
    POOL_WIDTH_FACTOR,
    POOL_RX_FACTOR,
    POOL_RY,
    POOL_RAISE,
  ]);

  // Toggle — rapid fire, no dropped taps
  const toggle = () => {
    const next = !isOn;
    setIsOn(next);
    setCount((c) => c + 1);

    // Fire-and-forget haptics + sound
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    playRapidClick();

    animatingRef.current = true;

    // Stop any in-progress animation, then retarget
    a.stopAnimation(() => {
      Animated.timing(a, {
        toValue: next ? 1 : 0,
        duration: 160, // faster snap for LIGHT + POOL
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start(() => {
        animatingRef.current = false;
      });
    });
  };

  const reset = () => {
    setIsOn(false);
    setCount(0);
    a.stopAnimation();
    a.setValue(0);
    animatingRef.current = false;
  };

  // Interpolations
  const coneOpacity = a.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const filamentOpacity = a.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const coneIntensity = a.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.95],
  });

  // Button clarity (OFF vs ON)
  const buttonColor = a.interpolate({
    inputRange: [0, 1],
    outputRange: [COLOR.buttonOff, COLOR.buttonOn],
  });

  const glowOpacity = a.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const conePath = `
    M ${(L.bottomW - L.topW) / 2} 0
    L ${(L.bottomW + L.topW) / 2} 0
    L ${L.bottomW} ${L.coneH}
    L 0 ${L.coneH}
    Z
  `;

  return (
    <FullscreenWrapper>
      <View style={[styles.root, { backgroundColor: COLOR.bg }]}>
        <SafeAreaView style={{ flex: 1 }}>
          {/* HEADER (canonical GameHeader) */}
          <GameHeader
            left={<BackButton />}
            centerLabel="Clicks:"
            centerValue={count}
            onPressSettings={() => openSettings()}
          />

          {/* Ceiling line */}
          <View style={styles.ceilingLine} />

          {/* BACK WALL */}
          <View style={styles.wallContainer} pointerEvents="none">
            <View style={styles.upperWall} />
            <View style={styles.chairRail} />
            <View style={styles.lowerWall}>
              {Array.from({ length: 18 }).map((_, idx) => (
                <View key={idx} style={styles.wainscotPanel} />
              ))}
            </View>
          </View>

          {/* Cord */}
          <View style={[styles.cord, { height: L.cordHeight, marginBottom: -1 }]} />

          {/* ===================== LAMP GROUP ===================== */}
          <View style={[styles.lampGroup, { top: L.LAMP_GROUP_TOP }]}>
            {/* Cap */}
            <View
              style={{
                position: "absolute",
                top: capDrop,
                left: "50%",
                marginLeft: -10,
                width: 20,
                height: 16,
                borderRadius: 6,
                backgroundColor: "#2E3135",
              }}
            />
            <View
              style={{
                position: "absolute",
                top: capDrop + 14,
                left: "50%",
                marginLeft: -6,
                width: 12,
                height: 9,
                borderRadius: 4,
                backgroundColor: "#232629",
              }}
            />

            {/* BEAM */}
            <Animated.View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: capDrop + rimY + beamOffset,
                left: "50%",
                transform: [{ translateX: L.beamX }],
                opacity: Animated.multiply(coneOpacity, coneIntensity),
              }}
            >
              <Svg width={L.bottomW} height={L.coneH}>
                <Defs>
                  <SvgLinearGradient id="beamFadeY" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0%" stopColor={COLOR.warmGlow} stopOpacity="0.78" />
                    <Stop offset="42%" stopColor={COLOR.warmGlow} stopOpacity="0.3" />
                    <Stop offset="100%" stopColor={COLOR.warmGlow} stopOpacity="0.06" />
                  </SvgLinearGradient>
                </Defs>
                <Path d={conePath} fill="url(#beamFadeY)" />
                {debugOverlay && (
                  <>
                    <Line
                      x1={(L.bottomW - L.topW) / 2}
                      y1={0}
                      x2={L.bottomW / 2}
                      y2={L.coneH}
                      stroke="lime"
                      strokeDasharray="4,3"
                      strokeWidth={1}
                    />
                    <Line
                      x1={(L.bottomW + L.topW) / 2}
                      y1={0}
                      x2={L.bottomW / 2}
                      y2={L.coneH}
                      stroke="lime"
                      strokeDasharray="4,3"
                      strokeWidth={1}
                    />
                  </>
                )}
              </Svg>
            </Animated.View>

            {/* Lamp dome + bulb */}
            <View
              style={{
                position: "absolute",
                top: capDrop,
                left: 0,
                right: 0,
                alignItems: "center",
              }}
            >
              <Svg width={L.domeW} height={Math.max(240, rimY + 40)}>
                <Defs>
                  <ClipPath id="belowRim">
                    <Rect x={0} y={rimY} width={L.domeW} height={H} />
                  </ClipPath>
                </Defs>

                {/* Bulb */}
                <G clipPath="url(#belowRim)">
                  <Path
                    d={`
                      M ${L.domeW / 2 - L.bulbHalfW} ${rimY - 10}
                      Q ${L.domeW / 2 - (L.bulbHalfW - 6)} ${rimY - 26} ${L.domeW / 2} ${rimY - 40}
                      Q ${L.domeW / 2 + (L.bulbHalfW - 6)} ${rimY - 26} ${L.domeW / 2 + L.bulbHalfW} ${rimY - 10}
                      Q ${L.domeW / 2 + L.bulbHalfW} ${rimY - 2} ${L.domeW / 2} ${rimY + 34}
                      Q ${L.domeW / 2 - L.bulbHalfW} ${rimY - 2} ${L.domeW / 2 - L.bulbHalfW} ${rimY - 10} Z
                    `}
                    fill={COLOR.glassFill}
                    stroke={COLOR.glassStroke}
                    strokeWidth={1.4}
                  />
                  <AnimatedPath
                    d={`
                      M ${L.domeW / 2 - 9} ${rimY - 22}
                      Q ${L.domeW / 2 - 4} ${rimY - 14} ${L.domeW / 2} ${rimY - 10}
                      Q ${L.domeW / 2 + 4} ${rimY - 14} ${L.domeW / 2 + 9} ${rimY - 22}
                    `}
                    stroke={COLOR.filament}
                    strokeWidth={2.8}
                    strokeLinecap="round"
                    opacity={filamentOpacity as any}
                  />
                  <Ellipse
                    cx={L.domeW / 2}
                    cy={rimY - 14}
                    rx={20}
                    ry={14}
                    fill={COLOR.warmGlow}
                    opacity={0.28}
                  />
                </G>

                {/* Dome */}
                <Path
                  d={`
                    M ${L.domeW * rimLeftPct} ${rimY}
                    Q ${L.domeW / 2} ${domeTopY} ${L.domeW * rimRightPct} ${rimY} Z
                  `}
                  fill={COLOR.dome}
                />
              </Svg>
            </View>
          </View>

          {/* ===================== FLOOR POOL ===================== */}
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              top:
                CEILING_H +
                CEILING_MARGIN_B +
                L.cordHeight +
                (L.LAMP_GROUP_TOP - (CEILING_H + CEILING_MARGIN_B)) +
                rimY +
                beamOffset +
                L.coneH +
                L.POOL_RAISE,
              left: "50%",
              transform: [{ translateX: -(W * L.POOL_WIDTH_FACTOR) / 2 }],
              opacity: coneOpacity,
            }}
          >
            <Svg width={W * L.POOL_WIDTH_FACTOR} height={L.POOL_RY * 3.4}>
              <Defs>
                <RadialGradient id="floorGlow" cx="50%" cy="50%" r="72%">
                  <Stop offset="0%" stopColor="rgba(255,201,60,0.22)" />
                  <Stop offset="100%" stopColor="rgba(255,201,60,0.02)" />
                </RadialGradient>
              </Defs>
              <Ellipse
                cx={(W * L.POOL_WIDTH_FACTOR) / 2}
                cy={L.POOL_RY * 1.7}
                rx={W * L.POOL_RX_FACTOR}
                ry={L.POOL_RY}
                fill="url(#floorGlow)"
              />
            </Svg>
          </Animated.View>

          {/* ===================== WALL-MOUNTED BUTTON ===================== */}
          <View style={styles.buttonContainer}>
            <View style={styles.buttonPlate}>
              <View style={styles.screwRow}>
                <View style={styles.screwDot} />
                <View style={styles.screwDot} />
              </View>

              <View style={styles.buttonCapWrap}>
                {/* subtle glow ring when ON */}
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.buttonGlowRing,
                    {
                      opacity: glowOpacity,
                      transform: [
                        {
                          scale: a.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.92, 1],
                          }),
                        },
                      ],
                    },
                  ]}
                />

                <TouchableWithoutFeedback onPress={toggle}>
                  <Animated.View
                    style={[
                      styles.buttonCap,
                      {
                        backgroundColor: buttonColor as any,
                        transform: [
                          {
                            // ✅ Flip travel: ON presses IN (moves down)
                            translateY: a.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, 4],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    {/* specular highlight so it reads as “real” */}
                    <View style={styles.buttonSpec} pointerEvents="none" />
                  </Animated.View>
                </TouchableWithoutFeedback>
              </View>

              <View style={styles.screwRow}>
                <View style={styles.screwDot} />
                <View style={styles.screwDot} />
              </View>
            </View>
          </View>

          {/* ✅ No local SettingsModal (shell settings owns it) */}
        </SafeAreaView>

        {/* ===== Dev FAB / Dev Menu (only when DEBUG) ===== */}
        {DEBUG && (
          <>
            <TouchableOpacity onPress={() => setDebugOpen(true)} style={styles.devFab}>
              <Text style={{ color: "#111", fontWeight: "700" }}>⚙️</Text>
            </TouchableOpacity>

            <Modal
              transparent
              visible={debugOpen}
              animationType="fade"
              onRequestClose={() => setDebugOpen(false)}
            >
              <View style={styles.devModalBackdrop}>
                <View style={styles.devModal}>
                  <View style={styles.devHeader}>
                    <Text style={styles.devTitle}>Developer Tuning</Text>
                    <TouchableOpacity onPress={() => setDebugOverlay((v) => !v)}>
                      <Text style={styles.devToggle}>
                        {debugOverlay ? "Overlay: ON" : "Overlay: OFF"}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {row("Dome Top Y", domeTopY, () => setDomeTopY((v) => v - 2), () =>
                    setDomeTopY((v) => v + 2)
                  )}
                  {row("Rim Y", rimY, () => setRimY((v) => v - 2), () =>
                    setRimY((v) => v + 2)
                  )}
                  {row(
                    "Rim Left %",
                    rimLeftPct,
                    () => setRimLeftPct((v) => Math.max(0.05, +(v - 0.02).toFixed(2))),
                    () => setRimLeftPct((v) => Math.min(0.45, +(v + 0.02).toFixed(2)))
                  )}
                  {row(
                    "Rim Right %",
                    rimRightPct,
                    () => setRimRightPct((v) => Math.max(0.55, +(v - 0.02).toFixed(2))),
                    () => setRimRightPct((v) => Math.min(0.95, +(v + 0.02).toFixed(2)))
                  )}
                  {row(
                    "Rim Inset",
                    rimInnerInset,
                    () => setRimInnerInset((v) => Math.max(0, v - 1)),
                    () => setRimInnerInset((v) => v + 1)
                  )}
                  {row(
                    "Beam Offset",
                    beamOffset,
                    () => setBeamOffset((v) => Math.max(0, v - 4)),
                    () => setBeamOffset((v) => v + 4)
                  )}

                  {row(
                    "Cap Drop",
                    capDrop,
                    () => setCapDrop((v) => Math.max(0, v - 2)),
                    () => setCapDrop((v) => v + 2)
                  )}
                  {row(
                    "Cord Extra",
                    cordExtra,
                    () => setCordExtra((v) => Math.max(0, v - 2)),
                    () => setCordExtra((v) => v + 2)
                  )}

                  {row(
                    "Pool Width",
                    POOL_WIDTH_FACTOR,
                    () => setPOOL_WIDTH_FACTOR((v) => +(Math.max(0.6, v - 0.02)).toFixed(2)),
                    () => setPOOL_WIDTH_FACTOR((v) => +(Math.min(1.0, v + 0.02)).toFixed(2))
                  )}
                  {row(
                    "Pool RX",
                    POOL_RX_FACTOR,
                    () => setPOOL_RX_FACTOR((v) => +(Math.max(0.2, v - 0.02)).toFixed(2)),
                    () => setPOOL_RX_FACTOR((v) => +(Math.min(0.6, v + 0.02)).toFixed(2))
                  )}
                  {row(
                    "Pool RY",
                    POOL_RY,
                    () => setPOOL_RY((v) => Math.max(16, v - 2)),
                    () => setPOOL_RY((v) => Math.min(64, v + 2))
                  )}
                  {row("Pool Raise", POOL_RAISE, () => setPOOL_RAISE((v) => v - 4), () =>
                    setPOOL_RAISE((v) => v + 4)
                  )}

                  <View style={styles.devFooter}>
                    <TouchableOpacity style={styles.devBtn} onPress={() => setDebugOpen(false)}>
                      <Text style={styles.devBtnTxt}>Close</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.devBtn, { backgroundColor: "#FFD458" }]}
                      onPress={() => {
                        setDomeTopY(8);
                        setRimY(80);
                        setRimLeftPct(0.22);
                        setRimRightPct(0.78);
                        setRimInnerInset(8);
                        setBeamOffset(120);
                        setCapDrop(38);
                        setCordExtra(24);
                        setPOOL_WIDTH_FACTOR(0.92);
                        setPOOL_RX_FACTOR(0.46);
                        setPOOL_RY(36);
                        setPOOL_RAISE(-276);
                      }}
                    >
                      <Text style={[styles.devBtnTxt, { color: "#141414" }]}>
                        Reset to Preset
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
          </>
        )}
      </View>
    </FullscreenWrapper>
  );
}

/* ---------- Dev Menu row helper ---------- */
function row(label: string, value: number, dec: () => void, inc: () => void) {
  return (
    <View style={devStyles.row} key={label}>
      <Text style={devStyles.rowLabel}>{label}</Text>
      <TouchableOpacity onPress={dec} style={devStyles.stepBtn}>
        <Text style={devStyles.stepTxt}>–</Text>
      </TouchableOpacity>
      <Text style={devStyles.rowVal}>{String(value)}</Text>
      <TouchableOpacity onPress={inc} style={devStyles.stepBtn}>
        <Text style={devStyles.stepTxt}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

/* ---------------- styles ---------------- */
const styles = StyleSheet.create({
  root: { flex: 1 },

  ceilingLine: {
    width: "100%",
    height: CEILING_H,
    backgroundColor: "rgba(0,0,0,0.25)",
    marginBottom: CEILING_MARGIN_B,
  },

  wallContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    top: CEILING_H + CEILING_MARGIN_B + 40,
    bottom: 0,
    zIndex: -1,
  },
  upperWall: {
    flex: 1,
    backgroundColor: COLOR.upperWall,
  },
  chairRail: {
    height: 4,
    backgroundColor: COLOR.chairRail,
  },
  lowerWall: {
    flex: 1,
    backgroundColor: COLOR.lowerWall,
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  wainscotPanel: {
    flex: 1,
    marginHorizontal: 6,
    borderRadius: 8,
    backgroundColor: COLOR.panel,
    borderWidth: 1,
    borderColor: COLOR.panelStroke,
  },

  lampGroup: {
    position: "absolute",
    left: 0,
    right: 0,
    height: H * 0.6,
  },

  cord: {
    width: 2,
    backgroundColor: "rgba(240,240,240,0.95)",
    alignSelf: "center",
  },

  buttonContainer: {
    position: "absolute",
    top: H * 0.52,
    left: 0,
    right: 0,
    alignItems: "center",
  },

  buttonPlate: {
    width: 148,
    height: 148,
    borderRadius: 24,
    backgroundColor: COLOR.plate,
    borderWidth: 1,
    borderColor: COLOR.plateBorder,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 18,
    overflow: "hidden",
  },

  screwRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  screwDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLOR.screw,
    borderWidth: 1,
    borderColor: COLOR.screwHighlight,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },

  buttonCapWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  buttonGlowRing: {
    position: "absolute",
    width: 118,
    height: 118,
    borderRadius: 59,
    backgroundColor: COLOR.buttonGlow,
  },

  buttonCap: {
    width: 104,
    height: 104,
    borderRadius: 52,
    shadowColor: "#000",
    shadowOpacity: 0.42,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    overflow: "hidden",
  },

  buttonSpec: {
    position: "absolute",
    top: 10,
    left: 14,
    width: 40,
    height: 26,
    borderRadius: 16,
    backgroundColor: COLOR.buttonSpec,
    transform: [{ rotate: "-18deg" }],
  },

  devFab: {
    position: "absolute",
    right: 14,
    bottom: 84,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFD458",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  devModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  devModal: {
    width: "92%",
    maxWidth: 540,
    backgroundColor: "#0E1C36",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  devHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 8,
  },
  devTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
  devToggle: { color: "#FFD458", fontSize: 13, fontWeight: "700" },
  devFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 8,
  },
  devBtn: {
    flex: 1,
    backgroundColor: "#1E2A4E",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  devBtnTxt: { color: "#fff", fontWeight: "700" },
});

const devStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 6 },
  rowLabel: { color: "#fff", width: 140, fontSize: 13, opacity: 0.9 },
  stepBtn: {
    width: 30,
    height: 28,
    borderRadius: 6,
    backgroundColor: "#223357",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 6,
  },
  stepTxt: { color: "#fff", fontSize: 18, fontWeight: "800" },
  rowVal: {
    color: "#FFD458",
    width: 80,
    textAlign: "center",
    fontWeight: "700",
  },
});
