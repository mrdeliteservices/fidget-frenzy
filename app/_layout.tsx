import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

// Screens
import HomeScreen from "./index"; // Home stays at app/index.tsx
import SpinnerScreen from "./screens/SpinnerScreen";
import BalloonPopper from "./screens/BalloonPopper";

// -------------------- Stack Param List --------------------
export type RootStackParamList = {
  Home: undefined;
  Spinner: undefined;
  BalloonPopper: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// -------------------- Layout --------------------
export default function Layout() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Home" component={HomeScreen} />

        {/* ✅ Casts prevent TS 2739 errors */}
        <Stack.Screen
          name="Spinner"
          component={SpinnerScreen as React.ComponentType<any>}
        />
        <Stack.Screen
          name="BalloonPopper"
          component={BalloonPopper as React.ComponentType<any>}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
