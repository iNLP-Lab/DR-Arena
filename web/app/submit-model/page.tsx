import { ModelSubmissionPanel } from "@/components/contact/model-submission-panel";

export const metadata = {
  title: "Submit Model",
  description: "Contact the Deep Research Arena team to submit a model for leaderboard consideration.",
};

export default function SubmitModelPage() {
  return (
    <div className="relative w-full max-w-[1440px] px-6 py-8 md:px-10 md:py-12 lg:px-12">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[460px] w-[900px] -translate-x-1/2 rounded-full bg-accent/[0.06] blur-[140px]"
      />

      <ModelSubmissionPanel />
    </div>
  );
}
