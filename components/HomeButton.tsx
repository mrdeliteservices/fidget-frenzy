 import { Pressable, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";

type Props = {
  title: string;
  route: string;
};

export default function HomeButton({ title, route }: Props) {
  const router = useRouter();

  return (
    <Pressable style={styles.button} onPress={() => router.push(route)}>
      <Text style={styles.text}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: "#3b82f6",
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
    marginVertical: 10,
  },
  text: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
});

