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

/** How a game's line-up was first chosen. */
export const GameSource = {
  /** Picked by the queue (the normal court fill, online or offline). */
  AUTO: "AUTO",
  /** Players chosen by hand. */
  MANUAL: "MANUAL",
  /** "Match top 4": the four best-ranked waiting players. */
  TOP_FOUR: "TOP_FOUR",
} as const;
export type GameSource = (typeof GameSource)[keyof typeof GameSource];

export const WinningTeam = {
  A: "A",
  B: "B",
} as const;
export type WinningTeam = (typeof WinningTeam)[keyof typeof WinningTeam];

export const UserRole = {
  ORGANISER: "ORGANISER",
  ADMIN: "ADMIN",
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
  /** Prefer foursomes whose players have shared the fewest games, within a fairness window. */
  mixEveryone?: boolean;
  rankMatchups?: boolean;
  /** Split each foursome into the two most evenly matched teams by strength. */
  balanceTeams?: boolean;
  matchingStyle: MatchingStyle;
  /** @deprecated kept for backward compat */
  pairingMode?: PairingMode;
}

export const DEFAULT_SESSION_SETTINGS: SessionSettings = {
  scoring: { pointsTarget: 11, winByTwo: false },
  rankingOrder: [
    "WIN_RATE",
    "WINS",
    "POINT_DIFFERENTIAL",
    "POINTS_SCORED",
    "FEWEST_LOSSES",
    "EARLIEST_CHECK_IN",
  ],
  avoidRepeatPartnersWindow: 3,
  avoidRepeatOpponentsWindow: 2,
  queueMode: QueueMode.HYBRID,
  maxConsecutiveGames: 2,
  mixEveryone: false,
  rankMatchups: false,
  balanceTeams: true,
  matchingStyle: MatchingStyle.BALANCED,
};

/** The queue-related settings "Reset to default" restores. */
export const DEFAULT_QUEUE_SETTINGS = {
  queueMode: DEFAULT_SESSION_SETTINGS.queueMode,
  maxConsecutiveGames: DEFAULT_SESSION_SETTINGS.maxConsecutiveGames,
  mixEveryone: false,
  rankMatchups: false,
  balanceTeams: true,
} as const;
