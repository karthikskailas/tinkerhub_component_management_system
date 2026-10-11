import { useCallback, useState } from "react";
import { session, WIZARD_DRAFT_KEY } from "../../lib/storage";
import { EMPTY_DRAFT } from "./types";
import type { WizardDraft } from "./types";

function loadInitialDraft(): WizardDraft {
  return session.getJSON<WizardDraft>(WIZARD_DRAFT_KEY) ?? EMPTY_DRAFT;
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
    setDraftState(EMPTY_DRAFT);
  }, []);

  return { draft, setDraft, clearDraft };
}
