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
import { api, VehicleType, ApiError } from "@/lib/api";
import { PhotoPicker } from "@/components/PhotoPicker";

const VEHICLES: { value: VehicleType; label: string; emoji: string }[] = [
  { value: "moto", label: "Moto", emoji: "🏍️" },
  { value: "bicicleta", label: "Bicicleta", emoji: "🚲" },
  { value: "carro", label: "Carro", emoji: "🚗" },
  { value: "a_pie", label: "A pie", emoji: "🚶" },
];

export default function PerfilNuevoScreen() {
  const router = useRouter();
  const [vehicle, setVehicle] = useState<VehicleType>("moto");
  const [plate, setPlate] = useState("");
  const [idDocumentUrl, setIdDocumentUrl] = useState<string | null>(null);
  const [vehicleDocumentUrl, setVehicleDocumentUrl] = useState<string | null>(null);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const needsVehicleDoc = vehicle === "moto" || vehicle === "carro";

  async function handleCreate() {
    setError(null);
    if (!idDocumentUrl) {
      setError("Falta la foto de tu documento de identidad.");
      return;
    }
    if (needsVehicleDoc && !vehicleDocumentUrl) {
      setError("Falta la foto del documento de tu vehículo (SOAT / tarjeta de propiedad).");
      return;
    }
    if (!selfieUrl) {
      setError("Falta tu foto de perfil (selfie).");
      return;
    }
    setLoading(true);
    try {
      await api.createProfile({
        vehicle_type: vehicle,
        vehicle_plate: plate.trim() || undefined,
        id_document_url: idDocumentUrl,
        vehicle_document_url: vehicleDocumentUrl || undefined,
        selfie_url: selfieUrl,
      });
      router.replace("/(tabs)");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear tu perfil");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Cuéntanos cómo te movilizas</Text>
        <Text style={styles.subtitle}>
          Un administrador revisará y aprobará tu perfil antes de que puedas recibir pedidos.
        </Text>

        <Text style={styles.label}>Tipo de vehículo</Text>
        <View style={styles.vehicleRow}>
          {VEHICLES.map((v) => (
            <TouchableOpacity
              key={v.value}
              style={[styles.vehicleOption, vehicle === v.value && styles.vehicleOptionActive]}
              onPress={() => setVehicle(v.value)}
            >
              <Text style={styles.vehicleEmoji}>{v.emoji}</Text>
              <Text style={[styles.vehicleLabel, vehicle === v.value && styles.vehicleLabelActive]}>
                {v.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {needsVehicleDoc && (
          <TextInput
            style={styles.input}
            placeholder="Placa del vehículo"
            value={plate}
            onChangeText={setPlate}
            autoCapitalize="characters"
          />
        )}

        <PhotoPicker
          label="Foto de tu documento de identidad"
          helpText="Cédula, tarjeta de identidad o documento equivalente, legible."
          value={idDocumentUrl}
          onChange={setIdDocumentUrl}
        />

        {needsVehicleDoc && (
          <PhotoPicker
            label="Foto del documento del vehículo"
            helpText="SOAT o tarjeta de propiedad de tu moto/carro."
            value={vehicleDocumentUrl}
            onChange={setVehicleDocumentUrl}
          />
        )}

        <PhotoPicker
          label="Tu foto de perfil (selfie)"
          helpText="Puedes tomarte una selfie ahora o subir una foto que ya tengas en tu celular."
          value={selfieUrl}
          onChange={setSelfieUrl}
          preferFrontCamera
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity style={styles.button} onPress={handleCreate} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? "Creando..." : "Crear perfil"}</Text>
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
  vehicleRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  vehicleOption: {
    flexBasis: "47%",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  vehicleOptionActive: { borderColor: "#ea580c", backgroundColor: "#fff7ed" },
  vehicleEmoji: { fontSize: 28, marginBottom: 4 },
  vehicleLabel: { fontSize: 13, color: "#64748b" },
  vehicleLabelActive: { color: "#ea580c", fontWeight: "700" },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#ea580c",
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  error: { color: "#dc2626", marginBottom: 8, textAlign: "center" },
});
