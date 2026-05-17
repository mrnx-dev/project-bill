import type { EmailProvider, SendEmailData, SendResult } from "./types";

export abstract class BaseEmailProvider implements EmailProvider {
  abstract readonly name: string;
  abstract send(data: SendEmailData): Promise<SendResult>;

  protected parseFrom(from: string): { name: string; email: string } {
    const match = from.match(/^(.*?)\s*<(.+?)>$/);
    if (match) return { name: match[1].trim(), email: match[2] };
    return { name: "", email: from };
  }
}
