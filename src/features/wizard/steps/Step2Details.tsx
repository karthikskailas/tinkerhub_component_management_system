import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "../../../components/ui/Button";
import { SkeletonLines } from "../../../components/ui/Skeleton";
import { Input, Textarea } from "../../../components/ui/Input";
import { useFocusHeading } from "../../../lib/useFocusHeading";
import { isValidIndianMobile } from "../../../lib/phone";
import { findProjects } from "../../requests/api";
import { ExampleImageTrigger } from "../ExampleImage";
import { ScreenshotUpload } from "../ScreenshotUpload";
import { detailsSchema, newProjectSchema } from "../schema";
import type { DetailsFormValues, NewProjectFormValues } from "../schema";
import type { WizardDraft } from "../types";

interface Step2Props {
  draft: WizardDraft;
  userId: string;
  onPartChange: (part: number) => void;
  onBack: () => void;
  onNext: (patch: Partial<WizardDraft>) => void;
}

const NEW_PROJECT = "__new__";

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

const ICON = {
  user: "M12 12a4 4 0 100-8 4 4 0 000 8zM4.5 20a7.5 7.5 0 0115 0",
  phone:
    "M6.5 3h3l1.5 4-2 1.5a11 11 0 006 6L16.5 12.5l4 1.5v3a2 2 0 01-2 2A15 15 0 014.5 5a2 2 0 012-2z",
  shield: "M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3zM9 12l2 2 4-4",
  clear: "M6 6l12 12M18 6L6 18",
  search: "M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4",
  info: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v5M12 8h.01",
};

function Icon({ d, className = "h-5 w-5" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"
      strokeLinejoin="round" className={className} aria-hidden>
      <path d={d} />
    </svg>
  );
}

function IconField({
  label,
  icon,
  error,
  hint,
  value,
  onClear,
  inputProps,
}: {
  label: string;
  icon: string;
  error?: string;
  hint?: string;
  value: string;
  onClear: () => void;
  inputProps: React.InputHTMLAttributes<HTMLInputElement> & { ref?: React.Ref<HTMLInputElement> };
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-foreground">{label}</span>
        <span
          className={`flex min-h-12 items-center gap-2 rounded-xl border-2 bg-surface px-3 focus-within:border-accent ${
            error ? "border-danger" : "border-border"
          }`}
        >
          <span className="text-accent"><Icon d={icon} /></span>
          <input
            {...inputProps}
            aria-invalid={!!error}
            className="min-h-11 min-w-0 flex-1 bg-transparent text-base text-foreground outline-none"
          />
          {value && (
            <button
              type="button"
              onClick={onClear}
              aria-label={`Clear ${label.toLowerCase()}`}
              className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center text-muted"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-default">
                <Icon d={ICON.clear} className="h-3.5 w-3.5" />
              </span>
            </button>
          )}
        </span>
      </label>
      {hint && !error && <span className="text-sm text-muted">{hint}</span>}
      {error && <span className="text-sm text-danger">{error}</span>}
    </div>
  );
}

export function Step2Details({ draft, userId, onPartChange, onBack, onNext }: Step2Props) {
  const detailsForm = useForm<DetailsFormValues>({
    resolver: zodResolver(detailsSchema),
    defaultValues: { requesterName: draft.requesterName, phone: draft.phone },
  });

  const newProjectForm = useForm<NewProjectFormValues>({
    resolver: zodResolver(newProjectSchema),
    defaultValues: {
      name: draft.newProject?.name ?? "",
      description: draft.newProject?.description ?? "",
      ownerName: draft.newProject?.ownerName ?? "",
    },
  });

  // "" = nothing chosen yet, NEW_PROJECT = "Add a new project", otherwise a project id.
  const [choice, setChoice] = useState<string>(draft.selectedProjectId ?? "");
  const [screenshotPath, setScreenshotPath] = useState(draft.screenshotPath);
  // Three short screens inside the one "Details" step: who you are, which project, then its proof.
  const [shotError, setShotError] = useState(false);
  const [search, setSearch] = useState("");
  const [part, setPart] = useState<"you" | "project" | "proof">("you");
  const headingRef = useFocusHeading(part);
  useEffect(() => {
    onPartChange(part === "you" ? 1 : part === "project" ? 2 : 3);
  }, [part, onPartChange]);

  const phoneValue = detailsForm.watch("phone");
  const debouncedPhone = useDebounced(phoneValue, 250);
  const phoneReady = isValidIndianMobile(debouncedPhone ?? "");

  const projectsQuery = useQuery({
    queryKey: ["find_projects", debouncedPhone],
    queryFn: () => findProjects(debouncedPhone),
    enabled: phoneReady,
    retry: false,
  });

  const projects = projectsQuery.data ?? [];
  // First-time phone numbers have no projects: go straight to the new-project fields.
  // A failed or empty lookup also lands here: it is only a convenience, never an error.
  const showSelect = projectsQuery.isSuccess && projects.length > 0;
  const showNewProject = choice === NEW_PROJECT || !showSelect;
  const chosenProject = projects.find((p) => p.id === choice) ?? null;
  const projectLoading = phoneReady && projectsQuery.isFetching;

  function submit(
    details: DetailsFormValues,
    newProject?: NewProjectFormValues,
  ) {
    if (!screenshotPath) {
      setShotError(true);
      return;
    }

    if (!showNewProject) {
      if (!chosenProject) return;
      onNext({
        path: "registered",
        requesterName: details.requesterName,
        phone: details.phone,
        selectedProjectId: chosenProject.id,
        selectedProjectName: chosenProject.name,
        newProject: null,
        screenshotPath,
      });
    } else if (newProject) {
      onNext({
        path: "new",
        requesterName: details.requesterName,
        phone: details.phone,
        selectedProjectId: null,
        selectedProjectName: null,
        newProject: {
          name: newProject.name,
          description: newProject.description,
          ownerName: newProject.ownerName ?? "",
        },
        screenshotPath,
      });
    }
  }

  return (
    <div className="motion-list flex flex-1 flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="min-w-0 text-xl font-bold leading-tight text-foreground focus:outline-none"
        >
          {part === "you" ? "About you" : part === "project" ? "Your project" : "Show us your project page"}
        </h1>
        {part === "proof" && (
          <ExampleImageTrigger className="shrink-0">
            <span className="inline-flex min-h-11 items-center whitespace-nowrap rounded-full bg-accent/10 px-4 text-sm font-semibold text-accent">
              See example
            </span>
          </ExampleImageTrigger>
        )}
      </div>

      <div className="motion-list flex flex-col gap-4">
        {part === "you" && (
          <>
            <p className="text-sm text-muted">
              Tell us who is collecting the components.
            </p>
            <IconField
              label="Your name"
              icon={ICON.user}
              value={detailsForm.watch("requesterName") ?? ""}
              onClear={() => detailsForm.setValue("requesterName", "", { shouldDirty: true })}
              error={detailsForm.formState.errors.requesterName?.message}
              inputProps={{ autoComplete: "name", ...detailsForm.register("requesterName") }}
            />
            <IconField
              label="Phone number"
              icon={ICON.phone}
              value={phoneValue ?? ""}
              onClear={() => detailsForm.setValue("phone", "", { shouldDirty: true })}
              hint="10-digit mobile number."
              error={detailsForm.formState.errors.phone?.message}
              inputProps={{
                type: "tel",
                inputMode: "numeric",
                autoComplete: "tel-national",
                placeholder: "9876543210",
                ...detailsForm.register("phone"),
              }}
            />
            <div className="flex gap-3 rounded-xl bg-accent/10 p-4">
              <span className="mt-0.5 text-accent"><Icon d={ICON.shield} className="h-6 w-6 shrink-0" /></span>
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-semibold text-foreground">Why we need this</p>
                <p className="text-sm text-muted">
                  Your phone number lets us recognise you if you've requested before. Your name tells
                  the inventory manager who the request is for.
                </p>
              </div>
            </div>
          </>
        )}

        {part === "project" && (
          <div className="flex flex-col gap-4">
            {projectLoading && (
              <div role="status" aria-label="Loading your projects">
                <SkeletonLines count={2} />
              </div>
            )}
            {showSelect && !projectsQuery.isFetching && (
              <>
                <p className="text-sm text-muted">
                  Pick one of your projects, or add a new one.
                </p>
                <label className="flex min-h-12 items-center gap-2 rounded-xl border-2 border-accent/40 bg-surface px-3 focus-within:border-accent">
                  <span className="text-accent"><Icon d={ICON.search} /></span>
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search your project"
                    aria-label="Search your project"
                    className="min-h-11 min-w-0 flex-1 bg-transparent text-base text-foreground outline-none"
                  />
                </label>
                <div role="radiogroup" aria-label="Your projects" className="flex flex-col gap-3">
                  {projects
                    .filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()))
                    .map((p) => (
                      <label
                        key={p.id}
                        className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border-2 p-3 focus-within:ring-2 focus-within:ring-accent ${
                          choice === p.id ? "border-accent bg-accent/10" : "border-border bg-surface"
                        }`}
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-foreground text-sm font-bold text-surface">
                          {p.name.slice(0, 1).toUpperCase()}
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-base font-semibold text-foreground">{p.name}</span>
                          <span className="text-sm text-muted">Your project</span>
                        </span>
                        <input
                          type="radio"
                          name="project"
                          value={p.id}
                          checked={choice === p.id}
                          onChange={() => setChoice(p.id)}
                          className="h-5 w-5 shrink-0 accent-[var(--accent)]"
                        />
                      </label>
                    ))}
                </div>
                <div className="flex gap-3 rounded-xl bg-accent/10 p-4">
                  <span className="mt-0.5 text-accent"><Icon d={ICON.info} className="h-6 w-6 shrink-0" /></span>
                  <div className="flex flex-col gap-0.5">
                    <p className="text-sm font-semibold text-foreground">Not in the list?</p>
                    <p className="text-sm text-muted">
                      Add it as a new project.{" "}
                      <button
                        type="button"
                        onClick={() => setChoice(NEW_PROJECT)}
                        className="font-semibold text-accent underline"
                      >
                        Add a new project
                      </button>
                    </p>
                  </div>
                </div>
              </>
            )}
            {showNewProject && !projectsQuery.isFetching && (
              <div className="flex flex-col gap-4">
                <Input
                  label="Project name"
                  error={newProjectForm.formState.errors.name?.message}
                  {...newProjectForm.register("name")}
                />
                <Textarea
                  label="Project description"
                  rows={3}
                  error={newProjectForm.formState.errors.description?.message}
                  {...newProjectForm.register("description")}
                />
                <Input
                  label="Project owner (optional, if not you)"
                  {...newProjectForm.register("ownerName")}
                />
              </div>
            )}
          </div>
        )}

        {part === "proof" && (
          <>
            <p className="text-sm text-muted">
              Upload a screenshot of your project page on the TinkerHub app.
            </p>
            <ScreenshotUpload
              userId={userId}
              path={screenshotPath}
              onChange={(p) => {
                setScreenshotPath(p);
                setShotError(false);
              }}
              error={shotError ? "Add a screenshot of your project page to continue." : undefined}
            />
          </>
        )}
      </div>

      <div className="mt-auto flex gap-3 pt-4">
        <Button
          variant="secondary"
          onClick={
            part === "proof" ? () => setPart("project") : part === "project" ? () => setPart("you") : onBack
          }
          className="shrink-0 rounded-full"
        >
          Back
        </Button>
        <Button
          onClick={
            part === "you"
              ? async () => {
                  if (await detailsForm.trigger()) setPart("project");
                }
              : part === "project"
                ? async () => {
                    if (!showNewProject || (await newProjectForm.trigger())) setPart("proof");
                  }
              : !showNewProject
                ? detailsForm.handleSubmit((details) => submit(details))
                : detailsForm.handleSubmit((details) =>
                    newProjectForm.handleSubmit((np) => submit(details, np))(),
                  )
          }
          disabled={
            part === "project" &&
            (projectLoading || (showSelect && !choice))
          }
          className="flex-1 rounded-full"
        >
          {part === "proof" ? "Next →" : "Continue →"}
        </Button>
      </div>
    </div>
  );
}
