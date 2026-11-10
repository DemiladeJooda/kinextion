/**
 * Sample people for illustrations of community rooms.
 *
 * Stock photos from Unsplash (free under the Unsplash License, hotlinked from
 * images.unsplash.com as Unsplash asks). They are models, not members, and the
 * names are made up, so anywhere these appear must say it's a sample.
 * Real responses replace them as soon as people choose to share.
 */

export interface SamplePerson {
  readonly name: string;
  /** Unsplash photo id, after "photo-". */
  readonly photo: string;
}

export const SAMPLE_PEOPLE: readonly SamplePerson[] = [
  { name: "Marcus", photo: "1758874384148-8f8c60b0ba1d" },
  { name: "Amara", photo: "1758273705996-bdeefbdbce5e" },
  { name: "Jordan", photo: "1782938014072-8ea6927f2586" },
  { name: "Priya", photo: "1758874385109-90ae969c40ea" },
  { name: "Kwame", photo: "1764162051244-1391c41122ac" },
  { name: "Sofia", photo: "1758273239210-59fea02475eb" },
  { name: "Leo", photo: "1758874574136-6506197be737" },
  { name: "Hannah", photo: "1758598305805-4b9d79ae89bf" },
  { name: "Mateo", photo: "1777227684838-73f8ebf3948f" },
  { name: "Grace", photo: "1713812956759-371b4e8fc468" },
  { name: "Ben", photo: "1758521961236-38a86c00f1bd" },
  { name: "Aisha", photo: "1787647562374-97652f245581" },
  { name: "Tomás", photo: "1577864662891-c7b77f10f638" },
  { name: "Daniel", photo: "1758598497528-d8d9b3f22894" },
];

export function samplePhoto(photo: string, width = 400, height = 500): string {
  return `https://images.unsplash.com/photo-${photo}?w=${width}&h=${height}&fit=crop&crop=faces&q=70&auto=format`;
}
