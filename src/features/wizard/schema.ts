import { z } from "zod";
import { isValidIndianMobile } from "../../lib/phone";

export const phoneSchema = z
  .string()
  .trim()
  .refine(isValidIndianMobile, "Enter a valid 10-digit mobile number.");

export const detailsSchema = z.object({
  requesterName: z.string().trim().min(1, "Your name is required."),
  phone: phoneSchema,
});

export const newProjectSchema = z.object({
  name: z.string().trim().min(1, "Project name is required."),
  description: z.string().trim().min(10, "Please add at least 10 characters."),
  ownerName: z.string().trim().optional(),
});

export type DetailsFormValues = z.infer<typeof detailsSchema>;
export type NewProjectFormValues = z.infer<typeof newProjectSchema>;
