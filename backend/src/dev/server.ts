// Local dev server: serves every route in routes.ts on :4000 against DynamoDB Local. Never bundled into Lambdas.
// IVS and OpenRouter calls go to the real services with your AWS profile. Auth is ignored locally.
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2, Context } from "aws-lambda";
import { routes, type Route } from "../routes";
import { tick } from "../lib/lifecycle";

const ORIGIN = "http://localhost:3000";
const cors = { "access-control-allow-origin": ORIGIN, "access-control-allow-headers": "content-type,x-ticket", "access-control-allow-methods": "GET,POST" };

const compiled = routes.map((route) => ({
  route,
  regex: new RegExp(`^${route.path.replace(/\{(\w+)\}/g, "(?<$1>[^/]+)")}$`),
}));

/** The registry route for a method + path, with path parameters. Literal paths win over parameterised ones. */
export function matchRoute(method: string, path: string): { route: Route; params: Record<string, string> } | undefined {
  const hits = compiled.filter((c) => c.route.method === method && c.regex.test(path));
  const best = hits.find((c) => !c.route.path.includes("{")) ?? hits[0];
  if (!best) return undefined;
  return { route: best.route, params: { ...path.match(best.regex)!.groups } };
}

export async function toEvent(req: Request, route: Route, params: Record<string, string>): Promise<APIGatewayProxyEventV2> {
  const url = new URL(req.url);
  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => (headers[k.toLowerCase()] = v));
  const body = req.method === "GET" ? undefined : await req.text();
  return {
    version: "2.0",
    routeKey: `${route.method} ${route.path}`,
    rawPath: url.pathname,
    rawQueryString: url.search.slice(1),
    headers,
    queryStringParameters: url.search ? Object.fromEntries(url.searchParams) : undefined,
    pathParameters: Object.keys(params).length ? params : undefined,
    body: body || undefined,
    isBase64Encoded: false,
    requestContext: { requestId: crypto.randomUUID(), http: { method: req.method, path: url.pathname } } as APIGatewayProxyEventV2["requestContext"],
  };
}

const fakeContext = { functionName: "dev", awsRequestId: "dev", invokedFunctionArn: "dev" } as Context;
const respond = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });

export async function fetchHandler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method === "POST" && url.pathname === "/dev/tick") {
    const now = Date.parse(url.searchParams.get("now") ?? "") || Date.now();
    await tick(now);
    return respond(200, { ticked: new Date(now).toISOString() });
  }
  const match = matchRoute(req.method, url.pathname);
  if (!match) return respond(404, { error: { code: "not_found", message: "No such route." } });
  const mod = await import(`../handlers/${match.route.handler}.ts`);
  const res = (await mod.handler(await toEvent(req, match.route, match.params), fakeContext)) as APIGatewayProxyStructuredResultV2;
  return new Response(res.body ?? null, { status: res.statusCode, headers: { ...cors, ...(res.headers as Record<string, string>) } });
}

export const startServer = (port = Number(process.env.PORT ?? 4000)) => Bun.serve({ port, fetch: fetchHandler });

if (import.meta.main) console.log(`PitchDrill API on http://localhost:${startServer().port}`);
