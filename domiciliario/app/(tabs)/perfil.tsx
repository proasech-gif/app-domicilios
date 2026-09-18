import { useCallback, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Switch, Alert } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { api, clearTokens, User, DeliveryPerson, ApiError } from "@/lib/api";

const APPROVAL_LABELS: Record<string, string> = {
  pending: "Pendiente de aprobación",
  approved: "Aprobado",
  rejected: "Rechazado",
  suspended: "Suspendido",
};

const VEHICLE_LABELS: Record<string, string> = {
  moto: "Moto 🏍️",
  bicicleta: "Bicicleta 🚲",
  carro: "Carro 🚗",
  a_pie: "A pie 🚶",
};

export default function PerfilScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<DeliveryPerson | null>(null);
  const [toggling, setToggling] = useState(false);

  const load = useCallback(async () => {
    try {
      const [me, prof] = await Promise.all([api.me(), api.myProfile()]);
      setUser(me);
      setProfile(prof);
    } catch {
      /* ignore */
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleToggleAvailable() {
    if (!profile) return;
    setToggling(true);
    try {
      const updated = await api.toggleAvailability();
      setProfile(updated);
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
        <ActivityIndicator color="#ea580c" />
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

      {profile && (
        <View style={styles.profileCard}>
          <Text style={styles.vehicle}>{VEHICLE_LABELS[profile.vehicle_type]}</Text>
          {profile.vehicle_plate ? <Text style={styles.plate}>Placa: {profile.vehicle_plate}</Text> : null}
          <Text
            style={[
              styles.approvalBadge,
              profile.approval_status === "approved" ? styles.approvalOk : styles.approvalPending,
            ]}
          >
            {APPROVAL_LABELS[profile.approval_status]}
          </Text>

          {profile.approval_status === "approved" && (
            <View style={styles.availableRow}>
              <Text style={styles.availableLabel}>
                {profile.is_available ? "Disponible para recibir pedidos" : "Desactivado"}
              </Text>
              <Switch
                value={profile.is_available}
                onValueChange={handleToggleAvailable}
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
    backgroundColor: "#ea580c",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  avatarText: { color: "#fff", fontSize: 32, fontWeight: "bold" },
  name: { fontSize: 20, fontWeight: "700", color: "#0f172a" },
  email: { fontSize: 14, color: "#64748b", marginTop: 4 },
  profileCard: {
    width: "100%",
    marginTop: 28,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
  },
  vehicle: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  plate: { fontSize: 13, color: "#64748b", marginTop: 2 },
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
  availableRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  availableLabel: { fontSize: 13, fontWeight: "600", color: "#0f172a", flex: 1, marginRight: 8 },
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
