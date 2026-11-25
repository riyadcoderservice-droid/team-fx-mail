import React from 'react';
import type { User } from 'firebase/auth';
import {
  UserCheck,
  LogOut,
  BookmarkPlus,
  Trash2,
  ArrowRight,
  Mail,
} from 'lucide-react';
import type { SavedMailboxRecord } from '../firebase';

interface GmailAccountViewProps {
  user: User | null;
  authLoading: boolean;
  savedMailboxes: SavedMailboxRecord[];
  activeAddress: string | null;
  onSignInGmail: () => Promise<void>;
  onSignOutGmail: () => Promise<void>;
  onSaveCurrentMailbox: () => Promise<void>;
  onOpenSavedMailbox: (address: string) => Promise<void>;
  onRemoveSavedMailbox: (address: string) => Promise<void>;
}

export const GmailAccountView: React.FC<GmailAccountViewProps> = ({
  user,
  authLoading,
  savedMailboxes,
  activeAddress,
  onSignInGmail,
  onSignOutGmail,
  onSaveCurrentMailbox,
  onOpenSavedMailbox,
  onRemoveSavedMailbox,
}) => {
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const handleSignIn = async () => {
    setError(null);
    setBusy(true);
    try {
      await onSignInGmail();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'জিমেইল দিয়ে লগইন করা যায়নি।'
      );
    } finally {
      setBusy(false);
    }
  };

  const alreadySaved = Boolean(
    activeAddress && savedMailboxes.some((m) => m.address === activeAddress)
  );

  return (
    <section className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
      <div className="bg-[#12141C] border border-[#232736] rounded-xl p-6 sm:p-8 space-y-6">
        {!user ? (
          <div className="text-center space-y-5 py-6">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-b from-[#212638] to-[#151824] border border-[#303750] mx-auto flex items-center justify-center text-[#E5B869]">
              <UserCheck className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#F8FAFC]">
                জিমেইল দিয়ে লগইন করুন
              </h2>
              <p className="text-sm font-bold text-[#94A3B8] max-w-md mx-auto">
                আপনার Google / Gmail একাউন্ট দিয়ে লগইন করলে আপনার তৈরি করা সব টেম্প মেইল নিরাপদভাবে সেভ থাকবে এবং যেকোনো সময় ওপেন করতে পারবেন।
              </p>
            </div>
            {error && (
              <div className="p-3 rounded-xl bg-[#231419] border border-[#4D222D] text-xs font-bold text-[#FCA5A5] max-w-md mx-auto">
                {error}
              </div>
            )}
            <button
              type="button"
              onClick={handleSignIn}
              disabled={busy || authLoading}
              className="btn-gold px-7 py-3 text-sm"
            >
              <UserCheck className="w-4 h-4" />
              <span>{busy ? 'লগইন হচ্ছে...' : 'Google / Gmail দিয়ে সাইন-ইন'}</span>
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#1E2230]">
              <div className="flex items-center gap-4 min-w-0">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Gmail User'}
                    referrerPolicy="no-referrer"
                    className="w-14 h-14 rounded-xl object-cover border border-[#2A3045] shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-[#191C28] border border-[#2A3045] flex items-center justify-center text-[#E5B869] font-extrabold text-lg shrink-0">
                    {(user.displayName || user.email || 'U').slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <h2 className="text-xl font-extrabold text-[#F8FAFC] truncate">
                    {user.displayName || 'TEAM FX User'}
                  </h2>
                  <p className="text-xs sm:text-sm font-mono-tabular text-[#E5B869] truncate">
                    {user.email}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                {activeAddress && !alreadySaved && (
                  <button
                    type="button"
                    onClick={onSaveCurrentMailbox}
                    className="btn-gold px-4 py-2.5 text-xs sm:text-sm"
                  >
                    <BookmarkPlus className="w-4 h-4" />
                    <span>বর্তমান মেইল সেভ করুন</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onSignOutGmail}
                  className="btn-danger px-4 py-2.5 text-xs sm:text-sm"
                >
                  <LogOut className="w-4 h-4" />
                  <span>লগআউট</span>
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-base font-extrabold text-[#F8FAFC]">
                আপনার সেভ করা মেইলসমূহ ({savedMailboxes.length})
              </h3>
              {savedMailboxes.length === 0 ? (
                <div className="p-6 rounded-xl bg-[#0B0C12] border border-[#1E2230] text-center space-y-2">
                  <Mail className="w-8 h-8 text-[#3B4259] mx-auto" />
                  <p className="text-sm font-bold text-[#94A3B8]">
                    এখনো কোনো টেম্প মেইল সেভ করা হয়নি।
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[#1E2230] border border-[#1E2230] rounded-xl bg-[#0B0C12] overflow-hidden">
                  {savedMailboxes.map((item) => (
                    <div
                      key={item.mailboxId}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-mono-tabular text-[#F8FAFC] truncate">
                          {item.address}
                        </p>
                        <p className="text-xs font-bold text-[#64748B]">
                          {item.label || 'TEAM FX Temp Mail'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => onOpenSavedMailbox(item.address)}
                          className="btn-obsidian px-4 py-2 text-xs"
                        >
                          <span>ইনবক্স খুলুন</span>
                          <ArrowRight className="w-3.5 h-3.5 text-[#E5B869]" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemoveSavedMailbox(item.address)}
                          aria-label="Remove saved mailbox"
                          className="btn-danger w-9 h-9 p-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
