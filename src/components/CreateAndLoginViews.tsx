import React from 'react';
import {
  PlusCircle,
  Shuffle,
  LogIn,
  ArrowRight,
  Clock,
  CheckCircle2,
} from 'lucide-react';

interface CreateMailViewProps {
  domains: string[];
  creatingMail: boolean;
  error: string | null;
  onCreateMail: (username?: string, domain?: string) => Promise<void>;
}

export const CreateMailView: React.FC<CreateMailViewProps> = ({
  domains,
  creatingMail,
  error,
  onCreateMail,
}) => {
  const [customUsername, setCustomUsername] = React.useState('');
  const [selectedDomain, setSelectedDomain] = React.useState(domains[0] || '');

  React.useEffect(() => {
    if (domains.length > 0 && (!selectedDomain || !domains.includes(selectedDomain))) {
      setSelectedDomain(domains[0]);
    }
  }, [domains, selectedDomain]);

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onCreateMail(customUsername.trim() || undefined, selectedDomain || undefined);
  };

  return (
    <section className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
      <div className="bg-[#12141C] border border-[#232736] rounded-xl p-6 sm:p-8 space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#F8FAFC]">
            নতুন রিয়েল মেইল তৈরি করুন
          </h2>
          <p className="text-sm font-bold text-[#94A3B8]">
            এক ক্লিকে র‍্যান্ডম মেইল নিন অথবা আপনার পছন্দের ইউজারনেম ও লাইভ ডোমেইন দিয়ে রিয়েল প্রিমিয়াম মেইল তৈরি করুন।
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-[#231419] border border-[#4D222D] text-xs sm:text-sm font-bold text-[#FCA5A5]">
            {error}
          </div>
        )}

        <form onSubmit={handleCustomSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold text-[#CBD5E1]">
                পছন্দের নাম (ঐচ্ছিক)
              </label>
              <input
                type="text"
                value={customUsername}
                onChange={(e) => setCustomUsername(e.target.value)}
                placeholder="যেমন: teamfx.vip"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0C12] border border-[#222636] text-sm font-mono-tabular text-[#F8FAFC] placeholder-[#64748B] focus:outline-none focus:border-[#E5B869]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold text-[#CBD5E1]">
                লাইভ ডোমেইন নির্বাচন করুন
              </label>
              <select
                value={selectedDomain}
                onChange={(e) => setSelectedDomain(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0C12] border border-[#222636] text-sm font-mono-tabular text-[#F8FAFC] focus:outline-none focus:border-[#E5B869]"
              >
                {domains.map((d) => (
                  <option key={d} value={d}>
                    @{d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={creatingMail}
              className="btn-gold px-6 py-3 text-sm"
            >
              <PlusCircle className="w-4 h-4" />
              <span>
                {creatingMail
                  ? 'তৈরি হচ্ছে...'
                  : customUsername.trim()
                  ? 'কাস্টম মেইল তৈরি করুন'
                  : 'অটো মেইল তৈরি করুন'}
              </span>
            </button>

            <button
              type="button"
              disabled={creatingMail}
              onClick={() => onCreateMail(undefined, selectedDomain || undefined)}
              className="btn-obsidian px-6 py-3 text-sm"
            >
              <Shuffle className="w-4 h-4 text-[#E5B869]" />
              <span>দ্রুত র‍্যান্ডম মেইল</span>
            </button>
          </div>
        </form>
      </div>
    </section>
  );
};

interface MailLoginViewProps {
  recentAddresses: string[];
  activeAddress: string | null;
  loggingIn: boolean;
  error: string | null;
  onLoginMail: (mailName: string) => Promise<void>;
}

export const MailLoginView: React.FC<MailLoginViewProps> = ({
  recentAddresses,
  activeAddress,
  loggingIn,
  error,
  onLoginMail,
}) => {
  const [mailInput, setMailInput] = React.useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mailInput.trim()) return;
    await onLoginMail(mailInput.trim());
  };

  return (
    <section className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
      <div className="bg-[#12141C] border border-[#232736] rounded-xl p-6 sm:p-8 space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#F8FAFC]">
            মেইলের নাম দিয়ে লগইন করুন
          </h2>
          <p className="text-sm font-bold text-[#94A3B8]">
            আপনার পূর্বে তৈরি করা টেম্প মেইলের সম্পূর্ণ ঠিকানা অথবা শুধু নামটি লিখলে সাথে সাথে সেই মেইলের লাইভ ইনবক্স ওপেন হবে।
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-[#231419] border border-[#4D222D] text-xs sm:text-sm font-bold text-[#FCA5A5]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={mailInput}
            onChange={(e) => setMailInput(e.target.value)}
            placeholder="মেইলের নাম বা ইমেইল লিখুন (যেমন: fx.nova4821)"
            className="flex-1 px-4 py-3 rounded-xl bg-[#0B0C12] border border-[#222636] text-sm font-mono-tabular text-[#F8FAFC] placeholder-[#64748B] focus:outline-none focus:border-[#E5B869]"
          />
          <button
            type="submit"
            disabled={loggingIn || !mailInput.trim()}
            className="btn-gold px-6 py-3 text-sm"
          >
            <LogIn className="w-4 h-4" />
            <span>{loggingIn ? 'খুঁজছে...' : 'ইনবক্সে লগইন'}</span>
          </button>
        </form>

        {recentAddresses.length > 0 && (
          <div className="pt-4 border-t border-[#1E2230] space-y-3">
            <div className="flex items-center gap-2 text-xs font-extrabold text-[#94A3B8]">
              <Clock className="w-4 h-4 text-[#E5B869]" />
              <span>সাম্প্রতিক ব্যবহৃত মেইলসমূহ</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {recentAddresses.map((addr) => {
                const isCurrent = addr === activeAddress;
                return (
                  <button
                    key={addr}
                    type="button"
                    onClick={() => onLoginMail(addr)}
                    className={`flex items-center justify-between gap-2 p-3.5 rounded-xl border text-left transition-all duration-150 cursor-pointer active:scale-[0.98] ${
                      isCurrent
                        ? 'bg-gradient-to-b from-[#23283B] to-[#171B28] border-[#E5B869] text-[#F8FAFC]'
                        : 'bg-gradient-to-b from-[#171B27] to-[#11141D] border-[#24293B] text-[#CBD5E1] hover:border-[#E5B869]/60'
                    }`}
                  >
                    <span className="text-xs font-mono-tabular truncate">{addr}</span>
                    {isCurrent ? (
                      <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
                    ) : (
                      <ArrowRight className="w-4 h-4 text-[#E5B869] shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
