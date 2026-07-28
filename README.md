# NextQ

A full-stack pickleball open-play queueing and random-stacking app: organisers run
sessions with random partners/opponents, fair rotation, live standings, and a
public results link anyone can view without an account.

Built with Next.js App Router (frontend + backend in one app), TypeScript,
Ant Design, MongoDB/Mongoose, and Apollo Server + GraphQL mounted as a Next.js
route handler (no separate backend process).

## 1. Project structure

```
src/
  app/                        Next.js App Router pages
    api/graphql/route.ts      Apollo Server mounted as a Next.js route handler
    login/, register/         Organiser auth pages
    dashboard/                Organiser-only pages (auth required)
      clubs/[clubId]/...
      sessions/[sessionId]/   overview, players, courts, games, standings
    club/[clubSlug]/          Public, read-only pages (no auth)
      session/[sessionSlug]/
  components/                 Podium, StandingsTable, GameLog, ScoreEntryForm, DashboardShell
  graphql/
    typeDefs.ts                GraphQL schema
    resolvers/                 One file per domain (auth, club, session, player, court, game)
    context.ts, guards.ts      Request context + auth/ownership guards
    documents/                 Client-side gql queries/mutations (organiser + public)
  lib/
    db.ts                      Mongoose connection (cached across hot reloads)
    auth.ts                    Password hashing, JWT, http-only cookie helpers
    matchmaking.ts              Core random selection + team assignment algorithm
    eligibility.ts              "Who's eligible to play right now" queries
    statsCore.ts                 Pure win/loss/streak/history accumulation (unit tested)
    stats.ts                    DB-backed recalculation service + standings/podium queries
    ranking.ts                   Pure standings/podium ranking logic (unit tested)
    transaction.ts               MongoDB transaction wrapper with standalone-Mongo fallback
    slug.ts, urls.ts
  models/                      Mongoose schemas: User, Club, Session, SessionPlayer, Court, Game
  types/enums.ts                Shared enums + session settings types
  apollo/                       Apollo Client + provider for the browser
  theme/                        Ant Design theme tuned for courtside/outdoor use
scripts/seed.ts                 Seeds one organiser, one club, one active session,
                                 two courts, twelve players, several completed games,
                                 and one in-progress game
tests/                          Vitest unit/integration tests
```

## 2. Requirements

- Node.js 18.18+ (Node 20 LTS recommended)
- A MongoDB instance (local `mongod`, Docker, or Atlas). Transactions are used
  opportunistically when completing/editing games; if MongoDB is running as a
  standalone instance (no replica set), the app automatically falls back to
  running those same steps without a transaction, so a plain local `mongod`
  works fine for development.

## 3. Setup

```bash
npm install
cp .env.example .env.local
# edit .env.local: set MONGODB_URI and a real JWT_SECRET
npm run seed     # creates demo organiser, club, session, players, games
npm run dev      # http://localhost:3000
```

Seeded organiser login: `organiser@pickleq.test` / `password123`
Seeded public session: `/club/pickle-ann/session/friday-open-play-july-24`

## 4. Environment variables

See `.env.example`:

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Signs the organiser session JWT stored in an http-only cookie |
| `AUTH_COOKIE_NAME` | Name of that cookie |
| `NEXT_PUBLIC_APP_URL` | Base URL used to build shareable public club/session links |

## 5. Authentication & authorisation

- Organisers register/log in with email + password. Passwords are hashed with
  bcrypt; sessions are a signed JWT stored in an **http-only, `SameSite=Lax`**
  cookie (`secure` in production) - never exposed to client JS.
- Every organiser-only GraphQL mutation calls `requireOrganiser` (must be
  logged in) and, where relevant, `requireClubOwner` / `requireSessionOwner`
  (must own the specific club/session) before touching the database - see
  `src/graphql/guards.ts`. Ownership checks happen before any other DB
  mutation runs.
- Public queries (`publicClub`, `publicSession`) never require a session and
  only ever return public-safe fields - no organiser email, password hash, or
  internal `Session`/`Club` fields beyond what a spectator needs. There is no
  public mutation of any kind.
- Players never have accounts; they're plain records (`SessionPlayer`) scoped
  to a session.

## 6. Random queueing & matchmaking algorithm

`src/lib/matchmaking.ts` is a pure, dependency-free module (fully unit
tested in `tests/matchmaking.test.ts`):

1. **Player selection** (`selectEligiblePlayers`) - from the pool of
   checked-in, active, not-currently-playing players, pick four using
   priority order: fewest games played -> longest wait -> most games sat out
   -> random tiebreak among true ties.
2. **Team assignment** (`assignTeams`) - of the three ways to split four
   players into two teams of two, score each split by (a) whether it repeats
   a prior partnership, (b) whether it repeats the exact same four-player
   group, (c) how often the resulting opponents have faced each other, and
   pick the lowest-scoring split (random tiebreak). If every split repeats
   something, the least-bad option is still returned - a game is never
   blocked from generating.
3. `generateNextGame` (resolver) combines both steps, using
   `src/lib/eligibility.ts` to compute the truly-eligible pool (checked in +
   active + not on any court right now, via any `QUEUED`/`IN_PROGRESS` game),
   and returns a clear error instead of a partial game when fewer than four
   players are eligible.

## 7. Statistics & standings

- `src/lib/statsCore.ts` is a pure function that recomputes every player's
  wins/losses/points/differential/streaks/partner-and-opponent history from a
  chronological list of completed games. It has no DB dependency, so it's
  directly unit tested (`tests/statsCore.test.ts`).
- `src/lib/stats.ts` (`rebuildSessionStatistics`) fetches a session's players
  and completed games, runs them through `statsCore`, and writes the results
  back with a single `bulkWrite`. It is the **single source of truth** and is
  re-run after a game is completed, edited, cancelled, or deleted - so stats
  can never drift from the underlying game log.
- `src/lib/ranking.ts` computes standings from the session's configurable
  `rankingOrder` (wins -> win rate -> point differential -> points scored ->
  fewest losses -> earliest check-in by default) using standard competition
  ranking (ties share a rank; the next rank skips accordingly), and derives
  the top-three podium (excluding anyone with zero games played).
- Completing a game (`completeGame` mutation) runs inside
  `withOptionalTransaction` (`src/lib/transaction.ts`): mark the game
  complete -> free the court -> return the four players to the back of the
  queue -> recalculate statistics, all in one MongoDB transaction where the
  deployment supports one, with a transparent fallback for standalone Mongo.

## 8. GraphQL API

- Schema: `src/graphql/typeDefs.ts`. Resolvers are split by domain under
  `src/graphql/resolvers/` and merged in `resolvers/index.ts`.
- Mounted at `/api/graphql` via `@as-integrations/next`
  (`src/app/api/graphql/route.ts`), so there is no separate backend server -
  Next.js serves both the UI and the API.
- The browser talks to it through `@apollo/client` (`src/apollo/`), with
  `credentials: "include"` so the http-only auth cookie is sent automatically.
- **Live updates**: the app uses Apollo Client polling (5-8s intervals) on
  dashboard and public pages rather than GraphQL subscriptions. Subscriptions
  need a persistent WebSocket connection, which doesn't fit a "no separate
  backend, Next.js route handlers only" architecture without adding a custom
  server; polling was chosen as the pragmatic, spec-compliant ("optional")
  alternative. If you later add a custom server or a hosted subscription
  transport, `sessionUpdated`/`gameUpdated`/`standingsUpdated`/`queueUpdated`
  would be natural additions to the schema.

## 9. Frontend architecture note

Dashboard and public pages are client components using Apollo's `useQuery` /
`useMutation` hooks (with `cache-and-network` + polling), rather than deep
React Server Component + Apollo SSR wiring. This keeps the data layer simple
and consistent between the organiser dashboard (needs mutations, optimistic
UI, frequent polling) and the public pages (needs the same live-refresh
behaviour), at the cost of an initial client-side fetch instead of fully
server-rendered data. Ant Design's `Skeleton`/`Empty` components cover the
loading and empty states everywhere data is fetched this way.

## 10. Running tests

```bash
npm test
```

Covers (see `tests/`):
- `matchmaking.test.ts` - random selection of 4 eligible players, fairness
  priority order, avoiding repeated partners, graceful fallback when repeats
  are unavoidable, never double-booking a player.
- `ranking.test.ts` - ranking order, tie handling (shared/skipped ranks),
  0% win rate with no games, top-three podium generation including ties.
- `statsCore.test.ts` - recording a completed game, win/loss/point
  differential calculation, streaks, editing a result (recompute from
  scratch), cancelled games contributing nothing.
- `guards.test.ts` - organiser/club/session ownership guards (unauthenticated,
  not-found, forbidden, success paths).
- `mutationAuth.test.ts` - every organiser-only mutation rejects an anonymous
  caller before touching the database.
- `publicQueries.test.ts` - anonymous public club/session queries succeed,
  and unpublished/unknown sessions resolve to `null` rather than leaking data.

## 11. Deployment

1. Provision MongoDB (Atlas recommended for production - a replica set gives
   you real multi-document transactions during game completion/edits).
2. Set `MONGODB_URI`, `JWT_SECRET` (long random value), and
   `NEXT_PUBLIC_APP_URL` (your production URL) in your hosting platform's
   environment variables.
3. `npm run build && npm start`, or deploy directly to Vercel/any Node host
   that supports Next.js route handlers. No separate backend/process is
   required - GraphQL is served from the same Next.js deployment.
4. Run `npm run seed` once against your target database if you want demo
   data (safe to skip in production).
