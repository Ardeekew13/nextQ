export const SkillLevel = {
  NOVICE: "NOVICE",
  BEGINNER_LOW: "BEGINNER_LOW",
  BEGINNER_HIGH: "BEGINNER_HIGH",
  INTERMEDIATE: "INTERMEDIATE",
  ADVANCED: "ADVANCED",
} as const;
export type SkillLevel = (typeof SkillLevel)[keyof typeof SkillLevel];

export const SessionStatus = {
  DRAFT: "DRAFT",
  ACTIVE: "ACTIVE",
  PAUSED: "PAUSED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;
export type SessionStatus = (typeof SessionStatus)[keyof typeof SessionStatus];

export const CourtStatus = {
  AVAILABLE: "AVAILABLE",
  IN_USE: "IN_USE",
  DISABLED: "DISABLED",
} as const;
export type CourtStatus = (typeof CourtStatus)[keyof typeof CourtStatus];

export const GameStatus = {
  QUEUED: "QUEUED",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;
export type GameStatus = (typeof GameStatus)[keyof typeof GameStatus];

export const WinningTeam = {
  A: "A",
  B: "B",
} as const;
export type WinningTeam = (typeof WinningTeam)[keyof typeof WinningTeam];

export const UserRole = {
  ORGANISER: "ORGANISER",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

/** Points target / win-by-two rules that a session can be configured with. */
export interface ScoringSettings {
  pointsTarget: number;
  winByTwo: boolean;
}

/** Ranking tie-break order; each entry is applied in sequence until a difference is found. */
export type RankingCriterion =
  | "WINS"
  | "WIN_RATE"
  | "POINT_DIFFERENTIAL"
  | "POINTS_SCORED"
  | "FEWEST_LOSSES"
  | "EARLIEST_CHECK_IN";

export const MatchingStyle = {
  BALANCED: "BALANCED",
  WINNERS_LOSERS: "WINNERS_LOSERS",
  FIXED_PARTNERS: "FIXED_PARTNERS",
} as const;
export type MatchingStyle = (typeof MatchingStyle)[keyof typeof MatchingStyle];

/** @deprecated Use QueueMode instead */
export const PairingMode = {
  SMART: "SMART",
  RANDOM: "RANDOM",
} as const;
/** @deprecated Use QueueMode instead */
export type PairingMode = (typeof PairingMode)[keyof typeof PairingMode];

export const QueueMode = {
  BALANCED: "BALANCED",
  SMART: "SMART",
  HYBRID: "HYBRID",
} as const;
export type QueueMode = (typeof QueueMode)[keyof typeof QueueMode];

export interface SessionSettings {
  scoring: ScoringSettings;
  rankingOrder: RankingCriterion[];
  avoidRepeatPartnersWindow: number;
  avoidRepeatOpponentsWindow: number;
  queueMode: QueueMode;
  maxConsecutiveGames: number;
  matchingStyle: MatchingStyle;
  /** @deprecated kept for backward compat */
  pairingMode?: PairingMode;
}

export const DEFAULT_SESSION_SETTINGS: SessionSettings = {
  scoring: { pointsTarget: 11, winByTwo: false },
  rankingOrder: [
    "WINS",
    "WIN_RATE",
    "POINT_DIFFERENTIAL",
    "POINTS_SCORED",
    "FEWEST_LOSSES",
    "EARLIEST_CHECK_IN",
  ],
  avoidRepeatPartnersWindow: 3,
  avoidRepeatOpponentsWindow: 2,
  queueMode: QueueMode.HYBRID,
  maxConsecutiveGames: 2,
  matchingStyle: MatchingStyle.BALANCED,
};
