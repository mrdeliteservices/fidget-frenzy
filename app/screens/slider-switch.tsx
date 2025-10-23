// Fidget Frenzy – Slider Switch (tweak-friendly)
// Expo SDK 54 / RN 0.81
// - Lamp group fixed relative to ceiling (doesn't jump when cord changes)
// - Cord + cap move together (Cap Drop), Cord Extra only extends white piece
// - Beam begins under rim; unaffected by cord tuning
// - Dev Menu only if DEBUG = true

import React, { useMemo, useRef, useState } from "react";
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
import SettingsModal from "../../components/SettingsModal";

const { width: W, height: H } = Dimensions.get("window");
const AnimatedPath = Animated.createAnimatedComponent(Path);

const COLOR = {
  bg: "#081A34",
  dome: "#0E0F10",
  filament: "#FFC93C",
  glassStroke: "rgba(255,255,255,0.26)",
  glassFill: "rgba(255,255,255,0.06)",
  warmGlow: "rgba(255,201,60,0.85)",
};

// Show Dev FAB/Menu only in debug builds
const DEBUG = true; // <- set false for release

// ---- Layout constants (stable) ----
const CEILING_H = 10; // styles.ceilingLine.height
const CEILING_MARGIN_B = 4; // below the line

export default function SliderSwitch() {
  const [isOn, setIsOn] = useState(false);
  const [count, setCount] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(true);

  // Dev Menu (visible ONLY if DEBUG)
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugOverlay, setDebugOverlay] = useState(false);

  // Master animation
  const a = useRef(new Animated.Value(0)).current;
  const animatingRef = useRef(false);

  // --------- AUDIO: lazy-load on first use (avoids startup crash) ----------
  const soundRef = useRef<Audio.Sound | null>(null);
  const soundLoadedRef = useRef(false);
  const ensureSound = async () => {
    if (soundLoadedRef.current) return;
    try {
      const { sound } = await Audio.Sound.createAsync(
        require("../../assets/sounds/switch-click.mp3"),
        { shouldPlay: false }
      );
      soundRef.current = sound;
      soundLoadedRef.current = true;
    } catch {}
  };
  const playClick = async () => {
    if (!soundOn) return;
    try {
      if (!soundLoadedRef.current) await ensureSound();
      const s = soundRef.current;
      if (!s) return;
      await s.stopAsync().catch(() => {});
      await s.setPositionAsync(0).catch(() => {});
      await s.playAsync().catch(() => {});
    } catch {}
  };

  // ================== TUNABLES (Dev Menu) ==================
  // Dome geometry
  const [domeTopY, setDomeTopY] = useState(8);   // top of curve
  const [rimY, setRimY] = useState(120);          // bottom of shade (your latest)
  const [rimLeftPct, setRimLeftPct] = useState(0.22);
  const [rimRightPct, setRimRightPct] = useState(0.78);
  const [rimInnerInset, setRimInnerInset] = useState(8);

  // Beam start (pixels below rim)
  const [beamOffset, setBeamOffset] = useState(0);

  // Cord + Cap
  // Lamp group is fixed; Cap Drop moves the gray cap relative to lamp, and the white cord end follows.
  const [capDrop, setCapDrop] = useState(0); // pixels below lampGroupTop
  const [cordExtra, setCordExtra] = useState(0); // extra white below the cap (does not move cap)

  // Pool
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

    // ---- Fixed lamp group placement (from ceiling) ----
    // You can bump this number if you want the whole lamp assembly lower/higher
    const LAMP_GROUP_TOP = 120; // << primary macro placement knob

    // White cord runs from *under* ceiling to the cap top (LAMP_GROUP_TOP + capDrop) plus any extra
    const cordHeight = Math.max(
      8,
      (LAMP_GROUP_TOP - (CEILING_H + CEILING_MARGIN_B)) + capDrop + cordExtra
    );

    // pool geometry
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

  // Toggle with debounce
  const toggle = async () => {
    if (animatingRef.current) return;
    animatingRef.current = true;
    const next = !isOn;
    setIsOn(next);
    setCount((c) => c + 1);
    try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    await playClick();
    Animated.timing(a, {
      toValue: next ? 1 : 0,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => (animatingRef.current = false));
  };

  const reset = () => {
    setIsOn(false);
    setCount(0);
    a.stopAnimation();
    a.setValue(0);
    animatingRef.current = false;
  };

  // Interpolations
  const coneOpacity = a.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const filamentOpacity = a.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const coneIntensity = a.interpolate({ inputRange: [0, 1], outputRange: [0, 0.95] });

  // Beam trapezoid
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
          {/* Header */}
          <View style={styles.topBar}>
            <BackButton />
            <View style={styles.counterPill}><Text style={styles.counterTxt}>{count}</Text></View>
            <TouchableOpacity onPress={() => setSettingsOpen(true)} style={styles.settingsBtn}>
              <Text style={styles.settingsGlyph}>⚙️</Text>
            </TouchableOpacity>
          </View>

          {/* Ceiling line */}
          <View style={styles.ceilingLine} />

          {/* White cord (independent from lamp/beam) */}
          <View style={[styles.cord, { height: L.cordHeight, marginBottom: -1 }]} />

          {/* ===================== LAMP GROUP (fixed from ceiling) ===================== */}
          <View style={[styles.lampGroup, { top: L.LAMP_GROUP_TOP }]}>
            {/* Gray cap (two stacked rounded rects). It sits at capDrop, and the white
                cord end visually touches it because the cord is tall enough. */}
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

            {/* BEAM (relative to the lamp group, so unaffected by cord changes) */}
            <Animated.View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: capDrop + rimY + beamOffset, // "start under rim" invariant
                left: "50%",
                transform: [{ translateX: L.beamX }],
                opacity: Animated.multiply(coneOpacity, coneIntensity),
              }}
            >
              <Svg width={L.bottomW} height={L.coneH}>
                <Defs>
                  <SvgLinearGradient id="beamFadeY" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0%" stopColor={COLOR.warmGlow} stopOpacity="0.78" />
                    <Stop offset="42%" stopColor={COLOR.warmGlow} stopOpacity="0.30" />
                    <Stop offset="100%" stopColor={COLOR.warmGlow} stopOpacity="0.06" />
                  </SvgLinearGradient>
                </Defs>
                <Path d={conePath} fill="url(#beamFadeY)" />
                {debugOverlay && (
                  <>
                    <Line x1={(L.bottomW - L.topW) / 2} y1={0} x2={L.bottomW / 2} y2={L.coneH}
                      stroke="lime" strokeDasharray="4,3" strokeWidth={1} />
                    <Line x1={(L.bottomW + L.topW) / 2} y1={0} x2={L.bottomW / 2} y2={L.coneH}
                      stroke="lime" strokeDasharray="4,3" strokeWidth={1} />
                  </>
                )}
              </Svg>
            </Animated.View>

            {/* SVG Lamp (bulb clipped by rim; dome in front) */}
            <View style={{ position: "absolute", top: capDrop, left: 0, right: 0, alignItems: "center" }}>
              <Svg width={L.domeW} height={Math.max(240, rimY + 40)}>
                <Defs>
                  <ClipPath id="belowRim"><Rect x="0" y={rimY} width={L.domeW} height={H} /></ClipPath>
                </Defs>

                {/* Bulb (only below rim) */}
                <G clipPath="url(#belowRim)">
                  <Path
                    d={`
                      M ${L.domeW / 2 - L.bulbHalfW} ${rimY - 10}
                      Q ${L.domeW / 2 - (L.bulbHalfW - 6)} ${rimY - 26} ${L.domeW / 2} ${rimY - 40}
                      Q ${L.domeW / 2 + (L.bulbHalfW - 6)} ${rimY - 26} ${L.domeW / 2 + L.bulbHalfW} ${rimY - 10}
                      Q ${L.domeW / 2 + L.bulbHalfW} ${rimY - 2}  ${L.domeW / 2} ${rimY + 34}
                      Q ${L.domeW / 2 - L.bulbHalfW} ${rimY - 2}  ${L.domeW / 2 - L.bulbHalfW} ${rimY - 10} Z
                    `}
                    fill={COLOR.glassFill}
                    stroke={COLOR.glassStroke}
                    strokeWidth={1.4}
                  />
                  <AnimatedPath
                    d={`M ${L.domeW / 2 - 9} ${rimY - 22}
                        Q ${L.domeW / 2 - 4} ${rimY - 14} ${L.domeW / 2} ${rimY - 10}
                        Q ${L.domeW / 2 + 4} ${rimY - 14} ${L.domeW / 2 + 9} ${rimY - 22}`}
                    stroke={COLOR.filament}
                    strokeWidth={2.8}
                    strokeLinecap="round"
                    opacity={filamentOpacity as any}
                  />
                  <Ellipse cx={L.domeW / 2} cy={rimY - 14} rx={20} ry={14} fill={COLOR.warmGlow} opacity={0.28} />
                </G>

                {/* Dome (front) */}
                <Path
                  d={`M ${L.domeW * rimLeftPct} ${rimY}
                     Q ${L.domeW / 2} ${domeTopY} ${L.domeW * rimRightPct} ${rimY} Z`}
                  fill={COLOR.dome}
                />

                {debugOverlay && (
                  <Path
                    d={`M ${L.domeW * rimLeftPct} ${rimY}
                       Q ${L.domeW / 2} ${domeTopY} ${L.domeW * rimRightPct} ${rimY}`}
                    stroke="cyan" strokeDasharray="6,4" strokeWidth={1} fill="none"
                  />
                )}
              </Svg>
            </View>
          </View>

          {/* ===================== POOL (absolute from screen top) ===================== */}
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              top:
                CEILING_H + CEILING_MARGIN_B + // from top to under ceiling
                L.cordHeight +                 // through the entire cord
                (L.LAMP_GROUP_TOP - (CEILING_H + CEILING_MARGIN_B)) + // to lamp group top
                rimY + beamOffset + L.coneH +  // to end of cone
                POOL_RAISE,                    // final user raise
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

          {/* ===================== SWITCH ===================== */}
          <View style={{ flex: 1 }} />
          <View style={styles.switchAnchor}>
            <View style={styles.switchWrap}>
              <TouchableWithoutFeedback onPress={toggle}>
                <Animated.View
                  style={[
                    styles.track,
                    {
                      width: 124,
                      height: 214,
                      padding: 10,
                      borderRadius: 22,
                      borderWidth: 2,
                      backgroundColor: a.interpolate({
                        inputRange: [0, 1],
                        outputRange: ["rgba(255,255,255,0.08)", "rgba(255,201,60,0.38)"],
                      }) as any,
                      borderColor: a.interpolate({
                        inputRange: [0, 1],
                        outputRange: ["rgba(0,0,0,0.30)", "rgba(255,201,60,0.80)"],
                      }) as any,
                    },
                  ]}
                >
                  <Animated.View
                    style={[
                      styles.knob,
                      {
                        width: 104,
                        height: 92,
                        borderRadius: 16,
                        transform: [
                          {
                            translateY: a.interpolate({
                              inputRange: [0, 1],
                              outputRange: [214 - 20 - 92, 0],
                            }),
                          },
                        ],
                        backgroundColor: a.interpolate({
                          inputRange: [0, 1],
                          outputRange: ["#FFFFFF", "#FFF6D4"],
                        }) as any,
                      },
                    ]}
                  />
                </Animated.View>
              </TouchableWithoutFeedback>
            </View>
          </View>

          {/* Settings */}
          <SettingsModal
            visible={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            onReset={reset}
            soundOn={soundOn}
            setSoundOn={setSoundOn}
            accentColor={COLOR.filament}
            backgroundTint={"#2B364C"}
            blurEnabled
          />
        </SafeAreaView>

        {/* ===== Dev FAB / Dev Menu (only when DEBUG) ===== */}
        {DEBUG && (
          <>
            <TouchableOpacity
              onPress={() => setDebugOpen(true)}
              style={styles.devFab}
              accessibilityRole="button"
              accessibilityLabel="Open developer tuning menu"
            >
              <Text style={{ color: "#111", fontWeight: "700" }}>⚙️</Text>
            </TouchableOpacity>

            <Modal transparent visible={debugOpen} animationType="fade" onRequestClose={() => setDebugOpen(false)}>
              <View style={styles.devModalBackdrop}>
                <View style={styles.devModal}>
                  <View style={styles.devHeader}>
                    <Text style={styles.devTitle}>Developer Tuning</Text>
                    <TouchableOpacity onPress={() => setDebugOverlay((v) => !v)}>
                      <Text style={styles.devToggle}>{debugOverlay ? "Overlay: ON" : "Overlay: OFF"}</Text>
                    </TouchableOpacity>
                  </View>

                  {row("Dome Top Y", domeTopY, () => setDomeTopY((v) => v - 2), () => setDomeTopY((v) => v + 2))}
                  {row("Rim Y", rimY, () => setRimY((v) => v - 2), () => setRimY((v) => v + 2))}
                  {row("Rim Left %", rimLeftPct, () => setRimLeftPct((v) => Math.max(0.05, +(v - 0.02).toFixed(2))), () => setRimLeftPct((v) => Math.min(0.45, +(v + 0.02).toFixed(2))))}
                  {row("Rim Right %", rimRightPct, () => setRimRightPct((v) => Math.max(0.55, +(v - 0.02).toFixed(2))), () => setRimRightPct((v) => Math.min(0.95, +(v + 0.02).toFixed(2))))}
                  {row("Rim Inset", rimInnerInset, () => setRimInnerInset((v) => Math.max(0, v - 1)), () => setRimInnerInset((v) => v + 1))}
                  {row("Beam Offset", beamOffset, () => setBeamOffset((v) => Math.max(0, v - 4)), () => setBeamOffset((v) => v + 4))}

                  {row("Cap Drop", capDrop, () => setCapDrop((v) => Math.max(0, v - 2)), () => setCapDrop((v) => v + 2))}
                  {row("Cord Extra", cordExtra, () => setCordExtra((v) => Math.max(0, v - 2)), () => setCordExtra((v) => v + 2))}

                  {row("Pool Width", POOL_WIDTH_FACTOR, () => setPOOL_WIDTH_FACTOR((v) => +(Math.max(0.6, v - 0.02)).toFixed(2)), () => setPOOL_WIDTH_FACTOR((v) => +(Math.min(1.0, v + 0.02)).toFixed(2)))}
                  {row("Pool RX", POOL_RX_FACTOR, () => setPOOL_RX_FACTOR((v) => +(Math.max(0.20, v - 0.02)).toFixed(2)), () => setPOOL_RX_FACTOR((v) => +(Math.min(0.60, v + 0.02)).toFixed(2)))}
                  {row("Pool RY", POOL_RY, () => setPOOL_RY((v) => Math.max(16, v - 2)), () => setPOOL_RY((v) => Math.min(64, v + 2)))}
                  {row("Pool Raise", POOL_RAISE, () => setPOOL_RAISE((v) => v - 4), () => setPOOL_RAISE((v) => v + 4))}

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
                      <Text style={[styles.devBtnTxt, { color: "#141414" }]}>Reset to Preset</Text>
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
function row(
  label: string,
  value: number,
  dec: () => void,
  inc: () => void
) {
  return (
    <View style={devStyles.row} key={label}>
      <Text style={devStyles.rowLabel}>{label}</Text>
      <TouchableOpacity onPress={dec} style={devStyles.stepBtn}><Text style={devStyles.stepTxt}>–</Text></TouchableOpacity>
      <Text style={devStyles.rowVal}>{String(value)}</Text>
      <TouchableOpacity onPress={inc} style={devStyles.stepBtn}><Text style={devStyles.stepTxt}>+</Text></TouchableOpacity>
    </View>
  );
}

/* ---------------- styles ---------------- */
const styles = StyleSheet.create({
  root: { flex: 1 },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingTop: 4,
  },
  settingsBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  settingsGlyph: { fontSize: 22, color: "#ffffff" },
  counterPill: {
    minWidth: 64,
    paddingHorizontal: 14,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  counterTxt: { color: "#fff", fontWeight: "800", fontSize: 16 },

  ceilingLine: {
    width: "100%",
    height: CEILING_H,
    backgroundColor: "rgba(0,0,0,0.25)",
    marginBottom: CEILING_MARGIN_B,
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

  switchAnchor: {
    position: "absolute",
    left: 0, right: 0, bottom: 18, alignItems: "center",
  },
  switchWrap: { width: "100%", alignItems: "center" },

  track: {
    justifyContent: "flex-start",
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  knob: {
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },

  // Dev FAB/Menu
  devFab: {
    position: "absolute",
    right: 14,
    bottom: 84,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#FFD458",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  devModalBackdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center", justifyContent: "center",
  },
  devModal: {
    width: "92%", maxWidth: 540,
    backgroundColor: "#0E1C36",
    borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
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
    width: 30, height: 28, borderRadius: 6,
    backgroundColor: "#223357",
    alignItems: "center", justifyContent: "center",
    marginHorizontal: 6,
  },
  stepTxt: { color: "#fff", fontSize: 18, fontWeight: "800" },
  rowVal: { color: "#FFD458", width: 80, textAlign: "center", fontWeight: "700" },
});
