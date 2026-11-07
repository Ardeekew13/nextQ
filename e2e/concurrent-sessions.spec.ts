import { expect, test } from "@playwright/test";
import { activeSessionId, gql, login, resetToOneGame, seededClubId } from "./helpers";

/**
 * A club can now run up to two sessions at once (see MAX_CONCURRENT_SESSIONS in
 * createSession). This exercises that with a second, fully independent group of
 * players under the seeded club - proving the two queues never mix - and cleans
 * up after itself so later tests still see exactly one active session.
 */
test("a club can run two active sessions at once, each queueing its own players", async ({ page }) => {
  await login(page);
  const clubId = seededClubId();

  // The seeded session, captured while it's still the only active one.
  const sessionAId = await activeSessionId(page);

  const sessionBName = `Second Group ${Date.now()}`;
  let sessionBId: string | undefined;

  try {
    const created = await gql(
      page,
      `mutation($input: CreateSessionInput!) {
        createSession(input: $input) { id name status courts { id } }
      }`,
      {
        input: {
          clubId,
          name: sessionBName,
          sessionDate: new Date().toISOString(),
          numberOfCourts: 1,
        },
      }
    );
    sessionBId = created.createSession.id;
    const courtBId = created.createSession.courts[0].id;

    const started = await gql(page, `mutation($id: ID!) { startSession(id: $id) { id status } }`, {
      id: sessionBId,
    });
    expect(started.startSession.status).toBe("ACTIVE");

    // Both sessions are ACTIVE under the same club at the same time.
    const sessions = await gql(
      page,
      `query($clubId: ID!) { sessionsByClub(clubId: $clubId) { id status } }`,
      { clubId }
    );
    const statusById = new Map(sessions.sessionsByClub.map((s: { id: string; status: string }) => [s.id, s.status]));
    expect(statusById.get(sessionAId)).toBe("ACTIVE");
    expect(statusById.get(sessionBId)).toBe("ACTIVE");

    // A completely separate roster for session B - none of these were in the seed data.
    const newPlayerNames = ["Nico Alvarez", "Bea Santos", "Marco Ilagan", "Dani Cruz"];
    const added = await gql(
      page,
      `mutation($sessionId: ID!, $inputs: [AddPlayerInput!]!) {
        addSessionPlayers(sessionId: $sessionId, inputs: $inputs) { id name }
      }`,
      { sessionId: sessionBId, inputs: newPlayerNames.map((name) => ({ name })) }
    );
    expect(added.addSessionPlayers).toHaveLength(4);
    for (const player of added.addSessionPlayers) {
      await gql(page, `mutation($id: ID!) { checkInPlayer(id: $id, checkedIn: true) { id } }`, {
        id: player.id,
      });
    }

    // Session B's own queue engine fills its own court from its own (and only its own) players.
    const game = await gql(
      page,
      `mutation($sessionId: ID!, $courtId: ID!) {
        generateNextGame(sessionId: $sessionId, courtId: $courtId) {
          id
          teamA { players { id name } }
          teamB { players { id name } }
        }
      }`,
      { sessionId: sessionBId, courtId: courtBId }
    );
    const gamePlayerNames = [
      ...game.generateNextGame.teamA.players,
      ...game.generateNextGame.teamB.players,
    ].map((p: { name: string }) => p.name);
    expect(gamePlayerNames.sort()).toEqual([...newPlayerNames].sort());

    // Visible to the public too: the club page lists both active sessions, each linking to
    // its own page - a real player can't land in the wrong queue.
    const club = await gql(page, `query($id: ID!) { club(id: $id) { slug } }`, { id: clubId });
    await page.goto(`/club/${club.club.slug}`);
    await expect(page.getByRole("link", { name: sessionBName })).toBeVisible();
  } finally {
    // Leave the shared e2e database with exactly one active session again, so every
    // other test's assumption (activeSessionId resolves unambiguously) still holds.
    if (sessionBId) {
      await gql(page, `mutation($id: ID!) { cancelSession(id: $id) { id } }`, { id: sessionBId });
    }
  }
});

/**
 * Not just "can both be ACTIVE" - this runs several rounds of real games on both
 * sessions' courts, interleaved, to prove the two queue engines never leak a player
 * (or a game) across the session boundary while both are genuinely busy at once.
 */
test("two active sessions each run several rounds of games at once without mixing players", async ({ page }) => {
  await login(page);
  const clubId = seededClubId();

  const sessionAId = await activeSessionId(page);
  await resetToOneGame(page, sessionAId); // known state: court 1 running, court 2 open

  const rosterA = await gql(page, `query($id: ID!){ session(id: $id){ players { id } } }`, { id: sessionAId });
  const sessionAIds = new Set<string>(rosterA.session.players.map((p: { id: string }) => p.id));

  const sessionBName = `Second Group ${Date.now()}`;
  let sessionBId: string | undefined;

  try {
    const created = await gql(
      page,
      `mutation($input: CreateSessionInput!) {
        createSession(input: $input) { id courts { id } }
      }`,
      { input: { clubId, name: sessionBName, sessionDate: new Date().toISOString(), numberOfCourts: 2 } }
    );
    sessionBId = created.createSession.id;
    await gql(page, `mutation($id: ID!) { startSession(id: $id) { id } }`, { id: sessionBId });

    const newPlayerNames = ["Nico Alvarez", "Bea Santos", "Marco Ilagan", "Dani Cruz", "Pia Reyes", "Ken Uy", "Jo Valdez", "Tin Bautista"];
    const added = await gql(
      page,
      `mutation($sessionId: ID!, $inputs: [AddPlayerInput!]!) { addSessionPlayers(sessionId: $sessionId, inputs: $inputs) { id } }`,
      { sessionId: sessionBId, inputs: newPlayerNames.map((name) => ({ name })) }
    );
    const sessionBIds = new Set<string>(added.addSessionPlayers.map((p: { id: string }) => p.id));
    for (const player of added.addSessionPlayers) {
      await gql(page, `mutation($id: ID!) { checkInPlayer(id: $id, checkedIn: true) { id } }`, { id: player.id });
    }

    const COURTS_QUERY = `query($id: ID!) {
      session(id: $id) {
        courts { id status currentGame { id teamA { players { id } } teamB { players { id } } } }
      }
    }`;

    async function runRound(sessionId: string, allowedIds: Set<string>, otherIds: Set<string>, label: string) {
      const data = await gql(page, COURTS_QUERY, { id: sessionId });
      for (const court of data.session.courts) {
        if (court.currentGame) {
          const playerIds = [...court.currentGame.teamA.players, ...court.currentGame.teamB.players].map(
            (p: { id: string }) => p.id
          );
          for (const id of playerIds) {
            expect(allowedIds.has(id), `${label}: game ${court.currentGame.id} has a player not in this session`).toBe(true);
            expect(otherIds.has(id), `${label}: game ${court.currentGame.id} leaked a player from the other session`).toBe(
              false
            );
          }
          await gql(page, `mutation($id: ID!) { completeGame(id: $id, input: { winningTeam: A }) { id } }`, {
            id: court.currentGame.id,
          });
        }
      }
      // Fill every now-open court for the next round.
      const refreshed = await gql(page, COURTS_QUERY, { id: sessionId });
      for (const court of refreshed.session.courts) {
        if (court.status === "AVAILABLE") {
          await gql(page, `mutation($s: ID!, $c: ID!) { generateNextGame(sessionId: $s, courtId: $c) { id } }`, {
            s: sessionId,
            c: court.id,
          });
        }
      }
    }

    for (let round = 0; round < 3; round++) {
      await runRound(sessionAId, sessionAIds, sessionBIds, "Session A");
      await runRound(sessionBId!, sessionBIds, sessionAIds, "Session B");
    }

    // One last check after the final round: still fully isolated.
    const finalA = await gql(page, COURTS_QUERY, { id: sessionAId });
    const finalB = await gql(page, COURTS_QUERY, { id: sessionBId! });
    const idsOnCourt = (d: any) =>
      d.session.courts.flatMap((c: any) =>
        c.currentGame ? [...c.currentGame.teamA.players, ...c.currentGame.teamB.players].map((p: any) => p.id) : []
      );
    for (const id of idsOnCourt(finalA)) expect(sessionBIds.has(id)).toBe(false);
    for (const id of idsOnCourt(finalB)) expect(sessionAIds.has(id)).toBe(false);
  } finally {
    if (sessionBId) {
      await gql(page, `mutation($id: ID!) { cancelSession(id: $id) { id } }`, { id: sessionBId });
    }
  }
});
