import { useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator } from "react-native";
import { isAuthenticated, api, ApiError } from "@/lib/api";

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
    const inOnboarding = segments[0] === "perfil-nuevo";

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

    if (authed && !inAuthGroup && !inOnboarding) {
      try {
        await api.myProfile();
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          router.replace("/perfil-nuevo");
        }
      }
    }

    setReady(true);
  }

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#ea580c" />
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
        <Stack.Screen name="perfil-nuevo" options={{ headerShown: true, title: "Crear perfil" }} />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="pedido/[id]" options={{ headerShown: true, title: "Entrega" }} />
      </Stack>
    </AuthGate>
  );
}
