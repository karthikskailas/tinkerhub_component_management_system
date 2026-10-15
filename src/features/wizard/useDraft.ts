import { useCallback, useState } from "react";
import { LAST_CONTACT_KEY, local, WIZARD_DRAFT_KEY } from "../../lib/storage";
import { EMPTY_DRAFT } from "./types";
import type { WizardDraft } from "./types";

const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

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

// Stored as { savedAt, draft }. Never holds the File itself, only the
// already-uploaded screenshot path. Corrupt or expired drafts are ignored.
function loadInitialDraft(): WizardDraft {
  try {
    const saved = JSON.parse(local.get(WIZARD_DRAFT_KEY) ?? "null");
    if (
      saved &&
      typeof saved.savedAt === "number" &&
      Date.now() - saved.savedAt < DRAFT_TTL_MS &&
      saved.draft &&
      typeof saved.draft === "object"
    ) {
      return { ...EMPTY_DRAFT, ...saved.draft };
    }
  } catch {
    // corrupt: fall through
  }
  local.remove(WIZARD_DRAFT_KEY);
  return freshDraft();
}

export function useDraft() {
  const [draft, setDraftState] = useState<WizardDraft>(loadInitialDraft);

  const setDraft = useCallback((updater: (prev: WizardDraft) => WizardDraft) => {
    setDraftState((prev) => {
      const next = updater(prev);
      local.set(WIZARD_DRAFT_KEY, JSON.stringify({ savedAt: Date.now(), draft: next }));
      return next;
    });
  }, []);

  const clearDraft = useCallback(() => {
    local.remove(WIZARD_DRAFT_KEY);
    setDraftState(freshDraft());
  }, []);

  return { draft, setDraft, clearDraft };
}
