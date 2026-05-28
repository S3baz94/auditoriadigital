/**
 * Demo prospect generator — simulates public-profile extraction for development.
 * For production Instagram data, import CSV from compliant sources or your own API integration.
 */

export type SourceType =
  | "followers"
  | "following"
  | "likers"
  | "commenters"
  | "hashtag"
  | "location";

export interface ProspectRow {
  username: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  bio: string;
  location: string | null;
  followersCount: number;
  followingCount: number;
  isVerified: boolean;
}

const FIRST = [
  "Ana",
  "Carlos",
  "María",
  "Diego",
  "Sofía",
  "Lucas",
  "Valentina",
  "Mateo",
  "Camila",
  "Andrés",
];
const LAST = [
  "García",
  "López",
  "Martínez",
  "Rodríguez",
  "Hernández",
  "Pérez",
  "Sánchez",
  "Ramírez",
  "Torres",
  "Flores",
];
const NICHES = ["fitness", "beauty", "food", "travel", "tech", "fashion", "coaching"];
const CITIES = ["CDMX", "Bogotá", "Buenos Aires", "Madrid", "Miami", "Lima", "Santiago"];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

export function generateProspects(
  sourceType: SourceType,
  sourceValue: string,
  limit = 50
): ProspectRow[] {
  const base = `${sourceType}:${sourceValue}`;
  const rows: ProspectRow[] = [];

  for (let i = 0; i < limit; i++) {
    const seed = hash(`${base}:${i}`);
    const first = pick(FIRST, seed);
    const last = pick(LAST, seed >> 3);
    const niche = pick(NICHES, seed >> 5);
    const city = pick(CITIES, seed >> 7);
    const username = `${first.toLowerCase()}.${last.toLowerCase()}${(seed % 900) + 100}`;
    const hasEmail = seed % 3 !== 0;
    const domain = seed % 2 === 0 ? "gmail.com" : "outlook.com";
    const email = hasEmail
      ? `${first.toLowerCase()}.${last.toLowerCase()}@${domain}`
      : null;
    const followers = 500 + (seed % 50000);
    const following = 100 + (seed % 2000);

    rows.push({
      username,
      fullName: `${first} ${last}`,
      email,
      phone: seed % 4 === 0 ? `+52 55 ${1000 + (seed % 9000)} ${1000 + (seed % 9000)}` : null,
      bio: `${niche} creator | ${city} | DM for collabs`,
      location: city,
      followersCount: followers,
      followingCount: following,
      isVerified: seed % 17 === 0,
    });
  }

  return rows;
}
