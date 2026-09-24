import { useEffect } from "react";
import { Tabs } from "expo-router";
import { Text } from "react-native";
import { registerForPushNotificationsAsync } from "@/lib/notifications";

function TabIcon({ emoji }: { emoji: string }) {
  return <Text style={{ fontSize: 20 }}>{emoji}</Text>;
}

export default function TabsLayout() {
  useEffect(() => {
    // Registra el push token del celular cada vez que el usuario entra
    // a la app ya con sesión iniciada (aquí, no antes, porque ya hay token de acceso).
    registerForPushNotificationsAsync();
  }, []);

  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: "#16a34a", headerTitleAlign: "center" }}>
      <Tabs.Screen
        name="index"
        options={{
          title: "Comercios",
          tabBarIcon: () => <TabIcon emoji="🍽️" />,
        }}
      />
      <Tabs.Screen
        name="pedidos"
        options={{
          title: "Mis pedidos",
          tabBarIcon: () => <TabIcon emoji="📦" />,
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: "Perfil",
          tabBarIcon: () => <TabIcon emoji="👤" />,
        }}
      />
    </Tabs>
  );
}
