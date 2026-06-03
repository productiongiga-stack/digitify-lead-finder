"use client";

import dynamic from "next/dynamic";
import { AuthFormSkeleton } from "@/components/auth/auth-form-skeleton";

const LoginForm = dynamic(() => import("./login-form").then((mod) => mod.LoginForm), {
  ssr: false,
  loading: () => <AuthFormSkeleton />,
});

export function LoginPageClient() {
  return <LoginForm />;
}
