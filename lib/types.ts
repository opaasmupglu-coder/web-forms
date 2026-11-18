// Types for the configurable form system.
// A Form is built entirely in the admin: fields of various types, each
// dropdown pulling its options from a maintained OptionList (Offices,
// Names, or any custom list) or from its own inline options.

export type FieldType =
  | "text"
  | "textarea"
  | "email"
  | "tel"
  | "number"
  | "date"
  | "dropdown"
  | "checkbox";

export const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "text", label: "Short text" },
  { value: "textarea", label: "Long text" },
  { value: "email", label: "Email" },
  { value: "tel", label: "Phone" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "dropdown", label: "Searchable dropdown" },
  { value: "checkbox", label: "Yes / No checkbox" },
];

export type OptionItem = {
  id: number;
  label: string;
  value: string;
  sortOrder: number;
};

export type OptionList = {
  id: number;
  name: string;
  slug: string;
  options: OptionItem[];
};

export type FormField = {
  id: number;
  formId: number;
  label: string;
  type: FieldType;
  required: boolean;
  /** When set, the dropdown's options come from this list. */
  listId: number | null;
  listName: string | null;
  /** Inline options, used when listId is null (dropdown only). */
  options: string[];
  placeholder: string;
  helpText: string;
  sortOrder: number;
};

export type FormDef = {
  id: number;
  title: string;
  slug: string;
  description: string;
  successMessage: string;
  active: boolean;
  fields: FormField[];
};

export type FormSummary = {
  id: number;
  title: string;
  slug: string;
  description: string;
  active: boolean;
  fieldCount: number;
  submissionCount: number;
};

export type Submission = {
  id: number;
  formId: number;
  data: Record<string, string>;
  createdAt: string;
};

export type PublicFormField = Omit<FormField, "options"> & {
  options: { label: string; value: string }[];
};

export type PublicForm = {
  id: number;
  title: string;
  slug: string;
  description: string;
  successMessage: string;
  fields: PublicFormField[];
};

/** URL-safe slug from a free-text name. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
