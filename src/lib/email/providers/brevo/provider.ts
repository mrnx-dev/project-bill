import { BaseEmailProvider } from "../base-provider";
import type { SendEmailData, SendResult } from "../types";

export class BrevoProvider extends BaseEmailProvider {
  readonly name = "Brevo";
  private apiKey: string;
  private lastCall?: number;

  /** Rate limit: 100ms between Brevo API calls.
   *  Brevo free tier allows ~10 req/sec; enforce spacing. */
  private async rateLimit(): Promise<void> {
    if (this.lastCall) {
      const elapsed = Date.now() - this.lastCall;
      if (elapsed < 100) await new Promise((r) => setTimeout(r, 100 - elapsed));
    }
    this.lastCall = Date.now();
  }

  constructor(apiKey: string) {
    super();
    this.apiKey = apiKey;
  }

  async send(data: SendEmailData): Promise<SendResult> {
    await this.rateLimit();
    try {
      const toList = Array.isArray(data.to) ? data.to : [data.to];
      const fromParsed = this.parseFrom(data.from);

      const payload: any = {
        sender: { name: fromParsed.name, email: fromParsed.email },
        to: toList.map((email) => ({ email })),
        subject: data.subject,
        htmlContent: data.html,
        textContent: data.text,
      };

      if (data.attachments?.length) {
        payload.attachment = data.attachments.map((a) => ({
          name: a.filename,
          content: Buffer.isBuffer(a.content)
            ? a.content.toString("base64")
            : Buffer.from(a.content).toString("base64"),
        }));
      }

      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": this.apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorBody = await res.text();
        return {
          success: false,
          error: `Brevo API error (${res.status}): ${errorBody}`,
        };
      }

      const result = await res.json();
      return { success: true, messageId: result.messageId };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Brevo send failed",
      };
    }
  }
}
