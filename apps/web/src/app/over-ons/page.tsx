import { redirect } from "next/navigation";
import { getWordPressPageUrl } from "@/lib/digitify-unified-nav";

export default function AboutPage() {
  redirect(getWordPressPageUrl("over-ons"));
}
