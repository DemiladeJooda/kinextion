"use client";

import { createContext, useContext } from "react";

/**
 * Tab navigation context.
 *
 * This lives in its own leaf module rather than in TabLayout on purpose.
 * TabLayout imports every section, and several sections need `useNavigate` —
 * importing it back from TabLayout creates a cycle
 * (TabLayout → Section → TabLayout). Under Turbopack that cycle is resolved by
 * evaluating the section's module body before its own imports are initialised,
 * so any module-level work in a section throws `X is not defined` at runtime
 * while typechecking cleanly.
 *
 * Keeping the context here means both sides import downward and no cycle
 * exists. Don't move these back into TabLayout.
 */
export const NavigateContext = createContext<(tab: string) => void>(() => {});

export function useNavigate() {
  return useContext(NavigateContext);
}
