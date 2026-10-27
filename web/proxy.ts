import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  // returning visitor: they already have an ID, do nothing
  if (request.cookies.has("guestId")) {
    return NextResponse.next();
  }

  // new visitor: create a random ID
  const guestId = crypto.randomUUID();

  // make the ID visible to the rest of THIS request too
  request.cookies.set("guestId", guestId);
  const response = NextResponse.next({ request: { headers: request.headers } });

  // ask the browser to remember it for one year
  response.cookies.set("guestId", guestId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return response;
}

// run on every page and API route except Next.js static files
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};