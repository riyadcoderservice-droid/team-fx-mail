import express from 'express';
import type { Request, Response, NextFunction, Express } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const MAILTM_BASE = 'https://api.mail.tm';
const GUERRILLA_BASE = 'https://api.guerrillamail.com/ajax.php';
const UPSTREAM_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'Mozilla/5.0 (compatible; TeamFXMail/1.0)',
};
const GUERRILLA_DOMAINS = [
  'guerrillamailblock.com',
  'sharklasers.com',
  'grr.la',
  'guerrillamail.com',
];

function resolveWritableDataDir(): string {
  if (process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.resolve('/tmp', 'teamfx-data');
  }
  const localDir = path.resolve(process.cwd(), 'data');
  try {
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    fs.accessSync(localDir, fs.constants.W_OK);
    return localDir;
  } catch {
    return path.resolve('/tmp', 'teamfx-data');
  }
}

const DATA_DIR = resolveWritableDataDir();
const STORE_PATH = path.resolve(DATA_DIR, 'store.json');

function resolveSessionSecret(): string {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim().length > 0) {
    return process.env.SESSION_SECRET.trim();
  }
  const secretPath = path.resolve(DATA_DIR, '.session_secret');
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(secretPath)) {
      const saved = fs.readFileSync(secretPath, 'utf8').trim();
      if (saved.length >= 32) {
        return saved;
      }
    }
    const generated = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(secretPath, generated, { encoding: 'utf8', mode: 0o600 });
    return generated;
  } catch {
    return crypto.randomBytes(32).toString('hex');
  }
}

const SESSION_SECRET = resolveSessionSecret();

export interface StoredMailbox {
  address: string;
  localPart: string;
  domain: string;
  provider: 'mailtm' | 'guerrilla';
  mailTmId?: string;
  mailTmPassword?: string;
  mailTmToken?: string;
  guerrillaSid?: string;
  createdAt: string;
}

interface SiteConfig {
  brandName: string;
  subtitle: string;
  logoPath: string | null;
  logoDataUrl: string | null;
  noticeBanner: string;
}

interface AppStore {
  adminPasswordHash: string | null;
  siteConfig: SiteConfig;
  mailboxes: Record<string, StoredMailbox>;
}

const DEFAULT_STORE: AppStore = {
  adminPasswordHash: null,
  siteConfig: {
    brandName: 'TEAM FX',
    subtitle: 'premium mail',
    logoPath: null,
    logoDataUrl: null,
    noticeBanner: '',
  },
  mailboxes: {},
};

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadStore(): AppStore {
  try {
    ensureDataDir();
    if (!fs.existsSync(STORE_PATH)) {
      fs.writeFileSync(STORE_PATH, JSON.stringify(DEFAULT_STORE, null, 2), 'utf8');
      return structuredClone(DEFAULT_STORE);
    }
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<AppStore>;
    const cleanMailboxes: Record<string, StoredMailbox> = {};
    for (const [k, v] of Object.entries(parsed.mailboxes || {})) {
      if (v && (v.provider === 'mailtm' || v.provider === 'guerrilla')) {
        cleanMailboxes[k] = v;
      }
    }
    return {
      adminPasswordHash: parsed.adminPasswordHash ?? null,
      siteConfig: {
        brandName: parsed.siteConfig?.brandName || 'TEAM FX',
        subtitle: parsed.siteConfig?.subtitle || 'premium mail',
        logoPath: parsed.siteConfig?.logoPath ?? null,
        logoDataUrl: parsed.siteConfig?.logoDataUrl ?? null,
        noticeBanner: parsed.siteConfig?.noticeBanner || '',
      },
      mailboxes: cleanMailboxes,
    };
  } catch {
    return structuredClone(DEFAULT_STORE);
  }
}

function saveStore(store: AppStore): void {
  try {
    ensureDataDir();
    const tmpPath = path.resolve(DATA_DIR, `store.${process.pid}.tmp`);
    if (!tmpPath.startsWith(DATA_DIR + path.sep)) {
      return;
    }
    fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2), 'utf8');
    fs.renameSync(tmpPath, STORE_PATH);
  } catch {
    // Keep in-memory store working even if disk write fails
  }
}

const appStore: AppStore = loadStore();

function hashPasscode(passcode: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(passcode, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyScryptPasscode(passcode: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, hashHex] = parts;
  if (!salt || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(passcode, salt, 64);
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}

function constantTimeEquals(a: string, b: string): boolean {
  const digestA = crypto.createHash('sha256').update(a, 'utf8').digest();
  const digestB = crypto.createHash('sha256').update(b, 'utf8').digest();
  return crypto.timingSafeEqual(digestA, digestB);
}

function createAdminToken(): string {
  const exp = Date.now() + 12 * 60 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ role: 'admin', exp })).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyAdminToken(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  if (!payload || !sig) return false;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('base64url');
  const a = Buffer.from(sig, 'utf8');
  const b = Buffer.from(expectedSig, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      role?: string;
      exp?: number;
    };
    return decoded.role === 'admin' && typeof decoded.exp === 'number' && decoded.exp > Date.now();
  } catch {
    return false;
  }
}

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Admin authorization required' });
    return;
  }
  const token = header.slice('Bearer '.length).trim();
  if (!verifyAdminToken(token)) {
    res.status(401).json({ error: 'Invalid or expired admin session' });
    return;
  }
  next();
}

// Signed/encrypted stateless mailbox token so serverless Lambdas work across cold starts
const MAILBOX_CIPHER_KEY = crypto
  .createHash('sha256')
  .update(`mailbox:${SESSION_SECRET}`)
  .digest();

function encodeMailboxToken(mailbox: StoredMailbox): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', MAILBOX_CIPHER_KEY, iv);
  const json = JSON.stringify(mailbox);
  const encrypted = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

function decodeMailboxToken(token: string | undefined): StoredMailbox | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const iv = Buffer.from(parts[0], 'base64url');
    const tag = Buffer.from(parts[1], 'base64url');
    const encrypted = Buffer.from(parts[2], 'base64url');
    const decipher = crypto.createDecipheriv('aes-256-gcm', MAILBOX_CIPHER_KEY, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    const parsed = JSON.parse(decrypted) as StoredMailbox;
    if (parsed && parsed.address && (parsed.provider === 'mailtm' || parsed.provider === 'guerrilla')) {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

function resolveMailboxFromRequest(req: Request, address: string): StoredMailbox | null {
  const normalized = address.trim().toLowerCase();
  if (appStore.mailboxes[normalized]) {
    return appStore.mailboxes[normalized];
  }
  const headerToken = req.headers['x-mailbox-token'];
  const tokenStr = Array.isArray(headerToken) ? headerToken[0] : headerToken;
  const decoded = decodeMailboxToken(tokenStr);
  if (decoded && decoded.address.toLowerCase() === normalized) {
    appStore.mailboxes[normalized] = decoded;
    return decoded;
  }
  return null;
}

let cachedMailTmDomains: { domains: string[]; fetchedAt: number } = {
  domains: [],
  fetchedAt: 0,
};

async function fetchMailTmDomains(): Promise<string[]> {
  if (
    cachedMailTmDomains.domains.length > 0 &&
    Date.now() - cachedMailTmDomains.fetchedAt < 5 * 60 * 1000
  ) {
    return cachedMailTmDomains.domains;
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 7000);
      const resp = await fetch(`${MAILTM_BASE}/domains?page=1`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timer);
      if (resp.ok) {
        const raw = (await resp.json()) as
          | Array<{ domain: string; isActive: boolean }>
          | { 'hydra:member'?: Array<{ domain: string; isActive: boolean }> };
        const list = Array.isArray(raw) ? raw : raw['hydra:member'] || [];
        const active = list
          .filter((d) => d.isActive && typeof d.domain === 'string')
          .map((d) => d.domain);
        if (active.length > 0) {
          cachedMailTmDomains = { domains: active, fetchedAt: Date.now() };
          return active;
        }
      }
    } catch {
      // Retry once cleanly
    }
  }
  return [];
}

async function getAllLiveDomains(): Promise<{ mailTmDomains: string[]; allDomains: string[] }> {
  const mailTmDomains = await fetchMailTmDomains();
  const seen = new Set<string>();
  const allDomains: string[] = [];
  for (const d of [...mailTmDomains, ...GUERRILLA_DOMAINS]) {
    if (!seen.has(d)) {
      seen.add(d);
      allDomains.push(d);
    }
  }
  return { mailTmDomains, allDomains };
}

async function getOrRefreshMailTmToken(mailbox: StoredMailbox): Promise<string | null> {
  if (mailbox.provider !== 'mailtm' || !mailbox.mailTmPassword) return null;
  if (mailbox.mailTmToken) return mailbox.mailTmToken;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    const resp = await fetch(`${MAILTM_BASE}/token`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        address: mailbox.address,
        password: mailbox.mailTmPassword,
      }),
    });
    clearTimeout(timer);
    if (!resp.ok) return null;
    const data = (await resp.json()) as { token?: string };
    if (data.token) {
      mailbox.mailTmToken = data.token;
      saveStore(appStore);
      return data.token;
    }
  } catch {
    return null;
  }
  return null;
}

async function createGuerrillaMailbox(
  localPart: string,
  preferredDomain?: string
): Promise<StoredMailbox | null> {
  try {
    const initResp = await fetch(`${GUERRILLA_BASE}?f=get_email_address&lang=en`, {
      signal: AbortSignal.timeout(8000),
      headers: UPSTREAM_HEADERS,
    });
    if (!initResp.ok) return null;
    const initData = (await initResp.json()) as {
      email_addr?: string;
      sid_token?: string;
    };
    const sid = initData.sid_token;
    if (!sid) return null;

    const setResp = await fetch(
      `${GUERRILLA_BASE}?f=set_email_user&email_user=${encodeURIComponent(
        localPart
      )}&lang=en&sid_token=${encodeURIComponent(sid)}`,
      { signal: AbortSignal.timeout(8000), headers: UPSTREAM_HEADERS }
    );
    if (!setResp.ok) return null;
    const setData = (await setResp.json()) as {
      email_addr?: string;
      sid_token?: string;
    };
    const finalSid = setData.sid_token || sid;
    const actualUser = (setData.email_addr || `${localPart}@guerrillamailblock.com`).split('@')[0];
    const chosenDomain =
      preferredDomain && GUERRILLA_DOMAINS.includes(preferredDomain)
        ? preferredDomain
        : 'guerrillamailblock.com';
    const finalAddress = `${actualUser}@${chosenDomain}`.toLowerCase();

    return {
      address: finalAddress,
      localPart: actualUser.toLowerCase(),
      domain: chosenDomain,
      provider: 'guerrilla',
      guerrillaSid: finalSid,
      createdAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

async function refreshGuerrillaSession(mailbox: StoredMailbox): Promise<string | null> {
  try {
    const initResp = await fetch(`${GUERRILLA_BASE}?f=get_email_address&lang=en`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!initResp.ok) return mailbox.guerrillaSid || null;
    const initData = (await initResp.json()) as { sid_token?: string };
    if (!initData.sid_token) return mailbox.guerrillaSid || null;
    const setResp = await fetch(
      `${GUERRILLA_BASE}?f=set_email_user&email_user=${encodeURIComponent(
        mailbox.localPart
      )}&lang=en&sid_token=${encodeURIComponent(initData.sid_token)}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (setResp.ok) {
      const setData = (await setResp.json()) as { sid_token?: string };
      mailbox.guerrillaSid = setData.sid_token || initData.sid_token;
      saveStore(appStore);
      return mailbox.guerrillaSid;
    }
  } catch {
    // Keep existing sid
  }
  return mailbox.guerrillaSid || null;
}

function generateRandomUsername(): string {
  const words = [
    'nova',
    'apex',
    'zen',
    'flux',
    'aura',
    'crest',
    'vibe',
    'pulse',
    'swift',
    'orbit',
    'neon',
    'prime',
  ];
  const word = words[crypto.randomInt(0, words.length)];
  const suffix = crypto.randomInt(1000, 9999);
  return `fx${word}${suffix}`;
}

function extractOtpCode(subject: string, text: string): string | null {
  const combined = `${subject}\n${text}`;
  const keywordMatch = combined.match(
    /(?:otp|code|verification|pin|verify|passcode|কোড|পিন)[^\d]{0,24}(\d{4,8})\b/i
  );
  if (keywordMatch?.[1]) return keywordMatch[1];
  const standalone = combined.match(/\b(\d{6})\b/);
  return standalone?.[1] ?? null;
}

function buildPublicSiteConfig() {
  let logoUrl: string | null = appStore.siteConfig.logoDataUrl || null;
  if (!logoUrl && appStore.siteConfig.logoPath) {
    logoUrl = `/api/assets/logo?v=${encodeURIComponent(appStore.siteConfig.logoPath)}`;
  }
  return {
    brandName: appStore.siteConfig.brandName,
    subtitle: appStore.siteConfig.subtitle,
    logoUrl,
    noticeBanner: appStore.siteConfig.noticeBanner,
  };
}

export function createApp(): Express {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '4mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.get('/api/site-config', (_req: Request, res: Response) => {
    res.json(buildPublicSiteConfig());
  });

  app.get('/api/assets/logo', (_req: Request, res: Response) => {
    const logoFile = appStore.siteConfig.logoPath;
    if (!logoFile) {
      res.status(404).end();
      return;
    }
    const safeName = path.basename(logoFile);
    const resolved = path.resolve(DATA_DIR, safeName);
    if (!resolved.startsWith(DATA_DIR + path.sep) || !fs.existsSync(resolved)) {
      res.status(404).end();
      return;
    }
    const ext = path.extname(safeName).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
    };
    res.setHeader('Content-Type', mimeMap[ext] || 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.sendFile(resolved);
  });

  // Admin routes
  app.get('/api/admin/status', (_req: Request, res: Response) => {
    const envConfigured = Boolean(
      process.env.ADMIN_PASSCODE && process.env.ADMIN_PASSCODE.trim().length > 0
    );
    res.json({
      envConfigured,
      hasClaimedPasscode: Boolean(appStore.adminPasswordHash),
    });
  });

  app.post('/api/admin/claim', (req: Request, res: Response) => {
    const envPass = process.env.ADMIN_PASSCODE?.trim();
    if (envPass) {
      res.status(403).json({ error: 'Admin passcode is configured via environment secret.' });
      return;
    }
    if (appStore.adminPasswordHash) {
      res.status(409).json({ error: 'Admin passcode has already been claimed.' });
      return;
    }
    const passcode = typeof req.body?.passcode === 'string' ? req.body.passcode.trim() : '';
    if (passcode.length < 6 || passcode.length > 128) {
      res.status(400).json({ error: 'Passcode must be between 6 and 128 characters.' });
      return;
    }
    appStore.adminPasswordHash = hashPasscode(passcode);
    saveStore(appStore);
    res.json({ token: createAdminToken() });
  });

  app.post('/api/admin/login', (req: Request, res: Response) => {
    const passcode = typeof req.body?.passcode === 'string' ? req.body.passcode.trim() : '';
    if (!passcode) {
      res.status(400).json({ error: 'Passcode is required.' });
      return;
    }
    const envPass = process.env.ADMIN_PASSCODE?.trim();
    if (envPass) {
      if (!constantTimeEquals(passcode, envPass)) {
        res.status(401).json({ error: 'Invalid admin passcode.' });
        return;
      }
      res.json({ token: createAdminToken() });
      return;
    }
    if (!appStore.adminPasswordHash) {
      res.status(409).json({ error: 'Admin passcode has not been initialized yet.' });
      return;
    }
    if (!verifyScryptPasscode(passcode, appStore.adminPasswordHash)) {
      res.status(401).json({ error: 'Invalid admin passcode.' });
      return;
    }
    res.json({ token: createAdminToken() });
  });

  app.get('/api/admin/overview', requireAdmin, (_req: Request, res: Response) => {
    const mailboxes = Object.values(appStore.mailboxes)
      .map((m) => ({
        address: m.address,
        provider: m.provider,
        createdAt: m.createdAt,
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    res.json({
      totalMailboxes: mailboxes.length,
      siteConfig: buildPublicSiteConfig(),
      mailboxes,
    });
  });

  app.post('/api/admin/logo', requireAdmin, (req: Request, res: Response) => {
    const imageDataUrl = req.body?.imageDataUrl;
    if (imageDataUrl === null) {
      if (appStore.siteConfig.logoPath) {
        try {
          const oldResolved = path.resolve(DATA_DIR, path.basename(appStore.siteConfig.logoPath));
          if (oldResolved.startsWith(DATA_DIR + path.sep) && fs.existsSync(oldResolved)) {
            fs.unlinkSync(oldResolved);
          }
        } catch {
          // Ignore
        }
      }
      appStore.siteConfig.logoPath = null;
      appStore.siteConfig.logoDataUrl = null;
      saveStore(appStore);
      res.json({ siteConfig: buildPublicSiteConfig() });
      return;
    }

    if (typeof imageDataUrl !== 'string') {
      res.status(400).json({ error: 'Invalid image payload.' });
      return;
    }

    const match = imageDataUrl.match(
      /^data:image\/(png|jpeg|jpg|webp|gif);base64,([A-Za-z0-9+/=]+)$/
    );
    if (!match) {
      res.status(400).json({ error: 'Supported image formats: PNG, JPG, WEBP, GIF.' });
      return;
    }
    const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length === 0 || buffer.length > 2 * 1024 * 1024) {
      res.status(400).json({ error: 'Image size must be under 2 MB.' });
      return;
    }

    if (appStore.siteConfig.logoPath) {
      try {
        const oldResolved = path.resolve(DATA_DIR, path.basename(appStore.siteConfig.logoPath));
        if (oldResolved.startsWith(DATA_DIR + path.sep) && fs.existsSync(oldResolved)) {
          fs.unlinkSync(oldResolved);
        }
      } catch {
        // Ignore
      }
    }

    const fileName = `logo_${Date.now()}.${ext}`;
    try {
      ensureDataDir();
      const targetPath = path.resolve(DATA_DIR, fileName);
      if (targetPath.startsWith(DATA_DIR + path.sep)) {
        fs.writeFileSync(targetPath, buffer);
        appStore.siteConfig.logoPath = fileName;
      }
    } catch {
      appStore.siteConfig.logoPath = null;
    }
    // Keep validated data URL so serverless environments also serve logo cleanly
    appStore.siteConfig.logoDataUrl = imageDataUrl;
    saveStore(appStore);

    res.json({ siteConfig: buildPublicSiteConfig() });
  });

  app.patch('/api/admin/config', requireAdmin, (req: Request, res: Response) => {
    const subtitle =
      typeof req.body?.subtitle === 'string' ? req.body.subtitle.trim().slice(0, 60) : undefined;
    const noticeBanner =
      typeof req.body?.noticeBanner === 'string'
        ? req.body.noticeBanner.trim().slice(0, 200)
        : undefined;

    if (subtitle !== undefined && subtitle.length > 0) {
      appStore.siteConfig.subtitle = subtitle;
    }
    if (noticeBanner !== undefined) {
      appStore.siteConfig.noticeBanner = noticeBanner;
    }
    saveStore(appStore);
    res.json({ siteConfig: buildPublicSiteConfig() });
  });

  app.delete('/api/admin/mailboxes/:address', requireAdmin, (req: Request, res: Response) => {
    const rawAddress = decodeURIComponent(req.params.address || '').toLowerCase().trim();
    if (!rawAddress || !appStore.mailboxes[rawAddress]) {
      res.status(404).json({ error: 'Mailbox not found.' });
      return;
    }
    delete appStore.mailboxes[rawAddress];
    saveStore(appStore);
    res.json({ deleted: rawAddress });
  });

  // Real Temp Mail API routes
  app.get('/api/mail/domains', async (_req: Request, res: Response) => {
    const { allDomains } = await getAllLiveDomains();
    res.json({ domains: allDomains });
  });

  app.post('/api/mail/create', async (req: Request, res: Response) => {
    const requestedUsername =
      typeof req.body?.username === 'string' ? req.body.username.trim().toLowerCase() : '';
    const requestedDomain =
      typeof req.body?.domain === 'string' ? req.body.domain.trim().toLowerCase() : '';

    if (requestedUsername && !/^[a-z0-9._-]{3,32}$/.test(requestedUsername)) {
      res.status(400).json({
        error: 'ইউজারনেম ৩–৩২ অক্ষরের হতে হবে (ইংরেজি অক্ষর, সংখ্যা, ডট, হাইফেন বা আন্ডারস্কোর)।',
      });
      return;
    }

    const { mailTmDomains, allDomains } = await getAllLiveDomains();
    const targetDomain =
      requestedDomain && allDomains.includes(requestedDomain)
        ? requestedDomain
        : mailTmDomains[0] || GUERRILLA_DOMAINS[0];

    const localPart = requestedUsername || generateRandomUsername();
    const address = `${localPart}@${targetDomain}`.toLowerCase();

    if (appStore.mailboxes[address]) {
      res.status(409).json({
        error: 'এই মেইলটি ইতিমধ্যেই তৈরি করা আছে। Mail Login থেকে এটি ওপেন করুন অথবা অন্য নাম দিন।',
      });
      return;
    }

    let createdMailbox: StoredMailbox | null = null;

    if (mailTmDomains.includes(targetDomain)) {
      const password = crypto.randomBytes(14).toString('base64url');
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        const createResp = await fetch(`${MAILTM_BASE}/accounts`, {
          method: 'POST',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ address, password }),
        });
        clearTimeout(timer);

        if (createResp.ok) {
          const accountData = (await createResp.json()) as { id: string; address: string };
          const actualAddress = accountData.address.toLowerCase();
          const tokenResp = await fetch(`${MAILTM_BASE}/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ address: actualAddress, password }),
          });
          const tokenData = tokenResp.ok
            ? ((await tokenResp.json()) as { token?: string })
            : {};

          createdMailbox = {
            address: actualAddress,
            localPart: actualAddress.split('@')[0] || localPart,
            domain: targetDomain,
            provider: 'mailtm',
            mailTmId: accountData.id,
            mailTmPassword: password,
            mailTmToken: tokenData.token,
            createdAt: new Date().toISOString(),
          };
        } else if (createResp.status === 422 && requestedUsername) {
          res.status(409).json({
            error: 'এই কাস্টম নামটি ইতিমধ্যেই ব্যবহৃত হচ্ছে। অনুগ্রহ করে অন্য নাম দিন।',
          });
          return;
        }
      } catch {
        // Fall through to backup real provider below
      }
    }

    if (!createdMailbox) {
      const guerrillaDomain = GUERRILLA_DOMAINS.includes(targetDomain)
        ? targetDomain
        : GUERRILLA_DOMAINS[0];
      createdMailbox = await createGuerrillaMailbox(localPart, guerrillaDomain);
    }

    if (!createdMailbox) {
      res.status(503).json({
        error: 'রিয়েল মেইল সার্ভার এই মুহূর্তে ব্যস্ত রয়েছে। কয়েক সেকেন্ড পর আবার চেষ্টা করুন।',
      });
      return;
    }

    appStore.mailboxes[createdMailbox.address] = createdMailbox;
    saveStore(appStore);

    res.json({
      address: createdMailbox.address,
      provider: createdMailbox.provider,
      createdAt: createdMailbox.createdAt,
      mailboxToken: encodeMailboxToken(createdMailbox),
    });
  });

  app.post('/api/mail/login', async (req: Request, res: Response) => {
    const rawMailName =
      typeof req.body?.mailName === 'string'
        ? req.body.mailName
        : typeof req.body?.address === 'string'
        ? req.body.address
        : '';
    const rawInput = rawMailName.trim().toLowerCase();
    const headerToken = req.headers['x-mailbox-token'];
    const providedToken =
      typeof req.body?.mailboxToken === 'string'
        ? req.body.mailboxToken
        : Array.isArray(headerToken)
        ? headerToken[0]
        : headerToken;
    if (!rawInput) {
      res.status(400).json({ error: 'মেইলের নাম বা সম্পূর্ণ ঠিকানা লিখুন।' });
      return;
    }

    let mailbox: StoredMailbox | undefined = appStore.mailboxes[rawInput];
    if (!mailbox && providedToken) {
      const decoded = decodeMailboxToken(providedToken);
      if (decoded) {
        mailbox = decoded;
        appStore.mailboxes[decoded.address.toLowerCase()] = decoded;
      }
    }
    if (!mailbox) {
      const targetLocal = rawInput.includes('@') ? rawInput.split('@')[0] : rawInput;
      const matches = Object.values(appStore.mailboxes)
        .filter((m) => m.localPart === targetLocal)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      mailbox = matches[0];
    }

    // On stateless serverless cold starts, GuerrillaMail usernames can be re-attached directly
    if (!mailbox) {
      const [localPart, domainPart] = rawInput.includes('@')
        ? rawInput.split('@')
        : [rawInput, ''];
      if (
        localPart &&
        (!domainPart || GUERRILLA_DOMAINS.includes(domainPart))
      ) {
        const reattached = await createGuerrillaMailbox(
          localPart,
          domainPart || GUERRILLA_DOMAINS[0]
        );
        if (reattached) {
          mailbox = reattached;
          appStore.mailboxes[reattached.address] = reattached;
          saveStore(appStore);
        }
      }
    }

    if (!mailbox) {
      res.status(404).json({
        error: 'এই নামে কোনো মেইল পাওয়া যায়নি। প্রথমে মেইল তৈরি করুন অথবা সঠিক নাম দিন।',
      });
      return;
    }

    if (mailbox.provider === 'mailtm') {
      await getOrRefreshMailTmToken(mailbox);
    } else if (mailbox.provider === 'guerrilla') {
      await refreshGuerrillaSession(mailbox);
    }

    res.json({
      address: mailbox.address,
      provider: mailbox.provider,
      createdAt: mailbox.createdAt,
      mailboxToken: encodeMailboxToken(mailbox),
    });
  });

  app.delete('/api/mail/account', async (req: Request, res: Response) => {
    const rawAddr =
      typeof req.body?.address === 'string'
        ? req.body.address
        : typeof req.query?.address === 'string'
        ? req.query.address
        : '';
    const address = rawAddr.trim().toLowerCase();
    if (!address) {
      res.status(400).json({ error: 'Address required.' });
      return;
    }
    const mailbox = resolveMailboxFromRequest(req, address);
    if (!mailbox) {
      res.json({ deleted: address });
      return;
    }

    if (mailbox.provider === 'mailtm' && mailbox.mailTmId) {
      const token = await getOrRefreshMailTmToken(mailbox);
      if (token) {
        await fetch(`${MAILTM_BASE}/accounts/${encodeURIComponent(mailbox.mailTmId)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }
    } else if (mailbox.provider === 'guerrilla' && mailbox.guerrillaSid) {
      await fetch(
        `${GUERRILLA_BASE}?f=forget_me&email_addr=${encodeURIComponent(
          mailbox.address
        )}&sid_token=${encodeURIComponent(mailbox.guerrillaSid)}`
      ).catch(() => {});
    }

    delete appStore.mailboxes[address];
    saveStore(appStore);
    res.json({ deleted: address });
  });

  app.get('/api/mail/messages', async (req: Request, res: Response) => {
    const address =
      typeof req.query?.address === 'string' ? req.query.address.trim().toLowerCase() : '';
    if (!address) {
      res.status(400).json({ error: 'Address required.' });
      return;
    }
    const mailbox = resolveMailboxFromRequest(req, address);
    if (!mailbox) {
      res.status(404).json({ error: 'Mailbox not found.' });
      return;
    }

    const messages: Array<{
      id: string;
      from: { name: string; address: string };
      subject: string;
      intro: string;
      createdAt: string;
      seen: boolean;
      hasAttachments: boolean;
      otpCode: string | null;
    }> = [];

    if (mailbox.provider === 'mailtm') {
      let token = await getOrRefreshMailTmToken(mailbox);
      if (token) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 7000);
          let resp = await fetch(`${MAILTM_BASE}/messages?page=1`, {
            signal: controller.signal,
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          });
          clearTimeout(timer);

          if (resp.status === 401) {
            mailbox.mailTmToken = undefined;
            token = await getOrRefreshMailTmToken(mailbox);
            if (token) {
              resp = await fetch(`${MAILTM_BASE}/messages?page=1`, {
                headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
              });
            }
          }

          if (resp.ok) {
            const raw = (await resp.json()) as
              | Array<{
                  id: string;
                  from: { name?: string; address: string };
                  subject?: string;
                  intro?: string;
                  createdAt: string;
                  seen?: boolean;
                  hasAttachments?: boolean;
                }>
              | {
                  'hydra:member'?: Array<{
                    id: string;
                    from: { name?: string; address: string };
                    subject?: string;
                    intro?: string;
                    createdAt: string;
                    seen?: boolean;
                    hasAttachments?: boolean;
                  }>;
                };
            const list = Array.isArray(raw) ? raw : raw['hydra:member'] || [];
            for (const msg of list) {
              const subject = msg.subject || '(No Subject)';
              const intro = msg.intro || '';
              messages.push({
                id: msg.id,
                from: {
                  name: msg.from?.name || msg.from?.address || 'Unknown Sender',
                  address: msg.from?.address || '',
                },
                subject,
                intro,
                createdAt: msg.createdAt,
                seen: Boolean(msg.seen),
                hasAttachments: Boolean(msg.hasAttachments),
                otpCode: extractOtpCode(subject, intro),
              });
            }
          }
        } catch {
          // Transient timeout
        }
      }
    } else if (mailbox.provider === 'guerrilla') {
      const sid = mailbox.guerrillaSid || (await refreshGuerrillaSession(mailbox));
      if (sid) {
        try {
          const resp = await fetch(
            `${GUERRILLA_BASE}?f=get_email_list&offset=0&sid_token=${encodeURIComponent(sid)}`,
            { signal: AbortSignal.timeout(7000) }
          );
          if (resp.ok) {
            const data = (await resp.json()) as {
              list?: Array<{
                mail_id: string | number;
                mail_from: string;
                mail_subject: string;
                mail_excerpt: string;
                mail_timestamp: number;
                mail_read: number;
                att: number;
              }>;
            };
            for (const item of data.list || []) {
              if (
                String(item.mail_id) === '1' &&
                item.mail_from === 'no-reply@guerrillamail.com'
              ) {
                continue;
              }
              const subject = item.mail_subject || '(No Subject)';
              const intro = item.mail_excerpt || '';
              const ts = item.mail_timestamp
                ? new Date(Number(item.mail_timestamp) * 1000).toISOString()
                : new Date().toISOString();
              messages.push({
                id: String(item.mail_id),
                from: {
                  name: item.mail_from,
                  address: item.mail_from,
                },
                subject,
                intro,
                createdAt: ts,
                seen: Boolean(item.mail_read),
                hasAttachments: Number(item.att) > 0,
                otpCode: extractOtpCode(subject, intro),
              });
            }
          }
        } catch {
          // Transient error
        }
      }
    }

    messages.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({ messages });
  });

  app.get('/api/mail/messages/:id', async (req: Request, res: Response) => {
    const address =
      typeof req.query?.address === 'string' ? req.query.address.trim().toLowerCase() : '';
    const msgId = req.params.id;
    const mailbox = address ? resolveMailboxFromRequest(req, address) : null;
    if (!mailbox) {
      res.status(404).json({ error: 'Mailbox not found.' });
      return;
    }

    if (mailbox.provider === 'mailtm') {
      const token = await getOrRefreshMailTmToken(mailbox);
      if (token) {
        try {
          const resp = await fetch(`${MAILTM_BASE}/messages/${encodeURIComponent(msgId)}`, {
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          });
          if (resp.ok) {
            const full = (await resp.json()) as {
              id: string;
              from: { name?: string; address: string };
              to: { name?: string; address: string }[];
              subject?: string;
              intro?: string;
              text?: string;
              html?: string[];
              createdAt: string;
              hasAttachments?: boolean;
            };
            fetch(`${MAILTM_BASE}/messages/${encodeURIComponent(msgId)}`, {
              method: 'PATCH',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/merge-patch+json',
              },
              body: JSON.stringify({ seen: true }),
            }).catch(() => {});

            const subject = full.subject || '(No Subject)';
            const text = full.text || full.intro || '';
            res.json({
              id: full.id,
              from: {
                name: full.from?.name || full.from?.address || 'Unknown Sender',
                address: full.from?.address || '',
              },
              to: full.to || [{ name: '', address: mailbox.address }],
              subject,
              intro: full.intro || '',
              text,
              html: Array.isArray(full.html) ? full.html : [],
              createdAt: full.createdAt,
              seen: true,
              hasAttachments: Boolean(full.hasAttachments),
              otpCode: extractOtpCode(subject, text),
            });
            return;
          }
        } catch {
          // Fall through
        }
      }
    } else if (mailbox.provider === 'guerrilla') {
      const sid = mailbox.guerrillaSid || (await refreshGuerrillaSession(mailbox));
      if (sid) {
        try {
          const resp = await fetch(
            `${GUERRILLA_BASE}?f=fetch_email&email_id=${encodeURIComponent(
              msgId
            )}&sid_token=${encodeURIComponent(sid)}`
          );
          if (resp.ok) {
            const full = (await resp.json()) as {
              mail_id?: string | number;
              mail_from?: string;
              mail_subject?: string;
              mail_body?: string;
              mail_timestamp?: number;
              mail_excerpt?: string;
            };
            if (full.mail_id) {
              const subject = full.mail_subject || '(No Subject)';
              const body = full.mail_body || '';
              const plainText = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
              const ts = full.mail_timestamp
                ? new Date(Number(full.mail_timestamp) * 1000).toISOString()
                : new Date().toISOString();
              res.json({
                id: String(full.mail_id),
                from: {
                  name: full.mail_from || 'Unknown Sender',
                  address: full.mail_from || '',
                },
                to: [{ name: mailbox.localPart, address: mailbox.address }],
                subject,
                intro: full.mail_excerpt || '',
                text: plainText,
                html: body.includes('<') ? [body] : [],
                createdAt: ts,
                seen: true,
                hasAttachments: false,
                otpCode: extractOtpCode(subject, plainText),
              });
              return;
            }
          }
        } catch {
          // Fall through
        }
      }
    }

    res.status(404).json({ error: 'Message not found.' });
  });

  app.delete('/api/mail/messages/:id', async (req: Request, res: Response) => {
    const address =
      typeof req.query?.address === 'string' ? req.query.address.trim().toLowerCase() : '';
    const msgId = req.params.id;
    const mailbox = address ? resolveMailboxFromRequest(req, address) : null;
    if (!mailbox) {
      res.status(404).json({ error: 'Mailbox not found.' });
      return;
    }

    if (mailbox.provider === 'mailtm') {
      const token = await getOrRefreshMailTmToken(mailbox);
      if (token) {
        await fetch(`${MAILTM_BASE}/messages/${encodeURIComponent(msgId)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }
    } else if (mailbox.provider === 'guerrilla' && mailbox.guerrillaSid) {
      await fetch(
        `${GUERRILLA_BASE}?f=del_email&email_ids[]=${encodeURIComponent(
          msgId
        )}&sid_token=${encodeURIComponent(mailbox.guerrillaSid)}`
      ).catch(() => {});
    }

    res.json({ deleted: msgId });
  });

  app.use('/api/*', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'API route not found.' });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = err instanceof Error ? err.message : 'Internal server error';
    res.status(500).json({ error: message });
  });

  return app;
}
