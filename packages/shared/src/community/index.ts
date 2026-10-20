/**
 * Community — Kinextion's weekly conversation layer.
 *
 * A community is a group of people who recognise each other. A room is one
 * community's conversation for one week. The rules that make it distinctive —
 * speak before you listen, totals hidden until close, anonymous admission,
 * expiry — are enforced by apps/api; what lives here is the part every
 * surface needs to agree on: the numbers, the calendar, and the admission
 * rules, all pure.
 */

export * from "./constants.js";
export * from "./schedule.js";
export * from "./admission.js";
export * from "./ballots.js";
export * from "./circles.js";
export * from "./reveal.js";
export * from "./integrity.js";
export * from "./schemas.js";
export * from "./views.js";
