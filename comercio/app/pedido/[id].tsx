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
import { api, getToken, wsUrl, Order, OrderStatus, ChatMessage, ApiError } from "@/lib/api";

const STATUS_LABELS: Record<OrderStatus, string> = {
  creado: "Pedido creado",
  confirmado_comercio: "Confirmado por ti",
  en_preparacion: "En preparación",
  listo_para_recoger: "Listo para recoger",
  domiciliario_asignado: "Domiciliario asignado",
  en_camino_a_comercio: "Domiciliario yendo a recogerlo",
  recogido: "Recogido",
  en_camino_a_cliente: "En camino al cliente",
  entregado: "¡Entregado!",
  cancelado: "Cancelado",
};

const NEXT_ACTION: Partial<Record<OrderStatus, { label: string; next: OrderStatus }>> = {
  creado: { label: "Confirmar pedido", next: "confirmado_comercio" },
  confirmado_comercio: { label: "Empezar preparación", next: "en_preparacion" },
  en_preparacion: { label: "Marcar listo para recoger", next: "listo_para_recoger" },
};

export default function PedidoDetalleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState("");
  const [updating, setUpdating] = useState(false);
  const ws = useRef<WebSocket | null>(null);

  const loadOrder = useCallback(async () => {
    if (!id) return;
    try {
      const [orderData, messagesData] = await Promise.all([api.order(id), api.orderMessages(id)]);
      setOrder(orderData);
      setMessages(messagesData);
    } catch {
      /* se reintenta con el websocket */
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

  async function handleAdvance() {
    if (!order) return;
    const action = NEXT_ACTION[order.status];
    if (!action) return;
    setUpdating(true);
    try {
      const updated = await api.updateOrderStatus(order.id, action.next);
      setOrder(updated);
    } catch (err) {
      Alert.alert("No se pudo actualizar", err instanceof ApiError ? err.message : "Intenta de nuevo");
    } finally {
      setUpdating(false);
    }
  }

  if (!order) {
    return (
      <View style={styles.center}>
        <Text>Cargando pedido...</Text>
      </View>
    );
  }

  const action = NEXT_ACTION[order.status];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={styles.statusBox}>
        <Text style={styles.statusText}>{STATUS_LABELS[order.status] || order.status}</Text>
        <Text style={styles.total}>Total: ${order.total.toLocaleString()}</Text>

        <FlatList
          data={order.items}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <Text style={styles.itemLine}>
              {item.quantity}x producto — ${(item.unit_price * item.quantity).toLocaleString()}
              {item.notes ? ` (${item.notes})` : ""}
            </Text>
          )}
        />

        {action && (
          <TouchableOpacity style={styles.advanceButton} onPress={handleAdvance} disabled={updating}>
            <Text style={styles.advanceText}>{updating ? "Actualizando..." : action.label}</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.chatTitle}>Chat con el cliente</Text>
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
  total: { marginTop: 6, fontSize: 14, color: "#64748b" },
  itemLine: { fontSize: 13, color: "#334155", marginTop: 6 },
  advanceButton: {
    backgroundColor: "#2563eb",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginTop: 14,
  },
  advanceText: { color: "#fff", fontWeight: "700" },
  chatTitle: { fontSize: 13, fontWeight: "600", color: "#64748b", paddingHorizontal: 16, paddingTop: 12 },
  messageBubble: {
    backgroundColor: "#eff6ff",
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
    backgroundColor: "#2563eb",
    borderRadius: 20,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  sendButtonText: { color: "#fff", fontWeight: "600" },
});
