import { Button as HeroButton, Spinner } from "@heroui/react";
import type { ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

interface ButtonProps {
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
  children?: ReactNode;
  fullWidth?: boolean;
  /** Extra classes merged onto HeroUI's own (e.g. "rounded-full" for the
   *  client wizard's pill-shaped CTAs). Leave unset for the default shape
   *  used everywhere else. */
  className?: string;
}

// Thin adapter so every existing call site (onClick/disabled, the native
// button API) keeps working unchanged while rendering HeroUI's styled,
// accessible Button underneath.
export function Button({
  variant = "primary",
  loading = false,
  disabled = false,
  type = "button",
  onClick,
  children,
  fullWidth,
  className,
}: ButtonProps) {
  return (
    <HeroButton
      type={type}
      variant={variant}
      isDisabled={disabled || loading}
      fullWidth={fullWidth}
      className={className}
      onPress={() => onClick?.()}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </HeroButton>
  );
}
