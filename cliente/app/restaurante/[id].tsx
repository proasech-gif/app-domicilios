import { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api, Restaurant, Product, Category } from "@/lib/api";
import { useCart } from "@/lib/cart-context";

export default function RestauranteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const cart = useCart();

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([api.restaurant(id), api.products(id), api.categories(id)])
      .then(([r, p, c]) => {
        setRestaurant(r);
        setProducts(p);
        setCategories(c);
      })
      .finally(() => setLoading(false));
  }, [id]);

  function categoryName(categoryId: string | null) {
    if (!categoryId) return "Otros";
    return categories.find((c) => c.id === categoryId)?.name || "Otros";
  }

  function quantityInCart(productId: string) {
    return cart.items.find((i) => i.product.id === productId)?.quantity || 0;
  }

  if (loading || !restaurant) {
    return (
      <View style={styles.center}>
        <Text>Cargando...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={products.filter((p) => p.is_available)}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={styles.header}>
            {restaurant.cover_photo_url && (
              <Image source={{ uri: restaurant.cover_photo_url }} style={styles.cover} />
            )}
            <Text style={styles.title}>{restaurant.name}</Text>
            {restaurant.description && <Text style={styles.description}>{restaurant.description}</Text>}
            <Text style={styles.address}>{restaurant.address_line}</Text>
          </View>
        }
        renderItem={({ item, index }) => {
          const showCategoryHeader =
            index === 0 ||
            products.filter((p) => p.is_available)[index - 1]?.category_id !== item.category_id;
          const qty = quantityInCart(item.id);
          return (
            <View>
              {showCategoryHeader && <Text style={styles.categoryHeader}>{categoryName(item.category_id)}</Text>}
              <View style={styles.productRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.productName}>{item.name}</Text>
                  {item.description && (
                    <Text style={styles.productDescription} numberOfLines={2}>
                      {item.description}
                    </Text>
                  )}
                  <Text style={styles.productPrice}>${item.price.toLocaleString()}</Text>
                </View>
                {qty > 0 ? (
                  <View style={styles.stepper}>
                    <TouchableOpacity
                      style={styles.stepperButton}
                      onPress={() => cart.decreaseItem(item.id)}
                    >
                      <Text style={styles.stepperText}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.stepperCount}>{qty}</Text>
                    <TouchableOpacity
                      style={styles.stepperButton}
                      onPress={() => cart.addItem(restaurant.id, item)}
                    >
                      <Text style={styles.stepperText}>+</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => cart.addItem(restaurant.id, item)}
                  >
                    <Text style={styles.addButtonText}>Agregar</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        }}
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      {cart.itemCount > 0 && (
        <TouchableOpacity style={styles.cartBar} onPress={() => router.push("/carrito")}>
          <Text style={styles.cartBarText}>
            Ver carrito ({cart.itemCount}) · ${cart.total.toLocaleString()}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { padding: 16 },
  cover: { width: "100%", height: 140, borderRadius: 12, marginBottom: 12, backgroundColor: "#eee" },
  title: { fontSize: 22, fontWeight: "700", color: "#0f172a" },
  description: { fontSize: 14, color: "#64748b", marginTop: 4 },
  address: { fontSize: 13, color: "#94a3b8", marginTop: 4 },
  categoryHeader: {
    fontSize: 13,
    fontWeight: "700",
    color: "#16a34a",
    textTransform: "uppercase",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
  },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  productName: { fontSize: 15, fontWeight: "600", color: "#0f172a" },
  productDescription: { fontSize: 12, color: "#94a3b8", marginTop: 2 },
  productPrice: { fontSize: 14, fontWeight: "600", color: "#16a34a", marginTop: 4 },
  addButton: {
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#16a34a",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  addButtonText: { color: "#16a34a", fontWeight: "600", fontSize: 13 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepperButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#16a34a",
    justifyContent: "center",
    alignItems: "center",
  },
  stepperText: { color: "#fff", fontSize: 18, fontWeight: "700", lineHeight: 20 },
  stepperCount: { fontSize: 15, fontWeight: "600", minWidth: 16, textAlign: "center" },
  cartBar: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: "#16a34a",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  cartBarText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
