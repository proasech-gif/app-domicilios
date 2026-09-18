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
import { api, Order, DeliveryPerson, ApiError } from "@/lib/api";

export default function DisponiblesScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<DeliveryPerson | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const me = await api.myProfile();
      setProfile(me);
      if (me.approval_status === "approved" && me.is_available) {
        const data = await api.availableForPickup();
        setOrders(data);
      } else {
        setOrders([]);
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
      intervalRef.current = setInterval(() => load(false), 6000);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }, [load])
  );

  async function handleActivate() {
    try {
      const updated = await api.toggleAvailability();
      setProfile(updated);
      load(false);
    } catch (err) {
      Alert.alert("Error", err instanceof ApiError ? err.message : "No se pudo activar");
    }
  }

  async function handleAccept(order: Order) {
    setAccepting(order.id);
    try {
      await api.assignDelivery(order.id);
      router.push(`/pedido/${order.id}`);
    } catch (err) {
      Alert.alert("No se pudo tomar el pedido", err instanceof ApiError ? err.message : "Intenta de nuevo");
      load(false);
    } finally {
      setAccepting(null);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#ea580c" />
      </View>
    );
  }

  if (!profile || profile.approval_status !== "approved") {
    return (
      <View style={styles.center}>
        <Text style={styles.pendingTitle}>
          {profile?.approval_status === "pending"
            ? "Tu perfil está en revisión"
            : "Tu perfil no está activo"}
        </Text>
        <Text style={styles.pendingText}>
          {profile?.approval_status === "pending"
            ? "Un administrador debe aprobar tu perfil antes de que puedas recibir entregas."
            : "Contacta al administrador de la plataforma para más información."}
        </Text>
      </View>
    );
  }

  if (!profile.is_available) {
    return (
      <View style={styles.center}>
        <Text style={styles.pendingTitle}>Estás desactivado</Text>
        <Text style={styles.pendingText}>Actívate para empezar a ver pedidos disponibles.</Text>
        <TouchableOpacity style={styles.activateButton} onPress={handleActivate}>
          <Text style={styles.activateText}>Activarme ahora</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={orders}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={() => load(true)} />}
      ListEmptyComponent={
        <Text style={styles.empty}>No hay pedidos disponibles por ahora. Se actualiza automáticamente.</Text>
      }
      renderItem={({ item }) => {
        const itemsCount = item.items.reduce((sum, i) => sum + i.quantity, 0);
        return (
          <View style={styles.card}>
            <Text style={styles.orderId}>Pedido #{item.id.slice(0, 8)}</Text>
            <Text style={styles.meta}>
              {itemsCount} producto{itemsCount !== 1 ? "s" : ""} · ${item.total.toLocaleString()}
            </Text>
            <Text style={styles.meta}>Domicilio: ${item.delivery_fee.toLocaleString()}</Text>

            <TouchableOpacity
              style={styles.acceptButton}
              onPress={() => handleAccept(item)}
              disabled={accepting === item.id}
            >
              <Text style={styles.acceptText}>
                {accepting === item.id ? "Tomando pedido..." : "Aceptar pedido"}
              </Text>
            </TouchableOpacity>
          </View>
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
  activateButton: { marginTop: 20, backgroundColor: "#ea580c", borderRadius: 10, paddingVertical: 12, paddingHorizontal: 24 },
  activateText: { color: "#fff", fontWeight: "700" },
  empty: { textAlign: "center", color: "#94a3b8", marginTop: 40 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  orderId: { fontWeight: "700", fontSize: 15, color: "#0f172a" },
  meta: { fontSize: 13, color: "#64748b", marginTop: 2 },
  acceptButton: {
    backgroundColor: "#ea580c",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 12,
  },
  acceptText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
