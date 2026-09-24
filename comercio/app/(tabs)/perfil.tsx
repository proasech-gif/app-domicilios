import { useCallback, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Switch, Alert, Image, Modal, TextInput } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import * as ImagePicker from "expo-image-picker";
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
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [showBonusModal, setShowBonusModal] = useState(false);
  const [bonusCode, setBonusCode] = useState("");
  const [redeemingBonus, setRedeemingBonus] = useState(false);

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

  async function handleLogout() {
    await clearTokens();
    router.replace("/login");
  }

  async function pickAndUploadImage(target: "logo_url" | "cover_photo_url") {
    if (!restaurant) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permiso necesario", "Necesitamos acceso a tus fotos para poder subir la imagen.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: target === "logo_url" ? [1, 1] : [16, 9],
      quality: 0.6,
      base64: true,
    });

    if (result.canceled || !result.assets?.[0]?.base64) return;

    const asset = result.assets[0];
    const setUploading = target === "logo_url" ? setUploadingLogo : setUploadingCover;
    setUploading(true);
    try {
      const contentType = asset.mimeType || "image/jpeg";
      const { url } = await api.uploadImageBase64(`${target}.jpg`, contentType, asset.base64);
      const updated = await api.updateRestaurant(restaurant.id, { [target]: url });
      setRestaurant(updated);
    } catch (err) {
      Alert.alert("Error", err instanceof ApiError ? err.message : "No se pudo subir la imagen");
    } finally {
      setUploading(false);
    }
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

      {!restaurant && (
        <TouchableOpacity
          style={styles.registerButton}
          onPress={() => router.push("/restaurante/nuevo")}
        >
          <Text style={styles.registerButtonText}>+ Registrar mi comercio</Text>
        </TouchableOpacity>
      )}

      {restaurant && (
        <View style={styles.restaurantCard}>
          <View style={styles.coverRow}>
            {restaurant.cover_photo_url ? (
              <Image source={{ uri: restaurant.cover_photo_url }} style={styles.coverImg} />
            ) : (
              <View style={[styles.coverImg, styles.imgPlaceholder]}>
                <Text style={{ fontSize: 22 }}>🖼️</Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.changePhotoBtn}
              onPress={() => pickAndUploadImage("cover_photo_url")}
              disabled={uploadingCover}
            >
              {uploadingCover ? (
                <ActivityIndicator size="small" color="#2563eb" />
              ) : (
                <Text style={styles.changePhotoText}>
                  {restaurant.cover_photo_url ? "Cambiar foto de portada" : "Agregar foto de portada"}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.logoRow}>
            {restaurant.logo_url ? (
              <Image source={{ uri: restaurant.logo_url }} style={styles.logoImg} />
            ) : (
              <View style={[styles.logoImg, styles.imgPlaceholder]}>
                <Text style={{ fontSize: 20 }}>🏪</Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.changePhotoBtn}
              onPress={() => pickAndUploadImage("logo_url")}
              disabled={uploadingLogo}
            >
              {uploadingLogo ? (
                <ActivityIndicator size="small" color="#2563eb" />
              ) : (
                <Text style={styles.changePhotoText}>{restaurant.logo_url ? "Cambiar logo" : "Agregar logo"}</Text>
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.restaurantName}>{restaurant.name}</Text>
          <Text style={styles.restaurantAddress}>{restaurant.address_line}</Text>

          <TouchableOpacity
            style={styles.promoLinkButton}
            onPress={() => router.push({ pathname: "/promociones", params: { restaurantId: restaurant.id } })}
          >
            <Text style={styles.promoLinkText}>🎟️ Mis cupones de descuento</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.bonusLinkButton} onPress={() => setShowBonusModal(true)}>
            <Text style={styles.bonusLinkText}>🎁 Canjear un bono</Text>
          </TouchableOpacity>
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
    backgroundColor: "#2563eb",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  avatarText: { color: "#fff", fontSize: 32, fontWeight: "bold" },
  name: { fontSize: 20, fontWeight: "700", color: "#0f172a" },
  email: { fontSize: 14, color: "#64748b", marginTop: 4 },
  registerButton: {
    backgroundColor: "#0F766E",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginTop: 20,
  },
  registerButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
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
  promoLinkButton: {
    marginTop: 12,
    backgroundColor: "#f0fdf4",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  promoLinkText: { color: "#16a34a", fontWeight: "600", fontSize: 14 },
  bonusLinkButton: {
    marginTop: 8,
    backgroundColor: "#fef9c3",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
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
  modalSaveButton: { flex: 1, backgroundColor: "#16a34a", borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  modalSaveText: { color: "#fff", fontWeight: "700" },
  coverRow: { alignItems: "center", marginBottom: 12 },
  coverImg: { width: "100%", height: 90, borderRadius: 10, backgroundColor: "#f1f5f9" },
  logoRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  logoImg: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#f1f5f9", marginRight: 12 },
  imgPlaceholder: { justifyContent: "center", alignItems: "center" },
  changePhotoBtn: { marginTop: 8 },
  changePhotoText: { color: "#2563eb", fontSize: 13, fontWeight: "600" },
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
