import { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useLocalSearchParams, useFocusEffect } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { api, getToken, wsUrl, Order, ChatMessage, ApiError } from "@/lib/api";

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pendiente: "Pago pendiente",
  aprobado: "Pago confirmado",
  rechazado: "Pago rechazado",
  error: "Error en el pago",
  contra_entrega: "Pago contra entrega (efectivo)",
};

const STATUS_LABELS: Record<string, string> = {
  creado: "Pedido creado",
  confirmado_comercio: "Confirmado por el comercio",
  en_preparacion: "En preparación",
  listo_para_recoger: "Listo para recoger",
  domiciliario_asignado: "Domiciliario asignado",
  en_camino_a_comercio: "Domiciliario yendo por tu pedido",
  recogido: "Pedido recogido",
  en_camino_a_cliente: "En camino a tu dirección",
  entregado: "¡Entregado!",
  cancelado: "Cancelado",
};

const STATUS_ORDER = [
  "creado",
  "confirmado_comercio",
  "en_preparacion",
  "listo_para_recoger",
  "domiciliario_asignado",
  "en_camino_a_comercio",
  "recogido",
  "en_camino_a_cliente",
  "entregado",
];

export default function PedidoDetalleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState("");
  const [retryingPayment, setRetryingPayment] = useState(false);
  const ws = useRef<WebSocket | null>(null);

  const loadOrder = useCallback(async () => {
    if (!id) return;
    try {
      const [orderData, messagesData] = await Promise.all([api.order(id), api.orderMessages(id)]);
      setOrder(orderData);
      setMessages(messagesData);
    } catch {
      /* se reintenta con el polling/websocket */
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadOrder();
    }, [loadOrder])
  );

  useEffect(() => {
    if (!id) return;
    let active = true;

    (async () => {
      const token = await getToken();
      if (!token || !active) return;

      const socket = new WebSocket(wsUrl(`/ws/orders/${id}`, token));
      ws.current = socket;

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.event === "order.status_changed") {
            setOrder((prev) => (prev ? { ...prev, status: data.payload.status } : prev));
          } else if (data.event === "chat.message") {
            setMessages((prev) => [
              ...prev,
              {
                id: data.payload.id,
                order_id: id,
                sender_id: data.payload.sender_id,
                message: data.payload.message,
                sent_at: data.payload.sent_at,
              },
            ]);
          }
        } catch {
          /* mensaje no reconocido, se ignora */
        }
      };
    })();

    return () => {
      active = false;
      ws.current?.close();
    };
  }, [id]);

  function sendMessage() {
    if (!messageText.trim() || !ws.current) return;
    ws.current.send(JSON.stringify({ type: "chat.message", message: messageText.trim() }));
    setMessageText("");
  }

  async function handleRetryPayment() {
    if (!order) return;
    setRetryingPayment(true);
    try {
      const { payment_url } = await api.createPaymentLink(order.id);
      await WebBrowser.openBrowserAsync(payment_url);

      let finalStatus = order.payment_status;
      for (let i = 0; i < 5; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const { status: paymentStatus } = await api.paymentStatus(order.id);
        finalStatus = paymentStatus;
        if (paymentStatus !== "pendiente") break;
      }
      setOrder((prev) => (prev ? { ...prev, payment_status: finalStatus } : prev));
      if (finalStatus === "rechazado" || finalStatus === "error") {
        Alert.alert("Pago no confirmado", "El pago no se completó. Puedes intentarlo de nuevo.");
      }
    } catch (err) {
      Alert.alert("Error", err instanceof ApiError ? err.message : "No se pudo procesar el pago");
    } finally {
      setRetryingPayment(false);
    }
  }

  if (!order) {
    return (
      <View style={styles.center}>
        <Text>Cargando pedido...</Text>
      </View>
    );
  }

  const currentStepIndex = STATUS_ORDER.indexOf(order.status);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={styles.statusBox}>
        <Text style={styles.statusText}>{STATUS_LABELS[order.status] || order.status}</Text>
        {order.status !== "cancelado" && (
          <View style={styles.progressBar}>
            {STATUS_ORDER.map((s, i) => (
              <View
                key={s}
                style={[styles.progressSegment, i <= currentStepIndex && styles.progressSegmentActive]}
              />
            ))}
          </View>
        )}
        <Text style={styles.total}>Total: ${order.total.toLocaleString()}</Text>

        {order.payment_method !== "efectivo" && (
          <View style={styles.paymentRow}>
            <Text
              style={[
                styles.paymentBadge,
                order.payment_status === "aprobado" ? styles.paymentOk : styles.paymentPending,
              ]}
            >
              {PAYMENT_STATUS_LABELS[order.payment_status] || order.payment_status}
            </Text>
            {(order.payment_status === "pendiente" || order.payment_status === "rechazado" || order.payment_status === "error") && (
              <TouchableOpacity
                style={styles.retryButton}
                onPress={handleRetryPayment}
                disabled={retryingPayment}
              >
                <Text style={styles.retryButtonText}>
                  {retryingPayment ? "Procesando..." : "Reintentar pago"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      <Text style={styles.chatTitle}>Chat con el comercio / domiciliario</Text>
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 12, flexGrow: 1 }}
        renderItem={({ item }) => (
          <View style={styles.messageBubble}>
            <Text style={styles.messageText}>{item.message}</Text>
            <Text style={styles.messageTime}>{new Date(item.sent_at).toLocaleTimeString()}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Todavía no hay mensajes.</Text>}
      />

      <View style={styles.inputRow}>
        <TextInput
          style={styles.messageInput}
          placeholder="Escribe un mensaje..."
          value={messageText}
          onChangeText={setMessageText}
          onSubmitEditing={sendMessage}
        />
        <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
          <Text style={styles.sendButtonText}>Enviar</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  statusBox: { padding: 16, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  statusText: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  progressBar: { flexDirection: "row", gap: 4, marginTop: 12 },
  progressSegment: { flex: 1, height: 6, borderRadius: 3, backgroundColor: "#e2e8f0" },
  progressSegmentActive: { backgroundColor: "#16a34a" },
  total: { marginTop: 10, fontSize: 14, color: "#64748b" },
  paymentRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
  paymentBadge: {
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: "hidden",
  },
  paymentOk: { color: "#16a34a", backgroundColor: "#f0fdf4" },
  paymentPending: { color: "#b45309", backgroundColor: "#fffbeb" },
  retryButton: { backgroundColor: "#16a34a", borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 },
  retryButtonText: { color: "#fff", fontWeight: "600", fontSize: 12 },
  chatTitle: { fontSize: 13, fontWeight: "600", color: "#64748b", paddingHorizontal: 16, paddingTop: 12 },
  messageBubble: {
    backgroundColor: "#f0fdf4",
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    alignSelf: "flex-start",
    maxWidth: "80%",
  },
  messageText: { fontSize: 14, color: "#0f172a" },
  messageTime: { fontSize: 10, color: "#94a3b8", marginTop: 4 },
  empty: { textAlign: "center", color: "#94a3b8", marginTop: 20 },
  inputRow: {
    flexDirection: "row",
    padding: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  messageInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sendButton: {
    backgroundColor: "#16a34a",
    borderRadius: 20,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  sendButtonText: { color: "#fff", fontWeight: "600" },
});
