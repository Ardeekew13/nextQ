import { ApolloServer } from "@apollo/server";
import { typeDefs } from "./typeDefs";
import { resolvers } from "./resolvers";
import { getQueryDepth } from "./security";
import type { GraphQLContext } from "./context";

export const apolloServer = new ApolloServer<GraphQLContext>({
  typeDefs,
  resolvers,
  includeStacktraceInErrorResponses: process.env.NODE_ENV !== "production",
  introspection: process.env.NODE_ENV !== "production",
  plugins: [
    {
      async requestDidResolveOperation({ request }: any) {
        const depth = getQueryDepth(request.ast);
        if (depth > 10) {
          throw new Error("Query depth exceeds maximum limit of 10");
        }
      },
    } as any,
  ],
});
