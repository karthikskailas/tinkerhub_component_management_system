import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { SkeletonLines } from "../../../components/ui/Skeleton";
import { toast } from "../../../components/ui/Toast";
import { parseSupabaseError } from "../../../lib/errors";
import { supabase } from "../../../lib/supabase";

const KEY = ["handover_staff"];

async function fetchStaff() {
  const { data, error } = await supabase
    .from("handover_staff")
    .select("id, name, designation, active")
    .order("active", { ascending: false })
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export function HandoverStaffPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [designation, setDesignation] = useState("");

  const list = useQuery({ queryKey: KEY, queryFn: fetchStaff });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("add_handover_staff", {
        p_name: name.trim(),
        ...(designation.trim() ? { p_designation: designation.trim() } : {}),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setName("");
      setDesignation("");
      void queryClient.invalidateQueries({ queryKey: KEY });
    },
    onError: (error) => toast.error(parseSupabaseError(error).message),
  });

  const toggle = useMutation({
    mutationFn: async (vars: { id: string; active: boolean }) => {
      const { error } = await supabase.rpc("set_handover_staff_active", {
        p_id: vars.id,
        p_active: vars.active,
      });
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: KEY }),
    onError: (error) => toast.error(parseSupabaseError(error).message),
  });

  const fieldClass =
    "min-h-11 w-full rounded-lg border border-border bg-background px-3 text-base text-field-foreground outline-none focus:border-accent";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">On-site staff</h1>
        <p className="text-sm text-muted">
          People who can confirm a handover from the QR link. They don't need a login.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim().length >= 2) add.mutate();
        }}
        className="flex flex-col gap-3 rounded-xl bg-surface p-4 shadow-surface sm:flex-row sm:items-end"
      >
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-sm font-medium text-foreground">Name</span>
          <input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} className={fieldClass} />
        </label>
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-sm font-medium text-foreground">Designation (optional)</span>
          <input
            value={designation}
            maxLength={60}
            onChange={(e) => setDesignation(e.target.value)}
            className={fieldClass}
          />
        </label>
        <Button type="submit" loading={add.isPending} disabled={name.trim().length < 2}>
          Add
        </Button>
      </form>

      {list.isLoading && <SkeletonLines count={4} />}
      {list.isError && <p className="text-sm text-danger">Couldn't load the list.</p>}
      {list.data && list.data.length === 0 && (
        <p className="text-sm text-muted">No one added yet.</p>
      )}

      <ul className="flex flex-col gap-2">
        {(list.data ?? []).map((s) => (
          <li
            key={s.id}
            className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-surface p-3 shadow-surface"
          >
            <div className={`min-w-0 ${s.active ? "" : "opacity-60"}`}>
              <p className="truncate text-base font-semibold text-foreground">{s.name}</p>
              {s.designation && <p className="truncate text-sm text-muted">{s.designation}</p>}
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={s.active}
              aria-label={`${s.name} active`}
              disabled={toggle.isPending}
              onClick={() => toggle.mutate({ id: s.id, active: !s.active })}
              className={`inline-flex min-h-11 min-w-20 items-center justify-center rounded-full px-4 text-sm font-semibold ${
                s.active ? "bg-success-soft text-success" : "bg-default text-muted"
              }`}
            >
              {s.active ? "Active" : "Inactive"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
