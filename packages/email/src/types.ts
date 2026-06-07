export interface EmailMessage {
  to: string;
  from: string;
  fromName?: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  bcc?: string;
  inReplyTo?: string;
  references?: string;
  attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  filename: string;
  content?: string | Buffer;
  path?: string;
  contentType?: string;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface EmailProvider {
  name: string;
  send(message: EmailMessage): Promise<SendResult>;
}

export interface TemplateContext {
  companyName?: string;
  contactName?: string;
  city?: string;
  painPoints?: string;
  senderName?: string;
  previousSubject?: string;
  industry?: string;
  website?: string;
  score?: string;
  priority?: string;
  primaryPainPoint?: string;
  suggestedService?: string;
  [key: string]: string | undefined;
}
