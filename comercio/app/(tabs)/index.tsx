import { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { api, Order, OrderStatus, Restaurant, ApiError } from "@/lib/api";

const STATUS_LABELS: Record<OrderStatus, string> = {
  creado: "Nuevo pedido",
  confirmado_comercio: "Confirmado",
  en_preparacion: "En preparación",
  listo_para_recoger: "Esperando domiciliario",
  domiciliario_asignado: "Domiciliario asignado",
  en_camino_a_comercio: "Domiciliario en camino",
  recogido: "Recogido",
  en_camino_a_cliente: "En camino al cliente",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

// Para cada estado actual, qué botón mostrarle al comercio y a qué estado lleva.
const NEXT_ACTION: Partial<Record<OrderStatus, { label: string; next: OrderStatus }>> = {
  creado: { label: "Confirmar pedido", next: "confirmado_comercio" },
  confirmado_comercio: { label: "Empezar preparación", next: "en_preparacion" },
  en_preparacion: { label: "Marcar listo para recoger", next: "listo_para_recoger" },
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

export default function PedidosScreen() {
  const router = useRouter();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const restaurants = await api.myRestaurants();
      const mine = restaurants[0] || null;
      setRestaurant(mine);
      if (mine) {
        const data = await api.restaurantOrders(mine.id);
        data.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
        setOrders(data);
      }
    } catch {
      /* se reintenta en el próximo ciclo */
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(true);
      // Sondeo cada 6s mientras la pantalla está enfocada, para simular tiempo real
      // sin necesitar un WebSocket dedicado a la lista completa de pedidos.
      intervalRef.current = setInterval(() => load(false), 6000);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }, [load])
  );

  async function handleAdvance(order: Order) {
    const action = NEXT_ACTION[order.status];
    if (!action) return;
    setUpdatingId(order.id);
    try {
      await api.updateOrderStatus(order.id, action.next);
      await load(false);
    } catch (err) {
      Alert.alert("No se pudo actualizar", err instanceof ApiError ? err.message : "Intenta de nuevo");
    } finally {
      setUpdatingId(null);
    }
  }

  function handleReject(order: Order) {
    Alert.alert("Rechazar pedido", "¿Seguro que quieres rechazar este pedido?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Rechazar",
        style: "destructive",
        onPress: async () => {
          setUpdatingId(order.id);
          try {
            await api.updateOrderStatus(order.id, "cancelado");
            await load(false);
          } catch (err) {
            Alert.alert("Error", err instanceof ApiError ? err.message : "No se pudo rechazar");
          } finally {
            setUpdatingId(null);
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (restaurant && restaurant.approval_status !== "approved") {
    return (
      <View style={styles.center}>
        <Text style={styles.pendingTitle}>
          {restaurant.approval_status === "pending" ? "Tu comercio está en revisión" : "Tu comercio no está activo"}
        </Text>
        <Text style={styles.pendingText}>
          {restaurant.approval_status === "pending"
            ? "Un administrador debe aprobar tu comercio antes de que puedas recibir pedidos."
            : "Contacta al administrador de la plataforma para más información."}
        </Text>
      </View>
    );
  }

  const activeOrders = orders.filter((o) => ACTIVE_STATUSES.includes(o.status));

  return (
    <FlatList
      style={styles.container}
      data={activeOrders}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={() => load(true)} />}
      ListEmptyComponent={<Text style={styles.empty}>No tienes pedidos activos por ahora.</Text>}
      renderItem={({ item }) => {
        const action = NEXT_ACTION[item.status];
        const itemsCount = item.items.reduce((sum, i) => sum + i.quantity, 0);
        return (
          <TouchableOpacity style={styles.card} onPress={() => router.push(`/pedido/${item.id}`)}>
            <View style={styles.cardHeader}>
              <Text style={styles.orderId}>Pedido #{item.id.slice(0, 8)}</Text>
              <Text style={styles.statusBadge}>{STATUS_LABELS[item.status]}</Text>
            </View>
            <Text style={styles.meta}>
              {itemsCount} producto{itemsCount !== 1 ? "s" : ""} · ${item.total.toLocaleString()}
            </Text>
            <Text style={styles.meta}>Pago: {item.payment_method}</Text>

            <View style={styles.actionsRow}>
              {item.status === "creado" && (
                <TouchableOpacity
                  style={styles.rejectButton}
                  onPress={() => handleReject(item)}
                  disabled={updatingId === item.id}
                >
                  <Text style={styles.rejectText}>Rechazar</Text>
                </TouchableOpacity>
              )}
              {action && (
                <TouchableOpacity
                  style={styles.advanceButton}
                  onPress={() => handleAdvance(item)}
                  disabled={updatingId === item.id}
                >
                  <Text style={styles.advanceText}>
                    {updatingId === item.id ? "Actualizando..." : action.label}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  pendingTitle: { fontSize: 18, fontWeight: "700", color: "#0f172a", textAlign: "center", marginBottom: 8 },
  pendingText: { fontSize: 14, color: "#64748b", textAlign: "center" },
  empty: { textAlign: "center", color: "#94a3b8", marginTop: 40 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  orderId: { fontWeight: "700", fontSize: 15, color: "#0f172a" },
  statusBadge: {
    fontSize: 12,
    fontWeight: "600",
    color: "#2563eb",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: "hidden",
  },
  meta: { fontSize: 13, color: "#64748b", marginTop: 2 },
  actionsRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  rejectButton: {
    borderWidth: 1,
    borderColor: "#dc2626",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  rejectText: { color: "#dc2626", fontWeight: "600", fontSize: 13 },
  advanceButton: {
    flex: 1,
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  advanceText: { color: "#fff", fontWeight: "600", fontSize: 13 },
});
