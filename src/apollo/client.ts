import { ApolloClient, InMemoryCache, HttpLink } from "@apollo/client";

export function makeApolloClient() {
  return new ApolloClient({
    link: new HttpLink({
      uri: "/api/graphql",
      credentials: "include",
    }),
    cache: new InMemoryCache(),
    // A refresh asked for right after a change (cancel, undo, sync) must really go to the
    // server. With deduplication on, it joined an identical request already in flight — one
    // started BEFORE the change — and the screen showed the old state (e.g. an undone game
    // still on court) until the next 20 s poll.
    queryDeduplication: false,
    defaultOptions: {
      watchQuery: { fetchPolicy: "cache-and-network" },
    },
  });
}
