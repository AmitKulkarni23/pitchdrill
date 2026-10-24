import { NextResponse, type NextRequest } from "next/server";

// ponytail: one shared password (Basic Auth) for private testing. To make the site public, drop the password check and keep geoGate.
// SITE_PASSWORD is set in Vercel; locally the gate is off unless you set it. Production without it fails closed.
export function proxy(request: NextRequest) {
  const password = process.env.SITE_PASSWORD;
  if (!password && process.env.NODE_ENV !== "production") return NextResponse.next();
  const [scheme, encoded] = (request.headers.get("authorization") ?? "").split(" ");
  if (password && scheme === "Basic" && encoded) {
    const given = atob(encoded).split(":").slice(1).join(":"); // any username; the password is what counts
    if (given === password) return geoGate(request);
  }
  return new NextResponse("Password required", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="PitchDrill"' } });
}

// US only for now: Vercel sets x-vercel-ip-country on every request; other countries see /coming-soon. Locally the header
// is absent, so nothing is gated. Assets (/_next, files with a dot) pass through so that page can render.
// ponytail: website only; the AWS API stays reachable from anywhere (geo-blocking it needs CloudFront in front).
function geoGate(request: NextRequest) {
  const country = request.headers.get("x-vercel-ip-country");
  const { pathname } = request.nextUrl;
  if (!country || country === "US" || pathname === "/coming-soon" || pathname.startsWith("/_next") || pathname.includes("."))
    return NextResponse.next();
  return NextResponse.rewrite(new URL("/coming-soon", request.url));
}
