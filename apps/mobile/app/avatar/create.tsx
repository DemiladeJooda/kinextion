/**
 * Avatar creator — Ready Player Me, embedded as a WebView.
 *
 * A stylized, face-matched avatar (selfie in, cartoon-ish 3D character out),
 * not a real body scan. Saves just the avatar id to the profile; the actual
 * 3D/2D render is fetched by id wherever it's shown.
 */

import { useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import WebView, { type WebViewMessageEvent } from "react-native-webview";

import { Notice, Txt } from "../../components/ui";
import { useApi } from "../../hooks/useApi";
import { avatarCreatorUrl, parseRpmEvent, RPM_SUBSCRIBE_MESSAGE } from "../../lib/avatar";
import { color, space } from "../../theme";

export default function CreateAvatarScreen() {
  const api = useApi();
  const router = useRouter();
  const webviewRef = useRef<WebView>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onLoad = () => {
    webviewRef.current?.postMessage(RPM_SUBSCRIBE_MESSAGE);
  };

  const onMessage = async (message: WebViewMessageEvent) => {
    const event = parseRpmEvent(message.nativeEvent.data);
    if (event?.eventName !== "v1.avatar.exported" || !event.data?.avatarId) return;

    setSaving(true);
    setError(null);
    try {
      await api.updateProfile({ avatarId: event.data.avatarId });
      router.back();
    } catch {
      setError("Your avatar was created, but couldn't be saved to your profile. Try again.");
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }} edges={["bottom"]}>
      <Stack.Screen
        options={{
          title: "Create your avatar",
          headerStyle: { backgroundColor: color.bg },
          headerShadowVisible: false,
          headerTintColor: color.text,
          headerBackTitle: "Back",
        }}
      />
      {error ? (
        <View style={{ padding: space.lg }}>
          <Notice>{error}</Notice>
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <WebView
          ref={webviewRef}
          source={{ uri: avatarCreatorUrl() }}
          onLoad={onLoad}
          onMessage={(m) => void onMessage(m)}
          style={{ flex: 1 }}
        />
        {saving ? (
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: color.scrim,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ActivityIndicator color={color.green} />
            <Txt variant="small" c={color.textMuted} style={{ marginTop: space.md }}>
              Saving your avatar…
            </Txt>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
