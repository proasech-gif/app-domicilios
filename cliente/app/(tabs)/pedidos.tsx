import { useCallback, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { api, Order, ApiError } from "@/lib/api";

const STATUS_LABELS: Record<string, string> = {
  creado: "Creado",
  confirmado_comercio: "Confirmado por el comercio",
  en_preparacion: "En preparación",
  listo_para_recoger: "Listo para recoger",
  domiciliario_asignado: "Domiciliario asignado",
  en_camino_a_comercio: "Domiciliario en camino al comercio",
  recogido: "Pedido recogido",
  en_camino_a_cliente: "En camino a tu dirección",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

export default function PedidosScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await api.myOrders();
      setOrders(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudieron cargar tus pedidos. Revisa tu conexión.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <View style={styles.container}>
      {error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          !loading ? <Text style={styles.empty}>Todavía no has hecho ningún pedido.</Text> : null
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => router.push(`/pedido/${item.id}`)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.status}>{STATUS_LABELS[item.status] || item.status}</Text>
              <Text style={styles.date}>{new Date(item.created_at).toLocaleString()}</Text>
            </View>
            <Text style={styles.total}>${item.total.toLocaleString()}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  status: { fontSize: 15, fontWeight: "600", color: "#0f172a" },
  date: { fontSize: 12, color: "#64748b", marginTop: 4 },
  total: { fontSize: 15, fontWeight: "700", color: "#16a34a" },
  empty: { textAlign: "center", color: "#94a3b8", marginTop: 40 },
  error: { color: "#dc2626", textAlign: "center", padding: 12 },
});
