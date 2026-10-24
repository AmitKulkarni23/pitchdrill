import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import { createBooking } from "../lib/bookings";
import { handle, json } from "../lib/http";
import { logger, tracer } from "../lib/observability";
import { readBody } from "../lib/validation";

const sns = tracer.captureAWSv3Client(new SNSClient({}));
const slotTime = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

// POST /bookings  { slotId, handle, role } → 201 { ticket, booking } (the ticket is returned only here, once)
export const handler = handle(async (event) => {
  const body = readBody(event);
  const result = await createBooking({ slotId: body.slotId, handle: body.handle, role: body.role });
  await notifySlack(result.booking);
  return json(201, result);
});

// Posts the booking to Slack (SNS → AWS Chatbot custom notification). Unset locally; a failure never fails the booking.
async function notifySlack(b: { handle: string; role: string; slotId: string; opponentHandle?: string }) {
  const TopicArn = process.env.BOOKINGS_TOPIC_ARN_ENV;
  if (!TopicArn) return;
  const other = b.role === "seller" ? "buyer" : "seller";
  const description = `\`${b.handle}\` booked a *${b.role}* seat for *${slotTime.format(new Date(b.slotId))} PT*, ${b.opponentHandle ? `paired with \`${b.opponentHandle}\`` : `waiting for a ${other}`}.`;
  const Message = JSON.stringify({ version: "1.0", source: "custom", content: { textType: "client-markdown", title: "📅 New booking", description } });
  await sns.send(new PublishCommand({ TopicArn, Message })).catch((e) => logger.warn("Booking Slack notification failed", { error: (e as Error).message }));
}
