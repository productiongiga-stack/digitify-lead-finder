"use client";

import Script from "next/script";
import { getAppUrl } from "@/lib/config";
import { isMarketingShellPath } from "@/lib/shell-paths";
import { usePathname } from "next/navigation";

export function DigitifyChatbotLoader() {
  const pathname = usePathname() || "/";
  if (!isMarketingShellPath(pathname)) {
    return null;
  }

  const leadsUrl = getAppUrl().replace(/\/+$/, "");

  return (
    <Script
      id="digitify-chatbot-loader"
      src={`${leadsUrl}/digitify-chatbot-loader.js`}
      strategy="lazyOnload"
      data-digitify-chatbot-loader="true"
      data-leads-url={leadsUrl}
      data-company="Digitify Contact"
      data-color="#f9ae5a"
      data-position="bottom-right"
      data-welcome="Hallo! Hoe kan ik u helpen?"
      data-ask-name="0"
      data-auto-open="0"
    />
  );
}
