import { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { api, Wallet, ApiError } from "@/lib/api";

function formatCOP(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString("es-CO")}`;
}

export default function BilleteraScreen() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [amount, setAmount] = useState("");
  const [bankInfo, setBankInfo] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.wallet();
      setWallet(data);
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

  async function handleRequestWithdrawal() {
    const pesos = parseFloat(amount.replace(",", "."));
    if (isNaN(pesos) || pesos <= 0) {
      Alert.alert("Monto inválido", "Escribe un monto válido en pesos.");
      return;
    }
    if (!bankInfo.trim()) {
      Alert.alert("Falta información", "Escribe el banco, tipo de cuenta y número de cuenta.");
      return;
    }
    setSaving(true);
    try {
      await api.requestWithdrawal({ amount_cents: Math.round(pesos * 100), bank_info: bankInfo.trim() });
      setShowModal(false);
      setAmount("");
      setBankInfo("");
      Alert.alert("Solicitud enviada", "Un administrador revisará y procesará tu retiro pronto.");
      load();
    } catch (err) {
      Alert.alert("Error", err instanceof ApiError ? err.message : "No se pudo enviar la solicitud");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#ea580c" />
      </View>
    );
  }

  const balance = wallet?.balance_cents || 0;
  const inDebt = balance < 0;

  return (
    <View style={styles.container}>
      <View style={[styles.balanceCard, inDebt && styles.balanceCardDebt]}>
        <Text style={styles.balanceLabel}>{inDebt ? "Debes a la plataforma" : "Saldo disponible"}</Text>
        <Text style={[styles.balanceValue, inDebt && styles.balanceValueDebt]}>
          {formatCOP(Math.abs(balance))}
        </Text>
        {inDebt ? (
          <Text style={styles.debtExplanation}>
            Recibiste efectivo de clientes que le pertenecía al comercio. Se descuenta
            automáticamente de tus próximos domicilios pagados en línea, o puedes saldarlo
            transfiriendo directamente — contacta al administrador.
          </Text>
        ) : (
          <TouchableOpacity style={styles.withdrawButton} onPress={() => setShowModal(true)}>
            <Text style={styles.withdrawButtonText}>Solicitar retiro</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.historyTitle}>Movimientos</Text>
      <FlatList
        data={wallet?.transactions || []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
        ListEmptyComponent={<Text style={styles.empty}>Todavía no tienes movimientos.</Text>}
        renderItem={({ item }) => (
          <View style={styles.txRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.txDesc}>{item.description || (item.type === "credito" ? "Abono" : "Retiro")}</Text>
              <Text style={styles.txDate}>{new Date(item.created_at).toLocaleString()}</Text>
            </View>
            <Text style={[styles.txAmount, item.type === "credito" ? styles.txCredit : styles.txDebit]}>
              {item.type === "credito" ? "+" : "-"}
              {formatCOP(item.amount_cents)}
            </Text>
          </View>
        )}
      />

      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Solicitar retiro</Text>
            <TextInput
              style={styles.input}
              placeholder="Monto en pesos (ej: 50000)"
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Banco, tipo de cuenta y número de cuenta"
              value={bankInfo}
              onChangeText={setBankInfo}
              multiline
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowModal(false)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={handleRequestWithdrawal} disabled={saving}>
                <Text style={styles.modalSaveText}>{saving ? "Enviando..." : "Enviar solicitud"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  balanceCard: { backgroundColor: "#ea580c", margin: 16, borderRadius: 16, padding: 20, alignItems: "center" },
  balanceCardDebt: { backgroundColor: "#b91c1c" },
  balanceLabel: { color: "#fed7aa", fontSize: 13, fontWeight: "600" },
  balanceValue: { color: "#fff", fontSize: 32, fontWeight: "800", marginTop: 4 },
  balanceValueDebt: { color: "#fff" },
  debtExplanation: { color: "#fee2e2", fontSize: 12, textAlign: "center", marginTop: 10, lineHeight: 17 },
  withdrawButton: { backgroundColor: "#fff", borderRadius: 10, paddingVertical: 10, paddingHorizontal: 24, marginTop: 16 },
  withdrawButtonText: { color: "#ea580c", fontWeight: "700" },
  historyTitle: { fontSize: 14, fontWeight: "700", color: "#334155", paddingHorizontal: 16, marginBottom: 8 },
  empty: { textAlign: "center", color: "#94a3b8", marginTop: 20 },
  txRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  txDesc: { fontSize: 13, fontWeight: "600", color: "#0f172a" },
  txDate: { fontSize: 11, color: "#94a3b8", marginTop: 2 },
  txAmount: { fontWeight: "700", fontSize: 14 },
  txCredit: { color: "#16a34a" },
  txDebit: { color: "#dc2626" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 16 },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 12, marginBottom: 10, fontSize: 15 },
  textArea: { minHeight: 70, textAlignVertical: "top" },
  modalButtons: { flexDirection: "row", gap: 10, marginTop: 8 },
  modalCancel: { flex: 1, padding: 14, alignItems: "center" },
  modalCancelText: { color: "#64748b", fontWeight: "600" },
  modalSave: { flex: 1, backgroundColor: "#ea580c", borderRadius: 10, padding: 14, alignItems: "center" },
  modalSaveText: { color: "#fff", fontWeight: "700" },
});
