import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { isAuthenticated } from "@/lib/api";

export default function Index() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    (async () => {
      const authed = await isAuthenticated();
      router.replace(authed ? "/(tabs)" : "/login");
      setChecked(true);
    })();
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      {!checked && <ActivityIndicator size="large" color="#16a34a" />}
    </View>
  );
}
