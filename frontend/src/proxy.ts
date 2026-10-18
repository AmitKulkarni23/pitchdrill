import { NextResponse, type NextRequest } from "next/server";

// ponytail: one shared password (Basic Auth) for private testing. Delete this file to make the site public.
// SITE_PASSWORD is set in Vercel; locally the gate is off unless you set it. Production without it fails closed.
export function proxy(request: NextRequest) {
  const password = process.env.SITE_PASSWORD;
  if (!password && process.env.NODE_ENV !== "production") return NextResponse.next();
  const [scheme, encoded] = (request.headers.get("authorization") ?? "").split(" ");
  if (password && scheme === "Basic" && encoded) {
    const given = atob(encoded).split(":").slice(1).join(":"); // any username; the password is what counts
    if (given === password) return NextResponse.next();
  }
  return new NextResponse("Password required", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="PitchDrill"' } });
}
