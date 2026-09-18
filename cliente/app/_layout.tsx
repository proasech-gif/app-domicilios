import { useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator } from "react-native";
import { CartProvider } from "@/lib/cart-context";
import { isAuthenticated } from "@/lib/api";

function AuthGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    checkAuth();
  }, [segments]);

  async function checkAuth() {
    const authed = await isAuthenticated();
    const inAuthGroup = segments[0] === "login" || segments[0] === "register";

    if (!authed && !inAuthGroup) {
      router.replace("/login");
    } else if (authed && inAuthGroup) {
      router.replace("/(tabs)");
    }
    setReady(true);
  }

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <CartProvider>
      <AuthGate>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="restaurante/[id]" options={{ headerShown: true, title: "" }} />
          <Stack.Screen name="carrito" options={{ headerShown: true, title: "Tu carrito" }} />
          <Stack.Screen name="pedido/[id]" options={{ headerShown: true, title: "Tu pedido" }} />
        </Stack>
      </AuthGate>
    </CartProvider>
  );
}
