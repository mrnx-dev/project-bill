import type { ProviderManifest } from "../types";
import { BrevoProvider } from "./provider";

export const manifest: ProviderManifest = {
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
  create: (config) => new BrevoProvider(config.apiKey),
};
