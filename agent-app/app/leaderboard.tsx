import { View, Text, Image, FlatList, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Trophy, Crown, Sparkles, ChevronUp } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppHeader } from "@/components/ui/AppHeader";
import { Card } from "@/components/ui/Card";
import { HeroCard, Eyebrow, SectionHeader, Pill } from "@/components/ui/HeroCard";
import { initialsOf } from "@/components/ui/ProfileAvatar";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/States";
import { useLeaderboard, useProfile } from "@/hooks/useAgent";
import { formatCurrency } from "@/utils/currency";
import { colors, gradients } from "@/theme/colors";
import { getErrorMessage } from "@/api/client";
import type { LeaderboardEntry } from "@/types/api";

type PodiumRank = 1 | 2 | 3;

const RING: Record<PodiumRank, string> = { 1: colors.gold.DEFAULT, 2: "#C9CCD1", 3: "#C4835A" };
const RANK_TEXT: Record<PodiumRank, string> = { 1: colors.white, 2: colors.ink.DEFAULT, 3: colors.white };
const PODIUM_HEIGHT: Record<PodiumRank, number> = { 1: 88, 2: 64, 3: 52 };

const styles = StyleSheet.create({
  cardShadow: { shadowColor: colors.maroon[900], shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  podiumFirst: { backgroundColor: "rgba(255,255,255,0.16)", borderTopWidth: 1, borderColor: "rgba(199,154,61,0.6)" },
  podiumOther: { backgroundColor: "rgba(255,255,255,0.08)", borderTopWidth: 1, borderColor: "rgba(255,255,255,0.15)" },
  podiumNumber: { color: "rgba(255,255,255,0.85)" },
});

function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export default function LeaderboardScreen() {
  const { data, isLoading, isError, isFetching, refetch, error } = useLeaderboard();
  const { data: agent } = useProfile();

  const entries = data ?? [];
  const rest = entries.slice(3);
  const maxEarned = entries[0]?.earnedAmount ?? 0;
  const myIndex = agent ? entries.findIndex((e) => e.agentId === agent.agentId) : -1;
  const me = myIndex >= 0 ? entries[myIndex] : undefined;
  const nextAbove = myIndex > 0 ? entries[myIndex - 1] : undefined;

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <AppHeader title="Leaderboard" showBack />

      {isLoading ? (
        <LoadingState message="Loading leaderboard…" />
      ) : isError ? (
        <ErrorState message={getErrorMessage(error, "Couldn't load the leaderboard.")} onRetry={refetch} />
      ) : entries.length === 0 ? (
        <EmptyState icon={<Trophy size={24} color={colors.ink[500]} />} title="No rankings yet" subtitle="Rankings appear once agents start earning incentives." />
      ) : (
        <FlatList
          data={rest}
          keyExtractor={(item) => item.agentId}
          contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: 40, gap: 10 }}
          showsVerticalScrollIndicator={false}
          refreshing={isFetching}
          onRefresh={refetch}
          ListHeaderComponent={
            <View className="mb-1">
              <HeroCard contentStyle={{ paddingHorizontal: 14, paddingTop: 22, paddingBottom: 0 }}>
                <View className="items-center">
                  <View className="flex-row items-center gap-1.5">
                    <Sparkles size={12} color={colors.gold.DEFAULT} />
                    <Eyebrow light>Top performers · last 30 days</Eyebrow>
                  </View>
                  <Text className="mt-1 font-display-bold text-xl text-white">Hall of Fame</Text>
                </View>
                <Podium entries={entries} myAgentId={agent?.agentId} />
              </HeroCard>

              <StandingCard me={me} rank={myIndex + 1} total={entries.length} nextAbove={nextAbove} />

              {rest.length > 0 ? (
                <SectionHeader title="All Rankings" subtitle="Ranked by incentives earned" right={<Pill label={`${entries.length} agents`} />} />
              ) : null}
            </View>
          }
          renderItem={({ item, index }) => <RankRow entry={item} rank={index + 4} isMe={item.agentId === agent?.agentId} maxEarned={maxEarned} />}
        />
      )}
    </SafeAreaView>
  );
}

function Avatar({ uri, name, size }: { uri?: string | null; name: string; size: number }) {
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <View className="items-center justify-center bg-saffron-600" style={{ width: size, height: size, borderRadius: size / 2 }}>
      <Text className="font-display-bold text-white" style={{ fontSize: Math.round(size * 0.34) }}>
        {initialsOf(name)}
      </Text>
    </View>
  );
}

function Podium({ entries, myAgentId }: { entries: LeaderboardEntry[]; myAgentId?: string }) {
  // Visual order is 2nd · 1st · 3rd so the winner stands in the middle.
  const slots: { entry?: LeaderboardEntry; rank: PodiumRank }[] = [
    { entry: entries[1], rank: 2 },
    { entry: entries[0], rank: 1 },
    { entry: entries[2], rank: 3 },
  ];
  return (
    <View className="mt-5 flex-row items-end justify-center gap-2">
      {slots.map(({ entry, rank }) =>
        entry ? (
          <PodiumColumn key={entry.agentId} entry={entry} rank={rank} isMe={entry.agentId === myAgentId} />
        ) : (
          <View key={`slot-${rank}`} className="flex-1" />
        ),
      )}
    </View>
  );
}

function PodiumColumn({ entry, rank, isMe }: { entry: LeaderboardEntry; rank: PodiumRank; isMe: boolean }) {
  const first = rank === 1;
  const avatarSize = first ? 72 : 56;
  return (
    <View className="flex-1 items-center">
      {first ? <Crown size={22} color={colors.gold.DEFAULT} style={{ marginBottom: 4 }} /> : <View style={{ height: 26 }} />}

      <View style={{ padding: 3, borderRadius: 999, borderWidth: first ? 3 : 2, borderColor: RING[rank] }}>
        <Avatar uri={entry.profileImage} name={entry.name} size={avatarSize} />
      </View>
      <View
        className="-mt-3 h-6 min-w-[24px] items-center justify-center rounded-full border-2 px-1.5"
        style={{ backgroundColor: RING[rank], borderColor: colors.maroon[900] }}
      >
        <Text className="font-sans-bold text-[11px]" style={{ color: RANK_TEXT[rank] }}>
          {rank}
        </Text>
      </View>

      <Text className="mt-2 font-sans-bold text-sm text-white" numberOfLines={1}>
        {entry.name.split(" ")[0]}
        {isMe ? " (You)" : ""}
      </Text>
      <Text className="font-display-bold text-base text-saffron-100" numberOfLines={1} adjustsFontSizeToFit>
        {formatCurrency(entry.earnedAmount)}
      </Text>

      <View className="mt-3 w-full items-center rounded-t-2xl pt-2" style={[{ height: PODIUM_HEIGHT[rank] }, first ? styles.podiumFirst : styles.podiumOther]}>
        <Text className="font-display-black text-2xl" style={styles.podiumNumber}>
          {rank}
        </Text>
        <Text className="font-sans text-[10px] text-saffron-100">{entry.ordersDelivered} orders</Text>
      </View>
    </View>
  );
}

function StandingCard({ me, rank, total, nextAbove }: { me?: LeaderboardEntry; rank: number; total: number; nextAbove?: LeaderboardEntry }) {
  if (!me) {
    return (
      <Card className="mt-4 flex-row items-center gap-3">
        <View className="h-12 w-12 items-center justify-center rounded-full bg-sand">
          <Trophy size={20} color={colors.ink[500]} />
        </View>
        <View className="flex-1">
          <Text className="font-sans-bold text-sm text-ink">You're not on the board yet</Text>
          <Text className="mt-0.5 font-sans text-xs text-ink-500">Complete targets to earn incentives and claim your spot.</Text>
        </View>
      </Card>
    );
  }

  const gap = nextAbove ? Math.max(0, nextAbove.earnedAmount - me.earnedAmount) : 0;

  return (
    <View className="mt-4 overflow-hidden rounded-2xl border border-saffron-400/60 bg-saffron-50" style={styles.cardShadow}>
      <View className="flex-row items-center gap-3 p-4">
        <LinearGradient
          colors={gradients.saffronWash}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" }}
        >
          <Text className="font-display-bold text-base text-white">#{rank}</Text>
        </LinearGradient>

        <View className="flex-1">
          <Eyebrow>Your standing</Eyebrow>
          <Text className="mt-0.5 font-display-bold text-lg text-ink">
            {ordinal(rank)} of {total}
          </Text>
          <Text className="font-sans text-xs text-ink-500" numberOfLines={1}>
            {formatCurrency(me.earnedAmount)} earned · {me.ordersDelivered} orders · {me.completedTargets} targets
          </Text>
        </View>

        <View className="items-end">
          {rank === 1 ? (
            <>
              <Crown size={20} color={colors.gold.DEFAULT} />
              <Text className="mt-1 font-sans-bold text-[11px] text-saffron-700">On top</Text>
            </>
          ) : gap > 0 ? (
            <>
              <View className="flex-row items-center gap-0.5">
                <ChevronUp size={14} color={colors.cardamom[700]} />
                <Text className="font-sans-bold text-sm text-cardamom-700">{formatCurrency(gap)}</Text>
              </View>
              <Text className="font-sans text-[10px] text-ink-500">to reach #{rank - 1}</Text>
            </>
          ) : (
            <Text className="font-sans-bold text-[11px] text-saffron-700">Tied with #{rank - 1}</Text>
          )}
        </View>
      </View>
    </View>
  );
}

function RankRow({ entry, rank, isMe, maxEarned }: { entry: LeaderboardEntry; rank: number; isMe: boolean; maxEarned: number }) {
  // Relative bar against the leader, floored so tiny earners still show a sliver.
  const share = maxEarned > 0 ? Math.max(4, Math.round((entry.earnedAmount / maxEarned) * 100)) : 0;

  return (
    <View className={`overflow-hidden rounded-2xl border bg-white ${isMe ? "border-saffron-400" : "border-sand"}`} style={styles.cardShadow}>
      <View className="flex-row items-center gap-3 p-3.5">
        <View className="h-9 w-9 items-center justify-center rounded-full bg-cream-100">
          <Text className="font-sans-bold text-xs text-ink-700">{rank}</Text>
        </View>
        <Avatar uri={entry.profileImage} name={entry.name} size={42} />
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text className="shrink font-sans-bold text-sm text-ink" numberOfLines={1}>
              {entry.name}
            </Text>
            {isMe ? (
              <View className="rounded-full bg-saffron-100 px-2 py-0.5">
                <Text className="font-sans-bold text-[10px] text-saffron-700">YOU</Text>
              </View>
            ) : null}
          </View>
          <Text className="font-sans text-xs text-ink-500" numberOfLines={1}>
            {entry.agentId} · {entry.state}
          </Text>
        </View>
        <View className="items-end">
          <Text className="font-display-bold text-sm text-saffron-700">{formatCurrency(entry.earnedAmount)}</Text>
          <Text className="font-sans text-[10px] text-ink-500">
            {entry.ordersDelivered} orders · {entry.completedTargets} targets
          </Text>
        </View>
      </View>
      <View className="h-1 bg-cream-100">
        <View className="h-full bg-gold" style={{ width: `${share}%` }} />
      </View>
    </View>
  );
}
