import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Image,
  TextInput,
  Alert,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { api, Restaurant, BusinessType } from "@/lib/api";

const CATEGORIES: { key: BusinessType | "mas1" | "mas2" | "mas3" | "mas"; label: string; emoji: string; color: string; businessType?: BusinessType }[] = [
  { key: "restaurante", label: "Restaurantes", emoji: "🍴", color: "#FF6A00", businessType: "restaurante" },
  { key: "supermercado", label: "Supermercados", emoji: "🛒", color: "#16A34A", businessType: "supermercado" },
  { key: "farmacia", label: "Farmacias", emoji: "💊", color: "#2563EB", businessType: "farmacia" },
  { key: "tienda", label: "Tiendas", emoji: "🏬", color: "#2563EB", businessType: "tienda" },
  { key: "mas1", label: "Envíos", emoji: "📦", color: "#FF6A00" },
  { key: "mas2", label: "Transporte", emoji: "🚗", color: "#16A34A" },
  { key: "mas3", label: "Mascotas", emoji: "🐾", color: "#DB2777" },
  { key: "mas", label: "Más", emoji: "⋯", color: "#7C3AED" },
];

const CATEGORY_LABELS: Record<BusinessType, string> = {
  restaurante: "Restaurantes",
  supermercado: "Supermercados",
  farmacia: "Farmacias",
  tienda: "Tiendas",
};

export default function ComerciosScreen() {
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<BusinessType | null>(null);

  const load = useCallback(async (category: BusinessType | null) => {
    try {
      setError(null);
      const data = await api.restaurants(category || undefined);
      setRestaurants(data);
    } catch {
      setError("No se pudieron cargar los comercios. Revisa tu conexión.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(activeCategory);
    }, [load, activeCategory])
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return restaurants;
    const q = search.trim().toLowerCase();
    return restaurants.filter((r) => r.name.toLowerCase().includes(q));
  }, [restaurants, search]);

  function handleCategoryPress(cat: (typeof CATEGORIES)[number]) {
    if (!cat.businessType) {
      Alert.alert("Muy pronto", `${cat.label} estará disponible en una próxima actualización.`);
      return;
    }
    setLoading(true);
    setActiveCategory((prev) => (prev === cat.businessType ? null : cat.businessType!));
  }

  return (
    <FlatList
      style={styles.container}
      data={filtered}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      contentContainerStyle={{ paddingBottom: 24 }}
      ListHeaderComponent={
        <View>
          <View style={styles.header}>
            <Text style={styles.logo}>🛵 DomiYa</Text>
          </View>

          <View style={styles.searchBox}>
            <Text style={{ fontSize: 16 }}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="¿Qué quieres pedir hoy?"
              value={search}
              onChangeText={setSearch}
            />
          </View>

          <View style={styles.categoriesGrid}>
            {CATEGORIES.map((cat) => {
              const isActive = !!cat.businessType && activeCategory === cat.businessType;
              return (
                <TouchableOpacity key={cat.key} style={styles.categoryItem} onPress={() => handleCategoryPress(cat)}>
                  <View
                    style={[
                      styles.categoryIcon,
                      { backgroundColor: cat.color + "22" },
                      isActive && { backgroundColor: cat.color, transform: [{ scale: 1.05 }] },
                    ]}
                  >
                    <Text style={{ fontSize: 22 }}>{cat.emoji}</Text>
                  </View>
                  <Text style={[styles.categoryLabel, isActive && { color: cat.color, fontWeight: "700" }]} numberOfLines={1}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.banner}>
            <Text style={styles.bannerTitle}>Todo lo que necesitas,{"\n"}en un solo lugar</Text>
            <Text style={styles.bannerSubtitle}>Rápido · Seguro · Cerca de ti</Text>
          </View>

          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>
              {activeCategory ? CATEGORY_LABELS[activeCategory] : "Restaurantes cerca de ti"}
            </Text>
            {activeCategory && (
              <TouchableOpacity onPress={() => { setLoading(true); setActiveCategory(null); }}>
                <Text style={styles.clearFilter}>Ver todos ✕</Text>
              </TouchableOpacity>
            )}
          </View>
          {error && <Text style={styles.error}>{error}</Text>}
        </View>
      }
      ListEmptyComponent={
        !loading ? <Text style={styles.empty}>No hay comercios disponibles todavía.</Text> : null
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          style={[styles.card, !item.is_open && styles.cardClosed]}
          onPress={() => router.push(`/restaurante/${item.id}`)}
          disabled={!item.is_open}
        >
          {item.logo_url ? (
            <Image source={{ uri: item.logo_url }} style={styles.logoImg} />
          ) : (
            <View style={[styles.logoImg, styles.logoPlaceholder]}>
              <Text style={{ fontSize: 24 }}>🍴</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.address} numberOfLines={1}>
              {item.address_line}
            </Text>
            {!item.is_open && <Text style={styles.closedBadge}>Cerrado ahora</Text>}
          </View>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  logo: { fontSize: 22, fontWeight: "800", color: "#FF6A00" },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    marginHorizontal: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15 },
  categoriesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    paddingTop: 20,
  },
  categoryItem: { width: "25%", alignItems: "center", marginBottom: 16 },
  categoryIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  categoryLabel: { fontSize: 11, color: "#334155", textAlign: "center" },
  banner: {
    backgroundColor: "#0B3D3A",
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  bannerTitle: { color: "#fff", fontSize: 18, fontWeight: "700", lineHeight: 24 },
  bannerSubtitle: { color: "#A7F3D0", fontSize: 13, marginTop: 8 },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  clearFilter: { fontSize: 13, color: "#FF6A00", fontWeight: "600" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    marginHorizontal: 16,
    gap: 12,
  },
  cardClosed: { opacity: 0.5 },
  logoImg: { width: 56, height: 56, borderRadius: 10, backgroundColor: "#eee" },
  logoPlaceholder: { justifyContent: "center", alignItems: "center" },
  name: { fontSize: 16, fontWeight: "600", color: "#0f172a" },
  address: { fontSize: 13, color: "#64748b", marginTop: 2 },
  closedBadge: { fontSize: 12, color: "#dc2626", marginTop: 4, fontWeight: "500" },
  empty: { textAlign: "center", color: "#94a3b8", marginTop: 40 },
  error: { color: "#dc2626", textAlign: "center", padding: 12 },
});
