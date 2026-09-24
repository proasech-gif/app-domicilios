import { useEffect, useState } from "react";
import { Tabs } from "expo-router";
import { Text } from "react-native";
import { registerForPushNotificationsAsync } from "@/lib/notifications";
import { api, Restaurant } from "@/lib/api";

function TabIcon({ emoji }: { emoji: string }) {
  return <Text style={{ fontSize: 20 }}>{emoji}</Text>;
}

// Investigado: "Menú" solo tiene sentido para restaurantes. Para los demás
// tipos de negocio, el nombre correcto es distinto — una farmacia, un
// supermercado, una tienda o una tienda de mascotas venden "Catálogo" o
// "Productos", no un "Menú"; un salón de belleza ofrece "Servicios".
const CATALOG_LABELS: Record<Restaurant["business_type"], string> = {
  restaurante: "Menú",
  supermercado: "Catálogo",
  farmacia: "Catálogo",
  tienda: "Catálogo",
  mascota: "Catálogo",
  belleza: "Servicios",
};

const CATALOG_ICONS: Record<Restaurant["business_type"], string> = {
  restaurante: "🍔",
  supermercado: "🛒",
  farmacia: "💊",
  tienda: "🏬",
  mascota: "🐾",
  belleza: "💅",
};

export default function TabsLayout() {
  const [catalogLabel, setCatalogLabel] = useState("Menú");
  const [catalogIcon, setCatalogIcon] = useState("🍔");

  useEffect(() => {
    registerForPushNotificationsAsync();
    api
      .myRestaurants()
      .then((restaurants) => {
        const businessType = restaurants[0]?.business_type;
        if (businessType && CATALOG_LABELS[businessType]) {
          setCatalogLabel(CATALOG_LABELS[businessType]);
          setCatalogIcon(CATALOG_ICONS[businessType]);
        }
      })
      .catch(() => {
        /* si falla, se queda con "Menú" por defecto */
      });
  }, []);

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
          title: catalogLabel,
          tabBarIcon: () => <TabIcon emoji={catalogIcon} />,
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
