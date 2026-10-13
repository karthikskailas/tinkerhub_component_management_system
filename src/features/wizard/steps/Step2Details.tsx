import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "../../../components/ui/Button";
import { Input, Textarea } from "../../../components/ui/Input";
import { toast } from "../../../components/ui/Toast";
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

export function Step2Details({ draft, userId, onBack, onNext }: Step2Props) {
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

  const [selectedProjectId, setSelectedProjectId] = useState(draft.selectedProjectId);
  const [switchedToNew, setSwitchedToNew] = useState(false);
  const [screenshotPath, setScreenshotPath] = useState(draft.screenshotPath);

  const phoneValue = detailsForm.watch("phone");
  const debouncedPhone = useDebounced(phoneValue, 400);
  const phoneReady = isValidIndianMobile(debouncedPhone ?? "");
  const showRegisteredPath = draft.path === "registered" && !switchedToNew;

  const projectsQuery = useQuery({
    queryKey: ["find_projects", debouncedPhone],
    queryFn: () => findProjects(debouncedPhone),
    enabled: showRegisteredPath && phoneReady,
  });

  function submit(details: DetailsFormValues, newProject?: NewProjectFormValues) {
    if (!screenshotPath) {
      toast.error("Please upload a screenshot before continuing.");
      return;
    }

    if (showRegisteredPath) {
      if (!selectedProjectId) return;
      const selected = projectsQuery.data?.find((p) => p.id === selectedProjectId);
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
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold text-foreground">Your details</h1>

      <div className="flex flex-col gap-4">
        <Input
          label="Your name"
          error={detailsForm.formState.errors.requesterName?.message}
          {...detailsForm.register("requesterName")}
        />
        <Input
          label="Phone number"
          type="tel"
          inputMode="numeric"
          placeholder="9876543210"
          error={detailsForm.formState.errors.phone?.message}
          {...detailsForm.register("phone")}
        />

        {showRegisteredPath ? (
          <div className="flex flex-col gap-2">
            {!phoneReady && (
              <p className="text-sm text-muted">
                Enter your 10-digit phone number to look up your project.
              </p>
            )}
            {phoneReady && projectsQuery.isLoading && <p className="text-sm text-muted">Searching...</p>}
            {phoneReady && projectsQuery.isError && (
              <p className="text-sm text-danger">Couldn't search right now. Try again.</p>
            )}
            {phoneReady && projectsQuery.data && projectsQuery.data.length === 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-muted">No project found for this number.</p>
                <button
                  type="button"
                  onClick={() => setSwitchedToNew(true)}
                  className="self-start text-sm font-medium text-accent hover:underline"
                >
                  Add a new project instead
                </button>
              </div>
            )}
            {phoneReady && projectsQuery.data && projectsQuery.data.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-foreground">Select your project</span>
                {projectsQuery.data.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedProjectId(p.id)}
                    data-selected={p.id === selectedProjectId}
                    className={`rounded-xl px-4 py-3 text-left text-sm font-medium shadow-surface ${
                      p.id === selectedProjectId
                        ? "bg-accent text-accent-foreground"
                        : "bg-surface text-foreground"
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
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
              label="Owner name (optional)"
              {...newProjectForm.register("ownerName")}
            />
          </div>
        )}

        <ScreenshotUpload
          userId={userId}
          path={screenshotPath}
          onChange={setScreenshotPath}
          label="Screenshot of your project page on the TinkerHub app"
          labelExtra={
            <ExampleImageTrigger>
              <span className="text-sm font-medium text-accent hover:underline">See example</span>
            </ExampleImageTrigger>
          }
          helperText="We use this only to verify your project. It is deleted after your request is reviewed."
        />
      </div>

      <div className="flex gap-3">
        <Button variant="secondary" onClick={onBack} className="shrink-0 rounded-full">
          Back
        </Button>
        <Button
          onClick={
            showRegisteredPath
              ? detailsForm.handleSubmit((details) => submit(details))
              : detailsForm.handleSubmit((details) =>
                  newProjectForm.handleSubmit((np) => submit(details, np))(),
                )
          }
          disabled={showRegisteredPath && !selectedProjectId}
          className="flex-1 rounded-full"
        >
          Next →
        </Button>
      </div>
    </div>
  );
}
