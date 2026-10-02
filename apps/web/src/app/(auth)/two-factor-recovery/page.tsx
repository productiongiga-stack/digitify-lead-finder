import { TwoFactorSettings } from "@/components/settings/two-factor-settings";
export const metadata = { title: "Gecontroleerd authenticatorherstel", robots: { index: false, follow: false } };
export default function RecoveryPage() { return <TwoFactorSettings recovery />; }
