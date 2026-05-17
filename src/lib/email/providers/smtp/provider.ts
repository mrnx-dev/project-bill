import * as nodemailer from "nodemailer";
import { BaseEmailProvider } from "../base-provider";
import type { SendEmailData, SendResult } from "../types";

export class SmtpProvider extends BaseEmailProvider {
  readonly name = "Custom SMTP";

  private host: string;
  private port: number;
  private user?: string;
  private password?: string;
  private secureType: "starttls" | "tls" | "ssl" | "none";
  private rejectUnauthorized: boolean;

  constructor(config: Record<string, string>) {
    super();
    if (!config.host || !config.port) {
      throw new Error("SmtpProvider: host and port are required");
    }
    this.host = config.host;
    this.port = parseInt(config.port, 10);
    this.user = config.user || undefined;
    this.password = config.password || undefined;
    this.secureType = (config.secure as SmtpProvider["secureType"]) || "starttls";
    this.rejectUnauthorized = config.rejectUnauthorized !== "false";
  }

  async send(data: SendEmailData): Promise<SendResult> {
    // STARTTLS/TLS port 587 behavior:
    //   - secure: false + requireTLS: true  => STARTTLS on port 587 (upgrades after plaintext connection).
    //   - secure: true                      => Immediate TLS on port 465.
    //   - secure: false + requireTLS: false => Plaintext (not recommended).
    const secure = this.secureType === "ssl" || this.secureType === "tls";
    const requireTLS = this.secureType === "starttls";

    const transporter = nodemailer.createTransport({
      host: this.host,
      port: this.port,
      secure,
      requireTLS,
      auth:
        this.user || this.password
          ? { user: this.user || "", pass: this.password || "" }
          : undefined,
      tls: {
        rejectUnauthorized: this.rejectUnauthorized,
      },
    });

    const { name, email } = this.parseFrom(data.from);

    try {
      const info = await transporter.sendMail({
        from: name ? `${name} <${email}>` : email,
        to: Array.isArray(data.to) ? data.to.join(", ") : data.to,
        subject: data.subject,
        html: data.html,
        text: data.text,
        attachments: data.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType,
        })),
      });

      return { success: true, messageId: info.messageId };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      transporter.close();
    }
  }
}
