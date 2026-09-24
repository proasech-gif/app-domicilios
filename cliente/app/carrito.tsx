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
} from "react-native";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCart } from "@/lib/cart-context";
import { api, Address, ApiError } from "@/lib/api";

const PAYMENT_METHODS: { value: "efectivo" | "tarjeta" | "billetera_digital"; label: string }[] = [
  { value: "efectivo", label: "Efectivo" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "billetera_digital", label: "Billetera digital" },
];

export default function CarritoScreen() {
  const router = useRouter();
  const cart = useCart();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"efectivo" | "tarjeta" | "billetera_digital">(
    "efectivo"
  );
  const [placing, setPlacing] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);

  // Cupón de descuento
  const [promoCode, setPromoCode] = useState("");
  const [checkingPromo, setCheckingPromo] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string;
    discount_type: "percentage" | "fixed";
    discount_value: number;
  } | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);

  // Domicilio real (según distancia y hora) y propina
  const [deliveryFee, setDeliveryFee] = useState<number | null>(null);
  const [loadingFee, setLoadingFee] = useState(false);
  const [tipAmount, setTipAmount] = useState(0);
  const [customTip, setCustomTip] = useState("");

  useEffect(() => {
    if (!cart.restaurantId || !selectedAddressId) {
      setDeliveryFee(null);
      return;
    }
    setLoadingFee(true);
    api
      .deliveryFeePreview(cart.restaurantId, selectedAddressId)
      .then((res) => setDeliveryFee(res.delivery_fee))
      .catch(() => setDeliveryFee(null))
      .finally(() => setLoadingFee(false));
  }, [cart.restaurantId, selectedAddressId]);

  useEffect(() => {
    if (paymentMethod === "efectivo") {
      setTipAmount(0);
      setCustomTip("");
    }
  }, [paymentMethod]);

  // Formulario de nueva dirección
  const [newLabel, setNewLabel] = useState("");
  const [newAddressLine, setNewAddressLine] = useState("");
  const [newDetails, setNewDetails] = useState("");
  const [savingAddress, setSavingAddress] = useState(false);

  useEffect(() => {
    loadAddresses();
  }, []);

  async function loadAddresses() {
    try {
      const data = await api.addresses();
      setAddresses(data);
      const def = data.find((a) => a.is_default) || data[0];
      if (def) setSelectedAddressId(def.id);
    } catch {
      /* sin direcciones aún */
    }
  }

  async function handleSaveAddress() {
    if (!newAddressLine.trim()) {
      Alert.alert("Falta información", "Escribe la dirección completa.");
      return;
    }
    setSavingAddress(true);
    try {
      // NOTA: por ahora se usa una ubicación aproximada fija (0,0 no es válido,
      // se usa un punto de referencia genérico). En una fase futura esto se
      // reemplaza por selección real en mapa o geocodificación de la dirección.
      const created = await api.createAddress({
        label: newLabel || "Mi dirección",
        address_line: newAddressLine,
        details: newDetails || undefined,
        latitude: 4.6097,
        longitude: -74.0817,
        is_default: addresses.length === 0,
      });
      setAddresses((prev) => [created, ...prev]);
      setSelectedAddressId(created.id);
      setShowAddressModal(false);
      setNewLabel("");
      setNewAddressLine("");
      setNewDetails("");
    } catch (err) {
      Alert.alert("Error", err instanceof ApiError ? err.message : "No se pudo guardar la dirección");
    } finally {
      setSavingAddress(false);
    }
  }

  async function handleApplyPromo() {
    if (!cart.restaurantId || !promoCode.trim()) return;
    setPromoError(null);
    setCheckingPromo(true);
    try {
      const result = await api.validatePromotion(cart.restaurantId, promoCode.trim());
      if (result.valid && result.discount_type && result.discount_value != null) {
        setAppliedPromo({
          code: result.code || promoCode.trim().toUpperCase(),
          discount_type: result.discount_type,
          discount_value: result.discount_value,
        });
      } else {
        setAppliedPromo(null);
        setPromoError(result.reason || "Cupón no válido");
      }
    } catch (err) {
      setAppliedPromo(null);
      setPromoError(err instanceof ApiError ? err.message : "No se pudo validar el cupón");
    } finally {
      setCheckingPromo(false);
    }
  }

  const discountAmount = appliedPromo
    ? appliedPromo.discount_type === "percentage"
      ? Math.round((cart.total * appliedPromo.discount_value) / 100)
      : Math.min(appliedPromo.discount_value, cart.total + (deliveryFee ?? 0))
    : 0;

  async function handlePlaceOrder() {
    if (!cart.restaurantId) return;
    if (!selectedAddressId) {
      Alert.alert("Falta dirección", "Agrega una dirección de entrega antes de continuar.");
      return;
    }
    setPlacing(true);
    try {
      const order = await api.createOrder({
        restaurant_id: cart.restaurantId,
        delivery_address_id: selectedAddressId,
        payment_method: paymentMethod,
        items: cart.items.map((i) => ({
          product_id: i.product.id,
          quantity: i.quantity,
          notes: i.notes,
        })),
        promo_code: appliedPromo?.code,
        tip_amount: tipAmount,
      });

      if (paymentMethod === "efectivo") {
        cart.clear();
        router.replace(`/pedido/${order.id}`);
        return;
      }

      // Pago online: abrimos el checkout de Wompi y esperamos a que el cliente termine.
      const { payment_url } = await api.createPaymentLink(order.id);
      await WebBrowser.openBrowserAsync(payment_url);

      // Wompi confirma por webhook al backend; aquí solo consultamos unas veces
      // para darle feedback inmediato al usuario apenas cierre el navegador.
      let finalStatus = "pendiente";
      for (let i = 0; i < 5; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const { status: paymentStatus } = await api.paymentStatus(order.id);
        finalStatus = paymentStatus;
        if (paymentStatus !== "pendiente") break;
      }

      cart.clear();
      if (finalStatus === "rechazado" || finalStatus === "error") {
        Alert.alert(
          "Pago no confirmado",
          "El pago no se completó. Puedes ver el pedido e intentar pagar de nuevo desde ahí."
        );
      }
      router.replace(`/pedido/${order.id}`);
    } catch (err) {
      Alert.alert("No se pudo crear el pedido", err instanceof ApiError ? err.message : "Intenta de nuevo");
    } finally {
      setPlacing(false);
    }
  }

  const effectiveDeliveryFee = deliveryFee ?? 0;

  return (
    <View style={styles.container}>
      <FlatList
        data={cart.items}
        keyExtractor={(item) => item.product.id}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<Text style={styles.empty}>Tu carrito está vacío.</Text>}
        renderItem={({ item }) => (
          <View style={styles.itemRow}>
            <Text style={styles.itemQty}>{item.quantity}x</Text>
            <Text style={styles.itemName}>{item.product.name}</Text>
            <Text style={styles.itemPrice}>${(item.product.price * item.quantity).toLocaleString()}</Text>
          </View>
        )}
        ListFooterComponent={
          cart.items.length > 0 ? (
            <View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>${cart.total.toLocaleString()}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Domicilio</Text>
                <Text style={styles.summaryValue}>
                  {!selectedAddressId
                    ? "Elige una dirección"
                    : loadingFee
                      ? "Calculando..."
                      : `$${effectiveDeliveryFee.toLocaleString()}`}
                </Text>
              </View>

              <Text style={styles.sectionTitle}>Cupón de descuento</Text>
              {appliedPromo ? (
                <View style={styles.promoAppliedRow}>
                  <Text style={styles.promoAppliedText}>✓ Cupón "{appliedPromo.code}" aplicado</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setAppliedPromo(null);
                      setPromoCode("");
                      setPromoError(null);
                    }}
                  >
                    <Text style={styles.promoRemoveText}>Quitar</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.promoRow}>
                  <TextInput
                    style={styles.promoInput}
                    placeholder="Código de cupón"
                    autoCapitalize="characters"
                    value={promoCode}
                    onChangeText={setPromoCode}
                  />
                  <TouchableOpacity
                    style={styles.promoButton}
                    onPress={handleApplyPromo}
                    disabled={checkingPromo || !promoCode.trim()}
                  >
                    <Text style={styles.promoButtonText}>{checkingPromo ? "..." : "Aplicar"}</Text>
                  </TouchableOpacity>
                </View>
              )}
              {promoError && <Text style={styles.promoErrorText}>{promoError}</Text>}

              {discountAmount > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Descuento</Text>
                  <Text style={styles.discountValue}>-${discountAmount.toLocaleString()}</Text>
                </View>
              )}

              <View style={[styles.summaryRow, { marginTop: 4 }]}>
                <Text style={styles.totalLabel}>Total estimado</Text>
                <Text style={styles.totalValue}>
                  ${(cart.total + effectiveDeliveryFee - discountAmount + tipAmount).toLocaleString()}
                </Text>
              </View>

              <Text style={styles.sectionTitle}>Dirección de entrega</Text>
              {addresses.map((addr) => (
                <TouchableOpacity
                  key={addr.id}
                  style={[styles.addressCard, selectedAddressId === addr.id && styles.addressCardSelected]}
                  onPress={() => setSelectedAddressId(addr.id)}
                >
                  <Text style={styles.addressLabel}>{addr.label || "Dirección"}</Text>
                  <Text style={styles.addressLine}>{addr.address_line}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.addAddressButton} onPress={() => setShowAddressModal(true)}>
                <Text style={styles.addAddressText}>+ Agregar nueva dirección</Text>
              </TouchableOpacity>

              <Text style={styles.sectionTitle}>Método de pago</Text>
              <View style={styles.paymentRow}>
                {PAYMENT_METHODS.map((pm) => (
                  <TouchableOpacity
                    key={pm.value}
                    style={[styles.paymentChip, paymentMethod === pm.value && styles.paymentChipSelected]}
                    onPress={() => setPaymentMethod(pm.value)}
                  >
                    <Text
                      style={[
                        styles.paymentChipText,
                        paymentMethod === pm.value && styles.paymentChipTextSelected,
                      ]}
                    >
                      {pm.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {paymentMethod !== "efectivo" && (
                <>
                  <Text style={styles.sectionTitle}>Propina para el domiciliario (opcional)</Text>
                  <View style={styles.tipRow}>
                    {[0, 2000, 3000, 5000].map((amount) => (
                      <TouchableOpacity
                        key={amount}
                        style={[styles.tipChip, tipAmount === amount && !customTip && styles.tipChipSelected]}
                        onPress={() => {
                          setTipAmount(amount);
                          setCustomTip("");
                        }}
                      >
                        <Text
                          style={[
                            styles.tipChipText,
                            tipAmount === amount && !customTip && styles.tipChipTextSelected,
                          ]}
                        >
                          {amount === 0 ? "Sin propina" : `$${amount.toLocaleString()}`}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TextInput
                    style={styles.tipCustomInput}
                    placeholder="Otro monto"
                    keyboardType="numeric"
                    value={customTip}
                    onChangeText={(text) => {
                      setCustomTip(text);
                      const parsed = parseInt(text, 10);
                      setTipAmount(Number.isFinite(parsed) && parsed > 0 ? parsed : 0);
                    }}
                  />
                </>
              )}
            </View>
          ) : null
        }
      />

      {cart.items.length > 0 && (
        <TouchableOpacity style={styles.placeOrderButton} onPress={handlePlaceOrder} disabled={placing}>
          <Text style={styles.placeOrderText}>{placing ? "Enviando pedido..." : "Confirmar pedido"}</Text>
        </TouchableOpacity>
      )}

      <Modal visible={showAddressModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nueva dirección</Text>
            <TextInput
              style={styles.input}
              placeholder="Nombre (ej: Casa, Trabajo)"
              value={newLabel}
              onChangeText={setNewLabel}
            />
            <TextInput
              style={styles.input}
              placeholder="Dirección completa"
              value={newAddressLine}
              onChangeText={setNewAddressLine}
            />
            <TextInput
              style={styles.input}
              placeholder="Detalles (apto, torre, indicaciones)"
              value={newDetails}
              onChangeText={setNewDetails}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowAddressModal(false)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={handleSaveAddress} disabled={savingAddress}>
                <Text style={styles.modalSaveText}>{savingAddress ? "Guardando..." : "Guardar"}</Text>
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
  empty: { textAlign: "center", color: "#94a3b8", marginTop: 40 },
  itemRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, gap: 8 },
  itemQty: { fontWeight: "700", color: "#16a34a", width: 30 },
  itemName: { flex: 1, fontSize: 14, color: "#0f172a" },
  itemPrice: { fontSize: 14, fontWeight: "600" },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  summaryLabel: { color: "#64748b" },
  summaryValue: { color: "#0f172a" },
  totalLabel: { fontSize: 16, fontWeight: "700" },
  totalValue: { fontSize: 16, fontWeight: "700", color: "#16a34a" },
  promoRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  promoInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  promoButton: { backgroundColor: "#16a34a", borderRadius: 8, paddingHorizontal: 16, justifyContent: "center" },
  promoButtonText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  promoAppliedRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f0fdf4",
    borderRadius: 8,
    padding: 10,
  },
  promoAppliedText: { color: "#16a34a", fontWeight: "600", fontSize: 13 },
  promoRemoveText: { color: "#64748b", fontSize: 13 },
  promoErrorText: { color: "#dc2626", fontSize: 12, marginTop: 4 },
  tipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  tipChip: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  tipChipSelected: { backgroundColor: "#16a34a", borderColor: "#16a34a" },
  tipChipText: { fontSize: 13, color: "#334155", fontWeight: "600" },
  tipChipTextSelected: { color: "#fff" },
  tipCustomInput: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  discountValue: { fontSize: 14, fontWeight: "600", color: "#dc2626" },
  sectionTitle: { fontSize: 15, fontWeight: "700", marginTop: 24, marginBottom: 10 },
  addressCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  addressCardSelected: { borderColor: "#16a34a", backgroundColor: "#f0fdf4" },
  addressLabel: { fontWeight: "600", fontSize: 14 },
  addressLine: { fontSize: 13, color: "#64748b", marginTop: 2 },
  addAddressButton: { paddingVertical: 8 },
  addAddressText: { color: "#16a34a", fontWeight: "600" },
  paymentRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  paymentChip: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  paymentChipSelected: { backgroundColor: "#16a34a", borderColor: "#16a34a" },
  paymentChipText: { color: "#0f172a", fontSize: 13 },
  paymentChipTextSelected: { color: "#fff" },
  placeOrderButton: {
    backgroundColor: "#16a34a",
    margin: 16,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  placeOrderText: { color: "#fff", fontWeight: "700", fontSize: 16 },
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
  modalSave: { flex: 1, backgroundColor: "#16a34a", borderRadius: 10, padding: 14, alignItems: "center" },
  modalSaveText: { color: "#fff", fontWeight: "700" },
});
