import { cookies } from "next/headers";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// returns this visitor's guest ID, or null if it is missing or looks tampered with
export async function getGuestId(): Promise<string | null> {
  const store = await cookies();
  const id = store.get("guestId")?.value;
  return id && UUID_PATTERN.test(id) ? id : null;
}