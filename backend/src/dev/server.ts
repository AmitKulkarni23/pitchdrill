// Local stand-in for API Gateway: serves every route in src/routes.ts on localhost:4000. Auth is ignored.
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2, Context } from "aws-lambda";
import { routes, type RouteDef } from "../routes";

const ALLOWED_ORIGIN = "http://localhost:3000";
const cors = {
  "access-control-allow-origin": ALLOWED_ORIGIN,
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type,x-ticket",
  "access-control-max-age": "300",
};

type Handler = (event: APIGatewayProxyEventV2, context: Context) => Promise<APIGatewayProxyResultV2>;
interface Compiled {
  route: RouteDef;
  regex: RegExp;
  names: string[];
}

const compiled: Compiled[] = routes.map((route) => {
  const names: string[] = [];
  const source = route.path.replace(/\{(\w+)\}/g, (_, name: string) => (names.push(name), "([^/]+)"));
  return { route, regex: new RegExp(`^${source}$`), names };
});

/** Finds the registry route for a request, with its path parameters. */
export function matchRoute(method: string, path: string): { route: RouteDef; pathParameters: Record<string, string> } | undefined {
  for (const { route, regex, names } of compiled) {
    if (route.method !== method) continue;
    const m = regex.exec(path);
    if (m) return { route, pathParameters: Object.fromEntries(names.map((n, i) => [n, decodeURIComponent(m[i + 1]!)])) };
  }
}

/** Builds the API Gateway HTTP API (v2) event a Lambda would receive. */
export async function toEvent(req: Request, pathParameters: Record<string, string> = {}): Promise<APIGatewayProxyEventV2> {
  const url = new URL(req.url);
  const headers = Object.fromEntries([...req.headers].map(([k, v]) => [k.toLowerCase(), v]));
  const queryStringParameters = Object.fromEntries(url.searchParams);
  const body = req.method === "GET" ? undefined : await req.text();
  return {
    version: "2.0",
    routeKey: `${req.method} ${url.pathname}`,
    rawPath: url.pathname,
    rawQueryString: url.search.slice(1),
    headers,
    queryStringParameters: Object.keys(queryStringParameters).length ? queryStringParameters : undefined,
    pathParameters: Object.keys(pathParameters).length ? pathParameters : undefined,
    body: body || undefined,
    isBase64Encoded: false,
    requestContext: {
      accountId: "local",
      apiId: "local",
      domainName: "localhost",
      domainPrefix: "localhost",
      requestId: crypto.randomUUID(),
      routeKey: `${req.method} ${url.pathname}`,
      stage: "$default",
      time: new Date().toISOString(),
      timeEpoch: Date.now(),
      http: { method: req.method, path: url.pathname, protocol: "HTTP/1.1", sourceIp: "127.0.0.1", userAgent: headers["user-agent"] ?? "" },
    },
  };
}

const context = (): Context =>
  ({ awsRequestId: crypto.randomUUID(), functionName: "local", functionVersion: "$LATEST", invokedFunctionArn: "local", memoryLimitInMB: "256", logGroupName: "local", logStreamName: "local", callbackWaitsForEmptyEventLoop: false }) as Context;

const notFound = () =>
  Response.json({ error: { code: "not_found", message: "No such route." } }, { status: 404, headers: cors });

async function dispatch(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  const match = matchRoute(req.method, new URL(req.url).pathname);
  if (!match) return notFound();
  const { handler } = (await import(`../handlers/${match.route.handler}`)) as { handler: Handler };
  const result = await handler(await toEvent(req, match.pathParameters), context());
  const r = typeof result === "string" ? { statusCode: 200, body: result } : result;
  return new Response(r.body ?? null, { status: r.statusCode ?? 200, headers: { ...(r.headers as Record<string, string>), ...cors } });
}

export function startServer(port = Number(process.env.PORT ?? 4000)) {
  return Bun.serve({ port, fetch: dispatch });
}

if (import.meta.main) {
  const server = startServer();
  console.log(`PitchDrill dev API on http://localhost:${server.port}`);
}
