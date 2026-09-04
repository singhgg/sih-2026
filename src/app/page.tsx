"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LandingAuth } from "@/components/LandingAuth";
import { isUserAuthenticated, loginUser } from "@/lib/auth";

export default function Home() {
  const router = useRouter();
  const [isAuthPage, setIsAuthPage] = useState(false);

  useEffect(() => {
    if (isUserAuthenticated()) {
      router.push("/dashboard");
    }
  }, [router]);

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
      onBackToHero={() => setIsAuthPage(false)}
      onOpenSetup={handleOpenSetup}
    />
  );
}
