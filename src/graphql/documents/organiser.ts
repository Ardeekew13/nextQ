import { gql } from "@apollo/client";

export const PLAYER_FIELDS = gql`
  fragment PlayerFields on SessionPlayer {
    id
    name
    nickname
    skillLevel
    checkedIn
    checkedInAt
    active
    queueEnteredAt
    gamesPlayed
    wins
    losses
    winRate
    currentStreak
    longestWinStreak
    gamesSatOut
  }
`;

export const GAME_FIELDS = gql`
  fragment GameFields on Game {
    id
    gameNumber
    winningTeam
    losingTeam
    status
    startedAt
    completedAt
    notes
    court {
      id
      courtNumber
      name
    }
    teamA {
      players {
        id
        name
      }
    }
    teamB {
      players {
        id
        name
      }
    }
  }
`;

export const STANDING_FIELDS = gql`
  fragment StandingFields on SessionStanding {
    rank
    gamesPlayed
    wins
    losses
    winRate
    currentStreak
    longestWinStreak
    gamesSatOut
    player {
      id
      name
      nickname
    }
  }
`;

export const PODIUM_FIELDS = gql`
  fragment PodiumFields on PodiumEntry {
    position
    rank
    wins
    losses
    gamesPlayed
    winRate
    player {
      id
      name
      nickname
    }
  }
`;

export const ME_QUERY = gql`
  query Me {
    me {
      id
      email
      name
      role
    }
  }
`;

export const REGISTER_ORGANISER = gql`
  mutation RegisterOrganiser($email: String!, $password: String!, $name: String!) {
    registerOrganiser(email: $email, password: $password, name: $name) {
      user {
        id
        email
        name
      }
    }
  }
`;

export const LOGIN_ORGANISER = gql`
  mutation LoginOrganiser($email: String!, $password: String!) {
    loginOrganiser(email: $email, password: $password) {
      user {
        id
        email
        name
      }
    }
  }
`;

export const LOGOUT_ORGANISER = gql`
  mutation LogoutOrganiser {
    logoutOrganiser
  }
`;

export const MY_CLUBS_QUERY = gql`
  query MyClubs {
    myClubs {
      id
      name
      slug
      logoUrl
      location
      createdAt
    }
  }
`;

export const DASHBOARD_QUERY = gql`
  query Dashboard {
    myClubs {
      id
      name
      slug
      location
      createdAt
      memberCount
      sessions {
        id
        name
        slug
        status
        sessionDate
        publicUrl
        settings {
          queueMode
        }
        courts {
          id
        }
      }
    }
  }
`;

export const CLUB_QUERY = gql`
  query Club($id: ID!) {
    club(id: $id) {
      id
      name
      slug
      logoUrl
      location
      description
      joinCode
      memberCount
      createdAt
      sessions {
        id
        name
        slug
        status
        sessionDate
        publicUrl
        createdAt
        courts {
          id
        }
        settings {
          queueMode
        }
      }
    }
  }
`;

export const CLUB_DETAIL_QUERY = gql`
  query ClubDetail($id: ID!) {
    club(id: $id) {
      id
      name
      slug
      location
      memberCount
      organisers {
        id
        name
        role
      }
      sessions {
        id
        name
        status
        sessionDate
        startTime
        publicUrl
        settings {
          queueMode
        }
        courts {
          id
        }
        players {
          id
          checkedIn
          wins
          losses
          gamesPlayed
          name
        }
        completedGames {
          id
        }
      }
    }
  }
`;

export const CREATE_CLUB = gql`
  mutation CreateClub($input: CreateClubInput!) {
    createClub(input: $input) {
      id
      name
      slug
    }
  }
`;

export const UPDATE_CLUB = gql`
  mutation UpdateClub($id: ID!, $input: UpdateClubInput!) {
    updateClub(id: $id, input: $input) {
      id
      name
      slug
      logoUrl
      location
      description
    }
  }
`;

export const DELETE_CLUB = gql`
  mutation DeleteClub($id: ID!) {
    deleteClub(id: $id)
  }
`;

export const GENERATE_CLUB_JOIN_CODE = gql`
  mutation GenerateClubJoinCode($id: ID!) {
    generateClubJoinCode(id: $id) {
      id
      joinCode
    }
  }
`;

export const JOIN_CLUB = gql`
  mutation JoinClub($joinCode: String!) {
    joinClub(joinCode: $joinCode) {
      id
      name
      slug
    }
  }
`;

export const CREATE_SESSION = gql`
  mutation CreateSession($input: CreateSessionInput!) {
    createSession(input: $input) {
      id
      slug
    }
  }
`;

export const UPDATE_SESSION = gql`
  mutation UpdateSession($id: ID!, $input: UpdateSessionInput!) {
    updateSession(id: $id, input: $input) {
      id
      name
      slug
      sessionDate
      startTime
      endTime
      settings {
        scoring {
          pointsTarget
          winByTwo
        }
        rankingOrder
      }
    }
  }
`;

export const START_SESSION = gql`
  mutation StartSession($id: ID!) {
    startSession(id: $id) {
      id
      status
      publicPublished
      publicUrl
    }
  }
`;

export const PAUSE_SESSION = gql`
  mutation PauseSession($id: ID!) {
    pauseSession(id: $id) {
      id
      status
    }
  }
`;

export const RESUME_SESSION = gql`
  mutation ResumeSession($id: ID!) {
    resumeSession(id: $id) {
      id
      status
    }
  }
`;

export const FINISH_SESSION = gql`
  mutation FinishSession($id: ID!) {
    finishSession(id: $id) {
      id
      status
      finalisedAt
    }
  }
`;

export const CANCEL_SESSION = gql`
  mutation CancelSession($id: ID!) {
    cancelSession(id: $id) {
      id
      status
    }
  }
`;

export const DELETE_SESSION = gql`
  mutation DeleteSession($id: ID!) {
    deleteSession(id: $id)
  }
`;

export const SESSION_DASHBOARD_QUERY = gql`
  ${PLAYER_FIELDS}
  ${GAME_FIELDS}
  ${STANDING_FIELDS}
  ${PODIUM_FIELDS}
  query SessionDashboard($id: ID!) {
    session(id: $id) {
      id
      name
      slug
      status
      sessionDate
      startTime
      endTime
      publicPublished
      publicUrl
      clubId
      settings {
        scoring {
          pointsTarget
          winByTwo
        }
        rankingOrder
        pairingMode
        matchingStyle
        queueMode
        maxConsecutiveGames
      }
      courts {
        id
        courtNumber
        name
        status
        currentGame {
          ...GameFields
        }
      }
      players {
        ...PlayerFields
      }
      queuedPlayers {
        id
        name
        gamesPlayed
        queueEnteredAt
      }
      nextGamePreview {
        teamA {
          players {
            id
            name
          }
        }
        teamB {
          players {
            id
            name
          }
        }
      }
      activeGames {
        ...GameFields
      }
      completedGames {
        ...GameFields
      }
      standings {
        ...StandingFields
      }
      podium {
        ...PodiumFields
      }
    }
  }
`;

// ── Lean focused queries (used by individual tabs for faster polling) ──

/** Header-only: used by layout to show name/status/buttons without fetching all data */
export const SESSION_HEADER_QUERY = gql`
  query SessionHeader($id: ID!) {
    session(id: $id) {
      id
      name
      status
      publicPublished
      publicUrl
      clubId
    }
  }
`;

/** Courts + queued players: used by Courts tab */
export const SESSION_COURTS_QUERY = gql`
  ${GAME_FIELDS}
  query SessionCourts($id: ID!) {
    session(id: $id) {
      id
      status
      courts {
        id
        courtNumber
        name
        status
        currentGame {
          ...GameFields
        }
      }
      queuedPlayers {
        id
        name
        gamesPlayed
        queueEnteredAt
      }
      checkedInPlayerCount
    }
  }
`;

/** Players list: used by Players tab */
export const SESSION_PLAYERS_QUERY = gql`
  query SessionPlayers($id: ID!) {
    session(id: $id) {
      id
      status
      players {
        id
        name
        nickname
        skillLevel
        checkedIn
        checkedInAt
        active
        gamesPlayed
        wins
        losses
        winRate
        currentStreak
        longestWinStreak
        gamesSatOut
        queueEnteredAt
      }
    }
  }
`;

/** Games log: used by Games tab */
export const SESSION_GAMES_LOG_QUERY = gql`
  ${GAME_FIELDS}
  query SessionGamesLog($id: ID!) {
    session(id: $id) {
      id
      status
      completedGames {
        ...GameFields
      }
      activeGames {
        ...GameFields
      }
    }
  }
`;

/** Standings + podium: used by Standings tab */
export const SESSION_STANDINGS_QUERY = gql`
  ${STANDING_FIELDS}
  ${PODIUM_FIELDS}
  query SessionStandings($id: ID!) {
    session(id: $id) {
      id
      name
      status
      clubSlug
      standings {
        ...StandingFields
      }
      podium {
        ...PodiumFields
      }
      publicUrl
    }
  }
`;

export const SESSION_GAMES_QUERY = gql`
  ${GAME_FIELDS}
  query SessionGames($sessionId: ID!) {
    sessionGames(sessionId: $sessionId) {
      ...GameFields
    }
  }
`;

export const ADD_SESSION_PLAYER = gql`
  mutation AddSessionPlayer($sessionId: ID!, $input: AddPlayerInput!) {
    addSessionPlayer(sessionId: $sessionId, input: $input) {
      id
      name
    }
  }
`;

export const ADD_SESSION_PLAYERS = gql`
  mutation AddSessionPlayers($sessionId: ID!, $inputs: [AddPlayerInput!]!) {
    addSessionPlayers(sessionId: $sessionId, inputs: $inputs) {
      id
      name
    }
  }
`;

export const UPDATE_SESSION_PLAYER = gql`
  mutation UpdateSessionPlayer($id: ID!, $input: UpdatePlayerInput!) {
    updateSessionPlayer(id: $id, input: $input) {
      id
      name
      nickname
      skillLevel
    }
  }
`;

export const REMOVE_SESSION_PLAYER = gql`
  mutation RemoveSessionPlayer($id: ID!) {
    removeSessionPlayer(id: $id)
  }
`;

export const CHECK_IN_PLAYER = gql`
  mutation CheckInPlayer($id: ID!, $checkedIn: Boolean!) {
    checkInPlayer(id: $id, checkedIn: $checkedIn) {
      id
      checkedIn
    }
  }
`;

export const SET_PLAYER_ACTIVE_STATUS = gql`
  mutation SetPlayerActiveStatus($id: ID!, $active: Boolean!) {
    setPlayerActiveStatus(id: $id, active: $active) {
      id
      active
    }
  }
`;

export const ADD_COURT = gql`
  mutation AddCourt($sessionId: ID!, $input: AddCourtInput!) {
    addCourt(sessionId: $sessionId, input: $input) {
      id
      courtNumber
      name
      status
    }
  }
`;

export const UPDATE_COURT = gql`
  mutation UpdateCourt($id: ID!, $input: UpdateCourtInput!) {
    updateCourt(id: $id, input: $input) {
      id
      courtNumber
      name
      status
    }
  }
`;

export const DISABLE_COURT = gql`
  mutation DisableCourt($id: ID!, $disabled: Boolean!) {
    disableCourt(id: $id, disabled: $disabled) {
      id
      status
    }
  }
`;

export const DELETE_COURT = gql`
  mutation DeleteCourt($id: ID!) {
    deleteCourt(id: $id)
  }
`;

export const GENERATE_NEXT_GAME = gql`
  ${GAME_FIELDS}
  mutation GenerateNextGame($sessionId: ID!, $courtId: ID!) {
    generateNextGame(sessionId: $sessionId, courtId: $courtId) {
      ...GameFields
    }
  }
`;

export const FILL_COURT_MANUALLY = gql`
  ${GAME_FIELDS}
  mutation FillCourtManually($courtId: ID!, $teamAPlayerIds: [ID!]!, $teamBPlayerIds: [ID!]!) {
    fillCourtManually(courtId: $courtId, teamAPlayerIds: $teamAPlayerIds, teamBPlayerIds: $teamBPlayerIds) {
      ...GameFields
    }
  }
`;

export const UPDATE_GAME_TEAMS = gql`
  ${GAME_FIELDS}
  mutation UpdateGameTeams($id: ID!, $teamAPlayerIds: [ID!]!, $teamBPlayerIds: [ID!]!) {
    updateGameTeams(id: $id, teamAPlayerIds: $teamAPlayerIds, teamBPlayerIds: $teamBPlayerIds) {
      ...GameFields
    }
  }
`;

export const START_GAME = gql`
  mutation StartGame($id: ID!) {
    startGame(id: $id) {
      id
      status
      startedAt
    }
  }
`;

export const COMPLETE_GAME = gql`
  mutation CompleteGame($id: ID!, $input: CompleteGameInput!) {
    completeGame(id: $id, input: $input) {
      id
      status
      winningTeam
    }
  }
`;

export const UPDATE_GAME_RESULT = gql`
  mutation UpdateGameResult($id: ID!, $input: CompleteGameInput!) {
    updateGameResult(id: $id, input: $input) {
      id
      winningTeam
    }
  }
`;

export const CANCEL_GAME = gql`
  mutation CancelGame($id: ID!) {
    cancelGame(id: $id) {
      id
      status
    }
  }
`;

export const DELETE_GAME = gql`
  mutation DeleteGame($id: ID!) {
    deleteGame(id: $id)
  }
`;

// ─── Club Member (roster) ────────────────────────────────────────────────────

export const CLUB_MEMBER_FIELDS = gql`
  fragment ClubMemberFields on ClubMember {
    id
    clubId
    name
    nickname
    skillLevel
    totalGames
    wins
    losses
    winRate
    sessionsPlayed
    active
  }
`;

export const CLUB_MEMBERS_QUERY = gql`
  ${CLUB_MEMBER_FIELDS}
  query ClubMembers($clubId: ID!, $filter: String) {
    clubMembers(clubId: $clubId, filter: $filter) {
      ...ClubMemberFields
    }
  }
`;

export const ADD_CLUB_MEMBER = gql`
  ${CLUB_MEMBER_FIELDS}
  mutation AddClubMember($clubId: ID!, $input: AddClubMemberInput!) {
    addClubMember(clubId: $clubId, input: $input) {
      ...ClubMemberFields
    }
  }
`;

export const UPDATE_CLUB_MEMBER = gql`
  ${CLUB_MEMBER_FIELDS}
  mutation UpdateClubMember($id: ID!, $input: UpdateClubMemberInput!) {
    updateClubMember(id: $id, input: $input) {
      ...ClubMemberFields
    }
  }
`;

export const REMOVE_CLUB_MEMBER = gql`
  mutation RemoveClubMember($id: ID!) {
    removeClubMember(id: $id)
  }
`;

export const IMPORT_CLUB_MEMBERS_TO_SESSION = gql`
  mutation ImportClubMembersToSession($sessionId: ID!, $memberIds: [ID!]!) {
    importClubMembersToSession(sessionId: $sessionId, memberIds: $memberIds) {
      id
      name
      nickname
      skillLevel
      checkedIn
      active
      queueEnteredAt
      gamesPlayed
      wins
      losses
    }
  }
`;

export const SESSION_PLAYERS_ALLTIME_QUERY = gql`
  query SessionPlayersAllTime($sessionId: ID!) {
    sessionPlayersAllTime(sessionId: $sessionId) {
      name
      nickname
      skillLevel
      totalGames
      totalWins
      totalLosses
      winRate
      sessionsPlayed
    }
  }
`;
