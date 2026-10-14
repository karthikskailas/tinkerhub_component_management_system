import { Input as HeroInput, TextArea as HeroTextArea } from "@heroui/react";
import { forwardRef } from "react";
import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

interface FieldWrapperProps {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}

function FieldWrapper({ label, error, hint, children }: FieldWrapperProps) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
      {hint && !error && <span className="text-sm text-muted">{hint}</span>}
      {error && <span className="text-sm text-danger">{error}</span>}
    </label>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, ...rest }, ref) => (
    <FieldWrapper label={label} error={error} hint={hint}>
      <HeroInput ref={ref} fullWidth {...rest} />
    </FieldWrapper>
  ),
);
Input.displayName = "Input";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  error?: string;
  hint?: string;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, ...rest }, ref) => (
    <FieldWrapper label={label} error={error} hint={hint}>
      <HeroTextArea ref={ref} fullWidth {...rest} />
    </FieldWrapper>
  ),
);
Textarea.displayName = "Textarea";
