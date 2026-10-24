import { afterEach, beforeEach, expect, mock, spyOn, test } from "bun:test";
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2, Context } from "aws-lambda";
import { SESv2Client, type SendEmailCommand } from "@aws-sdk/client-sesv2";
import { handler } from "../src/handlers/createContact";

const call = async (body: unknown) =>
  (await handler({ routeKey: "POST /contact", body: JSON.stringify(body), requestContext: {} } as APIGatewayProxyEventV2, {} as Context)) as APIGatewayProxyStructuredResultV2;
const good = { name: "Sam", email: "sam@example.com", message: "Hello there" };

let send: ReturnType<typeof spyOn>;
beforeEach(() => {
  process.env.CONTACT_EMAIL_ENV = "owner@example.com";
  send = spyOn(SESv2Client.prototype, "send").mockResolvedValue({} as never);
});
afterEach(() => mock.restore());

test("createContact: given a valid message, should email the owner with Reply-To the sender", async () => {
  expect((await call(good)).statusCode).toBe(201);
  const input = (send.mock.calls[0]![0] as SendEmailCommand).input;
  expect(input.Destination?.ToAddresses).toEqual(["owner@example.com"]);
  expect(input.ReplyToAddresses).toEqual(["sam@example.com"]);
  expect(input.Content?.Simple?.Body?.Text?.Data).toContain("Hello there");
});

test("createContact: given the honeypot is filled, should answer 201 without sending", async () => {
  expect((await call({ ...good, website: "spam.example" })).statusCode).toBe(201);
  expect(send).not.toHaveBeenCalled();
});

test("createContact: given a bad email or empty message, should 400 without sending", async () => {
  expect(JSON.parse((await call({ ...good, email: "nope" })).body!).error.code).toBe("bad_email");
  expect(JSON.parse((await call({ ...good, message: " " })).body!).error.code).toBe("bad_message");
  expect(send).not.toHaveBeenCalled();
});
