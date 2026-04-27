import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";

export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-white">
      {children}
    </div>
  );
}
