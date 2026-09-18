import { useState } from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet, Alert, ActivityIndicator } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { uploadImage } from "@/lib/api";

interface PhotoPickerProps {
  label: string;
  helpText?: string;
  value: string | null; // URL ya subida (o null si no se ha tomado)
  onChange: (url: string | null) => void;
  preferFrontCamera?: boolean; // útil para selfies
}

export function PhotoPicker({ label, helpText, value, onChange, preferFrontCamera }: PhotoPickerProps) {
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function pickAndUpload(fromCamera: boolean) {
    try {
      const permission = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Permiso necesario",
          fromCamera
            ? "Necesitamos permiso de la cámara para tomar la foto."
            : "Necesitamos permiso para acceder a tus fotos."
        );
        return;
      }

      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({
            quality: 0.7,
            allowsEditing: true,
            cameraType: preferFrontCamera ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            quality: 0.7,
            allowsEditing: true,
          });

      if (result.canceled || !result.assets?.[0]) return;

      const uri = result.assets[0].uri;
      setLocalPreview(uri);
      setUploading(true);
      const url = await uploadImage(uri);
      onChange(url);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Error desconocido";
      Alert.alert("No se pudo subir la foto", detail);
      setLocalPreview(null);
      onChange(null);
    } finally {
      setUploading(false);
    }
  }

  const previewUri = localPreview || value;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      {helpText ? <Text style={styles.helpText}>{helpText}</Text> : null}

      {previewUri ? (
        <View style={styles.previewWrap}>
          <Image source={{ uri: previewUri }} style={styles.preview} />
          {uploading && (
            <View style={styles.uploadingOverlay}>
              <ActivityIndicator color="#fff" />
            </View>
          )}
          {!uploading && value && <Text style={styles.readyBadge}>✓ Lista</Text>}
        </View>
      ) : null}

      <View style={styles.buttonsRow}>
        <TouchableOpacity style={styles.pickButton} onPress={() => pickAndUpload(true)} disabled={uploading}>
          <Text style={styles.pickButtonText}>📷 Tomar foto</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.pickButton} onPress={() => pickAndUpload(false)} disabled={uploading}>
          <Text style={styles.pickButtonText}>🖼️ Elegir de galería</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: "600", color: "#334155", marginBottom: 2 },
  helpText: { fontSize: 12, color: "#94a3b8", marginBottom: 8 },
  previewWrap: { marginBottom: 10, alignSelf: "flex-start" },
  preview: { width: 120, height: 120, borderRadius: 10, backgroundColor: "#f1f5f9" },
  uploadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  readyBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    backgroundColor: "#16a34a",
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: "hidden",
  },
  buttonsRow: { flexDirection: "row", gap: 8 },
  pickButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ea580c",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  pickButtonText: { color: "#ea580c", fontWeight: "600", fontSize: 12 },
});
