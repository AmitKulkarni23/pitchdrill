import type { MetadataRoute } from "next";

// Public pages are indexable; ticket pages (/t) are private seats and have nothing to index.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/", disallow: "/t" } };
}
