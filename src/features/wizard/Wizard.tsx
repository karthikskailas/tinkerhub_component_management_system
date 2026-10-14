import { lazy, Suspense, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { SkeletonLines } from "../../components/ui/Skeleton";
import { Stepper } from "../../components/ui/Stepper";
import { LAST_REQUEST_ID_KEY, local } from "../../lib/storage";
import { useAuth } from "../auth/useAuth";
import { useCatalog } from "../catalog/useCatalog";
import type { CartLine } from "../catalog/ComponentPicker";
import { OpenRequestBanner } from "../requests/OpenRequestBanner";
import { Step1Path } from "./steps/Step1Path";
import { useDraft } from "./useDraft";
import type { ResubmitResult } from "../requests/api";

// Step 1 is the very first thing anyone sees, so it stays in the main
// Wizard chunk. Steps 2-4 (and the "No" path's guide) pull in
// react-hook-form/zod and @tanstack/react-virtual, which only the person
// actually filling the form needs — splitting them here keeps the
// "/" route's initial payload to just Step 1's two buttons.
const GuideStep = lazy(() => import("./steps/GuideStep").then((m) => ({ default: m.GuideStep })));
const Step2Details = lazy(() =>
  import("./steps/Step2Details").then((m) => ({ default: m.Step2Details })),
);
const Step3Components = lazy(() =>
  import("./steps/Step3Components").then((m) => ({ default: m.Step3Components })),
);
const Step4Review = lazy(() =>
  import("./steps/Step4Review").then((m) => ({ default: m.Step4Review })),
);

function StepFallback() {
  return <SkeletonLines count={5} />;
}

const STEP_LABELS = ["Project", "Details", "Components", "Review"];

export function Wizard() {
  const { user, isAnonymous } = useAuth();
  const { draft, setDraft, clearDraft } = useDraft();
  const navigate = useNavigate();
  const location = useLocation();
  const catalogQuery = useCatalog();

  const [resubmitItems, setResubmitItems] = useState<
    ResubmitResult["items"] | null
  >(null);

  useEffect(() => {
    const resubmit = (location.state as { resubmit?: ResubmitResult } | null)?.resubmit;
    if (!resubmit) return;

    setDraft(() => ({
      step: 2,
      path: "registered",
      requesterName: resubmit.requester_name,
      phone: resubmit.phone,
      selectedProjectId: resubmit.project_id,
      selectedProjectName: resubmit.project_name,
      newProject: null,
      screenshotPath: null,
      cart: {},
    }));
    setResubmitItems(resubmit.items);
    // Clear navigation state so a refresh doesn't re-apply the prefill over edits.
    navigate(".", { replace: true, state: null });
  }, [location.state, navigate, setDraft]);

  useEffect(() => {
    if (!resubmitItems || !catalogQuery.data) return;
    const byId = new Map(catalogQuery.data.map((c) => [c.id, c]));
    const cart: Record<string, CartLine> = {};
    for (const item of resubmitItems) {
      const component = byId.get(item.component_id);
      if (!component || component.available <= 0) continue;
      cart[item.component_id] = {
        id: item.component_id,
        name: component.name,
        qty: Math.min(item.qty, component.available),
        available: component.available,
      };
    }
    setDraft((prev) => ({ ...prev, cart }));
    setResubmitItems(null);
  }, [resubmitItems, catalogQuery.data, setDraft]);

  if (!user) return null;

  if (!isAnonymous) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface px-4 text-center">
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-muted">You are signed in as staff.</p>
          <Link to="/admin" className="text-sm font-medium text-accent hover:underline">
            Go to the staff dashboard
          </Link>
        </div>
      </div>
    );
  }

  const goTo = (step: 1 | 2 | 3 | 4) => setDraft((prev) => ({ ...prev, step }));

  function handleSubmitted(requestId: string) {
    local.set(LAST_REQUEST_ID_KEY, requestId);
    clearDraft();
    navigate(`/request/${requestId}`);
  }

  return (
    <div className="min-h-dvh bg-transparent sm:py-6">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-5 p-4 sm:rounded-3xl sm:bg-surface sm:p-6 sm:shadow-surface">
      {draft.step === 1 && <OpenRequestBanner />}

      <Stepper step={draft.step} total={4} labels={STEP_LABELS} />

      {draft.step === 1 && draft.path !== "new" && (
        <Step1Path
          onChoose={(path) =>
            setDraft((prev) => ({ ...prev, path, step: path === "new" ? 1 : 2 }))
          }
        />
      )}

      <Suspense fallback={<StepFallback />}>
        <div key={draft.step}>
        {draft.step === 1 && draft.path === "new" && (
          <GuideStep
            onBack={() => setDraft((prev) => ({ ...prev, path: null }))}
            onContinue={() => goTo(2)}
          />
        )}

        {draft.step === 2 && (
          <Step2Details
            draft={draft}
            userId={user.id}
            onBack={() => goTo(1)}
            onNext={(patch) => setDraft((prev) => ({ ...prev, ...patch, step: 3 }))}
          />
        )}

        {draft.step === 3 && (
          <Step3Components
            cart={draft.cart}
            onCartChange={(cart) => setDraft((prev) => ({ ...prev, cart }))}
            onBack={() => goTo(2)}
            onNext={() => goTo(4)}
          />
        )}

        {draft.step === 4 && (
          <Step4Review
            draft={draft}
            onBack={() => goTo(3)}
            onEditStep={goTo}
            onSubmitted={handleSubmitted}
          />
        )}
        </div>
      </Suspense>
      </div>
    </div>
  );
}
