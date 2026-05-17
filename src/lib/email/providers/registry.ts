import type { ProviderManifest, EmailProvider } from "./types";
import { manifest as resendManifest } from "./resend/manifest";
import { manifest as brevoManifest } from "./brevo/manifest";
import { manifest as smtpManifest } from "./smtp/manifest";

const MANIFESTS: ProviderManifest[] = [
  resendManifest,
  brevoManifest,
  smtpManifest,
];

export const providerRegistry = {
  getAll(): ProviderManifest[] {
    return MANIFESTS;
  },

  getById(id: string): ProviderManifest | undefined {
    return MANIFESTS.find((m) => m.id === id);
  },

  getIds(): string[] {
    return MANIFESTS.map((m) => m.id);
  },

  createProvider(id: string, config: Record<string, string>): EmailProvider {
    const manifest = MANIFESTS.find((m) => m.id === id);
    if (!manifest) throw new Error(`Unknown provider: ${id}`);
    return manifest.create(config);
  },
};
