"use client";

import { createContext, useContext, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { trpc, type RouterOutputs } from "@/lib/trpc/client";
import { isAppShellPath } from "@/lib/shell-paths";

type ShellContextData = RouterOutputs["user"]["getShellContext"];

type ShellContextValue = {
  data: ShellContextData | undefined;
  isLoading: boolean;
  isAppShell: boolean;
};

const ShellContext = createContext<ShellContextValue | null>(null);

export function ShellProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAppShell = isAppShellPath(pathname);

  const query = trpc.user.getShellContext.useQuery(undefined, {
    enabled: isAppShell,
    staleTime: 5 * 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  return (
    <ShellContext.Provider value={{ data: query.data, isLoading: query.isLoading, isAppShell }}>
      {children}
    </ShellContext.Provider>
  );
}

export function useShellContext() {
  const context = useContext(ShellContext);
  if (!context) {
    throw new Error("useShellContext must be used within ShellProvider");
  }
  return context;
}
