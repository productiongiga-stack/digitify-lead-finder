"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { RouteLoading } from "@/components/layout/route-states";

export default function CreativeStudioSettingsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/settings/integrations?tab=muapi");
  }, [router]);

  return <RouteLoading label="Doorverwijzen naar integraties..." />;
}
