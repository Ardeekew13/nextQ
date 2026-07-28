"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type NavbarActionsContextType = {
  actions: ReactNode;
  setActions: (actions: ReactNode) => void;
  title: ReactNode;
  setTitle: (title: ReactNode) => void;
  pageHeader: ReactNode;
  setPageHeader: (pageHeader: ReactNode) => void;
};

const NavbarActionsContext = createContext<NavbarActionsContextType>({
  actions: null,
  setActions: () => {},
  title: null,
  setTitle: () => {},
  pageHeader: null,
  setPageHeader: () => {},
});

export function NavbarActionsProvider({ children }: { children: ReactNode }) {
  const [actions, setActions] = useState<ReactNode>(null);
  const [title, setTitle] = useState<ReactNode>(null);
  const [pageHeader, setPageHeader] = useState<ReactNode>(null);
  return (
    <NavbarActionsContext.Provider value={{ actions, setActions, title, setTitle, pageHeader, setPageHeader }}>
      {children}
    </NavbarActionsContext.Provider>
  );
}

export function useNavbarActions() {
  return useContext(NavbarActionsContext);
}
