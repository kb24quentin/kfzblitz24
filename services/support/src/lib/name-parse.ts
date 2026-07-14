const HONORIFICS = new Set([
  "dr", "dr.", "prof", "prof.", "hr", "hr.", "fr", "fr.",
  "herr", "frau", "mr", "mr.", "mrs", "mrs.", "ms", "ms.",
]);

/**
 * Splits a display name into { firstName, lastName }.
 * "Max Mustermann" → { firstName: "Max", lastName: "Mustermann" }
 * "Anna Maria Schmitz" → { firstName: "Anna Maria", lastName: "Schmitz" }
 * "Dr. Klaus Weber" → { firstName: "Klaus", lastName: "Weber" }
 * "Meier" → { firstName: "Meier", lastName: null } (assume it's the first)
 */
export function splitName(fullName: string | null | undefined): {
  firstName: string | null;
  lastName: string | null;
} {
  if (!fullName) return { firstName: null, lastName: null };
  const cleaned = fullName.trim().replace(/\s+/g, " ");
  if (!cleaned) return { firstName: null, lastName: null };

  const parts = cleaned.split(" ").filter((p) => !HONORIFICS.has(p.toLowerCase()));
  if (parts.length === 0) return { firstName: null, lastName: null };
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
}

export function fullNameOf(c: {
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
}): string | null {
  const composed = [c.firstName, c.lastName].filter(Boolean).join(" ").trim();
  if (composed) return composed;
  return c.name?.trim() || null;
}
