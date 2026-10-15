import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Modal } from "../../../components/ui/Modal";
import { toast } from "../../../components/ui/Toast";
import { parseSupabaseError } from "../../../lib/errors";
import { useOnlineStatus } from "../../../lib/useOnlineStatus";
import { createComponentField, updateComponentField } from "./api";
import type { ComponentField } from "./api";
import { FIELDS_QUERY_KEY } from "./useComponents";

interface FieldsDialogProps {
  open: boolean;
  fields: ComponentField[];
  onClose: () => void;
}

const TYPES: { value: ComponentField["type"]; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "int", label: "Whole number" },
  { value: "numeric", label: "Decimal number" },
  { value: "bool", label: "Yes / no" },
];

function FieldRow({ field, disabled }: { field: ComponentField; disabled: boolean }) {
  const queryClient = useQueryClient();
  const [label, setLabel] = useState(field.label);

  const mutation = useMutation({
    mutationFn: (patch: Parameters<typeof updateComponentField>[1]) =>
      updateComponentField(field.key, patch),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: [FIELDS_QUERY_KEY] }),
    onError: (error) => toast.error(parseSupabaseError(error).message),
  });

  const busy = disabled || mutation.isPending;
  const typeLabel = TYPES.find((t) => t.value === field.type)?.label ?? field.type;

  return (
    <li className={`flex flex-col gap-2 rounded-xl bg-background p-3 ${field.archived ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <input
          aria-label={`Name of ${field.key}`}
          value={label}
          maxLength={60}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => {
            const next = label.trim();
            if (next && next !== field.label) mutation.mutate({ label: next });
            else setLabel(field.label);
          }}
          disabled={busy}
          className="min-h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-sm text-field-foreground"
        />
        <span className="text-xs text-muted">
          {field.is_core ? "Built-in" : typeLabel}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-foreground">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={field.show_in_table}
            disabled={busy || field.archived}
            onChange={(e) => mutation.mutate({ showInTable: e.target.checked })}
          />
          Show in table
        </label>
        {!field.is_core && field.type === "text" && (
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={field.searchable}
              disabled={busy || field.archived}
              onChange={(e) => mutation.mutate({ searchable: e.target.checked })}
            />
            Searchable
          </label>
        )}
        {!field.is_core && (
          <button
            type="button"
            disabled={busy}
            onClick={() => mutation.mutate({ archived: !field.archived })}
            className="font-medium text-accent hover:underline disabled:opacity-50"
          >
            {field.archived ? "Restore" : "Hide field"}
          </button>
        )}
      </div>
    </li>
  );
}

export function FieldsDialog({ open, fields, onClose }: FieldsDialogProps) {
  const isOnline = useOnlineStatus();
  const queryClient = useQueryClient();
  const [label, setLabel] = useState("");
  const [type, setType] = useState<ComponentField["type"]>("text");
  const [searchable, setSearchable] = useState(false);

  const create = useMutation({
    mutationFn: () => createComponentField({ label: label.trim(), type, searchable }),
    onSuccess: () => {
      toast.success("Field added.");
      setLabel("");
      setType("text");
      setSearchable(false);
      void queryClient.invalidateQueries({ queryKey: [FIELDS_QUERY_KEY] });
    },
    onError: (error) => toast.error(parseSupabaseError(error).message),
  });

  return (
    <Modal open={open} onClose={onClose} titleId="fields-dialog-title">
      <h2 id="fields-dialog-title" className="text-xl font-bold text-foreground">
        Fields
      </h2>
      <p className="text-sm text-muted">
        Add your own columns. Renaming only changes the label; hiding a field keeps its data.
      </p>

      <ul className="flex flex-col gap-2">
        {fields.map((f) => (
          <FieldRow key={f.key} field={f} disabled={!isOnline} />
        ))}
      </ul>

      <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
        <p className="text-sm font-medium text-foreground">Add a field</p>
        <Input
          label="Name"
          value={label}
          maxLength={60}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Category, Part number"
        />
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">Type</span>
          <select
            value={type}
            onChange={(e) => {
              const next = e.target.value as ComponentField["type"];
              setType(next);
              if (next !== "text") setSearchable(false);
            }}
            className="min-h-11 rounded-lg border border-border bg-background px-3 text-base text-field-foreground"
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        {type === "text" && (
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={searchable} onChange={(e) => setSearchable(e.target.checked)} />
            Include in search
          </label>
        )}
        <div className="flex justify-end">
          <Button
            disabled={!label.trim() || create.isPending || !isOnline}
            loading={create.isPending}
            onClick={() => create.mutate()}
          >
            {isOnline ? "Add field" : "Offline"}
          </Button>
        </div>
      </div>

      <div className="flex justify-end">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
}
