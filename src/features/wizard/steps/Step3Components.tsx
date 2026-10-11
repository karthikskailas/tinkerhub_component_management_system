import { Button } from "../../../components/ui/Button";
import { SkeletonLines } from "../../../components/ui/Skeleton";
import { ComponentPicker } from "../../catalog/ComponentPicker";
import type { CartLine } from "../../catalog/ComponentPicker";
import { useCatalog } from "../../catalog/useCatalog";

interface Step3Props {
  cart: Record<string, CartLine>;
  onCartChange: (cart: Record<string, CartLine>) => void;
  onBack: () => void;
  onNext: () => void;
}

export function Step3Components({ cart, onCartChange, onBack, onNext }: Step3Props) {
  const catalogQuery = useCatalog();
  const count = Object.keys(cart).length;

  return (
    <div className="pb-20">
      <h1 className="mb-4 text-xl font-semibold text-slate-900">Select components</h1>

      {catalogQuery.isLoading && <SkeletonLines count={6} />}
      {catalogQuery.isError && (
        <p className="text-sm text-red-600">
          Couldn't load the component list.{" "}
          <button
            type="button"
            className="font-medium underline"
            onClick={() => catalogQuery.refetch()}
          >
            Retry
          </button>
        </p>
      )}
      {catalogQuery.data && (
        <ComponentPicker items={catalogQuery.data} cart={cart} onChange={onCartChange} />
      )}

      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between border-t border-slate-200 bg-white p-4 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
        <span className="text-sm font-medium text-slate-600">
          {count} component{count === 1 ? "" : "s"} selected
        </span>
        <Button disabled={count === 0} onClick={onNext}>
          Next
        </Button>
      </div>
    </div>
  );
}
