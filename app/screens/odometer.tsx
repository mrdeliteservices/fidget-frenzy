import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import FullscreenWrapper from "../../components/FullscreenWrapper"; // ✅ hides status bar globally

const BRAND = { blue: "#0B1E3D", purple: "#A249C0", gold: "#FDD017" };

type Setter = React.Dispatch<React.SetStateAction<number>>;

function Digit({
  value,
  onInc,
  onDec,
}: {
  value: number;
  onInc: () => void;
  onDec: () => void;
}) {
  const y = useRef(new Animated.Value(0)).current;

  const bump = (dir: 1 | -1) => {
    Animated.sequence([
      Animated.timing(y, {
        toValue: dir * -8,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(y, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <View style={styles.digitWrap}>
      <TouchableOpacity
        onPress={() => {
          onInc();
          bump(1);
        }}
        style={styles.arrow}
      >
        <Text style={styles.arrowTxt}>▲</Text>
      </TouchableOpacity>

      <Animated.View style={[styles.digit, { transform: [{ translateY: y }] }]}>
        <Text style={styles.digitTxt}>{value}</Text>
      </Animated.View>

      <TouchableOpacity
        onPress={() => {
          onDec();
          bump(-1);
        }}
        style={styles.arrow}
      >
        <Text style={styles.arrowTxt}>▼</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function Odometer() {
  const router = useRouter();

  // ✅ Typed numeric state
  const [d0, setD0] = useState<number>(0);
  const [d1, setD1] = useState<number>(0);
  const [d2, setD2] = useState<number>(0);

  // ✅ Type-safe increment/decrement helpers
  const inc = (setter: Setter) => {
    try {
      Haptics.selectionAsync();
    } catch {}
    setter((n: number) => (n + 1) % 10);
  };

  const dec = (setter: Setter) => {
    try {
      Haptics.selectionAsync();
    } catch {}
    setter((n: number) => (n + 9) % 10);
  };

  return (
    <FullscreenWrapper>
      <SafeAreaView style={[styles.container, { backgroundColor: BRAND.blue }]}>
        <View style={styles.header}>
          <Text onPress={() => router.back()} style={styles.back}>
            ‹ Back
          </Text>
          <Text style={styles.title}>Odometer</Text>
          <View style={{ width: 50 }} />
        </View>

        <View style={styles.center}>
          <View style={styles.window}>
            <Digit value={d2} onInc={() => inc(setD2)} onDec={() => dec(setD2)} />
            <Digit value={d1} onInc={() => inc(setD1)} onDec={() => dec(setD1)} />
            <Digit value={d0} onInc={() => inc(setD0)} onDec={() => dec(setD0)} />
          </View>
          <Text style={styles.valueLabel}>
            {d2}
            {d1}
            {d0}
          </Text>
          <Text style={styles.hint}>Tap ▲ / ▼ to roll</Text>
        </View>
      </SafeAreaView>
    </FullscreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  back: { color: "#fff", fontSize: 18, opacity: 0.9 },
  title: { color: "#fff", fontSize: 20, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  window: {
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.25)",
    borderRadius: 12,
    padding: 8,
    gap: 8,
    borderWidth: 2,
    borderColor: "rgba(0,0,0,0.35)",
  },
  digitWrap: { alignItems: "center", justifyContent: "center" },
  arrow: { paddingVertical: 6 },
  arrowTxt: { color: "#fff", fontSize: 16, opacity: 0.9 },
  digit: {
    width: 54,
    height: 72,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111a2d",
    borderWidth: 2,
    borderColor: "#0b1220",
  },
  digitTxt: { color: "#fff", fontSize: 40, fontWeight: "800" },
  valueLabel: {
    color: BRAND.gold,
    fontSize: 22,
    marginTop: 16,
    fontWeight: "700",
    letterSpacing: 2,
  },
  hint: { color: "rgba(255,255,255,0.7)", marginTop: 10 },
});
