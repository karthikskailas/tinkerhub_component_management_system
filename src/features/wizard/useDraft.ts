import { useCallback, useState } from "react";
import { LAST_CONTACT_KEY, local, session, WIZARD_DRAFT_KEY } from "../../lib/storage";
import { EMPTY_DRAFT } from "./types";
import type { WizardDraft } from "./types";

// A returning student on this device starts with their name and phone filled in.
function lastContact(): Pick<WizardDraft, "requesterName" | "phone"> {
  try {
    const c = JSON.parse(local.get(LAST_CONTACT_KEY) ?? "null");
    if (typeof c?.requesterName === "string" && typeof c?.phone === "string") return c;
  } catch {
    // fall through to blank
  }
  return { requesterName: "", phone: "" };
}

function freshDraft(): WizardDraft {
  return { ...EMPTY_DRAFT, ...lastContact() };
}

function loadInitialDraft(): WizardDraft {
  return session.getJSON<WizardDraft>(WIZARD_DRAFT_KEY) ?? freshDraft();
}

export function useDraft() {
  const [draft, setDraftState] = useState<WizardDraft>(loadInitialDraft);

  const setDraft = useCallback((updater: (prev: WizardDraft) => WizardDraft) => {
    setDraftState((prev) => {
      const next = updater(prev);
      session.setJSON(WIZARD_DRAFT_KEY, next);
      return next;
    });
  }, []);

  const clearDraft = useCallback(() => {
    session.remove(WIZARD_DRAFT_KEY);
    setDraftState(freshDraft());
  }, []);

  return { draft, setDraft, clearDraft };
}
