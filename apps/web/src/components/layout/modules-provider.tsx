"use client";

import { createContext, useContext, type ReactNode } from "react";
import { type RouterOutputs } from "@/lib/trpc/client";
import { useShellContext } from "@/components/layout/shell-provider";

type MyModulesData = RouterOutputs["user"]["getMyModules"];

type ModulesContextValue = {
  data: MyModulesData | undefined;
  isLoading: boolean;
};

const ModulesContext = createContext<ModulesContextValue | null>(null);

export function ModulesProvider({ children }: { children: ReactNode }) {
  const shell = useShellContext();

  const data = shell.data ? { disabled: shell.data.disabled } : undefined;
  const isLoading = shell.isAppShell && shell.isLoading;

  return (
    <ModulesContext.Provider value={{ data, isLoading }}>
      {children}
    </ModulesContext.Provider>
  );
}

export function useMyModules() {
  const context = useContext(ModulesContext);
  if (!context) {
    throw new Error("useMyModules must be used within ModulesProvider");
  }
  return context;
}
