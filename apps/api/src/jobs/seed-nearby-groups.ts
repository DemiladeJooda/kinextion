/**
 * Seeds real, verified nearby fitness groups — Dallas only, for now.
 *
 *   pnpm --filter @kinextion/api nearby:seed
 *
 * Every row below was checked against its own primary source (the
 * organisation's official page, or corroborated across multiple independent
 * listings) on the date in `verifiedAt`, not generated. Coordinates came from
 * a one-time geocode of each verified address (OpenStreetMap Nominatim) —
 * nothing here is approximated or invented. If a studio moves or a run club
 * disbands, this file is what needs updating, and `sourceUrl` is where to
 * re-check it.
 *
 * Safe to re-run: upserted by (name, city).
 */

import { prisma } from "@kinextion/database";

const VERIFIED_AT = new Date("2026-10-06");

const DALLAS_GROUPS = [
  {
    name: "214 Run Club",
    category: "running",
    description: "Free Saturday morning group runs — 8 miles for distance runners, 3-5 miles for everyone else.",
    address: "4825 Cole Ave, Dallas, TX 75205",
    city: "Dallas",
    lat: 32.826576,
    lng: -96.7870713,
    website: "https://www.instagram.com/the214runclub/",
    schedule: "Saturdays, 7:30am (distance) & 8:30am (3-5 mi)",
    isFree: true,
    // Corroborated independently by apps/web/components/sections/LocalCommunity.tsx (PLACES.214).
    sourceUrl: "https://www.dallasites101.com/blog/post/running-clubs-groups-all-levels-dallas-fort-worth/",
  },
  {
    name: "Oak Cliff Run Crew",
    category: "running",
    description: "Neighborhood run crew based in Oak Cliff, open to all paces.",
    address: "1406 N Zang Blvd, Dallas, TX 75208",
    city: "Dallas",
    lat: 32.7609136,
    lng: -96.8176488,
    website: "https://www.oakcliffruncrew.com/",
    schedule: "Thursdays 7pm, Sundays 7am",
    isFree: true,
    // Corroborated independently by apps/web/components/sections/LocalCommunity.tsx (PLACES.oak-cliff).
    sourceUrl: "https://www.dallasites101.com/blog/post/running-clubs-groups-all-levels-dallas-fort-worth/",
  },
  {
    name: "Braindead Running Club",
    category: "running",
    description: "Casual 3-5 mile Monday run from Westlake Brewing Company through Deep Ellum, Old East Dallas or Klyde Warren Park.",
    address: "2816 Commerce St, Dallas, TX 75226",
    city: "Dallas",
    lat: 32.7830812,
    lng: -96.7824499,
    website: "https://www.westlakebeer.com/",
    schedule: "Mondays",
    isFree: true,
    sourceUrl: "https://www.dallasites101.com/blog/post/running-clubs-groups-all-levels-dallas-fort-worth/",
  },
  {
    name: "Pint Striders",
    category: "running",
    description: "Social run club meeting at Bar W in Uptown, open to all paces.",
    address: "2926 Maple Ave, Dallas, TX 75201",
    city: "Dallas",
    lat: 32.7980309,
    lng: -96.8069816,
    schedule: "Thursdays, 6:30pm",
    isFree: true,
    sourceUrl: "https://www.dallasites101.com/blog/post/running-clubs-groups-all-levels-dallas-fort-worth/",
  },
  {
    name: "Orangetheory Fitness – Lovers Lane",
    category: "hiit",
    description: "Heart-rate-based group HIIT studio.",
    address: "5549 W Lovers Lane, Dallas, TX 75209",
    city: "Dallas",
    lat: 32.851202,
    lng: -96.8372632,
    website: "https://www.orangetheory.com/en-us/locations/dallas-texas-1423",
    phone: "(972) 474-0725",
    schedule: "Class times vary — book on the app",
    isFree: false,
    sourceUrl: "https://www.orangetheory.com/en-us/locations/dallas-texas-1423",
  },
  {
    name: "Orangetheory Fitness – Uptown",
    category: "hiit",
    description: "Heart-rate-based group HIIT studio.",
    address: "4447 N Central Expy #100, Dallas, TX 75205",
    city: "Dallas",
    lat: 32.7995487,
    lng: -96.793447,
    website: "https://www.orangetheory.com/en-us/locations/dallas-texas-1029",
    phone: "(972) 474-0382",
    schedule: "Class times vary — book on the app",
    isFree: false,
    sourceUrl: "https://www.orangetheory.com/en-us/locations/dallas-texas-1029",
  },
  {
    name: "Orangetheory Fitness – Victory Park",
    category: "hiit",
    description: "Heart-rate-based group HIIT studio.",
    address: "625 High Market St #100, Dallas, TX 75219",
    city: "Dallas",
    lat: 32.7863983,
    lng: -96.8092258,
    website: "https://www.orangetheory.com/en-us/locations/victory-park-texas-1028",
    schedule: "Class times vary — book on the app",
    isFree: false,
    sourceUrl: "https://www.orangetheory.com/en-us/locations/victory-park-texas-1028",
  },
  {
    name: "CorePower Yoga – Victory Park",
    category: "yoga",
    description: "Heated and power yoga studio.",
    address: "1700 Cedar Springs Rd Suite 110, Dallas, TX 75202",
    city: "Dallas",
    lat: 32.788817,
    lng: -96.805545,
    website: "https://www.corepoweryoga.com/yoga-studios/tx/dallas/victory-park",
    schedule: "Class times vary — book on the app",
    isFree: false,
    sourceUrl: "https://www.corepoweryoga.com/yoga-studios/tx/dallas/victory-park",
  },
  {
    name: "Black Swan Yoga – Lovers Lane",
    category: "yoga",
    description: "Donation- and membership-based community yoga studio.",
    address: "5118 W Lovers Lane, Dallas, TX 75209",
    city: "Dallas",
    lat: 32.8509787,
    lng: -96.8228503,
    website: "https://www.blackswanyoga.com/studios/lovers",
    phone: "(214) 233-6283",
    schedule: "Class times vary — book on the app",
    isFree: false,
    sourceUrl: "https://www.blackswanyoga.com/studios/lovers",
  },
] as const;

async function main() {
  for (const group of DALLAS_GROUPS) {
    await prisma.nearbyGroup.upsert({
      where: { name_city: { name: group.name, city: group.city } },
      create: { ...group, verifiedAt: VERIFIED_AT },
      update: { ...group, verifiedAt: VERIFIED_AT },
    });
    console.log(`✓ ${group.name}`);
  }
  console.log(`\nSeeded ${DALLAS_GROUPS.length} verified Dallas groups.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
