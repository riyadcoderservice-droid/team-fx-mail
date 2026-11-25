import React from 'react';
import {
  Menu,
  X,
  Home,
  Mail,
  PlusCircle,
  LogIn,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import type { ActiveSection, SiteConfig } from '../types';

const DEFAULT_LOGO = '/src/assets/images/team_fx_emblem_1795625957277.jpg';

interface HeaderProps {
  siteConfig: SiteConfig;
  activeSection: ActiveSection;
  onNavigate: (section: ActiveSection) => void;
  drawerOpen: boolean;
  onToggleDrawer: (open: boolean) => void;
  activeAddress: string | null;
  unreadCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  siteConfig,
  activeSection,
  onNavigate,
  drawerOpen,
  onToggleDrawer,
  activeAddress,
  unreadCount,
}) => {
  const [logoError, setLogoError] = React.useState(false);

  React.useEffect(() => {
    setLogoError(false);
  }, [siteConfig.logoUrl]);

  const activeLogoSrc = siteConfig.logoUrl || DEFAULT_LOGO;

  const navLinks: { id: ActiveSection; label: string }[] = [
    { id: 'home', label: 'Home' },
    { id: 'mail', label: unreadCount > 0 ? `Inbox (${unreadCount})` : 'Inbox' },
    { id: 'create', label: 'Create Mail' },
    { id: 'login', label: 'Mail Login' },
  ];

  const drawerItems: {
    id: ActiveSection;
    title: string;
    bangla: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'home',
      title: 'Home',
      bangla: 'হোম ও ওভারভিউ',
      icon: <Home className="w-5 h-5" />,
    },
    {
      id: 'mail',
      title: 'Mail & Inbox',
      bangla: 'লাইভ ইনবক্স ও মেসেজ',
      icon: <Mail className="w-5 h-5" />,
    },
    {
      id: 'create',
      title: 'Create Mail',
      bangla: 'নতুন মেইল তৈরি করুন',
      icon: <PlusCircle className="w-5 h-5" />,
    },
    {
      id: 'login',
      title: 'Mail Login',
      bangla: 'মেইল নাম দিয়ে লগইন',
      icon: <LogIn className="w-5 h-5" />,
    },
    {
      id: 'admin',
      title: 'Admin Panel',
      bangla: 'অ্যাডমিন প্যানেল ও লোগো সেটআপ',
      icon: <ShieldCheck className="w-5 h-5" />,
    },
  ];

  const handleDrawerSelect = (section: ActiveSection) => {
    onNavigate(section);
    onToggleDrawer(false);
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-[#090A0F]/95 backdrop-blur-md border-b border-[#1E2230]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4 sm:gap-8">
          {/* Zone 1: Brand Lockup */}
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="flex items-center gap-3 text-left shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5B869] rounded-xl pr-2"
          >
            <div className="w-10 h-10 rounded-xl overflow-hidden border border-[#2E344B] bg-[#12141C] flex items-center justify-center shrink-0 shadow-[0_2px_10px_rgba(0,0,0,0.45)]">
              {!logoError ? (
                <img
                  src={activeLogoSrc}
                  alt="TEAM FX Logo"
                  referrerPolicy="no-referrer"
                  onError={() => setLogoError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xs font-extrabold tracking-tight text-[#E5B869]">
                  FX
                </span>
              )}
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-lg sm:text-xl font-extrabold tracking-tight text-[#F8FAFC] whitespace-nowrap">
                {siteConfig.brandName || 'TEAM FX'}
              </span>
              <span className="text-[11px] font-bold tracking-wider text-[#E5B869] lowercase mt-0.5 whitespace-nowrap">
                {siteConfig.subtitle || 'premium mail'}
              </span>
            </div>
          </button>

          {/* Zone 2: Clean Single-Line Nav Links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-bold">
            {navLinks.map((link) => {
              const isActive = activeSection === link.id;
              return (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => onNavigate(link.id)}
                  className={`py-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer border-b-2 ${
                    isActive
                      ? 'text-[#E5B869] border-[#E5B869]'
                      : 'text-[#94A3B8] border-transparent hover:text-[#F8FAFC] hover:border-[#333A4F]'
                  }`}
                >
                  {link.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Quick Create CTA + Top-Right Three-Line Menu */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('create')}
              className="hidden sm:inline-flex btn-gold px-4 py-2 text-xs shrink-0"
            >
              <PlusCircle className="w-4 h-4" />
              <span>নতুন মেইল</span>
            </button>

            <button
              type="button"
              aria-label="Open all features menu"
              onClick={() => onToggleDrawer(!drawerOpen)}
              className="btn-obsidian w-11 h-11 p-0 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5B869]"
            >
              {drawerOpen ? (
                <X className="w-5 h-5 text-[#E5B869]" />
              ) : (
                <Menu className="w-5 h-5 text-[#E5B869]" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Slide-Over All Features Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-xs"
            onClick={() => onToggleDrawer(false)}
          />
          <aside className="relative z-10 w-full max-w-sm bg-[#0E1017] border-l border-[#232736] h-full flex flex-col justify-between p-6 overflow-y-auto">
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-[#1E2230]">
                <div>
                  <p className="text-base font-extrabold text-[#F8FAFC]">
                    সকল ফিচারসমূহ
                  </p>
                  <p className="text-xs font-bold text-[#94A3B8]">
                    TEAM FX Navigation Menu
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => onToggleDrawer(false)}
                  className="btn-obsidian w-10 h-10 p-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {activeAddress && (
                <div className="p-3.5 rounded-xl bg-[#131620] border border-[#23283A] space-y-1">
                  <span className="text-[11px] font-bold text-[#94A3B8]">
                    বর্তমান রিয়েল মেইল
                  </span>
                  <p className="text-xs font-mono-tabular text-[#E5B869] truncate">
                    {activeAddress}
                  </p>
                </div>
              )}

              <div className="space-y-2.5">
                {drawerItems.map((item) => {
                  const isActive = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleDrawerSelect(item.id)}
                      className={`w-full flex items-center justify-between p-3.5 rounded-xl border transition-all duration-150 text-left cursor-pointer active:scale-[0.98] ${
                        isActive
                          ? 'bg-gradient-to-b from-[#23283B] to-[#171B28] border-[#E5B869] text-[#F8FAFC] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                          : 'bg-gradient-to-b from-[#171B27] to-[#11141D] border-[#24293B] text-[#CBD5E1] hover:border-[#E5B869]/50 hover:text-[#F8FAFC]'
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <span
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                            isActive
                              ? 'bg-[#E5B869] text-[#090A0F] border-[#F7D996]'
                              : 'bg-[#1D2232] text-[#E5B869] border-[#2E354D]'
                          }`}
                        >
                          {item.icon}
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-extrabold truncate">
                            {item.title}
                          </div>
                          <div className="text-xs font-bold text-[#94A3B8] truncate">
                            {item.bangla}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#64748B] shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-[#1E2230]">
              <div className="text-xs font-bold text-[#94A3B8]">
                কোনো একাউন্ট বা আইডি ছাড়াই সম্পূর্ণ ফিচার ব্যবহার করুন।
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
};
