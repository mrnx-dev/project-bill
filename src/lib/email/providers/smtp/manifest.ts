import type { ProviderManifest } from "../types";
import { SmtpProvider } from "./provider";

export const manifest: ProviderManifest = {
  id: "smtp",
  name: "SMTP",
  icon: "Server",
  description: "Custom SMTP server — connect to any mail relay or your own mail server.",
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
      placeholder: "587",
    },
    {
      id: "user",
      label: "Username",
      type: "text",
      required: false,
      placeholder: "user@example.com",
    },
    {
      id: "password",
      label: "Password",
      type: "password",
      required: false,
      placeholder: "••••••••",
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
  create: (config) => new SmtpProvider(config),
};
