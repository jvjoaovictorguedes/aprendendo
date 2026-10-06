export type LoyaltyTier = 'Bronze' | 'Prata' | 'Ouro';

const TIER_THRESHOLDS: { tier: LoyaltyTier; min: number }[] = [
  { tier: 'Ouro', min: 1500 },
  { tier: 'Prata', min: 500 },
  { tier: 'Bronze', min: 0 },
];

export function getTier(points: number): LoyaltyTier {
  return TIER_THRESHOLDS.find((entry) => points >= entry.min)?.tier ?? 'Bronze';
}

export type TierProgress = {
  tier: LoyaltyTier;
  nextTier: LoyaltyTier | null;
  pointsToNext: number | null;
  progressRatio: number;
};

export function getTierProgress(points: number): TierProgress {
  const tier = getTier(points);

  if (tier === 'Ouro') {
    return { tier, nextTier: null, pointsToNext: null, progressRatio: 1 };
  }

  const currentIndex = TIER_THRESHOLDS.findIndex((entry) => entry.tier === tier);
  const currentThreshold = TIER_THRESHOLDS[currentIndex];
  const nextThreshold = TIER_THRESHOLDS[currentIndex - 1];

  const span = nextThreshold.min - currentThreshold.min;
  const progressRatio = span > 0 ? (points - currentThreshold.min) / span : 0;

  return {
    tier,
    nextTier: nextThreshold.tier,
    pointsToNext: Math.max(0, nextThreshold.min - points),
    progressRatio: Math.min(1, Math.max(0, progressRatio)),
  };
}
