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
    <div>
      <h1 className="mb-4 text-xl font-semibold text-slate-900">Your details</h1>

      <div className="space-y-4">
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
          <div>
            {!phoneReady && (
              <p className="text-sm text-slate-500">
                Enter your 10-digit phone number to look up your project.
              </p>
            )}
            {phoneReady && projectsQuery.isLoading && (
              <p className="text-sm text-slate-500">Searching...</p>
            )}
            {phoneReady && projectsQuery.isError && (
              <p className="text-sm text-red-600">Couldn't search right now. Try again.</p>
            )}
            {phoneReady && projectsQuery.data && projectsQuery.data.length === 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-sm text-amber-800">No project found for this number.</p>
                <button
                  type="button"
                  onClick={() => setSwitchedToNew(true)}
                  className="mt-2 min-h-11 text-sm font-medium text-indigo-600"
                >
                  Add a new project instead
                </button>
              </div>
            )}
            {phoneReady && projectsQuery.data && projectsQuery.data.length > 0 && (
              <div className="space-y-2">
                <span className="block text-sm font-medium text-slate-700">Select your project</span>
                {projectsQuery.data.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedProjectId(p.id)}
                    className={`block min-h-11 w-full rounded-lg border px-3 py-2.5 text-left text-sm ${
                      selectedProjectId === p.id
                        ? "border-indigo-500 bg-indigo-50"
                        : "border-slate-300"
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 rounded-lg border border-slate-200 p-3">
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
            <ExampleImageTrigger className="text-xs font-medium text-indigo-600">
              See example
            </ExampleImageTrigger>
          }
          helperText="We use this only to verify your project. It is deleted after your request is reviewed."
        />
      </div>

      <div className="mt-6 flex justify-between">
        <Button variant="secondary" onClick={onBack}>
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
        >
          Next
        </Button>
      </div>
    </div>
  );
}
