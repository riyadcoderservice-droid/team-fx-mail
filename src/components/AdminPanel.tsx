import React from 'react';
import {
  ShieldCheck,
  Upload,
  RotateCcw,
  Trash2,
  LogOut,
  Save,
  KeyRound,
  Image as ImageIcon,
} from 'lucide-react';
import type { SiteConfig } from '../types';

interface AdminStatus {
  envConfigured: boolean;
  hasClaimedPasscode: boolean;
}

interface AdminOverview {
  totalMailboxes: number;
  siteConfig: SiteConfig;
  mailboxes: {
    address: string;
    provider: 'mailtm' | 'guerrilla';
    createdAt: string;
  }[];
}

interface AdminPanelProps {
  siteConfig: SiteConfig;
  onSiteConfigUpdated: (config: SiteConfig) => void;
  onOpenMailbox: (address: string) => Promise<void>;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  siteConfig,
  onSiteConfigUpdated,
  onOpenMailbox,
}) => {
  const [adminToken, setAdminToken] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<AdminStatus | null>(null);
  const [passcode, setPasscode] = React.useState('');
  const [authError, setAuthError] = React.useState<string | null>(null);
  const [authBusy, setAuthBusy] = React.useState(false);

  const [overview, setOverview] = React.useState<AdminOverview | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = React.useState<string | null>(null);
  const [subtitleInput, setSubtitleInput] = React.useState(siteConfig.subtitle);
  const [noticeInput, setNoticeInput] = React.useState(siteConfig.noticeBanner);
  const [actionMsg, setActionMsg] = React.useState<string | null>(null);
  const [actionErr, setActionErr] = React.useState<string | null>(null);
  const [savingLogo, setSavingLogo] = React.useState(false);
  const [savingConfig, setSavingConfig] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const fetchStatus = React.useCallback(async () => {
    try {
      const resp = await fetch('/api/admin/status');
      if (resp.ok) {
        const data = (await resp.json()) as AdminStatus;
        setStatus(data);
      }
    } catch {
      // Ignore network hiccup
    }
  }, []);

  const fetchOverview = React.useCallback(async (token: string) => {
    try {
      const resp = await fetch('/api/admin/overview', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.status === 401) {
        setAdminToken(null);
        return;
      }
      if (resp.ok) {
        const data = (await resp.json()) as AdminOverview;
        setOverview(data);
        setSubtitleInput(data.siteConfig.subtitle);
        setNoticeInput(data.siteConfig.noticeBanner);
      }
    } catch {
      // Ignore
    }
  }, []);

  React.useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  React.useEffect(() => {
    if (adminToken) {
      void fetchOverview(adminToken);
    }
  }, [adminToken, fetchOverview]);

  const needsFirstRunClaim =
    status !== null && !status.envConfigured && !status.hasClaimedPasscode;

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthBusy(true);
    try {
      const endpoint = needsFirstRunClaim ? '/api/admin/claim' : '/api/admin/login';
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      });
      const data = (await resp.json()) as { token?: string; error?: string };
      if (!resp.ok || !data.token) {
        setAuthError(data.error || 'অ্যাডমিন লগইন ব্যর্থ হয়েছে।');
        return;
      }
      setAdminToken(data.token);
      setPasscode('');
      await fetchStatus();
    } catch {
      setAuthError('সার্ভারের সাথে সংযোগ করা যায়নি।');
    } finally {
      setAuthBusy(false);
    }
  };

  const compressImageToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          const maxDim = 512;
          let width = img.naturalWidth || 512;
          let height = img.naturalHeight || 512;
          if (width > maxDim || height > maxDim) {
            if (width >= height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Canvas unavailable'));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          let out = canvas.toDataURL('image/png');
          if (out.length > 1_200_000) {
            out = canvas.toDataURL('image/jpeg', 0.9);
          }
          URL.revokeObjectURL(objectUrl);
          resolve(out);
        } catch (err) {
          URL.revokeObjectURL(objectUrl);
          reject(err);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('এই ছবির ফরম্যাট ব্রাউজারে পড়া যায়নি।'));
      };
      img.src = objectUrl;
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setActionErr(null);
    setActionMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      setActionErr('ছবির সাইজ ১৫ মেগাবাইটের কম হতে হবে।');
      return;
    }
    try {
      const compressed = await compressImageToDataUrl(file);
      setPreviewDataUrl(compressed);
    } catch (err) {
      setActionErr(
        err instanceof Error ? err.message : 'ছবি প্রসেস করা যায়নি। PNG বা JPG চেষ্টা করুন।'
      );
    }
  };

  const handleUploadLogo = async () => {
    if (!adminToken || !previewDataUrl) return;
    setSavingLogo(true);
    setActionErr(null);
    setActionMsg(null);
    try {
      const resp = await fetch('/api/admin/logo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ imageDataUrl: previewDataUrl }),
      });
      const data = (await resp.json()) as { siteConfig?: SiteConfig; error?: string };
      if (!resp.ok || !data.siteConfig) {
        setActionErr(data.error || 'লোগো আপলোড ব্যর্থ হয়েছে।');
        return;
      }
      onSiteConfigUpdated(data.siteConfig);
      setPreviewDataUrl(null);
      setActionMsg('নতুন লোগো সফলভাবে সেট করা হয়েছে!');
      await fetchOverview(adminToken);
    } catch {
      setActionErr('লোগো আপলোড করা যায়নি।');
    } finally {
      setSavingLogo(false);
    }
  };

  const handleResetLogo = async () => {
    if (!adminToken) return;
    setSavingLogo(true);
    setActionErr(null);
    setActionMsg(null);
    try {
      const resp = await fetch('/api/admin/logo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ imageDataUrl: null }),
      });
      const data = (await resp.json()) as { siteConfig?: SiteConfig; error?: string };
      if (resp.ok && data.siteConfig) {
        onSiteConfigUpdated(data.siteConfig);
        setPreviewDataUrl(null);
        setActionMsg('ডিফল্ট TEAM FX লোগো ফিরিয়ে আনা হয়েছে।');
        await fetchOverview(adminToken);
      }
    } finally {
      setSavingLogo(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;
    setSavingConfig(true);
    setActionErr(null);
    setActionMsg(null);
    try {
      const resp = await fetch('/api/admin/config', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          subtitle: subtitleInput,
          noticeBanner: noticeInput,
        }),
      });
      const data = (await resp.json()) as { siteConfig?: SiteConfig; error?: string };
      if (!resp.ok || !data.siteConfig) {
        setActionErr(data.error || 'সেটিংস সেভ করা যায়নি।');
        return;
      }
      onSiteConfigUpdated(data.siteConfig);
      setActionMsg('ব্র্যান্ড সেটিংস আপডেট হয়েছে।');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleAdminDeleteMailbox = async (address: string) => {
    if (!adminToken) return;
    const resp = await fetch(`/api/admin/mailboxes/${encodeURIComponent(address)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (resp.ok) {
      await fetchOverview(adminToken);
    }
  };

  if (!adminToken) {
    return (
      <section className="max-w-lg mx-auto px-4 sm:px-6 py-12">
        <div className="bg-[#12141C] border border-[#232736] rounded-xl p-6 sm:p-8 space-y-6">
          <div className="space-y-2 text-center">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-b from-[#212638] to-[#151824] border border-[#303750] mx-auto flex items-center justify-center text-[#E5B869]">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-extrabold text-[#F8FAFC]">
              {needsFirstRunClaim
                ? 'অ্যাডমিন পাসকোড সেটআপ'
                : 'অ্যাডমিন প্যানেল লগইন'}
            </h2>
            <p className="text-xs sm:text-sm font-bold text-[#94A3B8]">
              {needsFirstRunClaim
                ? 'প্রথমবার ব্যবহারের জন্য আপনার অ্যাডমিন পাসকোড সেট করুন। একবার সেট করলে তা নিরাপদভাবে লক হয়ে যাবে।'
                : 'লোগো আপলোড এবং মেইল নিয়ন্ত্রণ করতে অ্যাডমিন পাসওয়ার্ড দিন।'}
            </p>
          </div>

          {authError && (
            <div className="p-3 rounded-xl bg-[#231419] border border-[#4D222D] text-xs font-bold text-[#FCA5A5]">
              {authError}
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold text-[#CBD5E1]">
                অ্যাডমিন পাসওয়ার্ড
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="পাসকোড লিখুন..."
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0B0C12] border border-[#222636] text-sm font-mono-tabular text-[#F8FAFC] placeholder-[#64748B] focus:outline-none focus:border-[#E5B869]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={authBusy || status === null}
              className="btn-gold w-full py-3 px-4 text-sm"
            >
              {authBusy
                ? 'যাচাই হচ্ছে...'
                : needsFirstRunClaim
                ? 'পাসকোড সেট ও প্রবেশ করুন'
                : 'অ্যাডমিন প্যানেলে প্রবেশ'}
            </button>
          </form>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#12141C] border border-[#232736] rounded-xl p-5 sm:p-6">
        <div>
          <h2 className="text-2xl font-extrabold text-[#F8FAFC]">
            TEAM FX অ্যাডমিন কন্ট্রোল
          </h2>
          <p className="text-xs sm:text-sm font-bold text-[#94A3B8]">
            সরাসরি ছবি আপলোড করে ওয়েবের লোগো ও সাবটাইটেল পরিবর্তন করুন।
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAdminToken(null)}
          className="btn-danger px-4 py-2.5 text-xs w-fit"
        >
          <LogOut className="w-4 h-4" />
          <span>অ্যাডমিন লগআউট</span>
        </button>
      </div>

      {actionMsg && (
        <div className="p-3.5 rounded-xl bg-[#0D1E19] border border-[#1B4D3B] text-xs sm:text-sm font-bold text-[#A7F3D0]">
          {actionMsg}
        </div>
      )}
      {actionErr && (
        <div className="p-3.5 rounded-xl bg-[#231419] border border-[#4D222D] text-xs sm:text-sm font-bold text-[#FCA5A5]">
          {actionErr}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Direct Picture Logo Uploader */}
        <div className="bg-[#12141C] border border-[#232736] rounded-xl p-6 space-y-5">
          <div className="space-y-1">
            <h3 className="text-lg font-extrabold text-[#F8FAFC]">
              লোগো ছবি আপলোড করুন
            </h3>
            <p className="text-xs font-bold text-[#94A3B8]">
              এখান থেকে সরাসরি আপনার গ্যালারির যেকোনো ছবি (PNG, JPG, WEBP) আপলোড করলে সেটিই ওয়েবের প্রধান লোগো হয়ে যাবে।
            </p>
          </div>

          <div className="flex items-center gap-4 p-4 rounded-xl bg-[#0B0C12] border border-[#1E2230]">
            <div className="w-16 h-16 rounded-xl overflow-hidden border border-[#2A3045] bg-[#141722] flex items-center justify-center shrink-0">
              {previewDataUrl || siteConfig.logoUrl ? (
                <img
                  src={previewDataUrl || siteConfig.logoUrl || ''}
                  alt="Logo Preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <ImageIcon className="w-6 h-6 text-[#64748B]" />
              )}
            </div>
            <div className="space-y-1 min-w-0">
              <p className="text-sm font-extrabold text-[#F8FAFC]">
                {previewDataUrl ? 'নতুন ছবির প্রিভিউ — সেভ বাটনে চাপ দিন' : 'বর্তমান লোগো'}
              </p>
              <p className="text-xs font-bold text-[#64748B]">
                যেকোনো সাইজের ছবি (১৫ MB পর্যন্ত) অটো রিসাইজ হয়ে সেভ হবে
              </p>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => {
              void handleFileChange(e);
              e.target.value = '';
            }}
            className="hidden"
          />

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn-obsidian px-4 py-2.5 text-xs sm:text-sm"
            >
              <Upload className="w-4 h-4 text-[#E5B869]" />
              <span>ছবি নির্বাচন করুন</span>
            </button>

            {previewDataUrl && (
              <button
                type="button"
                onClick={handleUploadLogo}
                disabled={savingLogo}
                className="btn-gold px-4 py-2.5 text-xs sm:text-sm"
              >
                <Save className="w-4 h-4" />
                <span>{savingLogo ? 'সেভ হচ্ছে...' : 'লোগো সেভ করুন'}</span>
              </button>
            )}

            {siteConfig.logoUrl && (
              <button
                type="button"
                onClick={handleResetLogo}
                disabled={savingLogo}
                className="btn-danger px-4 py-2.5 text-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>ডিফল্ট লোগো</span>
              </button>
            )}
          </div>
        </div>

        {/* Subtitle & Notice Config */}
        <form
          onSubmit={handleSaveConfig}
          className="bg-[#12141C] border border-[#232736] rounded-xl p-6 space-y-5"
        >
          <div className="space-y-1">
            <h3 className="text-lg font-extrabold text-[#F8FAFC]">
              ব্র্যান্ড ও নোটিশ সেটিংস
            </h3>
            <p className="text-xs font-bold text-[#94A3B8]">
              TEAM FX এর নিচের ছোট সাবটাইটেল এবং ওয়েব নোটিশ আপডেট করুন।
            </p>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold text-[#CBD5E1]">
                সাবটাইটেল টেক্সট (ডিফল্ট: premium mail)
              </label>
              <input
                type="text"
                value={subtitleInput}
                onChange={(e) => setSubtitleInput(e.target.value)}
                maxLength={60}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0C12] border border-[#222636] text-sm font-bold text-[#F8FAFC] focus:outline-none focus:border-[#E5B869]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold text-[#CBD5E1]">
                টপ নোটিশ ব্যানার (ঐচ্ছিক)
              </label>
              <input
                type="text"
                value={noticeInput}
                onChange={(e) => setNoticeInput(e.target.value)}
                placeholder="যেমন: নতুন প্রিমিয়াম ডোমেইন যুক্ত হয়েছে!"
                maxLength={200}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0C12] border border-[#222636] text-sm font-bold text-[#F8FAFC] placeholder-[#64748B] focus:outline-none focus:border-[#E5B869]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={savingConfig}
            className="btn-gold px-5 py-2.5 text-sm"
          >
            <Save className="w-4 h-4" />
            <span>{savingConfig ? 'সেভ হচ্ছে...' : 'সেটিংস সেভ করুন'}</span>
          </button>
        </form>
      </div>

      {/* Active Mailboxes Overview Table */}
      <div className="bg-[#12141C] border border-[#232736] rounded-xl overflow-hidden">
        <div className="p-5 border-b border-[#1E2230] flex items-center justify-between">
          <h3 className="text-base font-extrabold text-[#F8FAFC]">
            সক্রিয় রিয়েল মেইলবক্স তালিকা ({overview?.totalMailboxes ?? 0})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#1E2230] text-xs font-extrabold text-[#94A3B8] bg-[#0B0C12]">
                <th className="py-3 px-4">মেইল ঠিকানা</th>
                <th className="py-3 px-4">প্রোভাইডার</th>
                <th className="py-3 px-4 text-right">তৈরির সময়</th>
                <th className="py-3 px-4 text-right">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2230] text-sm font-bold">
              {!overview || overview.mailboxes.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-[#64748B]">
                    কোনো মেইলবক্স এখনো তৈরি হয়নি।
                  </td>
                </tr>
              ) : (
                overview.mailboxes.map((mb) => (
                  <tr key={mb.address} className="hover:bg-[#161924]">
                    <td className="py-3 px-4 font-mono-tabular text-[#F8FAFC]">
                      {mb.address}
                    </td>
                    <td className="py-3 px-4 text-xs text-[#E5B869]">
                      {mb.provider === 'mailtm' ? 'Mail.tm Live' : 'Guerrilla Live'}
                    </td>
                    <td className="py-3 px-4 text-xs font-mono-tabular text-[#94A3B8] text-right">
                      {new Date(mb.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenMailbox(mb.address)}
                          className="btn-obsidian px-3.5 py-1.5 text-xs"
                        >
                          ওপেন
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAdminDeleteMailbox(mb.address)}
                          className="btn-danger w-8 h-8 p-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
