/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Header } from './components/Header';
import { HomeSection } from './components/HomeSection';
import { MailWorkspace } from './components/MailWorkspace';
import { CreateMailView, MailLoginView } from './components/CreateAndLoginViews';
import { AdminPanel } from './components/AdminPanel';
import type {
  ActiveSection,
  InboxMessageFull,
  InboxMessageSummary,
  MailboxSession,
  SiteConfig,
} from './types';

const RECENT_KEY = 'teamfx_recent_addresses';
const ACTIVE_KEY = 'teamfx_active_address';
const TOKENS_KEY = 'teamfx_mailbox_tokens';

function loadStoredTokens(): Record<string, string> {
  try {
    const raw = localStorage.getItem(TOKENS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function saveStoredTokens(map: Record<string, string>): void {
  try {
    localStorage.setItem(TOKENS_KEY, JSON.stringify(map));
  } catch {
    // Ignore quota errors
  }
}

async function parseJsonResponse<T>(resp: Response): Promise<T | null> {
  const text = await resp.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export default function App() {
  const [siteConfig, setSiteConfig] = React.useState<SiteConfig>({
    brandName: 'TEAM FX',
    subtitle: 'premium mail',
    logoUrl: null,
    noticeBanner: '',
  });
  const [activeSection, setActiveSection] = React.useState<ActiveSection>('home');
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const [domains, setDomains] = React.useState<string[]>([]);
  const [mailbox, setMailbox] = React.useState<MailboxSession | null>(null);
  const [recentAddresses, setRecentAddresses] = React.useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });

  const [messages, setMessages] = React.useState<InboxMessageSummary[]>([]);
  const [selectedMessage, setSelectedMessage] = React.useState<InboxMessageFull | null>(null);
  const [loadingList, setLoadingList] = React.useState(false);
  const [loadingDetail, setLoadingDetail] = React.useState(false);
  const [creatingMail, setCreatingMail] = React.useState(false);
  const [loggingInMail, setLoggingInMail] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [loginError, setLoginError] = React.useState<string | null>(null);
  const [countdown, setCountdown] = React.useState(5);

  const tokenMapRef = React.useRef<Record<string, string>>(loadStoredTokens());

  const recordRecentAddress = React.useCallback((session: MailboxSession) => {
    if (session.mailboxToken) {
      tokenMapRef.current[session.address] = session.mailboxToken;
      saveStoredTokens(tokenMapRef.current);
    }
    setRecentAddresses((prev) => {
      const next = [session.address, ...prev.filter((a) => a !== session.address)].slice(0, 12);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
        localStorage.setItem(ACTIVE_KEY, session.address);
      } catch {
        // Ignore storage quota issues
      }
      return next;
    });
  }, []);

  const fetchMessages = React.useCallback(async (address: string, token?: string) => {
    setLoadingList(true);
    try {
      const activeToken = token || tokenMapRef.current[address];
      const headers: Record<string, string> = {};
      if (activeToken) {
        headers['x-mailbox-token'] = activeToken;
      }
      const resp = await fetch(
        `/api/mail/messages?address=${encodeURIComponent(address)}`,
        { headers }
      );
      if (resp.ok) {
        const data = await parseJsonResponse<{ messages: InboxMessageSummary[] }>(resp);
        if (data?.messages) {
          setMessages(data.messages);
        }
      }
    } catch {
      // Keep current messages on transient error
    } finally {
      setLoadingList(false);
    }
  }, []);

  const createMailbox = React.useCallback(
    async (username?: string, domain?: string, navigateToMail = true) => {
      setCreateError(null);
      setCreatingMail(true);
      try {
        let resp: Response | null = null;
        let lastErr: unknown = null;

        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            resp = await fetch('/api/mail/create', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username, domain }),
            });
            if (resp.status !== 502 && resp.status !== 503 && resp.status !== 504) {
              break;
            }
          } catch (err) {
            lastErr = err;
          }
          if (attempt === 0) {
            await new Promise((r) => setTimeout(r, 700));
          }
        }

        if (!resp) {
          throw lastErr || new Error('Network error');
        }

        const data = await parseJsonResponse<MailboxSession & { error?: string }>(resp);
        if (!resp.ok || !data?.address) {
          setCreateError(
            data?.error || `মেইল তৈরি করা যায়নি (HTTP ${resp.status})। আবার চেষ্টা করুন।`
          );
          return;
        }
        setMailbox(data);
        setMessages([]);
        setSelectedMessage(null);
        setCountdown(5);
        recordRecentAddress(data);
        if (navigateToMail) {
          setActiveSection('mail');
        }
        await fetchMessages(data.address, data.mailboxToken);
      } catch {
        setCreateError('সার্ভারের সাথে সংযোগ করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।');
      } finally {
        setCreatingMail(false);
      }
    },
    [fetchMessages, recordRecentAddress]
  );

  const loginToMailbox = React.useCallback(
    async (mailName: string) => {
      setLoginError(null);
      setLoggingInMail(true);
      try {
        const normalized = mailName.trim().toLowerCase();
        const knownToken =
          tokenMapRef.current[normalized] ||
          Object.entries(tokenMapRef.current).find(
            ([addr]) => addr.split('@')[0] === normalized
          )?.[1];
        const resp = await fetch('/api/mail/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mailName: normalized, mailboxToken: knownToken }),
        });
        const data = await parseJsonResponse<MailboxSession & { error?: string }>(resp);
        if (!resp.ok || !data?.address) {
          setLoginError(data?.error || 'এই নামে কোনো মেইল পাওয়া যায়নি।');
          return;
        }
        setMailbox(data);
        setMessages([]);
        setSelectedMessage(null);
        setCountdown(5);
        recordRecentAddress(data);
        setActiveSection('mail');
        await fetchMessages(data.address, data.mailboxToken);
      } catch {
        setLoginError('মেইল লগইন করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।');
      } finally {
        setLoggingInMail(false);
      }
    },
    [fetchMessages, recordRecentAddress]
  );

  const deleteActiveMailbox = React.useCallback(async () => {
    if (!mailbox) return;
    const addr = mailbox.address;
    const activeToken = mailbox.mailboxToken || tokenMapRef.current[addr];
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (activeToken) headers['x-mailbox-token'] = activeToken;
      await fetch('/api/mail/account', {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ address: addr }),
      });
    } finally {
      delete tokenMapRef.current[addr];
      saveStoredTokens(tokenMapRef.current);
      setMailbox(null);
      setMessages([]);
      setSelectedMessage(null);
      setRecentAddresses((prev) => {
        const next = prev.filter((a) => a !== addr);
        try {
          localStorage.setItem(RECENT_KEY, JSON.stringify(next));
          localStorage.removeItem(ACTIVE_KEY);
        } catch {
          // Ignore
        }
        return next;
      });
    }
  }, [mailbox]);

  const selectMessage = React.useCallback(
    async (id: string) => {
      if (!mailbox) return;
      setLoadingDetail(true);
      try {
        const activeToken = mailbox.mailboxToken || tokenMapRef.current[mailbox.address];
        const headers: Record<string, string> = {};
        if (activeToken) headers['x-mailbox-token'] = activeToken;
        const resp = await fetch(
          `/api/mail/messages/${encodeURIComponent(id)}?address=${encodeURIComponent(
            mailbox.address
          )}`,
          { headers }
        );
        if (resp.ok) {
          const full = await parseJsonResponse<InboxMessageFull>(resp);
          if (full) {
            setSelectedMessage(full);
            setMessages((prev) =>
              prev.map((m) => (m.id === id ? { ...m, seen: true } : m))
            );
          }
        }
      } finally {
        setLoadingDetail(false);
      }
    },
    [mailbox]
  );

  const deleteMessage = React.useCallback(
    async (id: string) => {
      if (!mailbox) return;
      const activeToken = mailbox.mailboxToken || tokenMapRef.current[mailbox.address];
      const headers: Record<string, string> = {};
      if (activeToken) headers['x-mailbox-token'] = activeToken;
      await fetch(
        `/api/mail/messages/${encodeURIComponent(id)}?address=${encodeURIComponent(
          mailbox.address
        )}`,
        { method: 'DELETE', headers }
      );
      setMessages((prev) => prev.filter((m) => m.id !== id));
      setSelectedMessage((prev) => (prev?.id === id ? null : prev));
    },
    [mailbox]
  );

  // Initial boot: fetch config, domains, and restore or create first real mailbox
  React.useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const [cfgResp, domResp] = await Promise.all([
          fetch('/api/site-config'),
          fetch('/api/mail/domains'),
        ]);
        if (!cancelled && cfgResp.ok) {
          const cfg = await parseJsonResponse<SiteConfig>(cfgResp);
          if (cfg) setSiteConfig(cfg);
        }
        if (!cancelled && domResp.ok) {
          const dom = await parseJsonResponse<{ domains: string[] }>(domResp);
          if (dom?.domains?.length) setDomains(dom.domains);
        }
      } catch {
        // Ignore transient init errors
      }

      const savedActive = localStorage.getItem(ACTIVE_KEY);
      if (savedActive && !savedActive.endsWith('@teamfx.mail')) {
        try {
          const savedToken = tokenMapRef.current[savedActive.toLowerCase()];
          const resp = await fetch('/api/mail/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mailName: savedActive, mailboxToken: savedToken }),
          });
          if (!cancelled && resp.ok) {
            const session = await parseJsonResponse<MailboxSession>(resp);
            if (session?.address) {
              if (session.mailboxToken) {
                tokenMapRef.current[session.address] = session.mailboxToken;
                saveStoredTokens(tokenMapRef.current);
              }
              setMailbox(session);
              void fetchMessages(session.address, session.mailboxToken);
              return;
            }
          }
        } catch {
          // Fall through to creating fresh real mailbox
        }
      }
      if (!cancelled) {
        await createMailbox(undefined, undefined, false);
      }
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, [createMailbox, fetchMessages]);

  // Auto-refresh inbox every 5 seconds
  React.useEffect(() => {
    if (!mailbox?.address) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          void fetchMessages(mailbox.address, mailbox.mailboxToken);
          return 5;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [mailbox?.address, mailbox?.mailboxToken, fetchMessages]);

  const unreadCount = React.useMemo(
    () => messages.filter((m) => !m.seen).length,
    [messages]
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#090A0F] text-[#F8FAFC]">
      <Header
        siteConfig={siteConfig}
        activeSection={activeSection}
        onNavigate={setActiveSection}
        drawerOpen={drawerOpen}
        onToggleDrawer={setDrawerOpen}
        activeAddress={mailbox?.address || null}
        unreadCount={unreadCount}
      />

      {siteConfig.noticeBanner && (
        <div className="bg-[#151824] border-b border-[#262B3D] px-4 py-2 text-center text-xs sm:text-sm font-bold text-[#E5B869]">
          {siteConfig.noticeBanner}
        </div>
      )}

      <main className="flex-1">
        {activeSection === 'home' && (
          <HomeSection
            mailbox={mailbox}
            creatingMail={creatingMail}
            error={createError}
            onNavigate={setActiveSection}
            onCreateInstant={() => createMailbox(undefined, undefined, true)}
            onDeleteMail={deleteActiveMailbox}
          />
        )}

        {activeSection === 'mail' && (
          <MailWorkspace
            mailbox={mailbox}
            messages={messages}
            selectedMessage={selectedMessage}
            loadingList={loadingList}
            loadingDetail={loadingDetail}
            creatingMail={creatingMail}
            createError={createError}
            countdown={countdown}
            onSelectMessage={selectMessage}
            onRefresh={() => {
              if (mailbox) {
                setCountdown(5);
                void fetchMessages(mailbox.address, mailbox.mailboxToken);
              }
            }}
            onChangeMail={() => createMailbox(undefined, undefined, true)}
            onDeleteMail={deleteActiveMailbox}
            onDeleteMessage={deleteMessage}
            onOpenCreateView={() => setActiveSection('create')}
          />
        )}

        {activeSection === 'create' && (
          <CreateMailView
            domains={domains}
            creatingMail={creatingMail}
            error={createError}
            onCreateMail={async (u, d) => {
              await createMailbox(u, d, true);
            }}
          />
        )}

        {activeSection === 'login' && (
          <MailLoginView
            recentAddresses={recentAddresses.filter((a) => !a.endsWith('@teamfx.mail'))}
            activeAddress={mailbox?.address || null}
            loggingIn={loggingInMail}
            error={loginError}
            onLoginMail={loginToMailbox}
          />
        )}

        {activeSection === 'admin' && (
          <AdminPanel
            siteConfig={siteConfig}
            onSiteConfigUpdated={setSiteConfig}
            onOpenMailbox={loginToMailbox}
          />
        )}
      </main>

      <footer className="border-t border-[#1E2230] py-6 px-4 sm:px-6 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-bold text-[#64748B]">
          <span>
            © {new Date().getFullYear()} {siteConfig.brandName} · {siteConfig.subtitle}
          </span>
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => setActiveSection('home')}
              className="hover:text-[#F8FAFC] cursor-pointer"
            >
              Home
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('mail')}
              className="hover:text-[#F8FAFC] cursor-pointer"
            >
              Inbox
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('login')}
              className="hover:text-[#F8FAFC] cursor-pointer"
            >
              Mail Login
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('admin')}
              className="hover:text-[#F8FAFC] cursor-pointer"
            >
              Admin
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
