export type ActiveSection = 'home' | 'mail' | 'create' | 'login' | 'admin';

export interface SiteConfig {
  brandName: string;
  subtitle: string;
  logoUrl: string | null;
  noticeBanner: string;
}

export interface MailboxSession {
  address: string;
  provider: 'mailtm' | 'guerrilla';
  createdAt: string;
  mailboxToken?: string;
}

export interface InboxMessageSummary {
  id: string;
  from: { name: string; address: string };
  subject: string;
  intro: string;
  createdAt: string;
  seen: boolean;
  hasAttachments: boolean;
  otpCode: string | null;
}

export interface InboxMessageFull extends InboxMessageSummary {
  to: { name: string; address: string }[];
  text: string;
  html: string[];
}
