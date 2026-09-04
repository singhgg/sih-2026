"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LandingAuth } from "@/components/LandingAuth";
import { loginUser } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [isAuthPage, setIsAuthPage] = useState(true);

  const handleAuthenticate = (email = "operator@marine.ai", name = "Ava Morgan") => {
    loginUser(email, name);
    router.push("/dashboard");
  };

  const handleOpenSetup = () => {
    loginUser("operator@marine.ai", "Ava Morgan");
    router.push("/setup");
  };

  return (
    <LandingAuth
      isAuthPage={isAuthPage}
      onAuthenticate={handleAuthenticate}
      onOpenAuth={() => setIsAuthPage(true)}
      onBackToHero={() => router.push("/")}
      onOpenSetup={handleOpenSetup}
    />
  );
}
