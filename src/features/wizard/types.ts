import type { CartLine } from "../catalog/ComponentPicker";

export type ProjectPath = "registered" | "new";

export interface WizardDraft {
  step: 1 | 2 | 3 | 4;
  path: ProjectPath | null;
  requesterName: string;
  phone: string;
  selectedProjectId: string | null;
  selectedProjectName: string | null;
  newProject: { name: string; description: string; ownerName: string } | null;
  screenshotPath: string | null;
  cart: Record<string, CartLine>;
}

export const EMPTY_DRAFT: WizardDraft = {
  step: 1,
  path: null,
  requesterName: "",
  phone: "",
  selectedProjectId: null,
  selectedProjectName: null,
  newProject: null,
  screenshotPath: null,
  cart: {},
};
