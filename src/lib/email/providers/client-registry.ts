import type { ProviderManifest } from "./types";

/**
 * Client-safe manifest registry — pure metadata only.
 * No provider class imports (Resend SDK, nodemailer, etc).
 * Use this in client components to render dynamic config forms.
 */

const clientManifests: ProviderManifest[] = [
  {
    id: "resend",
    name: "Resend",
    description: "Modern email API for developers",
    icon: "Mail",
    fields: [
      {
        id: "apiKey",
        label: "Resend API Key",
        type: "password",
        required: true,
        placeholder: "re_xxxxxxxxxxxxxxxxxxxx",
        validation: {
          pattern: "^(re_|sk_)",
          message: "Resend API key must start with re_ or sk_",
        },
      },
    ],
    create: () => {
      throw new Error("Not available on client");
    },
  },
  {
    id: "brevo",
    name: "Brevo",
    description: "Brevo (ex-SendInBlue) email platform",
    icon: "Send",
    fields: [
      {
        id: "apiKey",
        label: "Brevo API Key",
        type: "password",
        required: true,
        placeholder: "xkeysib-xxxxxxxxxxxxxxxx",
        validation: {
          pattern: "^xkeysib-",
          message: "Brevo API key must start with xkeysib-",
        },
      },
    ],
    create: () => {
      throw new Error("Not available on client");
    },
  },
  {
    id: "smtp",
    name: "Custom SMTP",
    description: "Custom SMTP server — connect to any mail relay or your own mail server.",
    icon: "Server",
    fields: [
      {
        id: "host",
        label: "SMTP Host",
        type: "text",
        required: true,
        placeholder: "smtp.gmail.com",
      },
      {
        id: "port",
        label: "Port",
        type: "number",
        required: true,
        defaultValue: "587",
        placeholder: "587",
      },
      {
        id: "user",
        label: "Username",
        type: "text",
        required: true,
      },
      {
        id: "password",
        label: "Password",
        type: "password",
        required: true,
      },
      {
        id: "secure",
        label: "Connection Security",
        type: "select",
        required: false,
        options: [
          { label: "STARTTLS (auto, port 587)", value: "starttls" },
          { label: "TLS (port 465)", value: "tls" },
          { label: "SSL (legacy)", value: "ssl" },
          { label: "None", value: "none" },
        ],
      },
      {
        id: "rejectUnauthorized",
        label: "Reject Unauthorized Certs",
        type: "select",
        required: false,
        options: [
          { label: "Yes (secure)", value: "true" },
          { label: "No (allow self-signed)", value: "false" },
        ],
      },
    ],
    create: () => {
      throw new Error("Not available on client");
    },
  },
];

export const clientProviderRegistry = {
  getAll: (): ProviderManifest[] => clientManifests,
  getById: (id: string): ProviderManifest | undefined =>
    clientManifests.find((m) => m.id === id),
  getIds: (): string[] => clientManifests.map((m) => m.id),
};
