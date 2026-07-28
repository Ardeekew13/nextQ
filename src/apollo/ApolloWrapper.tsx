"use client";

import { useMemo, type ReactNode } from "react";
import { ApolloProvider } from "@apollo/client";
import { makeApolloClient } from "./client";

export function ApolloWrapper({ children }: { children: ReactNode }) {
  const client = useMemo(() => makeApolloClient(), []);
  return <ApolloProvider client={client}>{children}</ApolloProvider>;
}
