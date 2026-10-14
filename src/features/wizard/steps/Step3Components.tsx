import { useFocusHeading } from "../../../lib/useFocusHeading";
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
  const headingRef = useFocusHeading();

  return (
    <div className="motion-list flex flex-col gap-4">
      <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold text-foreground focus:outline-none">Select components</h1>

      {catalogQuery.isLoading && <SkeletonLines count={6} />}
      {catalogQuery.isError && (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-danger">
            We couldn't load the component list. Check your connection and retry.
          </p>
          <Button variant="secondary" onClick={() => catalogQuery.refetch()}>
            Retry
          </Button>
        </div>
      )}
      {catalogQuery.data && (
        <ComponentPicker items={catalogQuery.data} cart={cart} onChange={onCartChange} />
      )}

      <div className="sticky bottom-0 -mx-4 flex items-center gap-3 border-t border-border bg-surface px-4 py-3 sm:-mx-6 sm:px-6">
        <Button variant="secondary" onClick={onBack} className="shrink-0 rounded-full">
          Back
        </Button>
        <span role="status" className="flex-1 text-center text-sm text-muted">
          {count === 0 ? "Pick at least one component to continue" : `${count} component${count === 1 ? "" : "s"} selected`}
        </span>
        <Button disabled={count === 0} onClick={onNext} className="shrink-0 rounded-full">
          Next →
        </Button>
      </div>
    </div>
  );
}
