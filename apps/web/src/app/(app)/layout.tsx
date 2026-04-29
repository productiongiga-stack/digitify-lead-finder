import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { OpenClawPanelWrapper } from "@/components/openclaw/panel-wrapper";
import { AppShell } from "@/components/layout/app-shell";
import { FeedbackButton } from "@/components/feedback/feedback-button";
import { SessionProvider } from "@/components/layout/session-provider";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <SessionProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <AppShell>
          <Topbar />
          <main className="flex-1 overflow-x-clip">
            <div className="mx-auto w-full max-w-[1680px] overflow-x-clip p-3 sm:p-4 lg:p-5">
              {children}
            </div>
          </main>
        </AppShell>
        <FeedbackButton />
        <OpenClawPanelWrapper />
      </div>
    </SessionProvider>
  );
}
