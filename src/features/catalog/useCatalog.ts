import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";

export interface CatalogRow {
  id: string;
  name: string;
  description: string | null;
  returnable: boolean;
  available: number;
}

async function fetchCatalog(): Promise<CatalogRow[]> {
  const { data, error } = await supabase
    .from("component_catalog")
    .select("id, name, description, returnable, available")
    .order("name", { ascending: true });

  if (error) throw error;

  // The view's columns are nullable at the type level (it's a view, not a
  // table), but every row always has id/name/available populated in practice.
  return (data ?? []).map((row) => ({
    id: row.id!,
    name: row.name!,
    description: row.description,
    returnable: row.returnable ?? true,
    available: row.available ?? 0,
  }));
}

export function useCatalog() {
  return useQuery({
    queryKey: ["component_catalog"],
    queryFn: fetchCatalog,
    staleTime: 5 * 60 * 1000,
  });
}
