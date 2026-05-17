export interface SendEmailData {
  to: string | string[];
  from: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface EmailProvider {
  readonly name: string;
  send(data: SendEmailData): Promise<SendResult>;
}

export interface ProviderField {
  id: string;
  label: string;
  type: "text" | "password" | "number" | "select";
  required: boolean;
  placeholder?: string;
  defaultValue?: string;
  options?: Array<{ value: string; label: string }>;
  validation?: {
    pattern?: string;
    message?: string;
  };
}

export interface ProviderManifest {
  id: string;
  name: string;
  description: string;
  icon: string;
  fields: ProviderField[];
  create: (config: Record<string, string>) => EmailProvider;
}
