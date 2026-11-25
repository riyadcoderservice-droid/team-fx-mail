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

  const recordRecentAddress = React.useCallback((address: string) => {
    setRecentAddresses((prev) => {
      const next = [address, ...prev.filter((a) => a !== address)].slice(0, 12);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
        localStorage.setItem(ACTIVE_KEY, address);
      } catch {
        // Ignore storage quota issues
      }
      return next;
    });
  }, []);

  const fetchMessages = React.useCallback(async (address: string) => {
    setLoadingList(true);
    try {
      const resp = await fetch(
        `/api/mail/messages?address=${encodeURIComponent(address)}`
      );
      if (resp.ok) {
        const data = (await resp.json()) as { messages: InboxMessageSummary[] };
        setMessages(data.messages || []);
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
        const resp = await fetch('/api/mail/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, domain }),
        });
        const data = (await resp.json()) as MailboxSession & { error?: string };
        if (!resp.ok || !data.address) {
          setCreateError(data.error || 'নতুন মেইল তৈরি করা যায়নি।');
          return;
        }
        setMailbox(data);
        setMessages([]);
        setSelectedMessage(null);
        setCountdown(5);
        recordRecentAddress(data.address);
        if (navigateToMail) {
          setActiveSection('mail');
        }
        await fetchMessages(data.address);
      } catch {
        setCreateError('সার্ভারের সাথে সংযোগ করা যায়নি।');
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
        const resp = await fetch('/api/mail/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mailName }),
        });
        const data = (await resp.json()) as MailboxSession & { error?: string };
        if (!resp.ok || !data.address) {
          setLoginError(data.error || 'এই নামে কোনো মেইল পাওয়া যায়নি।');
          return;
        }
        setMailbox(data);
        setMessages([]);
        setSelectedMessage(null);
        setCountdown(5);
        recordRecentAddress(data.address);
        setActiveSection('mail');
        await fetchMessages(data.address);
      } catch {
        setLoginError('মেইল লগইন করা যায়নি।');
      } finally {
        setLoggingInMail(false);
      }
    },
    [fetchMessages, recordRecentAddress]
  );

  const deleteActiveMailbox = React.useCallback(async () => {
    if (!mailbox) return;
    const addr = mailbox.address;
    try {
      await fetch('/api/mail/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: addr }),
      });
    } finally {
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
        const resp = await fetch(
          `/api/mail/messages/${encodeURIComponent(id)}?address=${encodeURIComponent(
            mailbox.address
          )}`
        );
        if (resp.ok) {
          const full = (await resp.json()) as InboxMessageFull;
          setSelectedMessage(full);
          setMessages((prev) =>
            prev.map((m) => (m.id === id ? { ...m, seen: true } : m))
          );
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
      await fetch(
        `/api/mail/messages/${encodeURIComponent(id)}?address=${encodeURIComponent(
          mailbox.address
        )}`,
        { method: 'DELETE' }
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
          const cfg = (await cfgResp.json()) as SiteConfig;
          setSiteConfig(cfg);
        }
        if (!cancelled && domResp.ok) {
          const dom = (await domResp.json()) as { domains: string[] };
          if (dom.domains?.length > 0) setDomains(dom.domains);
        }
      } catch {
        // Ignore transient init errors
      }

      const savedActive = localStorage.getItem(ACTIVE_KEY);
      if (savedActive && !savedActive.endsWith('@teamfx.mail')) {
        try {
          const resp = await fetch('/api/mail/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mailName: savedActive }),
          });
          if (!cancelled && resp.ok) {
            const session = (await resp.json()) as MailboxSession;
            setMailbox(session);
            void fetchMessages(session.address);
            return;
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
          void fetchMessages(mailbox.address);
          return 5;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [mailbox?.address, fetchMessages]);

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
            countdown={countdown}
            onSelectMessage={selectMessage}
            onRefresh={() => {
              if (mailbox) {
                setCountdown(5);
                void fetchMessages(mailbox.address);
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
