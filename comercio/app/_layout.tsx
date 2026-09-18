import { useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator } from "react-native";
import { isAuthenticated, api } from "@/lib/api";

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
    const inOnboarding = segments[0] === "restaurante" && segments[1] === "nuevo";

    if (!authed && !inAuthGroup) {
      router.replace("/login");
      setReady(true);
      return;
    }

    if (authed && inAuthGroup) {
      router.replace("/(tabs)");
      setReady(true);
      return;
    }

    // Si está autenticado y no está en auth ni en onboarding, verificamos que tenga un comercio creado.
    if (authed && !inAuthGroup && !inOnboarding) {
      try {
        const restaurants = await api.myRestaurants();
        if (restaurants.length === 0) {
          router.replace("/restaurante/nuevo");
        }
      } catch {
        /* si falla la verificación, dejamos seguir; las pantallas manejan sus propios errores */
      }
    }

    setReady(true);
  }

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <AuthGate>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="restaurante/nuevo" options={{ headerShown: true, title: "Crear comercio" }} />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="pedido/[id]" options={{ headerShown: true, title: "Pedido" }} />
      </Stack>
    </AuthGate>
  );
}
