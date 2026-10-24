// CloudWatch RUM: uncaught errors, failed fetches and page performance from real browsers, plus errors we catch
// (IVS video, chat, mic) via reportError. The app monitor accepts unsigned events (resource policy in the CDK stack),
// so no Cognito pool. Runs only where NEXT_PUBLIC_RUM_APP_MONITOR_ID is set (Vercel production), never locally.
import type { AwsRum } from "aws-rum-web";

let rum: AwsRum | undefined;

export async function initRum() {
  const id = process.env.NEXT_PUBLIC_RUM_APP_MONITOR_ID;
  if (!id || rum) return;
  try {
    const { AwsRum } = await import("aws-rum-web");
    rum = new AwsRum(id, process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev", "us-west-2", {
      signing: false,
      endpoint: "https://dataplane.rum.us-west-2.amazonaws.com",
      sessionSampleRate: 1,
      telemetries: ["errors", "http", "performance"],
      allowCookies: true,
    });
  } catch {} // monitoring must never break the page
}

export const reportError = (e: unknown) => rum?.recordError(e);
