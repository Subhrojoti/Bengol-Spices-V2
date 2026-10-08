import { api } from "./client";
import type { Target, TargetProgress } from "@/types/api";

export interface TodayTarget {
  target: Target;
  progress: TargetProgress;
}

// No progress record exists until the agent's first qualifying action, so a
// missing one is simply zero progress.
function normalizeProgress(targetId: string, progress?: Partial<TargetProgress>): TargetProgress {
  return {
    targetId,
    achievedValue: Number(progress?.achievedValue) || 0,
    earnedAmount: Number(progress?.earnedAmount) || 0,
    isCompleted: progress?.isCompleted === true,
  };
}

// 🔥 FIX: the endpoint answers { targets, progress } as two separate lists.
// unwrapList picked out the bare targets array, which has no .target or
// .progress, so the Targets screen crashed the moment it rendered. The lists
// are now paired here. Newer backends also send them already paired as
// `data`; both shapes are read.
function toTodayTargets(body: unknown): TodayTarget[] {
  const res = (body ?? {}) as { data?: unknown; targets?: unknown; progress?: unknown };

  if (Array.isArray(res.data)) {
    return (res.data as Partial<TodayTarget>[])
      .filter((entry) => entry?.target?._id)
      .map((entry) => ({ target: entry.target!, progress: normalizeProgress(entry.target!._id, entry.progress) }));
  }

  const targets = Array.isArray(res.targets) ? (res.targets as Target[]) : [];
  const progress = Array.isArray(res.progress) ? (res.progress as TargetProgress[]) : [];

  return targets
    .filter((target) => target?._id)
    .map((target) => ({
      target,
      progress: normalizeProgress(
        target._id,
        progress.find((p) => String(p.targetId) === target._id),
      ),
    }));
}

export const targetApi = {
  getTodayTargets: (): Promise<TodayTarget[]> => api.get("/targets/agent/today-target").then((r) => toTodayTargets(r.data)),
};
