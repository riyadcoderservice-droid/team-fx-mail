import React from 'react';
import DOMPurify from 'dompurify';
import { QRCodeSVG } from 'qrcode.react';
import {
  Copy,
  Check,
  RefreshCw,
  Trash2,
  Mail,
  QrCode,
  Search,
  KeyRound,
  Plus,
  X,
  Inbox,
  Shuffle,
} from 'lucide-react';
import type {
  InboxMessageFull,
  InboxMessageSummary,
  MailboxSession,
} from '../types';

interface MailWorkspaceProps {
  mailbox: MailboxSession | null;
  messages: InboxMessageSummary[];
  selectedMessage: InboxMessageFull | null;
  loadingList: boolean;
  loadingDetail: boolean;
  creatingMail: boolean;
  createError?: string | null;
  countdown: number;
  onSelectMessage: (id: string) => void;
  onRefresh: () => void;
  onChangeMail: () => void;
  onDeleteMail: () => void;
  onDeleteMessage: (id: string) => void;
  onOpenCreateView: () => void;
}

export const MailWorkspace: React.FC<MailWorkspaceProps> = ({
  mailbox,
  messages,
  selectedMessage,
  loadingList,
  loadingDetail,
  creatingMail,
  createError,
  countdown,
  onSelectMessage,
  onRefresh,
  onChangeMail,
  onDeleteMail,
  onDeleteMessage,
  onOpenCreateView,
}) => {
  const [copiedAddr, setCopiedAddr] = React.useState(false);
  const [copiedOtp, setCopiedOtp] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [filterTab, setFilterTab] = React.useState<'all' | 'unread' | 'otp'>('all');
  const [viewMode, setViewMode] = React.useState<'html' | 'text'>('html');
  const [showQr, setShowQr] = React.useState(false);
  const [confirmDeleteMail, setConfirmDeleteMail] = React.useState(false);

  const handleCopyAddress = async () => {
    if (!mailbox?.address) return;
    await navigator.clipboard.writeText(mailbox.address);
    setCopiedAddr(true);
    setTimeout(() => setCopiedAddr(false), 1800);
  };

  const handleCopyOtp = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedOtp(code);
    setTimeout(() => setCopiedOtp(null), 1800);
  };

  const filteredMessages = React.useMemo(() => {
    return messages.filter((msg) => {
      if (filterTab === 'unread' && msg.seen) return false;
      if (filterTab === 'otp' && !msg.otpCode) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const hay = `${msg.from.name} ${msg.from.address} ${msg.subject} ${msg.intro}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [messages, filterTab, searchQuery]);

  const sanitizedHtmlDoc = React.useMemo(() => {
    if (!selectedMessage || !selectedMessage.html || selectedMessage.html.length === 0) {
      return null;
    }
    const rawHtml = selectedMessage.html.join('\n');
    const clean = DOMPurify.sanitize(rawHtml, {
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
    });
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body {
    margin: 0;
    padding: 16px;
    font-family: -apple-system, BlinkMacSystemFont, 'Noto Sans Bengali', sans-serif;
    font-weight: 700;
    background: #0F1118;
    color: #F8FAFC;
    line-height: 1.6;
    word-break: break-word;
  }
  a { color: #E5B869; }
  img { max-width: 100%; height: auto; border-radius: 6px; }
</style>
</head>
<body>${clean}</body>
</html>`;
  }, [selectedMessage]);

  const formatTime = (iso: string) => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        month: 'short',
        day: 'numeric',
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  if (!mailbox) {
    return (
      <section className="max-w-4xl mx-auto py-16 px-4 text-center space-y-6">
        <div className="bg-[#12141C] border border-[#232736] rounded-xl p-8 sm:p-12 space-y-5">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-b from-[#212638] to-[#151824] border border-[#303750] mx-auto flex items-center justify-center text-[#E5B869]">
            <Mail className="w-7 h-7" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#F8FAFC]">
            কোনো মেইল বর্তমানে চালু নেই
          </h2>
          <p className="text-sm sm:text-base font-bold text-[#94A3B8] max-w-lg mx-auto">
            নতুন রিয়েল টেম্প মেইল তৈরি করুন অথবা আগে তৈরি করা মেইলের নাম দিয়ে লগইন করুন।
          </p>
          {createError && (
            <div className="p-3.5 rounded-xl bg-[#231419] border border-[#4D222D] text-xs sm:text-sm font-bold text-[#FCA5A5] max-w-lg mx-auto">
              {createError}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={onChangeMail}
              disabled={creatingMail}
              className="btn-gold px-6 py-3 text-sm"
            >
              {creatingMail ? 'তৈরি হচ্ছে...' : 'তাৎক্ষণিক রিয়েল মেইল তৈরি'}
            </button>
            <button
              type="button"
              onClick={onOpenCreateView}
              className="btn-obsidian px-6 py-3 text-sm"
            >
              কাস্টম নাম দিয়ে তৈরি
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {createError && (
        <div className="p-3.5 rounded-xl bg-[#231419] border border-[#4D222D] text-xs sm:text-sm font-bold text-[#FCA5A5]">
          {createError}
        </div>
      )}
      {/* Active Mailbox Control Strip */}
      <div className="bg-[#12141C] border border-[#232736] rounded-xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-[#94A3B8]">
              <span>রিয়েল টেম্প মেইল</span>
              <span aria-hidden="true">·</span>
              <span className="text-[#10B981]">
                {mailbox.provider === 'mailtm' ? 'লাইভ Mail.tm সার্ভার' : 'লাইভ Guerrilla সার্ভার'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">অটো রিফ্রেশ {countdown}s</span>
            </div>
            <div className="flex items-center gap-3 min-w-0">
              <p className="text-lg sm:text-2xl font-mono-tabular text-[#F8FAFC] truncate select-all">
                {mailbox.address}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleCopyAddress}
              className="btn-gold px-5 py-2.5 text-xs sm:text-sm"
            >
              {copiedAddr ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedAddr ? 'কপি হয়েছে' : 'কপি করুন'}</span>
            </button>

            <button
              type="button"
              onClick={onRefresh}
              disabled={loadingList}
              className="btn-obsidian px-4 py-2.5 text-xs sm:text-sm"
            >
              <RefreshCw
                className={`w-4 h-4 text-[#E5B869] ${loadingList ? 'animate-spin' : ''}`}
              />
              <span>রিফ্রেশ</span>
            </button>

            <button
              type="button"
              onClick={onChangeMail}
              disabled={creatingMail}
              className="btn-obsidian px-4 py-2.5 text-xs sm:text-sm"
            >
              <Shuffle className="w-4 h-4 text-[#E5B869]" />
              <span>{creatingMail ? 'পরিবর্তন হচ্ছে...' : 'মেইল পরিবর্তন'}</span>
            </button>

            <button
              type="button"
              onClick={onOpenCreateView}
              className="btn-obsidian px-4 py-2.5 text-xs sm:text-sm"
            >
              <Plus className="w-4 h-4 text-[#E5B869]" />
              <span>কাস্টম তৈরি</span>
            </button>

            <button
              type="button"
              aria-label="Show QR Code"
              onClick={() => setShowQr(true)}
              className="btn-obsidian w-10 h-10 p-0 shrink-0"
            >
              <QrCode className="w-4 h-4 text-[#E5B869]" />
            </button>

            {!confirmDeleteMail ? (
              <button
                type="button"
                onClick={() => setConfirmDeleteMail(true)}
                className="btn-danger px-4 py-2.5 text-xs sm:text-sm"
              >
                <Trash2 className="w-4 h-4" />
                <span>ডিলিট</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmDeleteMail(false);
                    onDeleteMail();
                  }}
                  className="btn-danger px-3.5 py-2.5 text-xs"
                >
                  নিশ্চিত ডিলিট
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteMail(false)}
                  className="btn-obsidian px-3 py-2.5 text-xs"
                >
                  বাতিল
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Split-Pane Inbox & Reader */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Column: Inbox List */}
        <div className="lg:col-span-5 bg-[#12141C] border border-[#232736] rounded-xl flex flex-col overflow-hidden min-h-[520px]">
          <div className="p-4 border-b border-[#1E2230] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Inbox className="w-4 h-4 text-[#E5B869]" />
                <h2 className="text-base font-extrabold text-[#F8FAFC]">
                  লাইভ ইনবক্স ({messages.length})
                </h2>
              </div>
              <button
                type="button"
                onClick={onRefresh}
                disabled={loadingList}
                className="btn-obsidian px-3 py-1.5 text-xs"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 text-[#E5B869] ${loadingList ? 'animate-spin' : ''}`}
                />
                <span>চেক করুন</span>
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="মেইল বা প্রেরকের নাম খুঁজুন..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#0B0C12] border border-[#222636] text-sm font-bold text-[#F8FAFC] placeholder-[#64748B] focus:outline-none focus:border-[#E5B869]"
              />
            </div>

            <div className="flex items-center gap-1.5 p-1.5 bg-[#0A0B10] rounded-xl border border-[#222738]">
              {(['all', 'unread', 'otp'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setFilterTab(tab)}
                  className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-extrabold transition-all duration-150 cursor-pointer whitespace-nowrap ${
                    filterTab === tab
                      ? 'bg-gradient-to-b from-[#23283B] to-[#191D2B] text-[#FDE68A] shadow-[inset_0_1px_0_rgba(255,255,255,0.09)] border border-[#343C57]'
                      : 'text-[#94A3B8] hover:text-[#F8FAFC] border border-transparent'
                  }`}
                >
                  {tab === 'all' ? 'সব মেইল' : tab === 'unread' ? 'অপঠিত' : 'OTP কোড'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[#1C202E]">
            {filteredMessages.length === 0 ? (
              <div className="p-8 text-center space-y-3 my-auto">
                <Mail className="w-10 h-10 text-[#3B4259] mx-auto" />
                <p className="text-sm font-extrabold text-[#CBD5E1]">
                  {messages.length === 0
                    ? 'ইনবক্স খালি — নতুন মেইলের জন্য অপেক্ষা করা হচ্ছে'
                    : 'আপনার সার্চের সাথে কোনো মেইল মেলেনি'}
                </p>
                <p className="text-xs font-bold text-[#64748B]">
                  এই মেইলে যেকোনো জায়গা থেকে মেইল বা কোড পাঠালে সাথে সাথে এখানে চলে আসবে।
                </p>
              </div>
            ) : (
              filteredMessages.map((msg) => {
                const isSelected = selectedMessage?.id === msg.id;
                return (
                  <button
                    key={msg.id}
                    type="button"
                    onClick={() => onSelectMessage(msg.id)}
                    className={`w-full text-left p-4 transition-colors cursor-pointer ${
                      isSelected ? 'bg-[#1A1E2B]' : 'hover:bg-[#161924]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span
                        className={`text-sm font-extrabold truncate ${
                          msg.seen ? 'text-[#CBD5E1]' : 'text-[#F8FAFC]'
                        }`}
                      >
                        {msg.from.name || msg.from.address}
                      </span>
                      <span className="text-[11px] font-mono-tabular text-[#64748B] shrink-0">
                        {formatTime(msg.createdAt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={`text-xs font-bold truncate ${
                          msg.seen ? 'text-[#94A3B8]' : 'text-[#E5B869]'
                        }`}
                      >
                        {msg.subject}
                      </p>
                      {msg.otpCode && (
                        <span className="text-[11px] font-mono-tabular text-[#10B981] shrink-0">
                          OTP: {msg.otpCode}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-bold text-[#64748B] truncate mt-1">
                      {msg.intro || msg.from.address}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Email Viewer */}
        <div className="lg:col-span-7 bg-[#12141C] border border-[#232736] rounded-xl flex flex-col overflow-hidden min-h-[520px]">
          {loadingDetail ? (
            <div className="p-8 space-y-4">
              <div className="h-6 w-2/3 bg-[#1A1E2B] rounded animate-pulse" />
              <div className="h-4 w-1/3 bg-[#1A1E2B] rounded animate-pulse" />
              <div className="h-64 w-full bg-[#161924] rounded-lg animate-pulse mt-6" />
            </div>
          ) : !selectedMessage ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-b from-[#212638] to-[#151824] border border-[#303750] flex items-center justify-center text-[#E5B869]">
                <Mail className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-extrabold text-[#F8FAFC]">
                পড়ার জন্য একটি মেইল নির্বাচন করুন
              </h3>
              <p className="text-xs sm:text-sm font-bold text-[#94A3B8] max-w-md">
                বাম পাশের ইনবক্স থেকে যেকোনো মেসেজে ক্লিক করলে সম্পূর্ণ মেইল এবং অটো-ডিটেক্টেড OTP কোড এখানে দেখা যাবে।
              </p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col">
              {/* Message Header */}
              <div className="p-5 border-b border-[#1E2230] space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <h3 className="text-lg sm:text-xl font-extrabold text-[#F8FAFC] break-words">
                      {selectedMessage.subject}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-[#94A3B8]">
                      <span className="text-[#F8FAFC]">{selectedMessage.from.name}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-tabular">{selectedMessage.from.address}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-tabular">
                        {formatTime(selectedMessage.createdAt)}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteMessage(selectedMessage.id)}
                    className="btn-danger px-3.5 py-2 text-xs shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>ডিলিট</span>
                  </button>
                </div>

                {/* OTP Extraction Banner */}
                {selectedMessage.otpCode && (
                  <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-[#0D1E19] border border-[#1B4D3B]">
                    <div className="flex items-center gap-2.5">
                      <KeyRound className="w-4 h-4 text-[#10B981]" />
                      <span className="text-xs font-extrabold text-[#A7F3D0]">
                        শনাক্তকৃত ভেরিফিকেশন কোড:
                      </span>
                      <span className="text-base font-mono-tabular text-[#F8FAFC] tracking-widest">
                        {selectedMessage.otpCode}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyOtp(selectedMessage.otpCode!)}
                      className="btn-gold px-4 py-2 text-xs"
                    >
                      {copiedOtp === selectedMessage.otpCode ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {copiedOtp === selectedMessage.otpCode ? 'কপি হয়েছে' : 'কোড কপি'}
                      </span>
                    </button>
                  </div>
                )}

                {sanitizedHtmlDoc && (
                  <div className="flex items-center gap-1.5 p-1.5 bg-[#0A0B10] rounded-xl border border-[#222738] w-fit">
                    <button
                      type="button"
                      onClick={() => setViewMode('html')}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold cursor-pointer transition-all ${
                        viewMode === 'html'
                          ? 'bg-gradient-to-b from-[#23283B] to-[#191D2B] text-[#FDE68A] border border-[#343C57]'
                          : 'text-[#94A3B8] hover:text-[#F8FAFC] border border-transparent'
                      }`}
                    >
                      ফরম্যাটেড ভিউ
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('text')}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold cursor-pointer transition-all ${
                        viewMode === 'text'
                          ? 'bg-gradient-to-b from-[#23283B] to-[#191D2B] text-[#FDE68A] border border-[#343C57]'
                          : 'text-[#94A3B8] hover:text-[#F8FAFC] border border-transparent'
                      }`}
                    >
                      প্লেইন টেক্সট
                    </button>
                  </div>
                )}
              </div>

              {/* Message Body */}
              <div className="flex-1 p-5 overflow-y-auto">
                {viewMode === 'html' && sanitizedHtmlDoc ? (
                  <iframe
                    title="Email Content"
                    sandbox=""
                    srcDoc={sanitizedHtmlDoc}
                    className="w-full min-h-[340px] rounded-xl border border-[#1E2230] bg-[#0F1118]"
                  />
                ) : (
                  <pre className="whitespace-pre-wrap font-sans text-sm font-bold text-[#E2E8F0] leading-relaxed">
                    {selectedMessage.text || selectedMessage.intro || '(Empty message)'}
                  </pre>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* QR Code Modal */}
      {showQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="bg-[#12141C] border border-[#262B3D] rounded-xl p-6 max-w-xs w-full space-y-4 text-center">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-[#F8FAFC]">
                মেইল QR কোড
              </h3>
              <button
                type="button"
                onClick={() => setShowQr(false)}
                className="btn-obsidian w-9 h-9 p-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-white p-4 rounded-xl inline-block mx-auto">
              <QRCodeSVG value={mailbox.address} size={180} />
            </div>
            <p className="text-xs font-mono-tabular text-[#E5B869] break-all">
              {mailbox.address}
            </p>
          </div>
        </div>
      )}
    </section>
  );
};
