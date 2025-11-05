import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableWithoutFeedback,
  Animated,
  Easing,
  SafeAreaView,
} from "react-native";
import * as Haptics from "expo-haptics";
import FullscreenWrapper from "@components/FullscreenWrapper";

// --- Safe router shim so Welcome works with or without expo-router ---
let routerReplace: (path: string) => void = () => {};
try {
  // Dynamically require so it doesn't throw in web bypass mode
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const exp = require("expo-router");
  if (typeof exp?.useRouter === "function") {
    const r = exp.useRouter();
    if (r?.replace) routerReplace = r.replace.bind(r);
  }
} catch {
  // No expo-router available in this environment; fall back to no-op
}
// ---------------------------------------------------------------------

const BRAND = { blue: "#0B1E3D", gold: "#FDD017" };

const TAGLINES = [
  "Tap. Spin. Pop. Repeat.",
  "Settle your hands. Free your mind.",
  "Little motions. Big calm.",
  "Spin down the static.",
  "Quiet the fidget. Keep the flow.",
];
const SUBLINE = "Tiny tools to calm busy hands.";

export default function Welcome() {
  const logoScale = useRef(new Animated.Value(0.85)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const taglineTranslate = useRef(new Animated.Value(10)).current;
  const footerOpacity = useRef(new Animated.Value(0)).current;

  const taglineIndex = useRef(0);
  const taglineText = useRef(TAGLINES[0]);
  const [, forceRender] = React.useReducer((x) => x + 1, 0);

  const goHome = React.useCallback(() => {
    Haptics.selectionAsync();
    routerReplace("/home");
  }, []);

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 450,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          speed: 12,
          bounciness: 6,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(glowOpacity, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start();

    const rotate = () => {
      Animated.sequence([
        Animated.parallel([
          Animated.timing(taglineOpacity, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(taglineTranslate, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(1000),
        Animated.parallel([
          Animated.timing(taglineOpacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(taglineTranslate, {
            toValue: -10,
            duration: 300,
            useNativeDriver: true,
          }),
        ]),
      ]).start(({ finished }) => {
        if (finished) {
          taglineIndex.current++;
          if (taglineIndex.current < TAGLINES.length) {
            taglineText.current = TAGLINES[taglineIndex.current];
            taglineTranslate.setValue(10);
            forceRender();
            rotate();
          } else {
            Animated.timing(footerOpacity, {
              toValue: 1,
              duration: 700,
              useNativeDriver: true,
            }).start(() => {
              setTimeout(goHome, 1500);
            });
          }
        }
      });
    };

    const t = setTimeout(rotate, 400);
    return () => clearTimeout(t);
  }, [
    logoOpacity,
    logoScale,
    glowOpacity,
    taglineOpacity,
    taglineTranslate,
    footerOpacity,
    goHome,
  ]);

  return (
    <FullscreenWrapper>
      <TouchableWithoutFeedback onPress={goHome}>
        <SafeAreaView
          style={[styles.container, { backgroundColor: BRAND.blue }]}
        >
          <View style={styles.center}>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.glow,
                {
                  opacity: glowOpacity,
                  shadowColor: BRAND.gold,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.45,
                  shadowRadius: 28,
                },
              ]}
            />
            <Animated.Image
              source={require("@assets/brand/fidget-frenzy-logo.png")}
              style={[
                styles.logo,
                { opacity: logoOpacity, transform: [{ scale: logoScale }] },
              ]}
              resizeMode="contain"
            />
            <Animated.Text
              style={[
                styles.tagline,
                {
                  opacity: taglineOpacity,
                  transform: [{ translateY: taglineTranslate }],
                },
              ]}
            >
              {taglineText.current}
            </Animated.Text>
            <Animated.Text
              style={[
                styles.subline,
                {
                  opacity: taglineOpacity,
                  transform: [{ translateY: taglineTranslate }],
                },
              ]}
            >
              {SUBLINE}
            </Animated.Text>
            <Animated.Text
              style={[
                styles.hint,
                {
                  opacity: taglineOpacity,
                  transform: [{ translateY: taglineTranslate }],
                },
              ]}
            >
              Tap anywhere to start
            </Animated.Text>
          </View>

          <Animated.View style={[styles.footer, { opacity: footerOpacity }]}>
            <Text style={styles.footerText}>Built with focus by</Text>
            <Text style={styles.footerBrand}>MRD Elite Studios</Text>
          </Animated.View>
        </SafeAreaView>
      </TouchableWithoutFeedback>
    </FullscreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "space-between" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  logo: { width: 240, height: 240 },
  glow: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "transparent",
  },
  tagline: {
    marginTop: 22,
    color: "#fff",
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 0.5,
  },
  subline: {
    marginTop: 10,
    color: "rgba(255,255,255,0.85)",
    fontSize: 15,
    textAlign: "center",
  },
  hint: {
    marginTop: 22,
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    letterSpacing: 0.4,
  },
  footer: {
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 20,
  },
  footerText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
    letterSpacing: 0.3,
  },
  footerBrand: {
    fontSize: 15,
    color: "#FDD017",
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
