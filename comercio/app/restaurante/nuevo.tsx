import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { api, ApiError, BusinessType } from "@/lib/api";

const BUSINESS_TYPES: { value: BusinessType; label: string; emoji: string }[] = [
  { value: "restaurante", label: "Restaurante", emoji: "🍴" },
  { value: "supermercado", label: "Supermercado", emoji: "🛒" },
  { value: "farmacia", label: "Farmacia", emoji: "💊" },
  { value: "tienda", label: "Tienda", emoji: "🏬" },
  { value: "mascota", label: "Mascotas", emoji: "🐾" },
  { value: "belleza", label: "Belleza", emoji: "💅" },
];

export default function NuevoComercioScreen() {
  const router = useRouter();
  const [businessType, setBusinessType] = useState<BusinessType>("restaurante");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    setError(null);
    if (!name.trim() || !addressLine.trim()) {
      setError("El nombre y la dirección son obligatorios.");
      return;
    }
    setLoading(true);
    try {
      // NOTA: por ahora se usa una ubicación aproximada de referencia. En una fase
      // futura esto se reemplaza por selección real en mapa o geocodificación.
      await api.createRestaurant({
        name: name.trim(),
        business_type: businessType,
        description: description.trim() || undefined,
        address_line: addressLine.trim(),
        latitude: 4.6097,
        longitude: -74.0817,
      });
      router.replace("/(tabs)");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear el comercio");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Cuéntanos de tu negocio</Text>
        <Text style={styles.subtitle}>
          Un administrador revisará y aprobará tu comercio antes de que puedas recibir pedidos.
        </Text>

        <Text style={styles.label}>Tipo de negocio</Text>
        <View style={styles.typeGrid}>
          {BUSINESS_TYPES.map((t) => (
            <TouchableOpacity
              key={t.value}
              style={[styles.typeOption, businessType === t.value && styles.typeOptionActive]}
              onPress={() => setBusinessType(t.value)}
            >
              <Text style={styles.typeEmoji}>{t.emoji}</Text>
              <Text style={[styles.typeLabel, businessType === t.value && styles.typeLabelActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TextInput
          style={styles.input}
          placeholder="Nombre del comercio"
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Descripción breve (opcional)"
          value={description}
          onChangeText={setDescription}
          multiline
        />
        <TextInput
          style={styles.input}
          placeholder="Dirección completa"
          value={addressLine}
          onChangeText={setAddressLine}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity style={styles.button} onPress={handleCreate} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? "Creando..." : "Crear comercio"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  scroll: { flexGrow: 1, padding: 24, paddingTop: 16 },
  title: { fontSize: 22, fontWeight: "bold", color: "#0f172a", marginBottom: 6 },
  subtitle: { fontSize: 14, color: "#64748b", marginBottom: 24 },
  label: { fontSize: 14, fontWeight: "600", color: "#334155", marginBottom: 8 },
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  typeOption: {
    flexBasis: "47%",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  typeOptionActive: { borderColor: "#0F766E", backgroundColor: "#ECFDF5" },
  typeEmoji: { fontSize: 26, marginBottom: 4 },
  typeLabel: { fontSize: 13, color: "#64748b" },
  typeLabelActive: { color: "#0F766E", fontWeight: "700" },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    fontSize: 16,
  },
  textArea: { minHeight: 80, textAlignVertical: "top" },
  button: {
    backgroundColor: "#0F766E",
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  error: { color: "#dc2626", marginBottom: 8, textAlign: "center" },
});
