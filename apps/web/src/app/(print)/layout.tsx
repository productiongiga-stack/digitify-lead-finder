import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-white">
      {children}
    </div>
  );
}
