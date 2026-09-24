import { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api, ApiError, Promotion } from "@/lib/api";

export default function PromocionesScreen() {
  const router = useRouter();
  const { restaurantId } = useLocalSearchParams<{ restaurantId: string }>();

  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [discountValue, setDiscountValue] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!restaurantId) return;
    setLoading(true);
    try {
      setPromotions(await api.myPromotions(restaurantId));
    } catch {
      /* sin cupones aún, o error de red */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [restaurantId]);

  async function handleToggle(promo: Promotion) {
    setBusyId(promo.id);
    try {
      const updated = await api.togglePromotion(promo.id);
      setPromotions((prev) => prev.map((p) => (p.id === promo.id ? updated : p)));
    } catch (err) {
      Alert.alert("Error", err instanceof ApiError ? err.message : "No se pudo actualizar el cupón");
    } finally {
      setBusyId(null);
    }
  }

  async function handleCreate() {
    if (!restaurantId) return;
    if (!code.trim() || !discountValue.trim()) {
      Alert.alert("Falta información", "Escribe el código y el valor del descuento.");
      return;
    }
    setSaving(true);
    try {
      const created = await api.createPromotion(restaurantId, {
        code: code.trim(),
        description: description.trim() || undefined,
        discount_type: discountType,
        discount_value: parseFloat(discountValue),
      });
      setPromotions((prev) => [created, ...prev]);
      setShowModal(false);
      setCode("");
      setDescription("");
      setDiscountValue("");
    } catch (err) {
      Alert.alert("Error", err instanceof ApiError ? err.message : "No se pudo crear el cupón");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Mis cupones</Text>
        <TouchableOpacity onPress={() => setShowModal(true)}>
          <Text style={styles.addText}>+ Nuevo</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={promotions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <Text style={styles.empty}>Todavía no tienes cupones. Crea el primero con el botón "+ Nuevo".</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.code}>{item.code}</Text>
                <Text style={[styles.status, item.is_active ? styles.statusOn : styles.statusOff]}>
                  {item.is_active ? "Activo" : "Inactivo"}
                </Text>
              </View>
              <Text style={styles.discount}>
                {item.discount_type === "percentage" ? `${item.discount_value}% de descuento` : `$${item.discount_value.toLocaleString()} de descuento`}
              </Text>
              {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
              <TouchableOpacity
                style={styles.toggleButton}
                onPress={() => handleToggle(item)}
                disabled={busyId === item.id}
              >
                <Text style={styles.toggleButtonText}>{item.is_active ? "Desactivar" : "Activar"}</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nuevo cupón</Text>

            <Text style={styles.label}>Código</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: BIENVENIDA10"
              autoCapitalize="characters"
              value={code}
              onChangeText={setCode}
            />

            <Text style={styles.label}>Descripción (opcional)</Text>
            <TextInput style={styles.input} value={description} onChangeText={setDescription} />

            <Text style={styles.label}>Tipo de descuento</Text>
            <View style={styles.typeRow}>
              <TouchableOpacity
                style={[styles.typeButton, discountType === "percentage" && styles.typeButtonActive]}
                onPress={() => setDiscountType("percentage")}
              >
                <Text style={discountType === "percentage" ? styles.typeTextActive : styles.typeText}>Porcentaje (%)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeButton, discountType === "fixed" && styles.typeButtonActive]}
                onPress={() => setDiscountType("fixed")}
              >
                <Text style={discountType === "fixed" ? styles.typeTextActive : styles.typeText}>Monto fijo ($)</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Valor</Text>
            <TextInput
              style={styles.input}
              placeholder={discountType === "percentage" ? "Ej: 15" : "Ej: 3000"}
              keyboardType="numeric"
              value={discountValue}
              onChangeText={setDiscountValue}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowModal(false)}>
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleCreate} disabled={saving}>
                <Text style={styles.saveButtonText}>{saving ? "Guardando..." : "Crear cupón"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    paddingTop: 50,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  backText: { color: "#64748b", fontSize: 14 },
  title: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  addText: { color: "#16a34a", fontWeight: "700", fontSize: 14 },
  empty: { textAlign: "center", color: "#94a3b8", marginTop: 40 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 12 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  code: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  status: { fontSize: 11, fontWeight: "600", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusOn: { backgroundColor: "#f0fdf4", color: "#16a34a" },
  statusOff: { backgroundColor: "#f1f5f9", color: "#94a3b8" },
  discount: { fontSize: 14, color: "#16a34a", fontWeight: "600", marginTop: 4 },
  description: { fontSize: 13, color: "#64748b", marginTop: 2 },
  toggleButton: {
    marginTop: 10,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  toggleButtonText: { fontSize: 12, color: "#334155", fontWeight: "600" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: "#fff", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 12, color: "#0f172a" },
  label: { fontSize: 13, color: "#64748b", marginBottom: 4, marginTop: 10 },
  input: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  typeRow: { flexDirection: "row", gap: 8 },
  typeButton: { flex: 1, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  typeButtonActive: { backgroundColor: "#16a34a", borderColor: "#16a34a" },
  typeText: { color: "#334155", fontSize: 13, fontWeight: "600" },
  typeTextActive: { color: "#fff", fontSize: 13, fontWeight: "600" },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 20 },
  cancelButton: { flex: 1, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  cancelButtonText: { color: "#334155", fontWeight: "600" },
  saveButton: { flex: 1, backgroundColor: "#16a34a", borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  saveButtonText: { color: "#fff", fontWeight: "700" },
});
