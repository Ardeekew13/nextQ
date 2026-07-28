import { startServerAndCreateNextHandler } from "@as-integrations/next";
import { apolloServer } from "@/graphql/server";
import { createContext } from "@/graphql/context";

const handler = startServerAndCreateNextHandler(apolloServer, {
  context: async () => createContext(),
});

export { handler as GET, handler as POST };
