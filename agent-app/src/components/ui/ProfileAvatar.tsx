import { useState } from "react";
import { Image, Text } from "react-native";
import { useRouter } from "expo-router";
import { IconButton } from "@/components/ui/Button";
import { useProfile } from "@/hooks/useAgent";

export function initialsOf(name?: string): string {
  return (name ?? "")
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * Round profile button used in every tab header. Shows the agent's photo when
 * one exists (and loads), otherwise their initials. Shared so every tab
 * behaves the same — previously each screen re-implemented this and the
 * Wallet tab never rendered the photo at all.
 */
export function ProfileAvatar({ size = 40 }: { size?: number }) {
  const router = useRouter();
  const { data: agent } = useProfile();
  const [failedUri, setFailedUri] = useState<string | null>(null);

  const photo = agent?.documents?.photo;
  const showPhoto = !!photo && failedUri !== photo;

  return (
    <IconButton onPress={() => router.push("/profile")} className="overflow-hidden bg-maroon-700">
      {showPhoto ? (
        <Image source={{ uri: photo }} style={{ width: size, height: size }} resizeMode="cover" onError={() => setFailedUri(photo)} />
      ) : (
        <Text className="font-sans-bold text-xs text-white">{initialsOf(agent?.name)}</Text>
      )}
    </IconButton>
  );
}
