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

  private createTransport(overrides: { secure?: boolean; requireTLS?: boolean } = {}): nodemailer.Transporter {
    const secure = overrides.secure ?? (this.secureType === "ssl" || this.secureType === "tls");
    const requireTLS = overrides.requireTLS ?? (this.secureType === "starttls");

    return nodemailer.createTransport({
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
  }

  private isStartTLSError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const msg = error.message.toLowerCase();
    return (
      msg.includes("starttls") ||
      (msg.includes("500") && msg.includes("command not recognized")) ||
      msg.includes("530 must issue a starttls command") ||
      msg.includes("starttls is not advertised")
    );
  }

  private formatStartTLSError(): string {
    return (
      "SMTP server does not support STARTTLS on this port. " +
      'Try changing the connection security to "TLS (port 465)" or "None" in your SMTP settings.'
    );
  }

  async send(data: SendEmailData): Promise<SendResult> {
    const { name, email } = this.parseFrom(data.from);
    const mailOptions = {
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
    };

    // Strategy: try with configured secureType first, then fallback if STARTTLS fails
    const strategies: Array<{
      label: string;
      options: { secure?: boolean; requireTLS?: boolean };
    }> = [
      { label: "configured", options: {} }, // Use configured settings
    ];

    // If configured as STARTTLS, add a fallback to direct TLS
    if (this.secureType === "starttls") {
      strategies.push({
        label: "direct-TLS-fallback (port 465)",
        options: { secure: true, requireTLS: false },
      });
    }

    let lastError: Error | null = null;

    for (const strategy of strategies) {
      let transporter: nodemailer.Transporter | null = null;
      try {
        transporter = this.createTransport(strategy.options);
        const info = await transporter.sendMail(mailOptions);
        return { success: true, messageId: info.messageId };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // If this is a STARTTLS error and we have a fallback, try it
        if (this.isStartTLSError(error) && strategy.label === "configured") {
          console.warn(
            `[EMAIL] STARTTLS failed for ${this.host}:${this.port} (${strategy.label}), trying next strategy...`
          );
          transporter?.close();
          continue; // Try the next strategy
        }

        // No more fallbacks or different error type
        // Provide helpful error messages for common SMTP issues
        const msg = lastError.message;
        if (this.isStartTLSError(error)) {
          return { success: false, error: this.formatStartTLSError() };
        }
        if (msg.includes("ECONNREFUSED")) {
          return {
            success: false,
            error: `SMTP connection refused to ${this.host}:${this.port}. Check host and port settings.`,
          };
        }
        if (msg.includes("ENOTFOUND")) {
          return {
            success: false,
            error: `SMTP host "${this.host}" not found. Check the host address.`,
          };
        }
        if (msg.includes("EAUTH") || msg.includes("Invalid login")) {
          return {
            success: false,
            error: `SMTP authentication failed. Check username and password.`,
          };
        }
        if (msg.includes("ETIMEDOUT") || msg.includes("connection timed out")) {
          return {
            success: false,
            error: `SMTP connection timed out to ${this.host}:${this.port}. The server may be unreachable or blocking connections.`,
          };
        }

        return { success: false, error: msg };
      } finally {
        transporter?.close();
      }
    }

    // All strategies exhausted
    return {
      success: false,
      error: lastError?.message ?? "Unknown SMTP error",
    };
  }
}