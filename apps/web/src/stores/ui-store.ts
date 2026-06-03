import { useEffect } from "react";
import { create } from "zustand";

type OpenClawAssistLaunch = {
  pathname: string;
  seedMessage?: string;
  assistBookings?: boolean;
};

interface UIStore {
  sidebarCollapsed: boolean;
  /** False until client has read localStorage — avoids SSR hydration mismatch. */
  sidebarPrefsReady: boolean;
  hydrateSidebarPrefs: () => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;
  toggleMobileSidebar: () => void;
  openClawOpen: boolean;
  setOpenClawOpen: (open: boolean) => void;
  toggleOpenClaw: () => void;
  openClawAssistLaunch: OpenClawAssistLaunch | null;
  openOpenClawAssist: (launch: OpenClawAssistLaunch) => void;
  clearOpenClawAssistLaunch: () => void;
}

function getSavedSidebarState(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem("sidebar-collapsed") === "true";
  } catch {
    return false;
  }
}

function saveSidebarState(collapsed: boolean) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("sidebar-collapsed", String(collapsed));
  } catch { /* ignore */ }
}

export const useUIStore = create<UIStore>((set, get) => ({
  sidebarCollapsed: false,
  sidebarPrefsReady: false,
  hydrateSidebarPrefs: () => {
    if (get().sidebarPrefsReady) return;
    const collapsed = getSavedSidebarState();
    set({ sidebarCollapsed: collapsed, sidebarPrefsReady: true });
  },
  toggleSidebar: () =>
    set((state) => {
      const next = !state.sidebarCollapsed;
      saveSidebarState(next);
      return { sidebarCollapsed: next };
    }),
  setSidebarCollapsed: (collapsed) => {
    saveSidebarState(collapsed);
    set({ sidebarCollapsed: collapsed });
  },
  mobileSidebarOpen: false,
  setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),
  toggleMobileSidebar: () => set((state) => ({ mobileSidebarOpen: !state.mobileSidebarOpen })),
  openClawOpen: false,
  setOpenClawOpen: (open) => set({ openClawOpen: open }),
  toggleOpenClaw: () => set((state) => ({ openClawOpen: !state.openClawOpen })),
  openClawAssistLaunch: null,
  openOpenClawAssist: (launch) =>
    set({
      openClawAssistLaunch: launch,
      openClawOpen: true,
    }),
  clearOpenClawAssistLaunch: () => set({ openClawAssistLaunch: null }),
}));

/** Sidebar width matches server HTML until prefs are hydrated (prevents hydration error). */
export function useSidebarLayout() {
  const sidebarCollapsed = useUIStore((state) => state.sidebarCollapsed);
  const sidebarPrefsReady = useUIStore((state) => state.sidebarPrefsReady);
  const hydrateSidebarPrefs = useUIStore((state) => state.hydrateSidebarPrefs);

  useEffect(() => {
    hydrateSidebarPrefs();
  }, [hydrateSidebarPrefs]);

  return {
    collapsed: sidebarPrefsReady ? sidebarCollapsed : false,
    prefsReady: sidebarPrefsReady,
  };
}
