import type { PullRateConfig } from "./types.ts";

export type PackProfile = {
  id: string; game: string; language: "en" | "ja"; cardsPerPack: number | null;
  slots: { label: string; count: number; tier: string | null }[];
  sources: string[]; notes: string;
};
export type PullRateEvidence = {
  sources: string[]; sampleSizeMinimum: number | null; basis: "observed" | "publisher";
  notes: string; reviewedAt: string;
};
export type ReplacementGroup = { base: string; count: number; upgrades: string[] };

export function packProfileFor(config: PullRateConfig | undefined, game: string, set: string, productId?: number): PackProfile | null {
  const id = (productId == null ? undefined : config?.productProfiles?.[String(productId)]) ?? config?.setProfiles?.[game]?.[set];
  const profile = id ? config?.profiles?.[id] : undefined;
  return profile?.game === game ? profile : null;
}

export function evidenceFor(config: PullRateConfig | undefined, game: string, set: string): PullRateEvidence | null {
  return config?.evidence?.[`${game}|${set}`] ?? null;
}
