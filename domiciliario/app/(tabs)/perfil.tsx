import { useCallback, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Switch, Alert, Modal, TextInput } from "react-native";
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
  const [showBonusModal, setShowBonusModal] = useState(false);
  const [bonusCode, setBonusCode] = useState("");
  const [redeemingBonus, setRedeemingBonus] = useState(false);

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

  async function handleRedeemBonus() {
    if (!bonusCode.trim()) return;
    setRedeemingBonus(true);
    try {
      const result = await api.redeemBonus(bonusCode.trim());
      if (result.valid && result.amount_credited_cents != null) {
        Alert.alert("¡Bono canjeado!", `Se acreditaron $${(result.amount_credited_cents / 100).toLocaleString()} a tu billetera.`);
        setShowBonusModal(false);
        setBonusCode("");
      } else {
        Alert.alert("No se pudo canjear", result.reason || "Código no válido");
      }
    } catch (err) {
      Alert.alert("Error", err instanceof ApiError ? err.message : "No se pudo canjear el bono");
    } finally {
      setRedeemingBonus(false);
    }
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

      <TouchableOpacity style={styles.bonusLinkButton} onPress={() => setShowBonusModal(true)}>
        <Text style={styles.bonusLinkText}>🎁 Canjear un bono</Text>
      </TouchableOpacity>

      <Modal visible={showBonusModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Canjear un bono</Text>
            <Text style={styles.modalSubtitle}>
              Escribe el código de bono que te dio la plataforma. Se acredita directo a tu billetera.
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Código del bono"
              autoCapitalize="characters"
              value={bonusCode}
              onChangeText={setBonusCode}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowBonusModal(false);
                  setBonusCode("");
                }}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={handleRedeemBonus}
                disabled={redeemingBonus || !bonusCode.trim()}
              >
                <Text style={styles.modalSaveText}>{redeemingBonus ? "Canjeando..." : "Canjear"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  bonusLinkButton: {
    marginTop: 16,
    backgroundColor: "#fef9c3",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  bonusLinkText: { color: "#a16207", fontWeight: "600", fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: "#fff", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 6, color: "#0f172a" },
  modalSubtitle: { fontSize: 13, color: "#64748b", marginBottom: 14 },
  modalInput: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 20 },
  modalCancelButton: { flex: 1, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  modalCancelText: { color: "#334155", fontWeight: "600" },
  modalSaveButton: { flex: 1, backgroundColor: "#ea580c", borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  modalSaveText: { color: "#fff", fontWeight: "700" },
});
