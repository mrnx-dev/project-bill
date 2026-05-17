import type { ProviderManifest } from "../types";
import { ResendProvider } from "./provider";

export const manifest: ProviderManifest = {
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
  create: (config) => new ResendProvider(config.apiKey),
};
