import { View, Text, StyleSheet } from "react-native";
import HomeButton from "../components/HomeButton";

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>🎮 Fidget Frenzy</Text>
      <HomeButton title="Play Spinner" route="/spinner" />
      <HomeButton title="Play Balloon Popper" route="/balloonpopper" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 28,
    color: "#fff",
    marginBottom: 40,
  },
});
