import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { MetricUnit } from "@aws-lambda-powertools/metrics";
import { handle, json, UserError } from "../lib/http";
import { logger, metrics, tracer } from "../lib/observability";
import { readBody, requireText } from "../lib/validation";

const ses = tracer.captureAWSv3Client(new SESv2Client({}));
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /contact { name, email, message, website } → 201 { sent: true }. Emails CONTACT_EMAIL_ENV (set from SSM at deploy),
// from and to that same SES-verified address, with Reply-To the sender. `website` is a honeypot: bots fill it, people never see it.
export const handler = handle(async (event) => {
  const body = readBody(event);
  if (body.website) {
    logger.info("Contact honeypot hit");
    return json(201, { sent: true });
  }
  const name = requireText(body.name, 60, "bad_name", "Names");
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (email.length > 254 || !EMAIL.test(email)) throw new UserError(400, "bad_email", "Enter a valid email address.");
  const message = requireText(body.message, 2000, "bad_message", "Messages");

  const to = process.env.CONTACT_EMAIL_ENV;
  if (!to) throw new Error("CONTACT_EMAIL_ENV is not set");
  await ses.send(
    new SendEmailCommand({
      FromEmailAddress: `PitchDrill <${to}>`,
      Destination: { ToAddresses: [to] },
      ReplyToAddresses: [email],
      Content: { Simple: { Subject: { Data: `PitchDrill contact from ${name}` }, Body: { Text: { Data: `From: ${name} <${email}>\n\n${message}` } } } },
    }),
  );
  metrics.addMetric("ContactSent", MetricUnit.Count, 1);
  return json(201, { sent: true });
});
