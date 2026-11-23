import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.WEB_PORT || 3000);
const isProd = process.env.NODE_ENV === 'production';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

app.use(express.json({ limit: '2mb' }));

// ─────────────────────────────────────────────────────────────────────────────
// Server-Backed Email/Password Authentication Store
// Enables immediate Email/Password registration & login even when Firebase Auth's
// Email/Password provider toggle is not yet enabled in Firebase Console.
// ─────────────────────────────────────────────────────────────────────────────
type ValidRole = 'patient' | 'clinician' | 'researcher' | 'ml_engineer' | 'admin';
const VALID_ROLES: ValidRole[] = ['patient', 'clinician', 'researcher', 'ml_engineer', 'admin'];
const ADMIN_EMAIL = 'sunithanenavath566@gmail.com';
const DATA_DIR = path.join(__dirname, 'data');
const AUTH_USERS_FILE = path.join(DATA_DIR, '.auth_users.json');
const SESSION_SECRET_FILE = path.join(DATA_DIR, '.session_secret');
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface StoredAuthUser {
  uid: string;
  email: string;
  displayName: string;
  role: ValidRole;
  salt: string;
  passwordHash: string;
  createdAt: string;
  updatedAt?: string;
}

interface PublicAuthUser {
  uid: string;
  email: string;
  displayName: string;
  role: ValidRole;
  createdAt: string;
  updatedAt?: string;
}

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
  }
}

function getSessionSecret(): string {
  const envSecret = process.env.SESSION_SECRET?.trim();
  if (envSecret && envSecret.length >= 16) {
    return envSecret;
  }
  ensureDataDir();
  try {
    if (fs.existsSync(SESSION_SECRET_FILE)) {
      const existing = fs.readFileSync(SESSION_SECRET_FILE, 'utf8').trim();
      if (existing.length >= 32) return existing;
    }
    const generated = crypto.randomBytes(48).toString('hex');
    fs.writeFileSync(SESSION_SECRET_FILE, generated, { mode: 0o600 });
    return generated;
  } catch {
    return crypto.createHash('sha256').update(`dermai-session-${__dirname}`).digest('hex');
  }
}

const SESSION_SECRET = getSessionSecret();

function readAuthUsers(): StoredAuthUser[] {
  ensureDataDir();
  if (!fs.existsSync(AUTH_USERS_FILE)) return [];
  try {
    const raw = fs.readFileSync(AUTH_USERS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAuthUsers(users: StoredAuthUser[]): void {
  ensureDataDir();
  fs.writeFileSync(AUTH_USERS_FILE, JSON.stringify(users, null, 2), { mode: 0o600 });
}

function toPublicUser(u: StoredAuthUser): PublicAuthUser {
  return {
    uid: u.uid,
    email: u.email,
    displayName: u.displayName,
    role: u.role,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function verifyPassword(password: string, salt: string, expectedHex: string): boolean {
  try {
    const derived = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHex, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

function signSessionToken(uid: string, email: string): string {
  const payload = Buffer.from(
    JSON.stringify({ uid, email, exp: Date.now() + TOKEN_TTL_MS }),
    'utf8'
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifySessionToken(token: string): { uid: string; email: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payload, sig] = parts;
    const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!decoded?.uid || !decoded?.exp || Date.now() > Number(decoded.exp)) {
      return null;
    }
    return { uid: String(decoded.uid), email: String(decoded.email || '') };
  } catch {
    return null;
  }
}

function extractBearerUser(req: express.Request): StoredAuthUser | null {
  const header = req.header('Authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const session = verifySessionToken(match[1].trim());
  if (!session) return null;
  const users = readAuthUsers();
  return users.find((u) => u.uid === session.uid) || null;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.post('/api/auth/register', (req, res) => {
  const rawEmail = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const rawName = typeof req.body?.displayName === 'string' ? req.body.displayName.trim() : '';
  const requestedRole = typeof req.body?.role === 'string' ? req.body.role.trim() : 'patient';

  if (!rawEmail || !EMAIL_PATTERN.test(rawEmail)) {
    res.status(400).json({ code: 'auth/invalid-email', error: 'Please enter a valid email address.' });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({
      code: 'auth/weak-password',
      error: 'Password is too weak. Please create a password with at least 8 characters.',
    });
    return;
  }

  const users = readAuthUsers();
  if (users.some((u) => u.email.toLowerCase() === rawEmail)) {
    res.status(409).json({
      code: 'auth/email-already-in-use',
      error: 'An account with this email address already exists. Please switch to Sign In.',
    });
    return;
  }

  let assignedRole: ValidRole = VALID_ROLES.includes(requestedRole as ValidRole)
    ? (requestedRole as ValidRole)
    : 'patient';
  if (rawEmail === ADMIN_EMAIL) {
    assignedRole = 'admin';
  } else if (assignedRole === 'admin') {
    assignedRole = 'clinician';
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(password, salt);
  const now = new Date().toISOString();
  const newUser: StoredAuthUser = {
    uid: `srv_${crypto.randomBytes(10).toString('hex')}`,
    email: rawEmail,
    displayName: rawName || rawEmail.split('@')[0],
    role: assignedRole,
    salt,
    passwordHash,
    createdAt: now,
  };

  users.push(newUser);
  writeAuthUsers(users);

  const token = signSessionToken(newUser.uid, newUser.email);
  res.status(201).json({ token, user: toPublicUser(newUser) });
});

app.post('/api/auth/login', (req, res) => {
  const rawEmail = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!rawEmail || !password) {
    res.status(400).json({
      code: 'auth/invalid-credential',
      error: 'Please enter both your email address and password.',
    });
    return;
  }

  const users = readAuthUsers();
  const found = users.find((u) => u.email.toLowerCase() === rawEmail);
  if (!found || !verifyPassword(password, found.salt, found.passwordHash)) {
    res.status(401).json({
      code: 'auth/invalid-credential',
      error: 'Incorrect email or password. If you are new, switch to Create Account to register.',
    });
    return;
  }

  const token = signSessionToken(found.uid, found.email);
  res.json({ token, user: toPublicUser(found) });
});

app.get('/api/auth/me', (req, res) => {
  const found = extractBearerUser(req);
  if (!found) {
    res.status(401).json({ error: 'Invalid or expired session token.' });
    return;
  }
  res.json({ user: toPublicUser(found) });
});

app.patch('/api/auth/profile', (req, res) => {
  const found = extractBearerUser(req);
  if (!found) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const users = readAuthUsers();
  const idx = users.findIndex((u) => u.uid === found.uid);
  if (idx === -1) {
    res.status(404).json({ error: 'Account not found.' });
    return;
  }

  const nextName =
    typeof req.body?.displayName === 'string' && req.body.displayName.trim()
      ? req.body.displayName.trim().slice(0, 120)
      : users[idx].displayName;

  let nextRole = users[idx].role;
  if (typeof req.body?.role === 'string' && VALID_ROLES.includes(req.body.role as ValidRole)) {
    const candidate = req.body.role as ValidRole;
    if (candidate !== 'admin' || users[idx].email.toLowerCase() === ADMIN_EMAIL || users[idx].role === 'admin') {
      nextRole = candidate;
    }
  }

  users[idx] = {
    ...users[idx],
    displayName: nextName,
    role: nextRole,
    updatedAt: new Date().toISOString(),
  };
  writeAuthUsers(users);
  res.json({ user: toPublicUser(users[idx]) });
});

app.post('/api/auth/change-password', (req, res) => {
  const found = extractBearerUser(req);
  if (!found) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

  if (!verifyPassword(currentPassword, found.salt, found.passwordHash)) {
    res.status(401).json({ error: 'Current password is incorrect.' });
    return;
  }
  if (newPassword.length < 8) {
    res.status(400).json({ error: 'New password must be at least 8 characters.' });
    return;
  }

  const users = readAuthUsers();
  const idx = users.findIndex((u) => u.uid === found.uid);
  if (idx === -1) {
    res.status(404).json({ error: 'Account not found.' });
    return;
  }

  const nextSalt = crypto.randomBytes(16).toString('hex');
  users[idx] = {
    ...users[idx],
    salt: nextSalt,
    passwordHash: hashPassword(newPassword, nextSalt),
    updatedAt: new Date().toISOString(),
  };
  writeAuthUsers(users);
  res.json({ ok: true, message: 'Password updated successfully.' });
});

app.post('/api/auth/reset-password', (req, res) => {
  const rawEmail = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!rawEmail || !EMAIL_PATTERN.test(rawEmail)) {
    res.status(400).json({ error: 'Please enter a valid email address.' });
    return;
  }
  res.json({
    ok: true,
    message:
      'Password reset request recorded. Sign in with your account to change your password in Profile, or use Google Sign-In.',
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ML Service Proxy & Health Endpoints
// ─────────────────────────────────────────────────────────────────────────────

function isSafeExternalUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    const host = parsed.hostname.toLowerCase();
    // Prevent SSRF to cloud metadata, loopback, or private RFC1918 ranges from browser overrides
    if (
      host === 'localhost' ||
      host === '0.0.0.0' ||
      host.startsWith('127.') ||
      host.startsWith('10.') ||
      host.startsWith('169.254.') ||
      host.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
      host === '::1'
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function resolveMlServiceUrl(clientOverride?: string): { url: string | null; source: 'env' | 'override' | 'default' | 'none' } {
  const envUrl = process.env.ML_SERVICE_URL?.trim();
  if (envUrl) {
    return { url: envUrl.replace(/\/$/, ''), source: 'env' };
  }
  const override = clientOverride?.trim();
  if (override && (override.includes('localhost') || override.includes('127.0.0.1') || isSafeExternalUrl(override))) {
    return { url: override.replace(/\/$/, ''), source: 'override' };
  }
  return { url: 'http://127.0.0.1:8000', source: 'default' };
}

// Platform health endpoints for Cloud Run & load balancers
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    service: 'DermAI Skin Disease Detector',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'healthy',
    ml_service_configured: Boolean(process.env.ML_SERVICE_URL),
    disclaimer: 'AI-assisted analysis, not a standalone medical diagnosis.',
  });
});

// Live ML service connectivity probe
app.get('/api/ml/status', async (req, res) => {
  const overrideHeader = typeof req.query.url === 'string' ? req.query.url : undefined;
  const { url, source } = resolveMlServiceUrl(overrideHeader);

  if (!url) {
    res.json({
      connected: false,
      demo_mode: true,
      source: 'none',
      message: 'No ML_SERVICE_URL configured. Operating in Demo Mode with client-side quality, preprocessing & Otsu segmentation.',
    });
    return;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const probe = await fetch(`${url}/health`, { signal: controller.signal });
    clearTimeout(timer);

    if (!probe.ok) {
      res.json({
        connected: false,
        demo_mode: true,
        source,
        message: `ML service responded with HTTP ${probe.status}. Fallback to Demo Mode.`,
      });
      return;
    }

    const remoteData = await probe.json().catch(() => ({}));
    const hasLoadedModels =
      Array.isArray(remoteData.loaded_models) ? remoteData.loaded_models.length > 0 : true;

    res.json({
      connected: hasLoadedModels,
      demo_mode: !hasLoadedModels,
      source,
      remote_status: remoteData,
      message: hasLoadedModels
        ? 'Connected to trained PyTorch ML inference service.'
        : 'ML service reachable, but no trained weights loaded yet.',
    });
  } catch (err: any) {
    res.json({
      connected: false,
      demo_mode: true,
      source,
      message: err?.name === 'AbortError' ? 'ML service health probe timed out.' : 'Unable to reach remote ML service.',
    });
  }
});

// Server-side ML /predict multipart proxy
app.post('/api/ml/predict', upload.single('image'), async (req, res) => {
  const overrideUrl = req.header('X-ML-Service-Url');
  const { url, source } = resolveMlServiceUrl(overrideUrl);

  if (!url) {
    res.status(503).json({
      demo_mode: true,
      error: 'ML_SERVICE_URL is not configured.',
      disclaimer: 'AI-assisted analysis, not a standalone medical diagnosis.',
    });
    return;
  }

  if (!req.file) {
    res.status(400).json({ error: 'Missing multipart field "image".' });
    return;
  }

  const modelVersion = req.header('X-Model-Version') || 'v3.0 Ensemble';

  try {
    const outgoing = new FormData();
    const blob = new Blob([new Uint8Array(req.file.buffer)], {
      type: req.file.mimetype || 'image/jpeg',
    });
    outgoing.append('image', blob, req.file.originalname || 'lesion.jpg');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    let upstream = await fetch(`${url}/predict`, {
      method: 'POST',
      headers: {
        'X-Model-Version': modelVersion,
      },
      body: outgoing,
      signal: controller.signal,
    }).catch(() => null);

    if (!upstream || !upstream.ok) {
      const retryOutgoing = new FormData();
      const retryBlob = new Blob([new Uint8Array(req.file.buffer)], {
        type: req.file.mimetype || 'image/jpeg',
      });
      retryOutgoing.append('image', retryBlob, req.file.originalname || 'lesion.jpg');
      upstream = await fetch(`${url}/api/ml/predict`, {
        method: 'POST',
        headers: {
          'X-Model-Version': modelVersion,
        },
        body: retryOutgoing,
        signal: controller.signal,
      });
    }
    clearTimeout(timer);

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => upstream.statusText);
      res.status(upstream.status).json({
        demo_mode: true,
        source,
        error: `Remote ML service returned HTTP ${upstream.status}: ${detail}`,
      });
      return;
    }

    const prediction = await upstream.json();
    res.json({
      ...prediction,
      disclaimer: 'AI-assisted analysis, not a standalone medical diagnosis.',
    });
  } catch (err: any) {
    res.status(502).json({
      demo_mode: true,
      error: err?.message || 'Failed to reach remote ML service.',
    });
  }
});

async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`DermAI server (${isProd ? 'production' : 'development'}) listening on 0.0.0.0:${port}`);
  });
}

startServer();
