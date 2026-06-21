import { redirect } from "next/navigation";
import { getWordPressPageUrl } from "@/lib/digitify-unified-nav";

export default function ContactRedirectPage() {
  redirect(getWordPressPageUrl("contact"));
}
