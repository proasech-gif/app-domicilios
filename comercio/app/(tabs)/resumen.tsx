import { useCallback, useMemo, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { api, Order, OrderStatus, Product, Restaurant } from "@/lib/api";

const STATUS_LABELS: Record<OrderStatus, string> = {
  creado: "Nuevo",
  confirmado_comercio: "Confirmado",
  en_preparacion: "En preparación",
  listo_para_recoger: "Listo",
  domiciliario_asignado: "Asignado",
  en_camino_a_comercio: "Domiciliario en camino",
  recogido: "Recogido",
  en_camino_a_cliente: "En camino",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

const ACTIVE_STATUSES: OrderStatus[] = [
  "creado",
  "confirmado_comercio",
  "en_preparacion",
  "listo_para_recoger",
  "domiciliario_asignado",
  "en_camino_a_comercio",
  "recogido",
  "en_camino_a_cliente",
];

function isToday(dateString: string): boolean {
  const d = new Date(dateString);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
  );
}

export default function ResumenScreen() {
  const router = useRouter();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const restaurants = await api.myRestaurants();
      const mine = restaurants[0] || null;
      setRestaurant(mine);
      if (mine) {
        const [ordersData, productsData] = await Promise.all([
          api.restaurantOrders(mine.id),
          api.products(mine.id),
        ]);
        setOrders(ordersData);
        setProducts(productsData);
      }
    } catch {
      /* se reintenta al volver a enfocar la pantalla */
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(true);
    }, [load])
  );

  const stats = useMemo(() => {
    const todayOrders = orders.filter((o) => isToday(o.created_at) && o.status !== "cancelado");
    const ventasHoy = todayOrders.reduce((sum, o) => sum + (o.subtotal - o.commission_amount), 0);
    const pedidosActivos = orders.filter((o) => ACTIVE_STATUSES.includes(o.status)).length;
    const productosActivos = products.filter((p) => p.is_available).length;
    return {
      pedidosHoy: todayOrders.length,
      ventasHoy,
      pedidosActivos,
      productosActivos,
    };
  }, [orders, products]);

  const recentOrders = useMemo(
    () => [...orders].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 5),
    [orders]
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0F766E" />
      </View>
    );
  }

  if (!restaurant) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>Todavía no tienes un comercio creado.</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={recentOrders}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={false} onRefresh={() => load(false)} />}
      contentContainerStyle={{ paddingBottom: 24 }}
      ListHeaderComponent={
        <View>
          <View style={styles.header}>
            <Text style={styles.restaurantName}>{restaurant.name}</Text>
            <Text
              style={[
                styles.statusBadge,
                restaurant.is_open ? styles.statusOpen : styles.statusClosed,
              ]}
            >
              {restaurant.is_open ? "Abierto" : "Cerrado"}
            </Text>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.pedidosHoy}</Text>
              <Text style={styles.statLabel}>Pedidos hoy</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>${Math.round(stats.ventasHoy).toLocaleString()}</Text>
              <Text style={styles.statLabel}>Ventas hoy</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.pedidosActivos}</Text>
              <Text style={styles.statLabel}>Pedidos activos</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.productosActivos}</Text>
              <Text style={styles.statLabel}>Productos activos</Text>
            </View>
          </View>

          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Pedidos recientes</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)")}>
              <Text style={styles.seeAll}>Ver todos ›</Text>
            </TouchableOpacity>
          </View>
        </View>
      }
      ListEmptyComponent={<Text style={styles.empty}>Todavía no tienes pedidos.</Text>}
      renderItem={({ item }) => (
        <View style={styles.orderRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.orderId}>Pedido #{item.id.slice(0, 8)}</Text>
            <Text style={styles.orderMeta}>
              {item.items.reduce((s, i) => s + i.quantity, 0)} producto(s) · hace{" "}
              {Math.max(1, Math.round((Date.now() - new Date(item.created_at).getTime()) / 60000))} min
            </Text>
          </View>
          <Text style={styles.orderStatus}>{STATUS_LABELS[item.status]}</Text>
        </View>
      )}
      ListFooterComponent={
        <TouchableOpacity style={styles.createButton} onPress={() => router.push("/(tabs)/menu")}>
          <Text style={styles.createButtonText}>+ Crear nuevo producto</Text>
        </TouchableOpacity>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  empty: { textAlign: "center", color: "#94a3b8", marginTop: 20, paddingHorizontal: 16 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    paddingBottom: 8,
  },
  restaurantName: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  statusBadge: {
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    overflow: "hidden",
  },
  statusOpen: { color: "#16a34a", backgroundColor: "#f0fdf4" },
  statusClosed: { color: "#dc2626", backgroundColor: "#fef2f2" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, gap: 10, marginTop: 8 },
  statCard: {
    flexBasis: "47%",
    backgroundColor: "#F0FDFA",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#CCFBF1",
  },
  statValue: { fontSize: 22, fontWeight: "800", color: "#0F766E" },
  statLabel: { fontSize: 12, color: "#475569", marginTop: 4 },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginTop: 24,
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  seeAll: { fontSize: 13, color: "#0F766E", fontWeight: "600" },
  orderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  orderId: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  orderMeta: { fontSize: 12, color: "#64748b", marginTop: 2 },
  orderStatus: { fontSize: 12, fontWeight: "600", color: "#0F766E" },
  createButton: {
    backgroundColor: "#0F766E",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 20,
  },
  createButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
