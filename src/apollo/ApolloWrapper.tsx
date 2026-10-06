"use client";

import { useMemo, type ReactNode } from "react";
import { ApolloProvider } from "@apollo/client";
import { makeApolloClient } from "./client";
import { OfflineResultsProvider } from "./OfflineResultsProvider";

export function ApolloWrapper({ children }: { children: ReactNode }) {
  const client = useMemo(() => makeApolloClient(), []);
  return (
    <ApolloProvider client={client}>
      <OfflineResultsProvider>{children}</OfflineResultsProvider>
    </ApolloProvider>
  );
}
