import type { EmailProvider, EmailMessage, SendResult } from "../types";

export class ConsoleProvider implements EmailProvider {
  name = "console";

  async send(message: EmailMessage): Promise<SendResult> {
    console.log("=== EMAIL (Console Provider) ===");
    console.log(`To: ${message.to}`);
    console.log(`From: ${message.fromName ? `${message.fromName} <${message.from}>` : message.from}`);
    console.log(`Subject: ${message.subject}`);
    console.log(`Body: ${message.text || message.html.substring(0, 200)}...`);
    if (message.attachments?.length) {
      console.log(`Attachments: ${message.attachments.map((item) => item.filename).join(", ")}`);
    }
    console.log("================================");

    return { success: true, messageId: `console-${Date.now()}` };
  }
}
