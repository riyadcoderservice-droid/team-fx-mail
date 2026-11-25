import React from 'react';
import {
  Copy,
  Check,
  ArrowRight,
  PlusCircle,
  LogIn,
  Shuffle,
  Trash2,
  Shield,
  KeyRound,
  UserCheck,
} from 'lucide-react';
import type { ActiveSection, MailboxSession } from '../types';

interface HomeSectionProps {
  mailbox: MailboxSession | null;
  creatingMail: boolean;
  onNavigate: (section: ActiveSection) => void;
  onCreateInstant: () => void;
  onDeleteMail: () => void;
}

export const HomeSection: React.FC<HomeSectionProps> = ({
  mailbox,
  creatingMail,
  onNavigate,
  onCreateInstant,
  onDeleteMail,
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    if (!mailbox?.address) return;
    await navigator.clipboard.writeText(mailbox.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-10">
      {/* Hero Focal Block */}
      <div className="bg-[#12141C] border border-[#232736] rounded-xl p-6 sm:p-10 space-y-8">
        <div className="max-w-3xl space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-[#E5B869]">
            <span>TEAM FX</span>
            <span aria-hidden="true">·</span>
            <span>প্রিমিয়াম এডিশন</span>
            <span aria-hidden="true">·</span>
            <span>রিয়েল লাইভ মেইল ও OTP সাপোর্ট</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[#F8FAFC] leading-tight">
            তাৎক্ষণিক ও রিয়েল প্রিমিয়াম টেম্প মেইল
          </h1>
          <p className="text-sm sm:text-base font-bold text-[#94A3B8] leading-relaxed max-w-2xl">
            আসল ডোমেইনসহ রিয়েল ইমেইল তৈরি করুন, সাথে সাথে পরিবর্তন বা ডিলিট করুন, এবং যেকোনো ওয়েবসাইট বা অ্যাপ থেকে আসা আসল মেসেজ ও OTP কোড সরাসরি ইনবক্সে দেখুন।
          </p>
        </div>

        {/* Active Mailbox Bar */}
        <div className="bg-[#0B0C12] border border-[#222636] rounded-xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <span className="text-xs font-bold text-[#94A3B8]">
              আপনার সক্রিয় রিয়েল টেম্প মেইল
            </span>
            <p className="text-base sm:text-xl font-mono-tabular text-[#F8FAFC] truncate select-all">
              {mailbox ? mailbox.address : 'এখনো কোনো মেইল তৈরি করা হয়নি'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {mailbox ? (
              <>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="btn-gold px-5 py-2.5 text-xs sm:text-sm"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'কপি হয়েছে' : 'কপি করুন'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('mail')}
                  className="btn-obsidian px-4 py-2.5 text-xs sm:text-sm"
                >
                  <span>ইনবক্স দেখুন</span>
                  <ArrowRight className="w-4 h-4 text-[#E5B869]" />
                </button>
                <button
                  type="button"
                  onClick={onCreateInstant}
                  disabled={creatingMail}
                  className="btn-obsidian px-4 py-2.5 text-xs sm:text-sm"
                >
                  <Shuffle className="w-4 h-4 text-[#E5B869]" />
                  <span>{creatingMail ? 'তৈরি হচ্ছে...' : 'মেইল পরিবর্তন'}</span>
                </button>
                <button
                  type="button"
                  onClick={onDeleteMail}
                  className="btn-danger px-4 py-2.5 text-xs sm:text-sm"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>ডিলিট</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onCreateInstant}
                disabled={creatingMail}
                className="btn-gold px-6 py-3 text-sm"
              >
                <PlusCircle className="w-4 h-4" />
                <span>{creatingMail ? 'তৈরি হচ্ছে...' : 'নতুন রিয়েল মেইল নিন'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Three Functional Capability Blocks */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#12141C] border border-[#232736] rounded-xl p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-b from-[#212638] to-[#151824] border border-[#303750] flex items-center justify-center text-[#E5B869]">
              <KeyRound className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-extrabold text-[#F8FAFC]">
              কাস্টম নাম ও অটো OTP
            </h2>
            <p className="text-sm font-bold text-[#94A3B8] leading-relaxed">
              আপনার পছন্দের নামে রিয়েল মেইল তৈরি করুন। যেকোনো ভেরিফিকেশন কোড আসলে ইনবক্সে আলাদাভাবে কপি করার অপশন দেখাবে।
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('create')}
            className="btn-obsidian px-4 py-2.5 text-xs sm:text-sm w-fit"
          >
            <span>নতুন মেইল তৈরি করুন</span>
            <ArrowRight className="w-4 h-4 text-[#E5B869]" />
          </button>
        </div>

        <div className="bg-[#12141C] border border-[#232736] rounded-xl p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-b from-[#212638] to-[#151824] border border-[#303750] flex items-center justify-center text-[#E5B869]">
              <LogIn className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-extrabold text-[#F8FAFC]">
              মেইল নাম দিয়ে পুনরায় লগইন
            </h2>
            <p className="text-sm font-bold text-[#94A3B8] leading-relaxed">
              আগে নেওয়া মেইল হারিয়ে যায়নি! শুধুমাত্র সেই মেইলের নাম বা ঠিকানা দিয়ে লগইন করলে আগের পুরো ইনবক্স ফিরে পাবেন।
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('login')}
            className="btn-obsidian px-4 py-2.5 text-xs sm:text-sm w-fit"
          >
            <span>মেইল লগইনে যান</span>
            <ArrowRight className="w-4 h-4 text-[#E5B869]" />
          </button>
        </div>

        <div className="bg-[#12141C] border border-[#232736] rounded-xl p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-b from-[#212638] to-[#151824] border border-[#303750] flex items-center justify-center text-[#E5B869]">
              <UserCheck className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-extrabold text-[#F8FAFC]">
              জিমেইল একাউন্ট ও অ্যাডমিন
            </h2>
            <p className="text-sm font-bold text-[#94A3B8] leading-relaxed">
              জিমেইল দিয়ে সাইন-ইন করে আপনার তৈরি করা সব মেইল সেভ রাখুন এবং অ্যাডমিন প্যানেল থেকে ওয়েবের লোগো পরিবর্তন করুন।
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => onNavigate('gmail')}
              className="btn-gold px-4 py-2.5 text-xs sm:text-sm"
            >
              <span>জিমেইল লগইন</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('admin')}
              className="btn-obsidian px-4 py-2.5 text-xs sm:text-sm"
            >
              <Shield className="w-4 h-4 text-[#E5B869]" />
              <span>অ্যাডমিন</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
