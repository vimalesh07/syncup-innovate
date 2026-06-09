import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useLayoutEffect } from "react";
import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { Problems } from "@/components/landing/Problems";
import { Features } from "@/components/landing/Features";
import { TeamMatchDemo } from "@/components/landing/TeamMatchDemo";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Community } from "@/components/landing/Community";
import { Testimonials } from "@/components/landing/Testimonials";
import { Footer } from "@/components/landing/Footer";
import { CursorGlow } from "@/components/landing/Background";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SyncUp — Your Student Innovation Launchpad" },
      {
        name: "description",
        content:
          "SyncUp connects students, developers, designers, and researchers to form trusted teams, discover hackathons, and ship breakthrough projects together.",
      },
      { property: "og:title", content: "SyncUp — Your Student Innovation Launchpad" },
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

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;

    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });

    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    });
    const timer = window.setTimeout(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      window.history.scrollRestoration = previousScrollRestoration;
    }, 120);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, []);

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
      <Footer />
    </main>
  );
}
