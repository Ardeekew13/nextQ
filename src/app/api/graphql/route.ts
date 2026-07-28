import { startServerAndCreateNextHandler } from "@as-integrations/next";
import { type NextRequest } from "next/server";
import { apolloServer } from "@/graphql/server";
import { createContext } from "@/graphql/context";

const handler = startServerAndCreateNextHandler(apolloServer, {
  context: async () => createContext(),
});

async function GET(req: NextRequest) {
  return handler(req);
}

async function POST(req: NextRequest) {
  return handler(req);
}

export { GET, POST };
