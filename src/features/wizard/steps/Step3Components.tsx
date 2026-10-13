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
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-foreground">Select components</h1>

      {catalogQuery.isLoading && <SkeletonLines count={6} />}
      {catalogQuery.isError && (
        <p className="text-sm text-danger">
          Couldn't load the component list.{" "}
          <button type="button" onClick={() => catalogQuery.refetch()} className="font-medium underline">
            Retry
          </button>
        </p>
      )}
      {catalogQuery.data && (
        <ComponentPicker items={catalogQuery.data} cart={cart} onChange={onCartChange} />
      )}

      <div className="flex items-center gap-3">
        <Button variant="secondary" onClick={onBack} className="shrink-0 rounded-full">
          Back
        </Button>
        <span className="flex-1 text-center text-sm text-muted">
          {count} component{count === 1 ? "" : "s"} selected
        </span>
        <Button disabled={count === 0} onClick={onNext} className="shrink-0 rounded-full">
          Next →
        </Button>
      </div>
    </div>
  );
}
