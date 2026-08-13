import { gql } from "@apollo/client";
import { GAME_FIELDS, STANDING_FIELDS, PODIUM_FIELDS } from "./organiser";

export const PUBLIC_CLUB_QUERY = gql`
  query PublicClub($slug: String!) {
    publicClub(slug: $slug) {
      id
      name
      slug
      logoUrl
      location
      description
      activeSessions {
        id
        name
        slug
        status
        sessionDate
        publicUrl
      }
      recentCompletedSessions {
        id
        name
        slug
        status
        sessionDate
        publicUrl
      }
    }
  }
`;

export const CLUB_STANDINGS_QUERY = gql`
  query ClubStandings($slug: String!) {
    clubStandings(slug: $slug) {
      rank
      name
      nickname
      totalGames
      wins
      losses
      winRate
      sessionsPlayed
      currentStreak
      longestWinStreak
    }
  }
`;

export const PUBLIC_SESSION_QUERY = gql`
  ${GAME_FIELDS}
  ${STANDING_FIELDS}
  ${PODIUM_FIELDS}
  query PublicSession($clubSlug: String!, $sessionSlug: String!) {
    publicSession(clubSlug: $clubSlug, sessionSlug: $sessionSlug) {
      id
      name
      slug
      status
      sessionDate
      startTime
      endTime
      checkedInPlayerCount
      finalisedAt
      publicUrl
      club {
        id
        name
        slug
        logoUrl
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
      queuedPlayers {
        id
        name
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
      summary {
        sessionName
        sessionDate
        durationMinutes
        totalPlayers
        totalCompletedGames
        averageGamesPerPlayer
        isFinal
      }
    }
  }
`;
