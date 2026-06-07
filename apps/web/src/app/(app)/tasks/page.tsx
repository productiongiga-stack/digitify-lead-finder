"use client";

import dynamic from "next/dynamic";
import { RouteLoading } from "@/components/layout/route-states";

const TasksPageView = dynamic(
  () => import("./tasks-page-inner").then((module) => module.TasksPageInner),
  {
    ssr: false,
    loading: () => <RouteLoading label="Taken laden..." />,
  },
);

export default function TasksPage() {
  return <TasksPageView />;
}
