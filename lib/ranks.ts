export const RANKS = [
  { level: 1, minStreak: 0, title: "루틴 초보자" },
  { level: 2, minStreak: 3, title: "작은 불씨" },
  { level: 3, minStreak: 7, title: "꾸준함의 수련생" },
  { level: 4, minStreak: 14, title: "집중의 마법사" },
  { level: 5, minStreak: 21, title: "루틴의 기사" },
  { level: 6, minStreak: 30, title: "몰입의 현자" },
  { level: 7, minStreak: 45, title: "시간의 설계자" },
  { level: 8, minStreak: 60, title: "전설의 수행자" },
] as const;

export type RankProgress = {
  level: number;
  title: string;
  streak: number;
  xp: number;
  xpSpan: number;
  progress: number;
  nextTitle: string | null;
  daysToNext: number;
};

export function rankForStreak(streak: number): RankProgress {
  const safe = Math.max(0, Math.floor(Number.isFinite(streak) ? streak : 0));
  let index = 0;
  for (let cursor = 0; cursor < RANKS.length; cursor += 1) {
    if (safe >= RANKS[cursor].minStreak) index = cursor;
  }
  const current = RANKS[index];
  const next = RANKS[index + 1];
  if (!next) {
    return {
      level: current.level,
      title: current.title,
      streak: safe,
      xp: safe - current.minStreak,
      xpSpan: 0,
      progress: 1,
      nextTitle: null,
      daysToNext: 0,
    };
  }
  const xpSpan = next.minStreak - current.minStreak;
  const xp = safe - current.minStreak;
  return {
    level: current.level,
    title: current.title,
    streak: safe,
    xp,
    xpSpan,
    progress: xpSpan === 0 ? 1 : xp / xpSpan,
    nextTitle: next.title,
    daysToNext: next.minStreak - safe,
  };
}
