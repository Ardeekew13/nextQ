import { GraphQLError } from "graphql";
import { cookies } from "next/headers";
import { User } from "@/models/User";
import {
  hashPassword,
  verifyPassword,
  signAuthToken,
  authCookieName,
  authCookieMaxAge,
} from "@/lib/auth";
import type { GraphQLContext } from "../context";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function setAuthCookie(token: string) {
  const store = await cookies();
  store.set(authCookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: authCookieMaxAge,
  });
}

export const authResolvers = {
  Query: {
    me: async (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      if (!context.organiser) return null;
      return User.findById(context.organiser.sub);
    },
  },
  Mutation: {
    registerOrganiser: async (
      _parent: unknown,
      args: { email: string; password: string; name: string }
    ) => {
      const email = args.email.trim().toLowerCase();
      if (!EMAIL_RE.test(email)) {
        throw new GraphQLError("Please provide a valid email address.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      if (args.password.length < 8) {
        throw new GraphQLError("Password must be at least 8 characters long.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      if (!args.name.trim()) {
        throw new GraphQLError("Name is required.", { extensions: { code: "BAD_USER_INPUT" } });
      }

      const existing = await User.findOne({ email });
      if (existing) {
        throw new GraphQLError("An account with that email already exists.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      const passwordHash = await hashPassword(args.password);
      const user = await User.create({ email, passwordHash, name: args.name.trim() });

      const token = signAuthToken({ sub: String(user._id), email: user.email, name: user.name });
      await setAuthCookie(token);

      return { user };
    },

    loginOrganiser: async (_parent: unknown, args: { email: string; password: string }) => {
      const email = args.email.trim().toLowerCase();
      const user = await User.findOne({ email });
      if (!user) {
        throw new GraphQLError("Invalid email or password.", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      const valid = await verifyPassword(args.password, user.passwordHash);
      if (!valid) {
        throw new GraphQLError("Invalid email or password.", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      const token = signAuthToken({ sub: String(user._id), email: user.email, name: user.name });
      await setAuthCookie(token);

      return { user };
    },

    logoutOrganiser: async () => {
      const store = await cookies();
      store.delete(authCookieName);
      return true;
    },
  },
};
