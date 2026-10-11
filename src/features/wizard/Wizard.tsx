import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Stepper } from "../../components/ui/Stepper";
import { LAST_REQUEST_ID_KEY, local } from "../../lib/storage";
import { useAuth } from "../auth/useAuth";
import { useCatalog } from "../catalog/useCatalog";
import type { CartLine } from "../catalog/ComponentPicker";
import { OpenRequestBanner } from "../requests/OpenRequestBanner";
import { GuideStep } from "./steps/GuideStep";
import { Step1Path } from "./steps/Step1Path";
import { Step2Details } from "./steps/Step2Details";
import { Step3Components } from "./steps/Step3Components";
import { Step4Review } from "./steps/Step4Review";
import { useDraft } from "./useDraft";
import type { ResubmitResult } from "../requests/api";

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
      <div className="mx-auto max-w-lg px-4 py-6">
        <div className="rounded-lg bg-indigo-50 p-4 text-center">
          <p className="text-sm font-medium text-indigo-900">You are signed in as staff.</p>
          <Link
            to="/admin"
            className="mt-2 inline-block text-sm font-medium text-indigo-700 underline"
          >
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
    <div className="mx-auto max-w-lg px-4 py-6">
      {draft.step === 1 && <OpenRequestBanner />}

      <Stepper step={draft.step} total={4} labels={STEP_LABELS} />

      {draft.step === 1 && draft.path !== "new" && (
        <Step1Path
          onChoose={(path) =>
            setDraft((prev) => ({ ...prev, path, step: path === "new" ? 1 : 2 }))
          }
        />
      )}

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
  );
}
