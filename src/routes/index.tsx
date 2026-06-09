import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { Problems } from "@/components/landing/Problems";
import { Features } from "@/components/landing/Features";
import { TeamMatchDemo } from "@/components/landing/TeamMatchDemo";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Community } from "@/components/landing/Community";
import { Testimonials } from "@/components/landing/Testimonials";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { Footer } from "@/components/landing/Footer";
import { CursorGlow } from "@/components/landing/Background";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SyncUp — Build Your Dream Innovation Team" },
      {
        name: "description",
        content:
          "SyncUp connects students, developers, designers, and researchers to form trusted teams, discover hackathons, and ship breakthrough projects together.",
      },
      { property: "og:title", content: "SyncUp — Build Your Dream Innovation Team" },
      {
        property: "og:description",
        content:
          "Create your profile, discover builders, send team requests, and collaborate in one student-focused workspace.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) return;
      const saved = window.localStorage.getItem("syncup_last_route");
      if (saved && saved !== "/" && !saved.startsWith("/login") && !saved.startsWith("/signup")) {
        navigate({ href: saved, replace: true });
        return;
      }
      navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  return (
    <main className="syncup-app relative min-h-screen overflow-x-hidden text-white">
      <CursorGlow />
      <Navbar />
      <Hero />
      <Problems />
      <Features />
      <TeamMatchDemo />
      <HowItWorks />
      <Community />
      <Testimonials />
      <FinalCTA />
      <Footer />
    </main>
  );
}
