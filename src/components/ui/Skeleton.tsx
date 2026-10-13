import { Skeleton as HeroSkeleton } from "@heroui/react";

export function Skeleton() {
  return <HeroSkeleton className="h-4 w-full rounded-md" />;
}

export function SkeletonLines({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} />
      ))}
    </div>
  );
}
