import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { Problems } from "@/components/landing/Problems";
import { Features } from "@/components/landing/Features";
import { TeamMatchDemo } from "@/components/landing/TeamMatchDemo";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Community } from "@/components/landing/Community";
import { LiveStats } from "@/components/landing/LiveStats";
import { Testimonials } from "@/components/landing/Testimonials";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { Footer } from "@/components/landing/Footer";
import { CursorGlow } from "@/components/landing/Background";

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
          "Discover competitions, match with vetted teammates, and collaborate in real-time. The operating system for student innovation.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <main className="relative min-h-screen bg-[#0B0F19] text-white overflow-x-hidden">
      <CursorGlow />
      <Navbar />
      <Hero />
      <Problems />
      <Features />
      <TeamMatchDemo />
      <HowItWorks />
      <Community />
      <LiveStats />
      <Testimonials />
      <FinalCTA />
      <Footer />
    </main>
  );
}
