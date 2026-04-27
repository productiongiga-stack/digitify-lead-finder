import { create } from "zustand";

interface UIStore {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;
  toggleMobileSidebar: () => void;
  openClawOpen: boolean;
  setOpenClawOpen: (open: boolean) => void;
  toggleOpenClaw: () => void;
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

export const useUIStore = create<UIStore>((set) => ({
  sidebarCollapsed: getSavedSidebarState(),
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
}));
