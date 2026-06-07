"use client";

import dynamic from "next/dynamic";
import { RouteLoading } from "@/components/layout/route-states";

const ReviewsPageView = dynamic(
  () => import("./reviews-page-inner").then((module) => module.ReviewsPageInner),
  {
    ssr: false,
    loading: () => <RouteLoading label="Reviews laden..." />,
  },
);

export default function ReviewsPage() {
  return <ReviewsPageView />;
}
