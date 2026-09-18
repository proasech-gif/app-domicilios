import { useCallback, useRef, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { api, Order, OrderStatus, ApiError } from "@/lib/api";

const STATUS_LABELS: Record<OrderStatus, string> = {
  creado: "Creado",
  confirmado_comercio: "Confirmado por el comercio",
  en_preparacion: "En preparación",
  listo_para_recoger: "Listo para recoger",
  domiciliario_asignado: "Asignado a ti",
  en_camino_a_comercio: "Yendo al comercio",
  recogido: "Recogido",
  en_camino_a_cliente: "En camino al cliente",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

const NEXT_ACTION: Partial<Record<OrderStatus, { label: string; next: OrderStatus }>> = {
  domiciliario_asignado: { label: "Voy en camino al comercio", next: "en_camino_a_comercio" },
  en_camino_a_comercio: { label: "Ya recogí el pedido", next: "recogido" },
  recogido: { label: "Voy en camino al cliente", next: "en_camino_a_cliente" },
  en_camino_a_cliente: { label: "Marcar como entregado", next: "entregado" },
};

const ACTIVE_STATUSES: OrderStatus[] = [
  "domiciliario_asignado",
  "en_camino_a_comercio",
  "recogido",
  "en_camino_a_cliente",
];

export default function MisEntregasScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const data = await api.myDeliveries();
      data.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      setOrders(data);
    } catch {
      /* se reintenta */
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(true);
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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#ea580c" />
      </View>
    );
  }

  const active = orders.filter((o) => ACTIVE_STATUSES.includes(o.status));
  const history = orders.filter((o) => !ACTIVE_STATUSES.includes(o.status));

  return (
    <FlatList
      style={styles.container}
      data={[...active, ...history]}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: 16 }}
      ListEmptyComponent={<Text style={styles.empty}>Todavía no has tomado ninguna entrega.</Text>}
      renderItem={({ item }) => {
        const action = NEXT_ACTION[item.status];
        const isActive = ACTIVE_STATUSES.includes(item.status);
        return (
          <TouchableOpacity
            style={[styles.card, !isActive && styles.cardInactive]}
            onPress={() => router.push(`/pedido/${item.id}`)}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.orderId}>Pedido #{item.id.slice(0, 8)}</Text>
              <Text style={styles.statusBadge}>{STATUS_LABELS[item.status]}</Text>
            </View>
            <Text style={styles.meta}>Total: ${item.total.toLocaleString()}</Text>

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
          </TouchableOpacity>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  empty: { textAlign: "center", color: "#94a3b8", marginTop: 40 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cardInactive: { opacity: 0.6 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  orderId: { fontWeight: "700", fontSize: 15, color: "#0f172a" },
  statusBadge: {
    fontSize: 12,
    fontWeight: "600",
    color: "#ea580c",
    backgroundColor: "#fff7ed",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: "hidden",
  },
  meta: { fontSize: 13, color: "#64748b", marginTop: 2 },
  advanceButton: {
    backgroundColor: "#ea580c",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 12,
  },
  advanceText: { color: "#fff", fontWeight: "600", fontSize: 13 },
});
