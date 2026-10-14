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

  const [selectedProjectId, setSelectedProjectId] = useState(
    draft.selectedProjectId,
  );
  const [projectSearch, setProjectSearch] = useState("");
  const [switchedToNew, setSwitchedToNew] = useState(false);
  const [screenshotPath, setScreenshotPath] = useState(draft.screenshotPath);
  // Three short screens inside the one "Details" step: who you are, which project, then its proof.
  const [shotError, setShotError] = useState(false);
  const [part, setPart] = useState<"you" | "project" | "proof">("you");
  const headingRef = useFocusHeading(part);
  useEffect(() => {
    onPartChange(part === "you" ? 1 : part === "project" ? 2 : 3);
  }, [part, onPartChange]);

  const phoneValue = detailsForm.watch("phone");
  const debouncedPhone = useDebounced(phoneValue, 400);
  const phoneReady = isValidIndianMobile(debouncedPhone ?? "");
  const showRegisteredPath = draft.path === "registered" && !switchedToNew;

  const projectsQuery = useQuery({
    queryKey: ["find_projects", debouncedPhone],
    queryFn: () => findProjects(debouncedPhone),
    enabled: showRegisteredPath && phoneReady,
  });

  const visibleProjects = (projectsQuery.data ?? []).filter((p) =>
    p.name.toLowerCase().includes(projectSearch.trim().toLowerCase()),
  );

  function submit(
    details: DetailsFormValues,
    newProject?: NewProjectFormValues,
  ) {
    if (!screenshotPath) {
      setShotError(true);
      return;
    }

    if (showRegisteredPath) {
      if (!selectedProjectId) return;
      const selected = projectsQuery.data?.find(
        (p) => p.id === selectedProjectId,
      );
      onNext({
        path: "registered",
        requesterName: details.requesterName,
        phone: details.phone,
        selectedProjectId,
        selectedProjectName: selected?.name ?? draft.selectedProjectName,
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
    <div className="motion-list flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
              <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold text-foreground focus:outline-none">
        {part === "you" ? "About you" : part === "project" ? "Your project" : "Show us your project page"}
      </h1>
        {part === "proof" && (
          <ExampleImageTrigger>
            <span className="inline-flex min-h-11 items-center rounded-full bg-accent/10 px-4 text-sm font-semibold text-accent">
              See example
            </span>
          </ExampleImageTrigger>
        )}
      </div>


      <div className="motion-list flex flex-col gap-4">
        {part === "you" && (
          <>
            <p className="text-sm text-muted">
              We'll use this to identify your request in the TinkerHub app.
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
              hint="10-digit mobile number, as saved on the TinkerHub app."
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
                  Your phone number is how we find your project on the TinkerHub app. Your name tells
                  the inventory manager who the request is for.
                </p>
              </div>
            </div>
          </>
        )}

        {part === "project" &&
          (showRegisteredPath ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted">Select the project you added in the TinkerHub app.</p>
              {!phoneReady && (
                <p className="text-sm text-muted">
                  Enter the phone number you used on the TinkerHub app and we'll
                  find your project.
                </p>
              )}
              {phoneReady && projectsQuery.isLoading && (
                <div role="status" aria-label="Searching for your project">
                  <SkeletonLines count={2} />
                </div>
              )}
              {phoneReady && projectsQuery.isError && (
                <div className="flex flex-col items-start gap-1">
                  <p className="text-sm text-danger">Couldn't search right now.</p>
                  <button
                    type="button"
                    onClick={() => projectsQuery.refetch()}
                    className="inline-flex min-h-11 items-center text-sm font-medium text-accent hover:underline"
                  >
                    Try again
                  </button>
                </div>
              )}
              {phoneReady &&
                projectsQuery.data &&
                projectsQuery.data.length === 0 && (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm text-muted">
                      No project is linked to this number. Check the number, or
                      add your project here.
                    </p>
                    <button
                      type="button"
                      onClick={() => setSwitchedToNew(true)}
                      className="inline-flex min-h-11 items-center self-start text-sm font-medium text-accent hover:underline"
                    >
                      Add a new project instead
                    </button>
                  </div>
                )}
              {phoneReady &&
                projectsQuery.data &&
                projectsQuery.data.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <label className="flex min-h-12 items-center gap-2 rounded-xl border-2 border-border bg-surface px-3 focus-within:border-accent">
                      <span className="text-muted"><Icon d={ICON.search} /></span>
                      <input
                        type="search"
                        aria-label="Search your project"
                        placeholder="Search your project"
                        value={projectSearch}
                        onChange={(e) => setProjectSearch(e.target.value)}
                        className="min-h-11 min-w-0 flex-1 bg-transparent text-base text-foreground outline-none"
                      />
                    </label>
                    <div role="radiogroup" aria-label="Your projects" className="flex flex-col gap-2">
                      {visibleProjects.map((p) => {
                        const on = p.id === selectedProjectId;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            onClick={() => setSelectedProjectId(p.id)}
                            className={`flex items-center gap-3 rounded-xl border-2 p-3 text-left ${
                              on ? "border-accent bg-accent/10" : "border-transparent bg-surface shadow-surface"
                            }`}
                          >
                            <span
                              aria-hidden
                              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-foreground text-lg font-bold"
                              style={{ color: "var(--sticker-lime)" }}
                            >
                              {p.name.trim().charAt(0).toUpperCase()}
                            </span>
                            <span className="flex min-w-0 flex-1 flex-col">
                              <span className="truncate text-base font-semibold text-foreground">{p.name}</span>
                              <span className="text-sm text-muted">Your project from the TinkerHub app</span>
                            </span>
                            <span
                              aria-hidden
                              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                                on ? "border-accent" : "border-muted"
                              }`}
                            >
                              {on && <span className="h-3 w-3 rounded-full bg-accent" />}
                            </span>
                          </button>
                        );
                      })}
                      {visibleProjects.length === 0 && (
                        <p role="status" className="text-sm text-muted">
                          No project matches "{projectSearch.trim()}".
                        </p>
                      )}
                    </div>
                    <div className="flex gap-3 rounded-xl bg-accent/10 p-4">
                      <span className="mt-0.5 text-accent">
                        <Icon d={ICON.info} className="h-6 w-6 shrink-0" />
                      </span>
                      <div className="flex flex-col gap-0.5">
                        <p className="text-sm font-semibold text-foreground">Don't see your project?</p>
                        <p className="text-sm text-muted">
                          Make sure it's added in the TinkerHub app using the same phone number, or{" "}
                          <button
                            type="button"
                            onClick={() => setSwitchedToNew(true)}
                            className="font-medium text-accent underline"
                          >
                            add it here
                          </button>
                          .
                        </p>
                      </div>
                    </div>
                  </div>
                )}
            </div>
          ) : (
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
          ))}

        {part === "proof" && (
          <>
            <p className="text-sm text-muted">
              Upload a screenshot of your project page on the TinkerHub app.
            </p>
            <div className="flex gap-3 rounded-xl bg-accent/10 p-4">
              <span className="mt-0.5 text-accent"><Icon d={ICON.shield} className="h-6 w-6 shrink-0" /></span>
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-semibold text-foreground">Used only for verification</p>
                <p className="text-sm text-muted">
                  We use this only to verify your project. It is deleted after your request is reviewed.
                </p>
              </div>
            </div>
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

      {part === "project" && showRegisteredPath && phoneReady && !selectedProjectId && (
        <p className="text-sm text-muted">Choose your project above to continue.</p>
      )}

      <div className="flex gap-3">
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
                    if (showRegisteredPath || (await newProjectForm.trigger())) setPart("proof");
                  }
              : showRegisteredPath
                ? detailsForm.handleSubmit((details) => submit(details))
                : detailsForm.handleSubmit((details) =>
                    newProjectForm.handleSubmit((np) => submit(details, np))(),
                  )
          }
          disabled={part === "project" && showRegisteredPath && !selectedProjectId}
          className="flex-1 rounded-full"
        >
          {part === "proof" ? "Next →" : "Continue →"}
        </Button>
      </div>
    </div>
  );
}
