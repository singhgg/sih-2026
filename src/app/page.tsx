"use client";

import { useState } from "react";
import { LandingAuth } from "@/components/LandingAuth";
import { SurveyDashboard } from "@/components/SurveyDashboard";
import { createSurveyFromDraft, demoSurveys, type Survey, type SurveyDraft } from "@/lib/surveyData";

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthPage, setIsAuthPage] = useState(false);
  const [surveys, setSurveys] = useState<Survey[]>(demoSurveys);
  const [selectedSurveyId, setSelectedSurveyId] = useState<string | null>(demoSurveys[0]?.id ?? null);

  const handleCreateSurvey = (draft: SurveyDraft, survey = createSurveyFromDraft(draft)) => {
    const nextSurvey = survey;
    setSurveys((current) => [nextSurvey, ...current]);
    setSelectedSurveyId(nextSurvey.id);
    setIsAuthenticated(true);
  };

  if (!isAuthenticated) {
    return (
      <LandingAuth
        isAuthPage={isAuthPage}
        onAuthenticate={() => setIsAuthenticated(true)}
        onOpenAuth={() => setIsAuthPage(true)}
        onBackToHero={() => setIsAuthPage(false)}
      />
    );
  }

  return (
    <SurveyDashboard
      surveys={surveys}
      selectedSurveyId={selectedSurveyId}
      onSelectSurvey={setSelectedSurveyId}
      onCreateSurvey={handleCreateSurvey}
      onSurveysChange={setSurveys}
    />
  );
}
