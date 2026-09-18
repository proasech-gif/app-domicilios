import { Tabs } from "expo-router";
import { Text } from "react-native";

function TabIcon({ emoji }: { emoji: string }) {
  return <Text style={{ fontSize: 20 }}>{emoji}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: "#0F766E", headerTitleAlign: "center" }}>
      <Tabs.Screen
        name="resumen"
        options={{
          title: "Resumen",
          tabBarIcon: () => <TabIcon emoji="📊" />,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: "Pedidos",
          tabBarIcon: () => <TabIcon emoji="📦" />,
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: "Menú",
          tabBarIcon: () => <TabIcon emoji="🍔" />,
        }}
      />
      <Tabs.Screen
        name="billetera"
        options={{
          title: "Billetera",
          tabBarIcon: () => <TabIcon emoji="💰" />,
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: "Mi comercio",
          tabBarIcon: () => <TabIcon emoji="🏪" />,
        }}
      />
    </Tabs>
  );
}
