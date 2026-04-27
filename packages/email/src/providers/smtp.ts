import nodemailer from "nodemailer";
import type { EmailProvider, EmailMessage, SendResult } from "../types";

function formatProviderSmtpError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("Hostname/IP does not match certificate's altnames")) {
    return "het SSL-certificaat past niet bij de SMTP-host of TLS-servernaam";
  }
  if (/auth|login|invalid credentials|username|password/i.test(message)) {
    return "authenticatie geweigerd; controleer gebruikersnaam, wachtwoord of app-password";
  }
  if (/timeout|ENOTFOUND|ECONNREFUSED|EAI_AGAIN/i.test(message)) {
    return "verbinding met de mailserver mislukt; controleer host, poort, firewall en DNS";
  }
  return message;
}

export class SmtpProvider implements EmailProvider {
  name = "smtp";
  private transporter: nodemailer.Transporter;

  constructor(config: {
    host: string;
    port: number;
    user: string;
    pass: string;
    secure?: boolean;
    tls?: { rejectUnauthorized?: boolean; servername?: string };
  }) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure ?? config.port === 465,
      auth: { user: config.user, pass: config.pass },
      tls: {
        rejectUnauthorized: config.tls?.rejectUnauthorized ?? true,
        ...(config.tls?.servername ? { servername: config.tls.servername } : {}),
      },
    });
  }

  async send(message: EmailMessage): Promise<SendResult> {
    try {
      const info = await this.transporter.sendMail({
        from: message.fromName ? `"${message.fromName}" <${message.from}>` : message.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        replyTo: message.replyTo,
        bcc: message.bcc,
        attachments: message.attachments as nodemailer.SendMailOptions["attachments"],
      } as nodemailer.SendMailOptions);
      return { success: true, messageId: info.messageId };
    } catch (error: any) {
      console.error("[smtp] Send failed:", error);
      return { success: false, error: formatProviderSmtpError(error) };
    }
  }
}
