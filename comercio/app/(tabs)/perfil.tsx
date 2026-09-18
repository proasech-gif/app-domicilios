import { useCallback, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Switch, Alert } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { api, clearTokens, User, Restaurant, ApiError } from "@/lib/api";

const APPROVAL_LABELS: Record<string, string> = {
  pending: "Pendiente de aprobación",
  approved: "Aprobado",
  rejected: "Rechazado",
  suspended: "Suspendido",
};

export default function PerfilScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [toggling, setToggling] = useState(false);

  const load = useCallback(async () => {
    try {
      const [me, restaurants] = await Promise.all([api.me(), api.myRestaurants()]);
      setUser(me);
      setRestaurant(restaurants[0] || null);
    } catch {
      /* ignore */
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleToggleOpen() {
    if (!restaurant) return;
    setToggling(true);
    try {
      const updated = await api.toggleOpen(restaurant.id);
      setRestaurant(updated);
    } catch (err) {
      Alert.alert("Error", err instanceof ApiError ? err.message : "No se pudo cambiar el estado");
    } finally {
      setToggling(false);
    }
  }

  async function handleLogout() {
    await clearTokens();
    router.replace("/login");
  }

  if (!user) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{user.full_name.charAt(0).toUpperCase()}</Text>
      </View>
      <Text style={styles.name}>{user.full_name}</Text>
      <Text style={styles.email}>{user.email}</Text>

      {restaurant && (
        <View style={styles.restaurantCard}>
          <Text style={styles.restaurantName}>{restaurant.name}</Text>
          <Text style={styles.restaurantAddress}>{restaurant.address_line}</Text>
          <Text
            style={[
              styles.approvalBadge,
              restaurant.approval_status === "approved" ? styles.approvalOk : styles.approvalPending,
            ]}
          >
            {APPROVAL_LABELS[restaurant.approval_status]}
          </Text>

          {restaurant.approval_status === "approved" && (
            <View style={styles.openRow}>
              <Text style={styles.openLabel}>{restaurant.is_open ? "Comercio abierto" : "Comercio cerrado"}</Text>
              <Switch
                value={restaurant.is_open}
                onValueChange={handleToggleOpen}
                disabled={toggling}
                trackColor={{ true: "#16a34a" }}
              />
            </View>
          )}
        </View>
      )}

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", padding: 24, backgroundColor: "#fff", paddingTop: 48 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#2563eb",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  avatarText: { color: "#fff", fontSize: 32, fontWeight: "bold" },
  name: { fontSize: 20, fontWeight: "700", color: "#0f172a" },
  email: { fontSize: 14, color: "#64748b", marginTop: 4 },
  restaurantCard: {
    width: "100%",
    marginTop: 28,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
  },
  restaurantName: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  restaurantAddress: { fontSize: 13, color: "#64748b", marginTop: 2 },
  approvalBadge: {
    marginTop: 10,
    alignSelf: "flex-start",
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: "hidden",
  },
  approvalOk: { color: "#16a34a", backgroundColor: "#f0fdf4" },
  approvalPending: { color: "#b45309", backgroundColor: "#fffbeb" },
  openRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  openLabel: { fontSize: 14, fontWeight: "600", color: "#0f172a" },
  logoutButton: {
    marginTop: 32,
    borderWidth: 1,
    borderColor: "#dc2626",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  logoutText: { color: "#dc2626", fontWeight: "600" },
});
