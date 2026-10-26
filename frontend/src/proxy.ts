import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  // Old ticket links (/t/<ticket>) move the ticket into the fragment, which never reaches the server again.
  const old = request.nextUrl.pathname.match(/^\/t\/([^/]+)$/);
  if (old) return NextResponse.redirect(new URL(`/t#${old[1]}`, request.url), 308);
  return geoGate(request);
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
