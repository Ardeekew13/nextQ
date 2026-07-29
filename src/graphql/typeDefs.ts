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
    createdAt: Date!
    updatedAt: Date!
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
    standings: [SessionStanding!]!
    podium: [PodiumEntry!]!
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
    startTime: String
    endTime: String
    numberOfCourts: Int
    settings: SessionSettingsInput
  }

  input UpdateSessionInput {
    name: String
    slug: String
    sessionDate: Date
    startTime: String
    endTime: String
    settings: SessionSettingsInput
  }

  type ClubMember {
    id: ID!
    clubId: ID!
    name: String!
    nickname: String
    skillLevel: SkillLevel
    totalGames: Int!
    sessionsPlayed: Int!
    active: Boolean!
    createdAt: Date!
    updatedAt: Date!
  }

  input AddPlayerInput {
    name: String!
    nickname: String
    skillLevel: SkillLevel
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

  type Query {
    me: User

    myClubs: [Club!]!
    club(id: ID!): Club
    sessionsByClub(clubId: ID!): [Session!]!
    session(id: ID!): Session
    activeSession(clubId: ID!): Session

    publicClub(slug: String!): PublicClub
    publicSession(clubSlug: String!, sessionSlug: String!): PublicSession

    sessionPlayers(sessionId: ID!): [SessionPlayer!]!
    sessionCourts(sessionId: ID!): [Court!]!
    sessionGames(sessionId: ID!, status: GameStatus): [Game!]!
    sessionStandings(sessionId: ID!): [SessionStanding!]!
    sessionPodium(sessionId: ID!): [PodiumEntry!]!
    sessionSummary(sessionId: ID!): SessionSummary!

    clubMembers(clubId: ID!): [ClubMember!]!

    playerSessionStats(sessionId: ID!, playerId: ID!): PlayerStatistics!
    playerGameLogs(sessionId: ID!, playerId: ID!): [Game!]!
  }

  type Mutation {
    registerOrganiser(email: String!, password: String!, name: String!): AuthPayload!
    loginOrganiser(email: String!, password: String!): AuthPayload!
    logoutOrganiser: Boolean!

    createClub(input: CreateClubInput!): Club!
    updateClub(id: ID!, input: UpdateClubInput!): Club!
    deleteClub(id: ID!): Boolean!
    generateClubJoinCode(id: ID!): Club!
    joinClub(joinCode: String!): Club!

    createSession(input: CreateSessionInput!): Session!
    updateSession(id: ID!, input: UpdateSessionInput!): Session!
    startSession(id: ID!): Session!
    pauseSession(id: ID!): Session!
    resumeSession(id: ID!): Session!
    finishSession(id: ID!): Session!
    cancelSession(id: ID!): Session!

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
