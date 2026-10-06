import gql from "graphql-tag";

export const typeDefs = gql`
  scalar Date

  enum SkillLevel {
    NOVICE
    BEGINNER_LOW
    BEGINNER_HIGH
    INTERMEDIATE
    ADVANCED
  }

  enum SessionStatus {
    DRAFT
    ACTIVE
    PAUSED
    COMPLETED
    CANCELLED
  }

  enum CourtStatus {
    AVAILABLE
    IN_USE
    DISABLED
  }

  enum GameStatus {
    QUEUED
    IN_PROGRESS
    COMPLETED
    CANCELLED
  }

  enum WinningTeam {
    A
    B
  }

  enum RankingCriterion {
    WINS
    WIN_RATE
    POINT_DIFFERENTIAL
    POINTS_SCORED
    FEWEST_LOSSES
    EARLIEST_CHECK_IN
  }

  enum PairingMode {
    SMART
    RANDOM
  }

  enum PairingMode {
    SMART
    RANDOM
  }

  enum QueueMode {
    BALANCED
    SMART
    HYBRID
  }

  enum MatchingStyle {
    BALANCED
    WINNERS_LOSERS
    FIXED_PARTNERS
  }

  type ScoringSettings {
    pointsTarget: Int!
    winByTwo: Boolean!
  }

  type SessionSettings {
    scoring: ScoringSettings!
    rankingOrder: [RankingCriterion!]!
    avoidRepeatPartnersWindow: Int!
    avoidRepeatOpponentsWindow: Int!
    pairingMode: PairingMode!
    matchingStyle: MatchingStyle!
    queueMode: QueueMode!
    maxConsecutiveGames: Int!
  }

  input ScoringSettingsInput {
    pointsTarget: Int
    winByTwo: Boolean
  }

  input SessionSettingsInput {
    scoring: ScoringSettingsInput
    rankingOrder: [RankingCriterion!]
    avoidRepeatPartnersWindow: Int
    avoidRepeatOpponentsWindow: Int
    pairingMode: PairingMode
    matchingStyle: MatchingStyle
    queueMode: QueueMode
    maxConsecutiveGames: Int
  }

  type User {
    id: ID!
    email: String!
    name: String!
    role: String!
    lastLoginAt: Date
    hasSeenFixedPartnerTour: Boolean!
    createdAt: Date!
    updatedAt: Date!
  }

  type AuthPayload {
    user: User!
  }

  type Club {
    id: ID!
    organiserId: ID!
    coOrganiserIds: [ID!]!
    name: String!
    slug: String!
    logoUrl: String
    location: String
    description: String
    joinCode: String
    sessions: [Session!]!
    memberCount: Int!
    organisers: [ClubOrganiser!]!
    createdAt: Date!
    updatedAt: Date!
  }

  type ClubOrganiser {
    id: ID!
    name: String!
    role: String!
  }

  type PublicClub {
    id: ID!
    name: String!
    slug: String!
    logoUrl: String
    location: String
    description: String
    activeSessions: [PublicSession!]!
    recentCompletedSessions: [PublicSession!]!
  }

  type PlayerHistoryEntry {
    playerId: ID!
    playerName: String!
    count: Int!
  }

  type SessionPlayer {
    id: ID!
    sessionId: ID!
    name: String!
    nickname: String
    skillLevel: SkillLevel
    checkedIn: Boolean!
    checkedInAt: Date
    active: Boolean!
    """Optional mutual partner request. When set, the queue engine always keeps this
    player and their fixed partner together in the same game, on the same team."""
    fixedPartnerId: ID
    fixedPartner: SessionPlayer
    queueEnteredAt: Date!
    queuePosition: Int!
    gamesPlayed: Int!
    wins: Int!
    losses: Int!
    winRate: Float!
    currentStreak: Int!
    longestWinStreak: Int!
    gamesSatOut: Int!
    partnerHistory: [PlayerHistoryEntry!]!
    opponentHistory: [PlayerHistoryEntry!]!
    createdAt: Date!
    updatedAt: Date!
  }

  type Court {
    id: ID!
    sessionId: ID!
    courtNumber: Int!
    name: String
    status: CourtStatus!
    currentGame: Game
    previousGames: [Game!]!
    createdAt: Date!
    updatedAt: Date!
  }

  type Team {
    players: [SessionPlayer!]!
  }

  """Predicted teams for the very next game, so players can see their partner in advance."""
  type NextGamePreview {
    teamA: Team!
    teamB: Team!
  }

  type Game {
    id: ID!
    sessionId: ID!
    courtId: ID!
    court: Court
    gameNumber: Int!
    teamA: Team!
    teamB: Team!
    winningTeam: WinningTeam
    losingTeam: WinningTeam
    status: GameStatus!
    startedAt: Date
    completedAt: Date
    recordedBy: ID
    notes: String
    createdAt: Date!
    updatedAt: Date!
  }

  type TogetherGroup {
    id: ID!
    players: [SessionPlayer!]!
    gamesTogether: Int!
    games: [Game!]!
  }

  type SessionStanding {
    rank: Int!
    player: SessionPlayer!
    gamesPlayed: Int!
    wins: Int!
    losses: Int!
    winRate: Float!
    currentStreak: Int!
    longestWinStreak: Int!
    gamesSatOut: Int!
  }

  type PodiumEntry {
    position: Int!
    rank: Int!
    player: SessionPlayer!
    wins: Int!
    losses: Int!
    gamesPlayed: Int!
    winRate: Float!
  }

  type PlayerStatistics {
    player: SessionPlayer!
    rank: Int!
    gamesPlayed: Int!
    wins: Int!
    losses: Int!
    winRate: Float!
    currentStreak: Int!
    longestWinStreak: Int!
    gamesSatOut: Int!
    games: [Game!]!
  }

  type SessionSummary {
    club: PublicClub!
    sessionName: String!
    sessionDate: Date!
    durationMinutes: Int
    totalPlayers: Int!
    totalCompletedGames: Int!
    averageGamesPerPlayer: Float!
    podium: [PodiumEntry!]!
    standings: [SessionStanding!]!
    gameLogs: [Game!]!
    isFinal: Boolean!
  }

  type Session {
    id: ID!
    clubId: ID!
    clubSlug: String!
    organiserId: ID!
    name: String!
    slug: String!
    sessionDate: Date!
    startTime: String
    endTime: String
    status: SessionStatus!
    settings: SessionSettings!
    players: [SessionPlayer!]!
    courts: [Court!]!
    activeGames: [Game!]!
    completedGames: [Game!]!
    queuedPlayers: [SessionPlayer!]!
    nextGamePreview: NextGamePreview
    standings: [SessionStanding!]!
    podium: [PodiumEntry!]!
    """Players who keep landing in the same games (2+ players sharing 2+ games), strongest first,
    so the organiser can be prompted to break them up. Groups already separated are excluded."""
    togetherGroups: [TogetherGroup!]!
    """Players genuinely tied for 1st place under this session's ranking rules.
    Empty when there's a clear #1. When 2+ players show up here, they should
    play each other to decide the winner — useful when a prize is on the line."""
    firstPlaceTie: [SessionStanding!]!
    publicPublished: Boolean!
    publicUrl: String!
    finalisedAt: Date
    createdAt: Date!
    updatedAt: Date!
  }

  type PublicSession {
    id: ID!
    club: PublicClub!
    name: String!
    slug: String!
    status: SessionStatus!
    sessionDate: Date!
    startTime: String
    endTime: String
    courts: [Court!]!
    checkedInPlayerCount: Int!
    activeGames: [Game!]!
    queuedPlayers: [SessionPlayer!]!
    completedGames: [Game!]!
    standings: [SessionStanding!]!
    podium: [PodiumEntry!]!
    summary: SessionSummary
    publicUrl: String!
    finalisedAt: Date
  }

  input CreateClubInput {
    name: String!
    slug: String
    logoUrl: String
    location: String
    description: String
  }

  input UpdateClubInput {
    name: String
    slug: String
    logoUrl: String
    location: String
    description: String
  }

  input CreateSessionInput {
    clubId: ID!
    name: String!
    slug: String
    sessionDate: Date!
    numberOfCourts: Int
    settings: SessionSettingsInput
  }

  input UpdateSessionInput {
    name: String
    slug: String
    sessionDate: Date
    settings: SessionSettingsInput
  }

  type ClubMember {
    id: ID!
    clubId: ID!
    name: String!
    nickname: String
    skillLevel: SkillLevel
    totalGames: Int!
    wins: Int!
    losses: Int!
    winRate: Float!
    sessionsPlayed: Int!
    active: Boolean!
    createdAt: Date!
    updatedAt: Date!
  }

  type SessionPlayerAllTime {
    name: String!
    nickname: String
    skillLevel: SkillLevel
    totalGames: Int!
    totalWins: Int!
    totalLosses: Int!
    winRate: Float!
    sessionsPlayed: Int!
  }

  input AddPlayerInput {
    name: String!
    nickname: String
    skillLevel: SkillLevel
    """Optional: ID of another player already in this session to set as a mutual fixed partner."""
    fixedPartnerId: ID
  }

  input AddClubMemberInput {
    name: String!
    nickname: String
    skillLevel: SkillLevel
  }

  input UpdateClubMemberInput {
    name: String
    nickname: String
    skillLevel: SkillLevel
    active: Boolean
  }

  input UpdatePlayerInput {
    name: String
    nickname: String
    skillLevel: SkillLevel
    """Set to another player's ID to make them mutual fixed partners, or null to clear."""
    fixedPartnerId: ID
  }

  input AddCourtInput {
    courtNumber: Int!
    name: String
  }

  input UpdateCourtInput {
    courtNumber: Int
    name: String
    status: CourtStatus
  }

  input CompleteGameInput {
    winningTeam: WinningTeam!
    notes: String
  }

  type ClubStanding {
    rank: Int!
    name: String!
    nickname: String
    totalGames: Int!
    wins: Int!
    losses: Int!
    winRate: Float!
    sessionsPlayed: Int!
    currentStreak: Int!
    longestWinStreak: Int!
  }

  type Query {
    me: User

    myClubs: [Club!]!
    club(id: ID!): Club
    sessionsByClub(clubId: ID!): [Session!]!
    session(id: ID!): Session
    activeSession(clubId: ID!): Session

    publicClub(slug: String!): PublicClub
    publicSession(clubSlug: String!, sessionSlug: String!): PublicSession
    clubStandings(slug: String!): [ClubStanding!]!

    sessionPlayers(sessionId: ID!): [SessionPlayer!]!
    sessionCourts(sessionId: ID!): [Court!]!
    sessionGames(sessionId: ID!, status: GameStatus): [Game!]!
    sessionStandings(sessionId: ID!): [SessionStanding!]!
    sessionPlayersAllTime(sessionId: ID!): [SessionPlayerAllTime!]!
    sessionPodium(sessionId: ID!): [PodiumEntry!]!
    sessionSummary(sessionId: ID!): SessionSummary!

    clubMembers(clubId: ID!, filter: String): [ClubMember!]!

    playerSessionStats(sessionId: ID!, playerId: ID!): PlayerStatistics!
    playerGameLogs(sessionId: ID!, playerId: ID!): [Game!]!
  }

  type Mutation {
    registerOrganiser(email: String!, password: String!, name: String!): AuthPayload!
    loginOrganiser(email: String!, password: String!): AuthPayload!
    logoutOrganiser: Boolean!
    """Always returns true, whether or not the email belongs to an account, so a caller
    can't use this to probe which emails are registered. Sends a reset email only when
    the account actually exists."""
    requestPasswordReset(email: String!): Boolean!
    """Consumes a reset token (single use, expires 1 hour after being requested) and
    sets a new password."""
    resetPassword(token: String!, newPassword: String!): Boolean!
    """Marks the fixed-partner feature walkthrough as seen for the current organiser, so it
    won't be shown again. Called once they finish or dismiss the tour."""
    markFixedPartnerTourSeen: Boolean!

    createClub(input: CreateClubInput!): Club!
    updateClub(id: ID!, input: UpdateClubInput!): Club!
    deleteClub(id: ID!): Boolean!
    generateClubJoinCode(id: ID!): Club!
    joinClub(joinCode: String!): Club!

    createSession(input: CreateSessionInput!): Session!
    updateSession(id: ID!, input: UpdateSessionInput!): Session!
    """Breaks a group up: from now on the queue never puts two or more of these players in the same game."""
    separatePlayers(sessionId: ID!, playerIds: [ID!]!): Session!
    startSession(id: ID!): Session!
    pauseSession(id: ID!): Session!
    resumeSession(id: ID!): Session!
    finishSession(id: ID!): Session!
    cancelSession(id: ID!): Session!
    deleteSession(id: ID!): Boolean!

    addSessionPlayer(sessionId: ID!, input: AddPlayerInput!): SessionPlayer!
    addSessionPlayers(sessionId: ID!, inputs: [AddPlayerInput!]!): [SessionPlayer!]!
    updateSessionPlayer(id: ID!, input: UpdatePlayerInput!): SessionPlayer!
    removeSessionPlayer(id: ID!): Boolean!
    checkInPlayer(id: ID!, checkedIn: Boolean!): SessionPlayer!
    setPlayerActiveStatus(id: ID!, active: Boolean!): SessionPlayer!

    addClubMember(clubId: ID!, input: AddClubMemberInput!): ClubMember!
    updateClubMember(id: ID!, input: UpdateClubMemberInput!): ClubMember!
    removeClubMember(id: ID!): Boolean!
    importClubMembersToSession(sessionId: ID!, memberIds: [ID!]!): [SessionPlayer!]!

    addCourt(sessionId: ID!, input: AddCourtInput!): Court!
    updateCourt(id: ID!, input: UpdateCourtInput!): Court!
    disableCourt(id: ID!, disabled: Boolean!): Court!
    deleteCourt(id: ID!): Boolean!

    generateNextGame(sessionId: ID!, courtId: ID!): Game!
    fillCourtManually(courtId: ID!, teamAPlayerIds: [ID!]!, teamBPlayerIds: [ID!]!): Game!
    updateGameTeams(id: ID!, teamAPlayerIds: [ID!]!, teamBPlayerIds: [ID!]!): Game!
    startGame(id: ID!): Game!
    completeGame(id: ID!, input: CompleteGameInput!): Game!
    updateGameResult(id: ID!, input: CompleteGameInput!): Game!
    cancelGame(id: ID!): Game!
    deleteGame(id: ID!): Boolean!
  }
`;
