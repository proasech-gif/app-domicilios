import { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Modal,
  Switch,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { api, Product, Restaurant, ApiError } from "@/lib/api";

export default function MenuScreen() {
  const router = useRouter();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");

  const load = useCallback(async () => {
    try {
      const restaurants = await api.myRestaurants();
      const mine = restaurants[0] || null;
      setRestaurant(mine);
      if (mine) {
        const data = await api.products(mine.id);
        setProducts(data);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleToggleAvailable(product: Product) {
    // Actualización optimista para que se sienta inmediata
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, is_available: !p.is_available } : p))
    );
    try {
      await api.updateProduct(product.id, { is_available: !product.is_available });
    } catch (err) {
      // revertir si falla
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, is_available: product.is_available } : p))
      );
      Alert.alert("Error", err instanceof ApiError ? err.message : "No se pudo actualizar el producto");
    }
  }

  async function handleCreate() {
    if (!restaurant) return;
    const parsedPrice = parseFloat(price.replace(",", "."));
    if (!name.trim() || isNaN(parsedPrice) || parsedPrice <= 0) {
      Alert.alert("Datos incompletos", "Escribe un nombre y un precio válido.");
      return;
    }
    setSaving(true);
    try {
      const created = await api.createProduct(restaurant.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        price: parsedPrice,
      });
      setProducts((prev) => [created, ...prev]);
      setShowModal(false);
      setName("");
      setDescription("");
      setPrice("");
    } catch (err) {
      Alert.alert("Error", err instanceof ApiError ? err.message : "No se pudo crear el producto");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!restaurant) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>No encontramos tu comercio todavía.</Text>
        <TouchableOpacity style={styles.registerButton} onPress={() => router.push("/restaurante/nuevo")}>
          <Text style={styles.registerButtonText}>+ Registrar mi comercio</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<Text style={styles.empty}>Todavía no has agregado productos.</Text>}
        renderItem={({ item }) => (
          <View style={styles.productCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.productName}>{item.name}</Text>
              {item.description ? <Text style={styles.productDesc}>{item.description}</Text> : null}
              <Text style={styles.productPrice}>${item.price.toLocaleString()}</Text>
            </View>
            <View style={styles.switchColumn}>
              <Text style={styles.switchLabel}>{item.is_available ? "Disponible" : "Agotado"}</Text>
              <Switch
                value={item.is_available}
                onValueChange={() => handleToggleAvailable(item)}
                trackColor={{ true: "#2563eb" }}
              />
            </View>
          </View>
        )}
      />

      <TouchableOpacity style={styles.fab} onPress={() => setShowModal(true)}>
        <Text style={styles.fabText}>+ Agregar producto</Text>
      </TouchableOpacity>

      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nuevo producto</Text>
            <TextInput style={styles.input} placeholder="Nombre" value={name} onChangeText={setName} />
            <TextInput
              style={styles.input}
              placeholder="Descripción (opcional)"
              value={description}
              onChangeText={setDescription}
            />
            <TextInput
              style={styles.input}
              placeholder="Precio (ej: 15000)"
              value={price}
              onChangeText={setPrice}
              keyboardType="numeric"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowModal(false)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={handleCreate} disabled={saving}>
                <Text style={styles.modalSaveText}>{saving ? "Guardando..." : "Guardar"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  empty: { textAlign: "center", color: "#94a3b8", marginTop: 40 },
  registerButton: {
    backgroundColor: "#0F766E",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginTop: 20,
  },
  registerButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  productCard: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    alignItems: "center",
  },
  productName: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  productDesc: { fontSize: 13, color: "#64748b", marginTop: 2 },
  productPrice: { fontSize: 14, fontWeight: "600", color: "#2563eb", marginTop: 4 },
  switchColumn: { alignItems: "center", marginLeft: 8 },
  switchLabel: { fontSize: 11, color: "#64748b", marginBottom: 4 },
  fab: {
    backgroundColor: "#2563eb",
    margin: 16,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  fabText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    fontSize: 15,
  },
  modalButtons: { flexDirection: "row", gap: 10, marginTop: 8 },
  modalCancel: { flex: 1, padding: 14, alignItems: "center" },
  modalCancelText: { color: "#64748b", fontWeight: "600" },
  modalSave: { flex: 1, backgroundColor: "#2563eb", borderRadius: 10, padding: 14, alignItems: "center" },
  modalSaveText: { color: "#fff", fontWeight: "700" },
});
