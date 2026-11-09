/**
 * Real places on the Community map.
 *
 * Coordinates and links for groups come from the hand-verified seed in
 * apps/api/src/jobs/seed-nearby-groups.ts. Nothing here claims a partnership:
 * these are independent groups, and each links to its own page.
 */

export type PlaceKind = "Run club" | "Studio" | "Yoga" | "Courts" | "Open space";

export interface MapPlace {
  readonly id: string;
  readonly name: string;
  readonly kind: PlaceKind;
  readonly note: string;
  readonly lat: number;
  readonly lng: number;
  readonly href: string;
}

export const KIND_COLOR: Record<PlaceKind, string> = {
  "Run club": "#00C47A",
  Studio: "#F59E0B",
  Yoga: "#A855F7",
  Courts: "#3B82F6",
  "Open space": "#0ABAB5",
};

export const MAP_PLACES: readonly MapPlace[] = [
  { id: "214", name: "214 Run Club", kind: "Run club", note: "Free Saturday morning runs", lat: 32.826576, lng: -96.7870713, href: "https://www.instagram.com/the214runclub/" },
  { id: "oak-cliff", name: "Oak Cliff Run Crew", kind: "Run club", note: "Weekday evenings, Sunday mornings", lat: 32.7609136, lng: -96.8176488, href: "https://www.oakcliffruncrew.com/" },
  { id: "braindead", name: "Braindead Running Club", kind: "Run club", note: "Deep Ellum run club", lat: 32.7830812, lng: -96.7824499, href: "https://www.westlakebeer.com/" },
  { id: "otf-lovers", name: "Orangetheory, Lovers Lane", kind: "Studio", note: "Group training", lat: 32.851202, lng: -96.8372632, href: "https://www.orangetheory.com/en-us/locations/dallas-texas-1423" },
  { id: "otf-uptown", name: "Orangetheory, Uptown", kind: "Studio", note: "Group training", lat: 32.7995487, lng: -96.793447, href: "https://www.orangetheory.com/en-us/locations/dallas-texas-1029" },
  { id: "otf-victory", name: "Orangetheory, Victory Park", kind: "Studio", note: "Group training", lat: 32.7863983, lng: -96.8092258, href: "https://www.orangetheory.com/en-us/locations/victory-park-texas-1028" },
  { id: "corepower", name: "CorePower Yoga, Victory Park", kind: "Yoga", note: "Studio classes", lat: 32.788817, lng: -96.805545, href: "https://www.corepoweryoga.com/yoga-studios/tx/dallas/victory-park" },
  { id: "black-swan", name: "Black Swan Yoga, Lovers Lane", kind: "Yoga", note: "Studio classes", lat: 32.8509787, lng: -96.8228503, href: "https://www.blackswanyoga.com/studios/lovers" },
  { id: "cole-courts", name: "Cole Park courts", kind: "Courts", note: "Free public pickleball", lat: 32.8228, lng: -96.7905, href: "https://www.dallasparks.org/facilities/facility/details/Cole-Park-446" },
  { id: "katy", name: "The Katy Trail", kind: "Open space", note: "Three and a half miles through Uptown", lat: 32.8025, lng: -96.8095, href: "https://katytraildallas.org/" },
  { id: "white-rock", name: "White Rock Lake", kind: "Open space", note: "A nine-mile loop the whole city shares", lat: 32.8295, lng: -96.7228, href: "https://www.dallasparks.org/235/White-Rock-Lake" },
  { id: "klyde", name: "Klyde Warren Park", kind: "Open space", note: "Free classes on the lawn", lat: 32.7893, lng: -96.8016, href: "https://www.klydewarrenpark.org/" },
  { id: "bishop", name: "Bishop Arts, Oak Cliff", kind: "Open space", note: "Walkable neighbourhood meeting point", lat: 32.7478, lng: -96.8279, href: "https://bishopartsdistrict.com/" },
];
