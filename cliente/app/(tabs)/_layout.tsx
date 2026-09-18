import { Tabs } from "expo-router";
import { Text } from "react-native";

function TabIcon({ emoji }: { emoji: string }) {
  return <Text style={{ fontSize: 20 }}>{emoji}</Text>;
}

export default function TabsLayout() {
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
