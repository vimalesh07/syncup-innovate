import { createFileRoute } from "@tanstack/react-router";
import { Flag, HeartHandshake, LockKeyhole, ShieldAlert, UserX } from "lucide-react";
import { PlatformShell } from "@/components/app/PlatformShell";
import { ProtectedPage } from "@/components/app/ProtectedPage";

export const Route = createFileRoute("/community-guidelines")({
  head: () => ({ meta: [{ title: "Community Guidelines | SyncUp" }] }),
  component: CommunityGuidelinesRoute,
});

function CommunityGuidelinesRoute() {
  return (
    <ProtectedPage>
      <PlatformShell>
        <section className="space-y-6">
          <div className="glass-strong neon-border rounded-2xl p-6">
            <p className="text-sm text-cyan-200">Safety center</p>
            <h1 className="mt-2 text-3xl font-bold">Community Guidelines</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/60">
              SyncUp is for students and builders to find teams, share work, and collaborate respectfully. These rules keep the platform useful, safe, and focused.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Guideline icon={HeartHandshake} title="Be respectful">
              No harassment, hate, bullying, threats, sexual content, or attacks on identity, college, skill level, language, or background.
            </Guideline>
            <Guideline icon={ShieldAlert} title="Keep posts honest">
              Do not post scams, fake opportunities, stolen projects, misleading team roles, spam, or copied work presented as your own.
            </Guideline>
            <Guideline icon={LockKeyhole} title="Protect private data">
              Do not share passwords, private chats, phone numbers, addresses, college IDs, tokens, API keys, or someone else&apos;s personal information.
            </Guideline>
            <Guideline icon={Flag} title="Report harmful content">
              Report posts that break these rules. Reports are stored for review and help keep the feed clean for everyone.
            </Guideline>
            <Guideline icon={UserX} title="Block when needed">
              Blocking hides that user&apos;s posts from your home feed. Use it when you do not want to see someone&apos;s content or interact with them.
            </Guideline>
          </div>

          <div className="glass-strong rounded-2xl p-6">
            <h2 className="text-xl font-semibold">Data and cookies</h2>
            <p className="mt-3 text-sm leading-6 text-white/60">
              SyncUp stores essential login/session data, profile preferences, theme choice, and safety actions such as reports or blocks. These are used to keep you signed in, personalize the app, and protect the community.
            </p>
          </div>
        </section>
      </PlatformShell>
    </ProtectedPage>
  );
}

function Guideline({ icon: Icon, title, children }: { icon: typeof HeartHandshake; title: string; children: React.ReactNode }) {
  return (
    <article className="glass-strong rounded-2xl p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-cyan-300/15 text-cyan-100">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-white/60">{children}</p>
        </div>
      </div>
    </article>
  );
}
