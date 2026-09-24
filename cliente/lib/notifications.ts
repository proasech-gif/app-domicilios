import { Platform } from "react-native";
import * as Device from "expo-device";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { registerPushToken } from "./api";

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

const Notifications = isExpoGo ? null : (require("expo-notifications") as typeof import("expo-notifications"));

if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function registerForPushNotificationsAsync(): Promise<void> {
  if (!Notifications) {
    console.log("Notificaciones push desactivadas dentro de Expo Go en Android (limitacion de Expo desde SDK 53). El resto de la app sigue funcionando normal.");
    return;
  }

  if (!Device.isDevice) {
    console.log("Las notificaciones push requieren un celular fisico.");
    return;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") {
    console.log("El usuario no concedio permiso de notificaciones.");
    return;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? (Constants as any).easConfig?.projectId;

  if (!projectId) {
    console.log("Falta el projectId de EAS en app.json.");
    return;
  }

  try {
    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
    await registerPushToken(tokenResponse.data);
  } catch (err) {
    console.log("No se pudo registrar el push token:", err);
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }
}
