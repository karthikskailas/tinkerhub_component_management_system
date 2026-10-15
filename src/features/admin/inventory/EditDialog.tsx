import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Input, Textarea } from "../../../components/ui/Input";
import { Modal } from "../../../components/ui/Modal";
import { toast } from "../../../components/ui/Toast";
import { parseSupabaseError } from "../../../lib/errors";
import { useOnlineStatus } from "../../../lib/useOnlineStatus";
import { deleteComponent, updateComponent } from "./api";
import type { ComponentEditFields, ComponentField, ComponentRow } from "./api";

interface EditDialogProps {
  component: ComponentRow | null;
  customFields: ComponentField[];
  onClose: () => void;
  onSaved: () => void;
  onAdjustCount: (component: ComponentRow) => void;
}

interface FormState {
  name: string;
  location: string;
  description: string;
  image_url: string;
  returnable: boolean;
  custom: Record<string, string>;
}

function toForm(c: ComponentRow, fields: ComponentField[]): FormState {
  return {
    custom: Object.fromEntries(
      fields.map((f) => [f.key, c[f.key] == null ? "" : f.type === "bool" ? (c[f.key] ? "yes" : "no") : String(c[f.key])]),
    ),
    name: c.name,
    location: c.location ?? "",
    description: c.description ?? "",
    image_url: c.image_url ?? "",
    returnable: c.returnable,
  };
}

// Only fields that differ from the stored row are sent.
function changedFields(c: ComponentRow, form: FormState, fields: ComponentField[]): ComponentEditFields {
  const original = toForm(c, fields);
  const out: ComponentEditFields = {};
  for (const f of fields) {
    if (form.custom[f.key].trim() !== original.custom[f.key]) out[f.key] = form.custom[f.key].trim();
  }
  if (form.name.trim() !== original.name) out.name = form.name.trim();
  if (form.location.trim() !== original.location) out.location = form.location.trim();
  if (form.description.trim() !== original.description) out.description = form.description.trim();
  if (form.image_url.trim() !== original.image_url) out.image_url = form.image_url.trim();
  if (form.returnable !== original.returnable) out.returnable = form.returnable;
  return out;
}

export function EditDialog({ component, customFields, onClose, onSaved, onAdjustCount }: EditDialogProps) {
  const isOnline = useOnlineStatus();
  const [form, setForm] = useState<FormState | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setForm(component ? toForm(component, customFields) : null);
    setConfirmDelete(false);
    // Keyed on id so reopening the same row after an aborted edit resets.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [component?.id]);

  const fields = component && form ? changedFields(component, form, customFields) : {};
  const hasChanges = Object.keys(fields).length > 0;
  const nameMissing = !!form && form.name.trim() === "";

  const mutation = useMutation({
    mutationFn: () => updateComponent(component!.id, fields),
    onSuccess: () => {
      toast.success("Component updated.");
      onSaved();
      onClose();
    },
    onError: (error) => {
      const parsed = parseSupabaseError(error);
      // The backend's own wording is the specific one for a name/location clash.
      toast.error(parsed.code === "E_DUPLICATE" ? "A component with this name and location already exists" : parsed.message);
    },
  });

  const remove = useMutation({
    mutationFn: () => deleteComponent(component!.id),
    onSuccess: () => {
      toast.success("Component deleted.");
      onSaved();
      onClose();
    },
    onError: (error) => {
      setConfirmDelete(false);
      toast.error(parseSupabaseError(error).message);
    },
  });

  const set = (patch: Partial<FormState>) => setForm((prev) => (prev ? { ...prev, ...patch } : prev));

  return (
    <Modal open={!!component} onClose={onClose} titleId="edit-dialog-title">
      {component && form && (
        <>
          <h2 id="edit-dialog-title" className="text-xl font-bold text-foreground">
            Edit {component.name}
          </h2>

          <div className="flex flex-col gap-4">
            <Input
              label="Name"
              value={form.name}
              maxLength={200}
              onChange={(e) => set({ name: e.target.value })}
              error={nameMissing ? "Name is required" : undefined}
            />
            <Input
              label="Location"
              value={form.location}
              maxLength={200}
              onChange={(e) => set({ location: e.target.value })}
            />
            <Textarea
              label="Description"
              rows={3}
              maxLength={500}
              value={form.description}
              onChange={(e) => set({ description: e.target.value })}
            />
            <Input
              label="Image link"
              type="url"
              inputMode="url"
              value={form.image_url}
              onChange={(e) => set({ image_url: e.target.value })}
              hint="Optional https link to a photo."
            />
            {customFields.map((f) => (
              <Input
                key={f.key}
                label={f.label}
                value={form.custom[f.key] ?? ""}
                maxLength={f.max_length ?? undefined}
                inputMode={f.type === "int" || f.type === "numeric" ? "decimal" : undefined}
                hint={f.type === "bool" ? "yes or no" : undefined}
                onChange={(e) => set({ custom: { ...form.custom, [f.key]: e.target.value } })}
              />
            ))}
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={form.returnable}
                onChange={(e) => set({ returnable: e.target.checked })}
              />
              Returnable
            </label>
            <p className="text-sm text-muted">
              Count: <span className="font-medium text-foreground">{component.count}</span> (reserved{" "}
              {component.reserved}) ·{" "}
              <button
                type="button"
                onClick={() => onAdjustCount(component)}
                className="font-medium text-accent hover:underline"
              >
                Adjust count
              </button>
            </p>
          </div>

          <div className="flex flex-col gap-2 rounded-xl border border-border p-3">
            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={!isOnline}
                className="self-start text-sm font-medium text-danger hover:underline disabled:opacity-50"
              >
                Delete component
              </button>
            ) : (
              <>
                <p className="text-sm text-foreground">
                  Delete {component.name} permanently? This can't be undone. Components used in
                  requests can't be deleted.
                </p>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setConfirmDelete(false)} disabled={remove.isPending}>
                    Keep
                  </Button>
                  <Button
                    variant="danger"
                    loading={remove.isPending}
                    disabled={!isOnline}
                    onClick={() => remove.mutate()}
                  >
                    Delete
                  </Button>
                </div>
              </>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button
              disabled={!hasChanges || nameMissing || mutation.isPending || !isOnline}
              loading={mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {isOnline ? "Save" : "Offline"}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
