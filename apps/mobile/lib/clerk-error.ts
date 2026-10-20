/** Clerk errors arrive as `{ errors: [{ message }] }` — this is the shape, not `Error`. */
export function firstClerkError(err: unknown): string | null {
  if (err && typeof err === "object" && "errors" in err) {
    const errors = (err as { errors?: Array<{ message?: string }> }).errors;
    return errors?.[0]?.message ?? null;
  }
  return null;
}
