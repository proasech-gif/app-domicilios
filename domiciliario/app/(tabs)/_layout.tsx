import { Tabs } from "expo-router";
import { Text } from "react-native";

function TabIcon({ emoji }: { emoji: string }) {
  return <Text style={{ fontSize: 20 }}>{emoji}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: "#ea580c", headerTitleAlign: "center" }}>
      <Tabs.Screen
        name="index"
        options={{
          title: "Disponibles",
          tabBarIcon: () => <TabIcon emoji="🛵" />,
        }}
      />
      <Tabs.Screen
        name="mis-entregas"
        options={{
          title: "Mis entregas",
          tabBarIcon: () => <TabIcon emoji="📦" />,
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
          title: "Perfil",
          tabBarIcon: () => <TabIcon emoji="👤" />,
        }}
      />
    </Tabs>
  );
}
