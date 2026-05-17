import { Resend } from "resend";
import { BaseEmailProvider } from "../base-provider";
import type { SendEmailData, SendResult } from "../types";

export class ResendProvider extends BaseEmailProvider {
  readonly name = "Resend";
  private client: Resend;

  constructor(apiKey: string) {
    super();
    this.client = new Resend(apiKey);
  }

  async send(data: SendEmailData): Promise<SendResult> {
    try {
      const result = await this.client.emails.send({
        from: data.from,
        to: Array.isArray(data.to) ? data.to : [data.to],
        subject: data.subject,
        html: data.html,
        text: data.text,
        attachments: data.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
        })),
      });

      if (result.error) {
        return { success: false, error: result.error.message };
      }

      return { success: true, messageId: result.data?.id };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Resend send failed",
      };
    }
  }
}
