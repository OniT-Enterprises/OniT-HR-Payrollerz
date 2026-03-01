/**
 * Meza HR/Payroll API
 * REST API for OpenClaw bot integration with OniT HR system
 *
 * All Firestore collections are tenant subcollections under tenants/{tid}/
 * (no top-level collections with tenantId field).
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const admin = require('firebase-admin');
const crypto = require('crypto');
const { classifyChatIntent, detectActions, isConfirmMessage, isCancelMessage, sanitizeSessionKey } = require('./chatUtils');

const app = express();
app.set('trust proxy', 1); // Behind Nginx reverse proxy
const PORT = process.env.PORT || 3201;

// ============================================================================
// Firebase Admin Initialization
// ============================================================================

let db;
let firebaseInitialized = false;

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const serviceAccount = require(path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else if (process.env.FIREBASE_PROJECT_ID) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  } else {
    throw new Error('Firebase credentials not configured. Check .env file.');
  }

  db = admin.firestore();
  firebaseInitialized = true;
  console.log('[meza-api] Firebase Admin initialized successfully');
} catch (error) {
  console.error('[meza-api] Firebase initialization failed:', error.message);
  console.error('[meza-api] API will start but Firebase-dependent endpoints will not work.');
}

// ============================================================================
// Middleware
// ============================================================================

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: function (origin, callback) {
    const allowed = ['https://payroll.naroman.tl', 'https://meza.naroman.tl'];
    if (!origin || allowed.includes(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-API-Key', 'Authorization'],
}));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('combined'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});
app.use(limiter);

// ============================================================================
// Auth Middleware
// ============================================================================

const API_KEY = process.env.API_KEY;
const ALLOWED_TENANT_ID = process.env.ALLOWED_TENANT_ID;

function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!API_KEY) {
    return res.status(500).json({ success: false, message: 'API key not configured on server' });
  }
  if (!key || key !== API_KEY) {
    return res.status(401).json({ success: false, message: 'Invalid or missing API key' });
  }
  next();
}

function requireTenant(req, res, next) {
  const { tenantId } = req.params;
  if (!tenantId) {
    return res.status(400).json({ success: false, message: 'Missing tenantId parameter' });
  }
  if (ALLOWED_TENANT_ID) {
    const allowed = ALLOWED_TENANT_ID.split(',').map(s => s.trim());
    if (!allowed.includes(tenantId)) {
      return res.status(403).json({ success: false, message: 'Access denied for this tenant' });
    }
  }
  if (!firebaseInitialized) {
    return res.status(503).json({ success: false, message: 'Firebase not initialized' });
  }
  req.tenantId = tenantId;
  next();
}

// Firebase ID token auth middleware (for web app users, not bot API key)
async function authenticateFirebaseToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Firebase ID token required' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = {
      uid: decoded.uid,
      email: decoded.email || '',
      name: decoded.name || '',
    };
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired Firebase token' });
  }
}

// Chat-specific rate limiter (AI calls are expensive)
const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 requests per 15 min per IP
  message: { success: false, message: 'Too many chat requests. Please try again later.' },
});

// ============================================================================
// OpenClaw Gateway Configuration
// ============================================================================

const OPENCLAW_WS_URL = process.env.OPENCLAW_WS_URL || 'ws://127.0.0.1:18790';
const OPENCLAW_HTTP_URL = OPENCLAW_WS_URL.replace(/^ws/, 'http');
const OPENCLAW_PASSWORD = process.env.OPENCLAW_PASSWORD || '';
if (OPENCLAW_PASSWORD) {
  console.log(`[meza-api] OpenClaw gateway configured at ${OPENCLAW_HTTP_URL}`);
} else {
  console.log('[meza-api] OPENCLAW_PASSWORD not set — chat endpoint will be unavailable');
}

function genId() {
  return crypto.randomBytes(8).toString('hex');
}

// ============================================================================
// Helpers
// ============================================================================

/** Convert Firestore Timestamp to ISO string */
function toIso(val) {
  if (!val) return null;
  if (val.toDate) return val.toDate().toISOString();
  if (val instanceof Date) return val.toISOString();
  return val;
}

/** Map a Firestore doc snapshot to a plain object */
function mapDoc(doc) {
  if (!doc.exists) return null;
  const data = doc.data();
  const mapped = { id: doc.id };
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === 'object' && typeof value.toDate === 'function') {
      mapped[key] = value.toDate().toISOString();
    } else {
      mapped[key] = value;
    }
  }
  return mapped;
}

/** Map an array of query snapshots */
function mapDocs(snapshot) {
  return snapshot.docs.map(mapDoc);
}

/** Get today's date string in YYYY-MM-DD (TL timezone UTC+9) */
function getTodayTL() {
  const now = new Date();
  const tlTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return tlTime.toISOString().split('T')[0];
}

/** Get current YYYYMM */
function getCurrentYYYYMM() {
  const now = new Date();
  const tlTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const year = tlTime.getFullYear();
  const month = String(tlTime.getMonth() + 1).padStart(2, '0');
  return `${year}${month}`;
}

/** Get current year */
function getCurrentYear() {
  const now = new Date();
  const tlTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return tlTime.getFullYear();
}

/** Get start/end of current month as ISO strings */
function getCurrentMonthRange() {
  const now = new Date();
  const tlTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const year = tlTime.getFullYear();
  const month = tlTime.getMonth();
  const start = new Date(year, month, 1).toISOString().split('T')[0];
  const end = new Date(year, month + 1, 0).toISOString().split('T')[0];
  return { start, end };
}

/** Tenant collection reference helper */
function tenantCol(tenantId, collection) {
  return db.collection('tenants').doc(tenantId).collection(collection);
}

/**
 * Find the most recent balance snapshot strictly before `beforeDate`.
 * Walks backward by deterministic YYYY-MM IDs (O(1) per check).
 * Returns null if no snapshot exists.
 */
async function findLatestSnapshotBefore(tenantId, beforeDate) {
  const [yearStr, monthStr] = beforeDate.split('-');
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10) - 1;
  if (month < 1) { month = 12; year--; }

  for (let i = 0; i < 36; i++) {
    const sid = `${year}-${String(month).padStart(2, '0')}`;
    const snap = await tenantCol(tenantId, 'balanceSnapshots').doc(sid).get();
    if (snap.exists) {
      const data = snap.data();
      if (data.periodEndDate < beforeDate) {
        return { id: sid, ...data };
      }
    }
    month--;
    if (month < 1) { month = 12; year--; }
  }
  return null;
}

/**
 * Query GL entries in a date range: (afterDate, upToDate].
 * If afterDate is null, queries all entries up to upToDate.
 */
async function queryGLDelta(tenantId, afterDate, upToDate) {
  const glRef = tenantCol(tenantId, 'generalLedger');
  let q;
  if (afterDate) {
    q = glRef.where('entryDate', '>', afterDate).where('entryDate', '<=', upToDate).orderBy('entryDate', 'asc');
  } else {
    q = glRef.where('entryDate', '<=', upToDate).orderBy('entryDate', 'asc');
  }
  const snap = await q.get();
  return snap.docs.map((d) => d.data());
}

// ============================================================================
// Health Check
// ============================================================================

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    service: 'meza-api',
    version: '1.0.0',
    firebase: firebaseInitialized,
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// All tenant-scoped routes require API key + tenant validation
// ============================================================================

const router = express.Router({ mergeParams: true });
router.use(requireApiKey);
router.use(requireTenant);

// ============================================================================
// EMPLOYEES
// ============================================================================

/**
 * GET /api/tenants/:tenantId/employees
 * Query: status, department, search, limit
 */
router.get('/employees', async (req, res) => {
  try {
    const { status, department, search, limit: limitStr } = req.query;
    const maxResults = Math.min(parseInt(limitStr) || 100, 500);

    let query = tenantCol(req.tenantId, 'employees').orderBy('personalInfo.lastName', 'asc');

    if (status) {
      query = query.where('status', '==', status);
    }
    if (department) {
      query = query.where('jobDetails.departmentId', '==', department);
    }

    query = query.limit(maxResults);
    const snapshot = await query.get();
    let employees = mapDocs(snapshot);

    // Client-side search filter (Firestore doesn't support full-text)
    if (search) {
      const term = search.toLowerCase();
      employees = employees.filter((e) => {
        const name = `${e.personalInfo?.firstName || ''} ${e.personalInfo?.lastName || ''}`.toLowerCase();
        const email = (e.personalInfo?.email || '').toLowerCase();
        const empId = (e.employeeId || e.id || '').toLowerCase();
        return name.includes(term) || email.includes(term) || empId.includes(term);
      });
    }

    res.json({ success: true, count: employees.length, employees });
  } catch (error) {
    console.error('[employees]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/tenants/:tenantId/employees/counts
 * Returns employee counts by status
 */
router.get('/employees/counts', async (req, res) => {
  try {
    const snapshot = await tenantCol(req.tenantId, 'employees').get();
    const counts = { total: 0, active: 0, inactive: 0, terminated: 0, onLeave: 0, probation: 0 };
    snapshot.docs.forEach((doc) => {
      counts.total++;
      const status = doc.data().status || 'active';
      if (counts[status] !== undefined) {
        counts[status]++;
      }
    });
    res.json({ success: true, counts });
  } catch (error) {
    console.error('[employees/counts]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/tenants/:tenantId/employees/by-department
 * Groups employees by department
 */
router.get('/employees/by-department', async (req, res) => {
  try {
    const snapshot = await tenantCol(req.tenantId, 'employees')
      .where('status', '==', 'active')
      .get();

    const departments = {};
    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      const deptId = data.jobDetails?.departmentId || 'unassigned';
      const deptName = data.jobDetails?.departmentName || data.jobDetails?.department || 'Unassigned';
      if (!departments[deptId]) {
        departments[deptId] = { id: deptId, name: deptName, count: 0, employees: [] };
      }
      departments[deptId].count++;
      departments[deptId].employees.push({
        id: doc.id,
        name: `${data.personalInfo?.firstName || ''} ${data.personalInfo?.lastName || ''}`.trim(),
        position: data.jobDetails?.positionTitle || data.jobDetails?.position || '',
        status: data.status,
      });
    });

    const result = Object.values(departments).sort((a, b) => b.count - a.count);
    res.json({ success: true, count: result.length, departments: result });
  } catch (error) {
    console.error('[employees/by-department]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/tenants/:tenantId/employees/:employeeId
 */
router.get('/employees/:employeeId', async (req, res) => {
  try {
    const doc = await tenantCol(req.tenantId, 'employees').doc(req.params.employeeId).get();
    if (!doc.exists) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }
    res.json({ success: true, employee: mapDoc(doc) });
  } catch (error) {
    console.error('[employees/:id]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
// DEPARTMENTS
// ============================================================================

/**
 * GET /api/tenants/:tenantId/departments
 */
router.get('/departments', async (req, res) => {
  try {
    const snapshot = await tenantCol(req.tenantId, 'departments').orderBy('name', 'asc').get();
    const departments = mapDocs(snapshot);
    res.json({ success: true, count: departments.length, departments });
  } catch (error) {
    console.error('[departments]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
// PAYROLL
// ============================================================================

/**
 * GET /api/tenants/:tenantId/payroll/runs
 * Query: status, limit
 */
router.get('/payroll/runs', async (req, res) => {
  try {
    const { status, limit: limitStr } = req.query;
    const maxResults = Math.min(parseInt(limitStr) || 12, 50);

    // Payroll runs are stored as documents at tenants/{tid}/payruns/{yyyymm}
    const payrunsRef = tenantCol(req.tenantId, 'payruns');
    const snapshot = await payrunsRef.orderBy('periodStart', 'desc').limit(maxResults).get();
    let runs = mapDocs(snapshot);

    if (status) {
      runs = runs.filter((r) => r.status === status);
    }

    res.json({ success: true, count: runs.length, runs });
  } catch (error) {
    console.error('[payroll/runs]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/tenants/:tenantId/payroll/runs/:yyyymm
 */
router.get('/payroll/runs/:yyyymm', async (req, res) => {
  try {
    const doc = await tenantCol(req.tenantId, 'payruns').doc(req.params.yyyymm).get();
    if (!doc.exists) {
      return res.status(404).json({ success: false, message: 'Payroll run not found' });
    }
    res.json({ success: true, run: mapDoc(doc) });
  } catch (error) {
    console.error('[payroll/runs/:yyyymm]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/tenants/:tenantId/payroll/runs/:yyyymm/payslips
 */
router.get('/payroll/runs/:yyyymm/payslips', async (req, res) => {
  try {
    const payslipsRef = db
      .collection('tenants')
      .doc(req.tenantId)
      .collection('payruns')
      .doc(req.params.yyyymm)
      .collection('payslips');

    const snapshot = await payslipsRef.get();
    const payslips = mapDocs(snapshot);

    res.json({ success: true, count: payslips.length, payslips });
  } catch (error) {
    console.error('[payroll/payslips]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
// LEAVE
// ============================================================================

/**
 * GET /api/tenants/:tenantId/leave/requests
 * Query: status, employeeId, limit
 */
router.get('/leave/requests', async (req, res) => {
  try {
    const { status, employeeId, limit: limitStr } = req.query;
    const maxResults = Math.min(parseInt(limitStr) || 100, 500);

    let query = tenantCol(req.tenantId, 'leaveRequests').orderBy('requestDate', 'desc');

    if (status) {
      query = query.where('status', '==', status);
    }
    if (employeeId) {
      query = query.where('employeeId', '==', employeeId);
    }

    query = query.limit(maxResults);
    const snapshot = await query.get();
    const requests = mapDocs(snapshot);

    res.json({ success: true, count: requests.length, requests });
  } catch (error) {
    console.error('[leave/requests]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/tenants/:tenantId/leave/pending
 */
router.get('/leave/pending', async (req, res) => {
  try {
    const snapshot = await tenantCol(req.tenantId, 'leaveRequests')
      .where('status', '==', 'pending')
      .orderBy('requestDate', 'desc')
      .get();
    const requests = mapDocs(snapshot);
    res.json({ success: true, count: requests.length, requests });
  } catch (error) {
    console.error('[leave/pending]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/tenants/:tenantId/leave/balances
 * Query: year (defaults to current year)
 */
router.get('/leave/balances', async (req, res) => {
  try {
    const year = req.query.year || String(getCurrentYear());
    // Leave balances have IDs like {empId}_{year}
    const snapshot = await tenantCol(req.tenantId, 'leaveBalances').get();
    const allBalances = mapDocs(snapshot);
    // Filter to requested year
    const balances = allBalances.filter((b) => {
      return b.year === parseInt(year) || b.year === year || b.id.endsWith(`_${year}`);
    });

    res.json({ success: true, count: balances.length, year, balances });
  } catch (error) {
    console.error('[leave/balances]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/tenants/:tenantId/leave/on-leave-today
 */
router.get('/leave/on-leave-today', async (req, res) => {
  try {
    const today = getTodayTL();
    // Find approved leave requests where today falls between startDate and endDate
    const snapshot = await tenantCol(req.tenantId, 'leaveRequests')
      .where('status', '==', 'approved')
      .get();

    const onLeave = [];
    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      const startDate = data.startDate || '';
      const endDate = data.endDate || '';
      if (today >= startDate && today <= endDate) {
        onLeave.push({
          id: doc.id,
          employeeId: data.employeeId,
          employeeName: data.employeeName || '',
          leaveType: data.leaveType,
          startDate,
          endDate,
          days: data.totalDays || data.days || 0,
        });
      }
    });

    res.json({ success: true, count: onLeave.length, date: today, employees: onLeave });
  } catch (error) {
    console.error('[leave/on-leave-today]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
// ATTENDANCE
// ============================================================================

/**
 * GET /api/tenants/:tenantId/attendance/daily
 * Query: date (YYYY-MM-DD, defaults to today)
 */
router.get('/attendance/daily', async (req, res) => {
  try {
    const date = req.query.date || getTodayTL();
    // Timesheets use IDs like {empId}_{weekIso}, so filter by date range
    const snapshot = await tenantCol(req.tenantId, 'timesheets')
      .orderBy('date', 'desc')
      .limit(200)
      .get();

    const records = mapDocs(snapshot).filter((t) => {
      return t.date === date || (t.weekStartDate && t.weekStartDate <= date && t.weekEndDate >= date);
    });

    res.json({ success: true, count: records.length, date, records });
  } catch (error) {
    console.error('[attendance/daily]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
// INTERVIEWS
// ============================================================================

/**
 * GET /api/tenants/:tenantId/interviews
 * Query: status, limit
 */
router.get('/interviews', async (req, res) => {
  try {
    const { status, limit: limitStr } = req.query;
    const maxResults = Math.min(parseInt(limitStr) || 50, 200);

    let query = tenantCol(req.tenantId, 'interviews').orderBy('scheduledDate', 'desc');

    if (status) {
      query = query.where('status', '==', status);
    }

    query = query.limit(maxResults);
    const snapshot = await query.get();
    const interviews = mapDocs(snapshot);

    res.json({ success: true, count: interviews.length, interviews });
  } catch (error) {
    console.error('[interviews]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/tenants/:tenantId/interviews/today
 */
router.get('/interviews/today', async (req, res) => {
  try {
    const today = getTodayTL();
    const snapshot = await tenantCol(req.tenantId, 'interviews').get();
    const interviews = mapDocs(snapshot).filter((i) => {
      const date = (i.scheduledDate || i.date || '').split('T')[0];
      return date === today;
    });

    res.json({ success: true, count: interviews.length, date: today, interviews });
  } catch (error) {
    console.error('[interviews/today]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/tenants/:tenantId/interviews/upcoming
 * Returns interviews in the next 7 days
 */
router.get('/interviews/upcoming', async (req, res) => {
  try {
    const today = getTodayTL();
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 9 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const snapshot = await tenantCol(req.tenantId, 'interviews').get();
    const interviews = mapDocs(snapshot).filter((i) => {
      const date = (i.scheduledDate || i.date || '').split('T')[0];
      return date >= today && date <= nextWeek;
    });

    interviews.sort((a, b) => {
      const da = a.scheduledDate || a.date || '';
      const db = b.scheduledDate || b.date || '';
      return da.localeCompare(db);
    });

    res.json({ success: true, count: interviews.length, from: today, to: nextWeek, interviews });
  } catch (error) {
    console.error('[interviews/upcoming]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
// JOBS (Recruitment)
// ============================================================================

/**
 * GET /api/tenants/:tenantId/jobs
 * Query: status, limit
 */
router.get('/jobs', async (req, res) => {
  try {
    const { status, limit: limitStr } = req.query;
    const maxResults = Math.min(parseInt(limitStr) || 50, 200);

    let query = tenantCol(req.tenantId, 'jobs').orderBy('createdAt', 'desc');

    if (status) {
      query = query.where('status', '==', status);
    }

    query = query.limit(maxResults);
    const snapshot = await query.get();
    const jobs = mapDocs(snapshot);

    res.json({ success: true, count: jobs.length, jobs });
  } catch (error) {
    console.error('[jobs]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/tenants/:tenantId/jobs/open
 */
router.get('/jobs/open', async (req, res) => {
  try {
    const snapshot = await tenantCol(req.tenantId, 'jobs')
      .where('status', '==', 'open')
      .orderBy('createdAt', 'desc')
      .get();
    const jobs = mapDocs(snapshot);
    res.json({ success: true, count: jobs.length, jobs });
  } catch (error) {
    console.error('[jobs/open]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
// INVOICES
// ============================================================================

/**
 * GET /api/tenants/:tenantId/invoices
 * Query: status, customerId, limit
 */
router.get('/invoices', async (req, res) => {
  try {
    const { status, customerId, limit: limitStr } = req.query;
    const maxResults = Math.min(parseInt(limitStr) || 50, 200);

    let query = tenantCol(req.tenantId, 'invoices').orderBy('issueDate', 'desc');

    if (status) {
      query = query.where('status', '==', status);
    }
    if (customerId) {
      query = query.where('customerId', '==', customerId);
    }

    query = query.limit(maxResults);
    const snapshot = await query.get();
    const invoices = mapDocs(snapshot);

    res.json({ success: true, count: invoices.length, invoices });
  } catch (error) {
    console.error('[invoices]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/tenants/:tenantId/invoices/overdue
 */
router.get('/invoices/overdue', async (req, res) => {
  try {
    const today = getTodayTL();
    const snapshot = await tenantCol(req.tenantId, 'invoices')
      .where('status', 'in', ['sent', 'viewed', 'partial'])
      .get();

    const overdue = mapDocs(snapshot).filter((inv) => {
      return inv.dueDate && inv.dueDate < today;
    });

    const totalOverdue = overdue.reduce((sum, inv) => sum + (inv.balanceDue || inv.total || 0), 0);

    res.json({
      success: true,
      count: overdue.length,
      totalOverdue,
      date: today,
      invoices: overdue,
    });
  } catch (error) {
    console.error('[invoices/overdue]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
// BILLS (Accounts Payable)
// ============================================================================

/**
 * GET /api/tenants/:tenantId/bills
 * Query: status, vendorId, limit
 */
router.get('/bills', async (req, res) => {
  try {
    const { status, vendorId, limit: limitStr } = req.query;
    const maxResults = Math.min(parseInt(limitStr) || 50, 200);

    let query = tenantCol(req.tenantId, 'bills').orderBy('dueDate', 'desc');

    if (status) {
      query = query.where('status', '==', status);
    }
    if (vendorId) {
      query = query.where('vendorId', '==', vendorId);
    }

    query = query.limit(maxResults);
    const snapshot = await query.get();
    const bills = mapDocs(snapshot);

    res.json({ success: true, count: bills.length, bills });
  } catch (error) {
    console.error('[bills]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/tenants/:tenantId/bills/overdue
 */
router.get('/bills/overdue', async (req, res) => {
  try {
    const today = getTodayTL();
    const snapshot = await tenantCol(req.tenantId, 'bills')
      .where('status', 'in', ['pending', 'partial', 'approved'])
      .get();

    const overdue = mapDocs(snapshot).filter((bill) => {
      return bill.dueDate && bill.dueDate < today;
    });

    const totalOverdue = overdue.reduce((sum, b) => sum + (b.balanceDue || b.total || 0), 0);

    res.json({
      success: true,
      count: overdue.length,
      totalOverdue,
      date: today,
      bills: overdue,
    });
  } catch (error) {
    console.error('[bills/overdue]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
// EXPENSES
// ============================================================================

/**
 * GET /api/tenants/:tenantId/expenses
 * Query: category, from, to, limit
 */
router.get('/expenses', async (req, res) => {
  try {
    const { category, from, to, limit: limitStr } = req.query;
    const maxResults = Math.min(parseInt(limitStr) || 100, 500);

    let query = tenantCol(req.tenantId, 'expenses').orderBy('date', 'desc');

    if (category) {
      query = query.where('category', '==', category);
    }

    query = query.limit(maxResults);
    const snapshot = await query.get();
    let expenses = mapDocs(snapshot);

    // Client-side date filtering
    if (from) {
      expenses = expenses.filter((e) => (e.date || '') >= from);
    }
    if (to) {
      expenses = expenses.filter((e) => (e.date || '') <= to);
    }

    const total = expenses.reduce((sum, e) => sum + (e.amount || e.total || 0), 0);

    res.json({ success: true, count: expenses.length, total, expenses });
  } catch (error) {
    console.error('[expenses]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/tenants/:tenantId/expenses/this-month
 */
router.get('/expenses/this-month', async (req, res) => {
  try {
    const { start, end } = getCurrentMonthRange();
    const snapshot = await tenantCol(req.tenantId, 'expenses')
      .orderBy('date', 'desc')
      .get();

    const expenses = mapDocs(snapshot).filter((e) => {
      const d = e.date || '';
      return d >= start && d <= end;
    });

    const total = expenses.reduce((sum, e) => sum + (e.amount || e.total || 0), 0);

    // Group by category
    const byCategory = {};
    expenses.forEach((e) => {
      const cat = e.category || 'Uncategorized';
      if (!byCategory[cat]) byCategory[cat] = { count: 0, total: 0 };
      byCategory[cat].count++;
      byCategory[cat].total += e.amount || e.total || 0;
    });

    res.json({
      success: true,
      count: expenses.length,
      total,
      period: { start, end },
      byCategory,
      expenses,
    });
  } catch (error) {
    console.error('[expenses/this-month]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
// JOURNAL ENTRIES (Accounting)
// ============================================================================

/**
 * GET /api/tenants/:tenantId/journal-entries
 * Query: status, source, limit
 */
router.get('/journal-entries', async (req, res) => {
  try {
    const { status, source, limit: limitStr } = req.query;
    const maxResults = Math.min(parseInt(limitStr) || 50, 200);

    let query = tenantCol(req.tenantId, 'journalEntries').orderBy('date', 'desc');
    if (status) {
      query = query.where('status', '==', status);
    }
    if (source) {
      query = query.where('source', '==', source);
    }
    query = query.limit(maxResults);

    const snapshot = await query.get();
    const entries = mapDocs(snapshot);
    res.json(entries);
  } catch (error) {
    console.error('[journal-entries]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/tenants/:tenantId/journal-entries
 * Creates a journal entry and corresponding GL entries atomically.
 *
 * Body: { date, description, reference?, source?, sourceId?, lines: [{ accountId, accountCode?, accountName?, debit, credit, description? }], status?, createdBy? }
 * Lines must balance (sum of debits == sum of credits).
 * status: 'posted' (default, writes GL) or 'draft' (no GL entries until posted via PUT /journal-entries/:id/post)
 */
router.post('/journal-entries', async (req, res) => {
  try {
    const { date, description, reference, source, sourceId, lines, status: reqStatus, createdBy } = req.body;
    const entryStatus = reqStatus === 'draft' ? 'draft' : 'posted';

    // Validate required fields
    if (!date || !description) {
      return res.status(400).json({ success: false, message: 'date and description are required' });
    }
    if (!Array.isArray(lines) || lines.length < 2) {
      return res.status(400).json({ success: false, message: 'At least 2 journal lines are required' });
    }

    // Validate lines and compute totals
    let totalDebit = 0;
    let totalCredit = 0;
    for (const line of lines) {
      if (!line.accountId) {
        return res.status(400).json({ success: false, message: 'Each line must have an accountId' });
      }
      const debit = Number(line.debit) || 0;
      const credit = Number(line.credit) || 0;
      if (debit < 0 || credit < 0) {
        return res.status(400).json({ success: false, message: 'Line amounts cannot be negative' });
      }
      if ((debit > 0) === (credit > 0)) {
        return res.status(400).json({ success: false, message: 'Each line must have either a debit or a credit, not both' });
      }
      totalDebit += debit;
      totalCredit += credit;
    }

    // Verify balance
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return res.status(400).json({ success: false, message: `Entry does not balance: debit=${totalDebit}, credit=${totalCredit}` });
    }

    const entryDate = date.split('T')[0]; // YYYY-MM-DD
    const year = parseInt(entryDate.slice(0, 4), 10);
    const month = parseInt(entryDate.slice(5, 7), 10);
    const tid = req.tenantId;

    // Atomic transaction: generate entry number + write journal + write GL
    const result = await db.runTransaction(async (transaction) => {
      // --- Generate next entry number ---
      const settingsRef = db.doc(`tenants/${tid}/settings/accounting`);
      const settingsSnap = await transaction.get(settingsRef);

      let prefix = 'JE';
      let nextNum = 1;

      if (settingsSnap.exists) {
        const settings = settingsSnap.data() || {};
        prefix = settings.journalEntryPrefix || 'JE';
        const byYear = settings.nextJournalNumberByYear || {};
        const yearKey = String(year);

        if (typeof byYear[yearKey] === 'number' && byYear[yearKey] > 0) {
          nextNum = Math.floor(byYear[yearKey]);
        } else if (typeof settings.nextJournalNumber === 'number' && settings.nextJournalNumber > 0) {
          nextNum = Math.floor(settings.nextJournalNumber);
        }

        transaction.set(settingsRef, {
          journalEntryPrefix: prefix,
          nextJournalNumber: nextNum + 1,
          nextJournalNumberByYear: {
            ...byYear,
            [yearKey]: nextNum + 1,
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      } else {
        transaction.set(settingsRef, {
          journalEntryPrefix: 'JE',
          nextJournalNumber: 2,
          nextJournalNumberByYear: { [String(year)]: 2 },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      }

      const entryNumber = `${prefix}-${year}-${String(nextNum).padStart(4, '0')}`;

      // --- Write journal entry ---
      const journalRef = db.collection(`tenants/${tid}/journalEntries`).doc();

      const numberedLines = lines.map((line, idx) => ({
        lineNumber: idx + 1,
        accountId: line.accountId,
        accountCode: line.accountCode || '',
        accountName: line.accountName || '',
        debit: Number(line.debit) || 0,
        credit: Number(line.credit) || 0,
        description: line.description || '',
      }));

      const jeDoc = {
        entryNumber,
        date: entryDate,
        description,
        reference: reference || '',
        source: source || 'manual',
        sourceId: sourceId || null,
        sourceRef: reference || '',
        lines: numberedLines,
        totalDebit,
        totalCredit,
        status: entryStatus,
        fiscalYear: year,
        fiscalPeriod: month,
        createdBy: createdBy || source || 'api',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (entryStatus === 'posted') {
        jeDoc.postedAt = admin.firestore.FieldValue.serverTimestamp();
        jeDoc.postedBy = createdBy || 'api';
      }

      transaction.set(journalRef, jeDoc);

      // --- Write GL entries (only if posted) ---
      if (entryStatus === 'posted') {
        for (const line of numberedLines) {
          const glRef = db.collection(`tenants/${tid}/generalLedger`).doc();
          transaction.set(glRef, {
            accountId: line.accountId,
            accountCode: line.accountCode,
            accountName: line.accountName,
            journalEntryId: journalRef.id,
            entryNumber,
            entryDate,
            description: line.description || description,
            debit: line.debit,
            credit: line.credit,
            balance: 0, // Calculated on retrieval
            fiscalYear: year,
            fiscalPeriod: month,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      }

      return { id: journalRef.id, entryNumber, status: entryStatus };
    });

    console.log(`[journal-entries] Created ${result.entryNumber} (${result.status}) for tenant ${tid} (source: ${source || 'manual'})`);
    res.status(201).json({ success: true, id: result.id, entryNumber: result.entryNumber, status: result.status });
  } catch (error) {
    console.error('[journal-entries] POST error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/tenants/:tenantId/accounts
 * Returns chart of accounts
 */
router.get('/accounts', async (req, res) => {
  try {
    const snapshot = await tenantCol(req.tenantId, 'accounts').orderBy('code', 'asc').get();
    const accounts = mapDocs(snapshot);
    res.json(accounts);
  } catch (error) {
    console.error('[accounts]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/tenants/:tenantId/trial-balance
 * Computes trial balance from GL entries
 */
router.get('/trial-balance', async (req, res) => {
  try {
    const asOfDate = req.query.asOf || getTodayTL();
    const balances = {};

    // Try snapshot+delta; fallback to full scan
    const bSnapshot = await findLatestSnapshotBefore(req.tenantId, asOfDate);

    if (bSnapshot) {
      // Seed from snapshot
      for (const entry of (bSnapshot.accounts || [])) {
        balances[entry.accountId] = {
          accountId: entry.accountId,
          accountCode: entry.accountCode || '',
          accountName: entry.accountName || '',
          accountType: entry.accountType || '',
          debit: entry.cumulativeDebit || 0,
          credit: entry.cumulativeCredit || 0,
        };
      }
      // Add delta entries after snapshot
      const delta = await queryGLDelta(req.tenantId, bSnapshot.periodEndDate, asOfDate);
      for (const d of delta) {
        const key = d.accountId || d.accountCode;
        if (!balances[key]) {
          balances[key] = { accountId: d.accountId || '', accountCode: d.accountCode || '', accountName: d.accountName || '', accountType: '', debit: 0, credit: 0 };
        }
        balances[key].debit += d.debit || 0;
        balances[key].credit += d.credit || 0;
      }
    } else {
      // Fallback: full GL scan
      const glSnap = await tenantCol(req.tenantId, 'generalLedger').get();
      glSnap.docs.forEach((doc) => {
        const d = doc.data();
        if (d.entryDate > asOfDate) return;
        const key = d.accountId || d.accountCode;
        if (!balances[key]) {
          balances[key] = { accountId: d.accountId || '', accountCode: d.accountCode || '', accountName: d.accountName || '', accountType: '', debit: 0, credit: 0 };
        }
        balances[key].debit += d.debit || 0;
        balances[key].credit += d.credit || 0;
      });
    }

    // Enrich with account type from chart of accounts
    const accountsSnap = await tenantCol(req.tenantId, 'accounts').get();
    const accountMap = {};
    accountsSnap.docs.forEach((doc) => {
      const a = doc.data();
      accountMap[doc.id] = a;
      if (a.code) accountMap[a.code] = a;
    });

    const rows = Object.values(balances).map((row) => {
      const acct = accountMap[row.accountId] || accountMap[row.accountCode] || {};
      return {
        ...row,
        accountType: row.accountType || acct.type || acct.subType || '',
        accountName: row.accountName || acct.name || '',
      };
    });

    rows.sort((a, b) => (a.accountCode || '').localeCompare(b.accountCode || ''));
    res.json(rows);
  } catch (error) {
    console.error('[trial-balance]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/tenants/:tenantId/journals
 * Alias for journal-entries (used by Rezerva frontend)
 */
router.get('/journals', async (req, res) => {
  try {
    const { limit: limitStr } = req.query;
    const maxResults = Math.min(parseInt(limitStr) || 50, 200);
    const snapshot = await tenantCol(req.tenantId, 'journalEntries')
      .orderBy('date', 'desc')
      .limit(maxResults)
      .get();
    const entries = mapDocs(snapshot);
    res.json(entries);
  } catch (error) {
    console.error('[journals]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
// REPORTS (P&L, Balance Sheet)
// ============================================================================

/**
 * GET /api/tenants/:tenantId/reports/pnl
 * Query: start (YYYY-MM-DD), end (YYYY-MM-DD)
 * Defaults to current month if no dates provided.
 * Returns PnLReport matching the Rezerva frontend schema.
 */
router.get('/reports/pnl', async (req, res) => {
  try {
    const { start, end } = req.query;
    const { start: defaultStart, end: defaultEnd } = getCurrentMonthRange();
    const periodStart = start || defaultStart;
    const periodEnd = end || defaultEnd;

    // Fetch accounts for type lookup
    const accountsSnap = await tenantCol(req.tenantId, 'accounts').get();
    const accountMap = {};
    accountsSnap.docs.forEach((doc) => {
      const a = doc.data();
      accountMap[doc.id] = { ...a, id: doc.id };
      if (a.code) accountMap[a.code] = { ...a, id: doc.id };
    });

    // Try snapshot+delta; fallback to full scan
    const bSnapshot = await findLatestSnapshotBefore(req.tenantId, periodStart);

    const accountTotals = {};

    if (bSnapshot) {
      // Query only delta from snapshot end to periodEnd, then filter to [periodStart, periodEnd]
      const delta = await queryGLDelta(req.tenantId, bSnapshot.periodEndDate, periodEnd);
      for (const entry of delta) {
        const d = entry.entryDate || '';
        if (d < periodStart) continue;
        const key = entry.accountId || entry.accountCode;
        if (!accountTotals[key]) {
          accountTotals[key] = { debit: 0, credit: 0 };
        }
        accountTotals[key].debit += entry.debit || 0;
        accountTotals[key].credit += entry.credit || 0;
      }
    } else {
      // Fallback: full GL scan
      const glSnap = await tenantCol(req.tenantId, 'generalLedger').get();
      for (const doc of glSnap.docs) {
        const entry = doc.data();
        const d = entry.entryDate || entry.date || '';
        const dateStr = typeof d === 'string' ? d.split('T')[0] : '';
        if (dateStr < periodStart || dateStr > periodEnd) continue;
        const key = entry.accountId || entry.accountCode;
        if (!accountTotals[key]) {
          accountTotals[key] = { debit: 0, credit: 0 };
        }
        accountTotals[key].debit += entry.debit || 0;
        accountTotals[key].credit += entry.credit || 0;
      }
    }

    // Build P&L lines
    const revenueLines = [];
    const expenseLines = [];

    for (const [key, totals] of Object.entries(accountTotals)) {
      const acct = accountMap[key] || {};
      const type = (acct.type || acct.subType || '').toLowerCase();

      if (type === 'revenue') {
        // Revenue: credit - debit (natural credit balance)
        const amount = totals.credit - totals.debit;
        revenueLines.push({
          accountCode: acct.code || key,
          accountName: acct.name || totals.accountName || key,
          amount,
        });
      } else if (type === 'expense') {
        // Expense: debit - credit (natural debit balance)
        const amount = totals.debit - totals.credit;
        expenseLines.push({
          accountCode: acct.code || key,
          accountName: acct.name || totals.accountName || key,
          amount,
        });
      }
    }

    // Sort by account code
    revenueLines.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
    expenseLines.sort((a, b) => a.accountCode.localeCompare(b.accountCode));

    const revenueTotal = revenueLines.reduce((sum, l) => sum + l.amount, 0);
    const expenseTotal = expenseLines.reduce((sum, l) => sum + l.amount, 0);

    res.json({
      periodStart,
      periodEnd,
      revenue: { total: revenueTotal, lines: revenueLines },
      expenses: { total: expenseTotal, lines: expenseLines },
      netProfit: revenueTotal - expenseTotal,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[reports/pnl]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/tenants/:tenantId/reports/balance-sheet
 * Query: asOf (YYYY-MM-DD, defaults to today)
 * Returns BalanceSheet matching the Rezerva frontend schema.
 */
router.get('/reports/balance-sheet', async (req, res) => {
  try {
    const asOf = req.query.asOf || getTodayTL();

    // Fetch accounts for type lookup
    const accountsSnap = await tenantCol(req.tenantId, 'accounts').get();
    const accountMap = {};
    accountsSnap.docs.forEach((doc) => {
      const a = doc.data();
      accountMap[doc.id] = { ...a, id: doc.id };
      if (a.code) accountMap[a.code] = { ...a, id: doc.id };
    });

    // Try snapshot+delta; fallback to full scan
    const bSnapshot = await findLatestSnapshotBefore(req.tenantId, asOf);

    const accountTotals = {};

    if (bSnapshot) {
      // Seed from snapshot cumulative balances
      for (const entry of (bSnapshot.accounts || [])) {
        accountTotals[entry.accountId] = {
          debit: entry.cumulativeDebit || 0,
          credit: entry.cumulativeCredit || 0,
        };
      }
      // Add delta entries after snapshot through asOf
      const delta = await queryGLDelta(req.tenantId, bSnapshot.periodEndDate, asOf);
      for (const entry of delta) {
        const key = entry.accountId || entry.accountCode;
        if (!accountTotals[key]) {
          accountTotals[key] = { debit: 0, credit: 0 };
        }
        accountTotals[key].debit += entry.debit || 0;
        accountTotals[key].credit += entry.credit || 0;
      }
    } else {
      // Fallback: full GL scan
      const glSnap = await tenantCol(req.tenantId, 'generalLedger').get();
      for (const doc of glSnap.docs) {
        const entry = doc.data();
        const d = entry.entryDate || entry.date || '';
        const dateStr = typeof d === 'string' ? d.split('T')[0] : '';
        if (dateStr > asOf) continue;
        const key = entry.accountId || entry.accountCode;
        if (!accountTotals[key]) {
          accountTotals[key] = { debit: 0, credit: 0 };
        }
        accountTotals[key].debit += entry.debit || 0;
        accountTotals[key].credit += entry.credit || 0;
      }
    }

    // Build balance sheet sections
    const assetLines = [];
    const liabilityLines = [];
    const equityLines = [];
    let retainedEarnings = 0; // revenue - expenses rolled into equity

    for (const [key, totals] of Object.entries(accountTotals)) {
      const acct = accountMap[key] || {};
      const type = (acct.type || acct.subType || '').toLowerCase();
      const line = {
        accountCode: acct.code || key,
        accountName: acct.name || key,
      };

      if (type === 'asset') {
        // Assets: natural debit balance
        assetLines.push({ ...line, amount: totals.debit - totals.credit });
      } else if (type === 'liability') {
        // Liabilities: natural credit balance
        liabilityLines.push({ ...line, amount: totals.credit - totals.debit });
      } else if (type === 'equity') {
        // Equity: natural credit balance
        equityLines.push({ ...line, amount: totals.credit - totals.debit });
      } else if (type === 'revenue') {
        // Revenue rolls into retained earnings (credit balance)
        retainedEarnings += totals.credit - totals.debit;
      } else if (type === 'expense') {
        // Expenses reduce retained earnings (debit balance)
        retainedEarnings -= totals.debit - totals.credit;
      }
    }

    // Add retained earnings to equity if non-zero
    if (Math.abs(retainedEarnings) > 0.01) {
      equityLines.push({
        accountCode: 'RE',
        accountName: 'Retained Earnings (Current Period)',
        amount: retainedEarnings,
      });
    }

    // Sort by account code
    assetLines.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
    liabilityLines.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
    equityLines.sort((a, b) => a.accountCode.localeCompare(b.accountCode));

    const assetTotal = assetLines.reduce((sum, l) => sum + l.amount, 0);
    const liabilityTotal = liabilityLines.reduce((sum, l) => sum + l.amount, 0);
    const equityTotal = equityLines.reduce((sum, l) => sum + l.amount, 0);

    res.json({
      asOf,
      assets: { total: assetTotal, lines: assetLines },
      liabilities: { total: liabilityTotal, lines: liabilityLines },
      equity: { total: equityTotal, lines: equityLines },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[reports/balance-sheet]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
// COMPANY STATS (Aggregated Overview)
// ============================================================================

/**
 * GET /api/tenants/:tenantId/stats
 * Returns a company-wide overview combining employee, payroll, leave, and financial data
 */
router.get('/stats', async (req, res) => {
  try {
    const today = getTodayTL();
    const currentYYYYMM = getCurrentYYYYMM();
    const { start: monthStart, end: monthEnd } = getCurrentMonthRange();

    // Run queries in parallel
    const [
      employeesSnap,
      pendingLeaveSnap,
      onLeaveSnap,
      overdueInvoicesSnap,
      overdueBillsSnap,
      expensesSnap,
      interviewsSnap,
      openJobsSnap,
    ] = await Promise.all([
      tenantCol(req.tenantId, 'employees').get(),
      tenantCol(req.tenantId, 'leaveRequests').where('status', '==', 'pending').get(),
      tenantCol(req.tenantId, 'leaveRequests').where('status', '==', 'approved').get(),
      tenantCol(req.tenantId, 'invoices').where('status', 'in', ['sent', 'viewed', 'partial']).get(),
      tenantCol(req.tenantId, 'bills').where('status', 'in', ['pending', 'partial', 'approved']).get(),
      tenantCol(req.tenantId, 'expenses').get(),
      tenantCol(req.tenantId, 'interviews').get(),
      tenantCol(req.tenantId, 'jobs').where('status', '==', 'open').get(),
    ]);

    // Employee counts
    const empCounts = { total: 0, active: 0, inactive: 0, terminated: 0, probation: 0 };
    employeesSnap.docs.forEach((doc) => {
      empCounts.total++;
      const status = doc.data().status || 'active';
      if (empCounts[status] !== undefined) empCounts[status]++;
    });

    // Leave stats
    const pendingLeave = pendingLeaveSnap.size;
    const onLeaveToday = [];
    onLeaveSnap.docs.forEach((doc) => {
      const data = doc.data();
      if (today >= (data.startDate || '') && today <= (data.endDate || '')) {
        onLeaveToday.push({
          employeeName: data.employeeName || '',
          leaveType: data.leaveType,
        });
      }
    });

    // Overdue invoices
    const overdueInvoices = [];
    let totalOverdueAR = 0;
    overdueInvoicesSnap.docs.forEach((doc) => {
      const data = doc.data();
      if (data.dueDate && data.dueDate < today) {
        overdueInvoices.push(doc.id);
        totalOverdueAR += data.balanceDue || data.total || 0;
      }
    });

    // Overdue bills
    const overdueBills = [];
    let totalOverdueAP = 0;
    overdueBillsSnap.docs.forEach((doc) => {
      const data = doc.data();
      if (data.dueDate && data.dueDate < today) {
        overdueBills.push(doc.id);
        totalOverdueAP += data.balanceDue || data.total || 0;
      }
    });

    // This month expenses
    let monthlyExpenses = 0;
    expensesSnap.docs.forEach((doc) => {
      const data = doc.data();
      const d = data.date || '';
      if (d >= monthStart && d <= monthEnd) {
        monthlyExpenses += data.amount || data.total || 0;
      }
    });

    // Interviews today
    const todayInterviews = [];
    interviewsSnap.docs.forEach((doc) => {
      const data = doc.data();
      const date = (data.scheduledDate || data.date || '').split('T')[0];
      if (date === today) {
        todayInterviews.push({
          candidateName: data.candidateName || '',
          position: data.position || data.jobTitle || '',
          time: data.scheduledTime || data.time || '',
        });
      }
    });

    // Fetch latest payroll run
    let latestPayroll = null;
    try {
      const payrollSnap = await tenantCol(req.tenantId, 'payruns')
        .orderBy('periodStart', 'desc')
        .limit(1)
        .get();
      if (!payrollSnap.empty) {
        latestPayroll = mapDoc(payrollSnap.docs[0]);
      }
    } catch (_) {
      // Payroll data may not exist yet
    }

    const stats = {
      date: today,
      employees: empCounts,
      leave: {
        pendingRequests: pendingLeave,
        onLeaveToday: onLeaveToday.length,
        onLeaveDetails: onLeaveToday,
      },
      recruitment: {
        openJobs: openJobsSnap.size,
        interviewsToday: todayInterviews.length,
        interviewDetails: todayInterviews,
      },
      finance: {
        overdueInvoices: overdueInvoices.length,
        totalOverdueAR: totalOverdueAR,
        overdueBills: overdueBills.length,
        totalOverdueAP: totalOverdueAP,
        monthlyExpenses,
      },
      payroll: latestPayroll
        ? {
            period: latestPayroll.id,
            status: latestPayroll.status,
            totalNetPay: latestPayroll.totalNetPay || 0,
            employeeCount: latestPayroll.employeeCount || 0,
          }
        : null,
    };

    res.json({ success: true, stats, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('[stats]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
// WRITE ENDPOINTS (Agentic Accounting — Phase 1)
// ============================================================================

/**
 * Helper: Write an audit log entry
 */
async function writeAuditLog(tenantId, {
  userId = 'bot',
  userEmail = 'bot',
  action,
  module,
  description,
  entityId = null,
  entityType = null,
  metadata = {},
  severity = 'info',
}) {
  try {
    await tenantCol(tenantId, 'auditLogs').add({
      userId,
      userEmail,
      action,
      module,
      description,
      entityId,
      entityType,
      metadata,
      severity,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      tenantId,
    });
  } catch (err) {
    console.error(`[audit] Failed to write audit log: ${err.message}`);
  }
}

/**
 * Helper: Assert a fiscal period is open for posting
 * Returns the period doc or null (if no fiscal period tracking)
 */
async function assertPeriodOpen(tenantId, year, month) {
  const periodsSnap = await tenantCol(tenantId, 'fiscalPeriods')
    .where('year', '==', year)
    .where('period', '==', month)
    .limit(1)
    .get();

  if (periodsSnap.empty) {
    return null; // No fiscal period tracking — allow posting
  }

  const period = periodsSnap.docs[0].data();
  if (period.status === 'closed') {
    throw new Error(`Fiscal period ${year}-${String(month).padStart(2, '0')} is closed`);
  }
  if (period.status === 'locked') {
    throw new Error(`Fiscal period ${year}-${String(month).padStart(2, '0')} is locked`);
  }
  return { id: periodsSnap.docs[0].id, ...period };
}

// ── PAYROLL ENDPOINTS ──────────────────────────────────────────────────────

/**
 * POST /api/tenants/:tenantId/payroll/calculate
 * Dry-run payroll calculation. Does NOT write to Firestore.
 * Fetches active employees and calculates TL payroll (WIT, INSS).
 * Body: { periodStart, periodEnd, payDate, payFrequency? }
 */
router.post('/payroll/calculate', async (req, res) => {
  try {
    const { periodStart, periodEnd, payDate, payFrequency = 'monthly' } = req.body;
    const tid = req.tenantId;

    if (!periodStart || !periodEnd || !payDate) {
      return res.status(400).json({ success: false, message: 'periodStart, periodEnd, and payDate are required' });
    }

    // Fetch active employees
    const empSnap = await tenantCol(tid, 'employees')
      .where('status', '==', 'active')
      .get();

    if (empSnap.empty) {
      return res.status(400).json({ success: false, message: 'No active employees found' });
    }

    // Fetch recurring deductions
    const deductionsSnap = await tenantCol(tid, 'recurringDeductions')
      .where('status', '==', 'active')
      .get();
    const recurringByEmployee = {};
    deductionsSnap.docs.forEach((doc) => {
      const d = doc.data();
      if (!recurringByEmployee[d.employeeId]) recurringByEmployee[d.employeeId] = [];
      recurringByEmployee[d.employeeId].push({ id: doc.id, ...d });
    });

    const records = [];
    const warnings = [];
    let totalGross = 0, totalNet = 0, totalWIT = 0;
    let totalINSSEmployee = 0, totalINSSEmployer = 0;

    empSnap.docs.forEach((doc) => {
      const emp = doc.data();
      const empId = doc.id;
      const name = `${emp.personalInfo?.firstName || ''} ${emp.personalInfo?.lastName || ''}`.trim();
      const salary = Number(emp.jobDetails?.salary || emp.compensationDetails?.baseSalary || 0);

      if (salary <= 0) {
        warnings.push(`${name}: No salary configured — skipped`);
        return;
      }

      // Gross pay (base salary for the period)
      let grossPay = salary;
      if (payFrequency === 'weekly') grossPay = Math.round(salary / 4.33 * 100) / 100;
      else if (payFrequency === 'biweekly') grossPay = Math.round(salary / 2.17 * 100) / 100;

      // WIT (Withholding Income Tax)
      const isResident = emp.personalInfo?.isResident !== false;
      let witAmount;
      if (isResident) {
        // Residents: 10% on monthly income above $500
        const monthlyEquiv = salary;
        const witMonthly = monthlyEquiv > 500 ? (monthlyEquiv - 500) * 0.10 : 0;
        if (payFrequency === 'weekly') witAmount = Math.round(witMonthly / 4.33 * 100) / 100;
        else if (payFrequency === 'biweekly') witAmount = Math.round(witMonthly / 2.17 * 100) / 100;
        else witAmount = Math.round(witMonthly * 100) / 100;
      } else {
        witAmount = Math.round(grossPay * 0.10 * 100) / 100;
      }

      // INSS (base salary only, excludes overtime/bonuses/allowances)
      const inssBase = grossPay;
      const inssEmployee = Math.round(inssBase * 0.04 * 100) / 100;
      const inssEmployer = Math.round(inssBase * 0.06 * 100) / 100;

      // Recurring deductions
      let otherDeductions = 0;
      const deductionLines = [];
      (recurringByEmployee[empId] || []).forEach((d) => {
        const amt = d.isPercentage ? Math.round(grossPay * (d.percentage / 100) * 100) / 100 : d.amount;
        otherDeductions += amt;
        deductionLines.push({ type: d.type, description: d.description, amount: amt });
      });

      const totalDeductions = witAmount + inssEmployee + otherDeductions;
      const netPay = Math.round((grossPay - totalDeductions) * 100) / 100;

      if (netPay < 0) {
        warnings.push(`${name}: Net pay is negative ($${netPay}) — check deductions`);
      }

      totalGross += grossPay;
      totalNet += netPay;
      totalWIT += witAmount;
      totalINSSEmployee += inssEmployee;
      totalINSSEmployer += inssEmployer;

      records.push({
        employeeId: empId,
        employeeName: name,
        employeeNumber: emp.employeeId || '',
        department: emp.jobDetails?.departmentName || emp.jobDetails?.department || '',
        position: emp.jobDetails?.positionTitle || emp.jobDetails?.position || '',
        monthlySalary: salary,
        grossPay,
        witAmount,
        inssEmployee,
        inssEmployer,
        otherDeductions,
        deductionLines,
        totalDeductions,
        netPay,
        isResident,
      });
    });

    res.json({
      success: true,
      summary: {
        employeeCount: records.length,
        totalGross: Math.round(totalGross * 100) / 100,
        totalNet: Math.round(totalNet * 100) / 100,
        totalWIT: Math.round(totalWIT * 100) / 100,
        totalINSSEmployee: Math.round(totalINSSEmployee * 100) / 100,
        totalINSSEmployer: Math.round(totalINSSEmployer * 100) / 100,
        periodStart,
        periodEnd,
        payDate,
        payFrequency,
      },
      records,
      warnings,
    });
  } catch (error) {
    console.error('[payroll/calculate]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/tenants/:tenantId/payroll/runs
 * Creates a payroll run + records in Firestore (batched writes).
 * Body: { payrollRun: {...}, records: [...], createdBy? }
 */
router.post('/payroll/runs', async (req, res) => {
  try {
    const { payrollRun, records, createdBy = 'bot' } = req.body;
    const tid = req.tenantId;

    if (!payrollRun || !records?.length) {
      return res.status(400).json({ success: false, message: 'payrollRun and records[] are required' });
    }
    if (!payrollRun.periodStart || !payrollRun.periodEnd || !payrollRun.payDate) {
      return res.status(400).json({ success: false, message: 'payrollRun must include periodStart, periodEnd, payDate' });
    }

    // Check fiscal period is open
    const payDate = payrollRun.payDate.split('T')[0];
    const year = parseInt(payDate.slice(0, 4), 10);
    const month = parseInt(payDate.slice(5, 7), 10);
    await assertPeriodOpen(tid, year, month);

    // Batch write: run + records
    const BATCH_LIMIT = 499;
    const runRef = tenantCol(tid, 'payrollRuns').doc();
    let batch = db.batch();
    let batchCount = 0;

    // Write the run doc first
    const targetStatus = payrollRun.status || 'draft';
    batch.set(runRef, {
      ...payrollRun,
      status: records.length > BATCH_LIMIT ? 'writing_records' : targetStatus,
      expectedRecordCount: records.length,
      createdBy,
      tenantId: tid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    batchCount++;

    const recordIds = [];
    for (const record of records) {
      if (batchCount >= BATCH_LIMIT) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
      const recRef = tenantCol(tid, 'payrollRecords').doc();
      batch.set(recRef, {
        ...record,
        payrollRunId: runRef.id,
        tenantId: tid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      recordIds.push(recRef.id);
      batchCount++;
    }

    if (batchCount > 0) await batch.commit();

    // Finalize run status if it was 'writing_records'
    if (records.length > BATCH_LIMIT) {
      await runRef.update({
        status: targetStatus,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // Audit log
    await writeAuditLog(tid, {
      userId: createdBy,
      userEmail: createdBy,
      action: 'payroll.run',
      module: 'payroll',
      description: `Created payroll run for ${payrollRun.periodStart} to ${payrollRun.periodEnd} (${records.length} employees)`,
      entityId: runRef.id,
      entityType: 'payroll_run',
      metadata: {
        employeeCount: records.length,
        totalGross: payrollRun.totalGrossPay,
        totalNet: payrollRun.totalNetPay,
        periodStart: payrollRun.periodStart,
        periodEnd: payrollRun.periodEnd,
      },
      severity: 'info',
    });

    console.log(`[payroll/runs] Created run ${runRef.id} for tenant ${tid} (${records.length} records)`);
    res.status(201).json({ success: true, runId: runRef.id, recordIds, status: targetStatus });
  } catch (error) {
    console.error('[payroll/runs]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /api/tenants/:tenantId/payroll/runs/:runId/approve
 * Body: { approvedBy }
 * Guards: Two-person rule (approver ≠ creator), status must be draft/processing
 */
router.put('/payroll/runs/:runId/approve', async (req, res) => {
  try {
    const { runId } = req.params;
    const { approvedBy } = req.body;
    const tid = req.tenantId;

    if (!approvedBy) {
      return res.status(400).json({ success: false, message: 'approvedBy is required' });
    }

    const runRef = tenantCol(tid, 'payrollRuns').doc(runId);
    const runSnap = await runRef.get();
    if (!runSnap.exists) {
      return res.status(404).json({ success: false, message: 'Payroll run not found' });
    }

    const run = runSnap.data();
    if (!['draft', 'processing'].includes(run.status)) {
      return res.status(400).json({ success: false, message: `Cannot approve run with status '${run.status}'` });
    }

    // Two-person rule
    if (run.createdBy && run.createdBy === approvedBy) {
      return res.status(400).json({ success: false, message: 'Approver must be different from creator (two-person rule)' });
    }

    await runRef.update({
      status: 'approved',
      approvedBy,
      approvedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await writeAuditLog(tid, {
      userId: approvedBy,
      userEmail: approvedBy,
      action: 'payroll.approve',
      module: 'payroll',
      description: `Approved payroll run ${runId}`,
      entityId: runId,
      entityType: 'payroll_run',
      severity: 'critical',
    });

    res.json({ success: true, message: 'Payroll run approved' });
  } catch (error) {
    console.error('[payroll/approve]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /api/tenants/:tenantId/payroll/runs/:runId/reject
 * Body: { rejectedBy, reason }
 */
router.put('/payroll/runs/:runId/reject', async (req, res) => {
  try {
    const { runId } = req.params;
    const { rejectedBy, reason } = req.body;
    const tid = req.tenantId;

    if (!rejectedBy || !reason) {
      return res.status(400).json({ success: false, message: 'rejectedBy and reason are required' });
    }

    const runRef = tenantCol(tid, 'payrollRuns').doc(runId);
    const runSnap = await runRef.get();
    if (!runSnap.exists) {
      return res.status(404).json({ success: false, message: 'Payroll run not found' });
    }

    const run = runSnap.data();
    if (!['draft', 'processing'].includes(run.status)) {
      return res.status(400).json({ success: false, message: `Cannot reject run with status '${run.status}'` });
    }

    await runRef.update({
      status: 'rejected',
      rejectedBy,
      rejectedAt: admin.firestore.FieldValue.serverTimestamp(),
      rejectionReason: reason,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await writeAuditLog(tid, {
      userId: rejectedBy,
      userEmail: rejectedBy,
      action: 'payroll.reject',
      module: 'payroll',
      description: `Rejected payroll run ${runId}: ${reason}`,
      entityId: runId,
      entityType: 'payroll_run',
      metadata: { reason },
      severity: 'warning',
    });

    res.json({ success: true, message: 'Payroll run rejected' });
  } catch (error) {
    console.error('[payroll/reject]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /api/tenants/:tenantId/payroll/runs/:runId/mark-paid
 * Guards: Status must be approved
 */
router.put('/payroll/runs/:runId/mark-paid', async (req, res) => {
  try {
    const { runId } = req.params;
    const { paidBy = 'bot' } = req.body;
    const tid = req.tenantId;

    const runRef = tenantCol(tid, 'payrollRuns').doc(runId);
    const runSnap = await runRef.get();
    if (!runSnap.exists) {
      return res.status(404).json({ success: false, message: 'Payroll run not found' });
    }

    const run = runSnap.data();
    if (run.status !== 'approved') {
      return res.status(400).json({ success: false, message: `Cannot mark-paid: status is '${run.status}' (must be approved)` });
    }

    await runRef.update({
      status: 'paid',
      paidAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await writeAuditLog(tid, {
      userId: paidBy,
      userEmail: paidBy,
      action: 'payroll.mark_paid',
      module: 'payroll',
      description: `Marked payroll run ${runId} as paid`,
      entityId: runId,
      entityType: 'payroll_run',
      severity: 'info',
    });

    res.json({ success: true, message: 'Payroll run marked as paid' });
  } catch (error) {
    console.error('[payroll/mark-paid]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/tenants/:tenantId/payroll/runs/:runId/repair
 * Repairs a stuck payroll run (status: writing_records).
 * Checks actual record count vs expected, finalizes or deletes.
 */
router.post('/payroll/runs/:runId/repair', async (req, res) => {
  try {
    const { runId } = req.params;
    const tid = req.tenantId;

    const runRef = tenantCol(tid, 'payrollRuns').doc(runId);
    const runSnap = await runRef.get();
    if (!runSnap.exists) {
      return res.status(404).json({ success: false, message: 'Payroll run not found' });
    }

    const run = runSnap.data();
    if (run.status !== 'writing_records') {
      return res.status(400).json({ success: false, message: `Run status is '${run.status}', not 'writing_records'. No repair needed.` });
    }

    // Count actual records written
    const recordsSnap = await tenantCol(tid, 'payrollRecords')
      .where('payrollRunId', '==', runId)
      .get();
    const actualCount = recordsSnap.size;
    const expectedCount = run.expectedRecordCount || 0;

    if (actualCount === 0) {
      // No records written — delete the run
      await runRef.delete();
      await writeAuditLog(tid, {
        action: 'payroll.repair',
        module: 'payroll',
        description: `Deleted empty payroll run ${runId} (0/${expectedCount} records written)`,
        entityId: runId,
        entityType: 'payroll_run',
        severity: 'warning',
      });
      return res.json({ success: true, result: 'deleted', message: `Deleted empty run (0/${expectedCount} records)` });
    }

    // Some records exist — finalize to draft
    await runRef.update({
      status: 'draft',
      employeeCount: actualCount,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await writeAuditLog(tid, {
      action: 'payroll.repair',
      module: 'payroll',
      description: `Repaired payroll run ${runId} (${actualCount}/${expectedCount} records, finalized to draft)`,
      entityId: runId,
      entityType: 'payroll_run',
      severity: 'warning',
    });

    res.json({ success: true, result: 'repaired', message: `Repaired: ${actualCount}/${expectedCount} records, status → draft` });
  } catch (error) {
    console.error('[payroll/repair]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── JOURNAL ENTRY WRITE ENDPOINTS ──────────────────────────────────────────

/**
 * PUT /api/tenants/:tenantId/journal-entries/:id/post
 * Posts a draft journal entry (creates GL entries).
 * Body: { postedBy }
 */
router.put('/journal-entries/:id/post', async (req, res) => {
  try {
    const { id } = req.params;
    const { postedBy = 'bot' } = req.body;
    const tid = req.tenantId;

    // Check fiscal period before transaction
    const jeDoc = await db.doc(`tenants/${tid}/journalEntries/${id}`).get();
    if (!jeDoc.exists) {
      return res.status(404).json({ success: false, message: 'Journal entry not found' });
    }
    const jeData = jeDoc.data();
    const entryDate = jeData.date.split('T')[0];
    const year = parseInt(entryDate.slice(0, 4), 10);
    const month = parseInt(entryDate.slice(5, 7), 10);
    await assertPeriodOpen(tid, year, month);

    const result = await db.runTransaction(async (transaction) => {
      const jeRef = db.doc(`tenants/${tid}/journalEntries/${id}`);
      const jeSnap = await transaction.get(jeRef);
      const je = jeSnap.data();

      if (je.status !== 'draft') {
        throw new Error(`Cannot post: status is '${je.status}' (must be draft)`);
      }

      transaction.update(jeRef, {
        status: 'posted',
        postedBy,
        postedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Create GL entries
      const lines = je.lines || [];
      for (const line of lines) {
        const glRef = db.collection(`tenants/${tid}/generalLedger`).doc();
        transaction.set(glRef, {
          accountId: line.accountId,
          accountCode: line.accountCode || '',
          accountName: line.accountName || '',
          journalEntryId: id,
          entryNumber: je.entryNumber,
          entryDate,
          description: line.description || je.description,
          debit: line.debit || 0,
          credit: line.credit || 0,
          balance: 0,
          fiscalYear: year,
          fiscalPeriod: month,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      // Audit inside transaction
      const auditRef = db.collection(`tenants/${tid}/auditLogs`).doc(`acct_${id}_post`);
      transaction.set(auditRef, {
        userId: postedBy,
        userEmail: postedBy,
        action: 'accounting.journal_post',
        module: 'accounting',
        description: `Posted journal entry ${je.entryNumber}`,
        entityId: id,
        entityType: 'journal_entry',
        severity: 'info',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        tenantId: tid,
      });

      return { entryNumber: je.entryNumber };
    });

    res.json({ success: true, message: `Journal entry ${result.entryNumber} posted`, entryNumber: result.entryNumber });
  } catch (error) {
    console.error('[journal-entries/post]', error);
    const status = error.message.includes('not found') ? 404 : error.message.includes('Cannot post') ? 400 : 500;
    res.status(status).json({ success: false, message: error.message });
  }
});

/**
 * PUT /api/tenants/:tenantId/journal-entries/:id/void
 * Voids a posted journal entry (creates reversing GL entries).
 * Body: { voidedBy, reason }
 */
router.put('/journal-entries/:id/void', async (req, res) => {
  try {
    const { id } = req.params;
    const { voidedBy = 'bot', reason } = req.body;
    const tid = req.tenantId;

    if (!reason) {
      return res.status(400).json({ success: false, message: 'reason is required to void a journal entry' });
    }

    // Check fiscal period before transaction
    const jeDoc = await db.doc(`tenants/${tid}/journalEntries/${id}`).get();
    if (!jeDoc.exists) {
      return res.status(404).json({ success: false, message: 'Journal entry not found' });
    }
    const jeData = jeDoc.data();
    const entryDate = jeData.date.split('T')[0];
    const year = parseInt(entryDate.slice(0, 4), 10);
    const month = parseInt(entryDate.slice(5, 7), 10);
    await assertPeriodOpen(tid, year, month);

    const result = await db.runTransaction(async (transaction) => {
      const jeRef = db.doc(`tenants/${tid}/journalEntries/${id}`);
      const jeSnap = await transaction.get(jeRef);
      const je = jeSnap.data();

      if (je.status !== 'posted') {
        throw new Error(`Cannot void: status is '${je.status}' (must be posted)`);
      }

      // Update JE status to void
      transaction.update(jeRef, {
        status: 'void',
        voidedBy,
        voidedAt: admin.firestore.FieldValue.serverTimestamp(),
        voidReason: reason,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Create REVERSING GL entries (swap debit/credit)
      const lines = je.lines || [];
      for (const line of lines) {
        const glRef = db.collection(`tenants/${tid}/generalLedger`).doc();
        transaction.set(glRef, {
          accountId: line.accountId,
          accountCode: line.accountCode || '',
          accountName: line.accountName || '',
          journalEntryId: id,
          entryNumber: je.entryNumber,
          entryDate,
          description: `VOID: ${line.description || je.description} — ${reason}`,
          debit: line.credit || 0,   // Swap!
          credit: line.debit || 0,   // Swap!
          balance: 0,
          fiscalYear: year,
          fiscalPeriod: month,
          isReversing: true,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      // Audit
      const auditRef = db.collection(`tenants/${tid}/auditLogs`).doc(`acct_${id}_void`);
      transaction.set(auditRef, {
        userId: voidedBy,
        userEmail: voidedBy,
        action: 'accounting.journal_void',
        module: 'accounting',
        description: `Voided journal entry ${je.entryNumber}: ${reason}`,
        entityId: id,
        entityType: 'journal_entry',
        metadata: { reason },
        severity: 'critical',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        tenantId: tid,
      });

      return { entryNumber: je.entryNumber };
    });

    res.json({ success: true, message: `Journal entry ${result.entryNumber} voided`, entryNumber: result.entryNumber });
  } catch (error) {
    console.error('[journal-entries/void]', error);
    const status = error.message.includes('not found') ? 404 : error.message.includes('Cannot void') ? 400 : 500;
    res.status(status).json({ success: false, message: error.message });
  }
});

// ── FISCAL PERIOD ENDPOINTS ────────────────────────────────────────────────

/**
 * POST /api/tenants/:tenantId/fiscal-years
 * Creates a fiscal year + 12 monthly periods.
 * Body: { year, createdBy? }
 */
router.post('/fiscal-years', async (req, res) => {
  try {
    const { year, createdBy = 'bot' } = req.body;
    const tid = req.tenantId;

    if (!year || year < 2000 || year > 2100) {
      return res.status(400).json({ success: false, message: 'Valid year (2000-2100) is required' });
    }

    // Check if fiscal year already exists
    const existingSnap = await tenantCol(tid, 'fiscalYears')
      .where('year', '==', year)
      .limit(1)
      .get();
    if (!existingSnap.empty) {
      return res.status(400).json({ success: false, message: `Fiscal year ${year} already exists` });
    }

    const batch = db.batch();

    // Create fiscal year
    const yearRef = tenantCol(tid, 'fiscalYears').doc();
    batch.set(yearRef, {
      year,
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
      status: 'open',
      openingBalancesPosted: false,
      createdBy,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Create 12 monthly periods
    const periodIds = [];
    for (let month = 1; month <= 12; month++) {
      const lastDay = new Date(year, month, 0).getDate();
      const periodRef = tenantCol(tid, 'fiscalPeriods').doc();
      batch.set(periodRef, {
        fiscalYearId: yearRef.id,
        year,
        period: month,
        startDate: `${year}-${String(month).padStart(2, '0')}-01`,
        endDate: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
        status: 'open',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      periodIds.push(periodRef.id);
    }

    await batch.commit();

    await writeAuditLog(tid, {
      userId: createdBy,
      userEmail: createdBy,
      action: 'accounting.period_create_year',
      module: 'accounting',
      description: `Created fiscal year ${year} with 12 periods`,
      entityId: yearRef.id,
      entityType: 'fiscal_year',
      severity: 'info',
    });

    res.status(201).json({ success: true, fiscalYearId: yearRef.id, periodIds, year });
  } catch (error) {
    console.error('[fiscal-years]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /api/tenants/:tenantId/fiscal-periods/:id/close
 * Body: { closedBy }
 */
router.put('/fiscal-periods/:id/close', async (req, res) => {
  try {
    const { id } = req.params;
    const { closedBy = 'bot' } = req.body;
    const tid = req.tenantId;

    const ref = tenantCol(tid, 'fiscalPeriods').doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).json({ success: false, message: 'Fiscal period not found' });
    }

    const period = snap.data();
    if (period.status !== 'open') {
      return res.status(400).json({ success: false, message: `Cannot close: status is '${period.status}' (must be open)` });
    }

    await ref.update({
      status: 'closed',
      closedBy,
      closedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await writeAuditLog(tid, {
      userId: closedBy,
      userEmail: closedBy,
      action: 'accounting.period_close',
      module: 'accounting',
      description: `Closed fiscal period ${period.year}-${String(period.period).padStart(2, '0')}`,
      entityId: id,
      entityType: 'fiscal_period',
      severity: 'warning',
    });

    res.json({ success: true, message: `Period ${period.year}-${String(period.period).padStart(2, '0')} closed` });
  } catch (error) {
    console.error('[fiscal-periods/close]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /api/tenants/:tenantId/fiscal-periods/:id/reopen
 * Body: { reopenedBy }
 * Guards: Cannot reopen locked periods
 */
router.put('/fiscal-periods/:id/reopen', async (req, res) => {
  try {
    const { id } = req.params;
    const { reopenedBy = 'bot' } = req.body;
    const tid = req.tenantId;

    const ref = tenantCol(tid, 'fiscalPeriods').doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).json({ success: false, message: 'Fiscal period not found' });
    }

    const period = snap.data();
    if (period.status === 'locked') {
      return res.status(400).json({ success: false, message: 'Cannot reopen a locked period' });
    }
    if (period.status === 'open') {
      return res.json({ success: true, message: 'Period is already open' });
    }

    await ref.update({
      status: 'open',
      closedBy: admin.firestore.FieldValue.delete(),
      closedAt: admin.firestore.FieldValue.delete(),
    });

    await writeAuditLog(tid, {
      userId: reopenedBy,
      userEmail: reopenedBy,
      action: 'accounting.period_reopen',
      module: 'accounting',
      description: `Reopened fiscal period ${period.year}-${String(period.period).padStart(2, '0')}`,
      entityId: id,
      entityType: 'fiscal_period',
      severity: 'warning',
    });

    res.json({ success: true, message: `Period ${period.year}-${String(period.period).padStart(2, '0')} reopened` });
  } catch (error) {
    console.error('[fiscal-periods/reopen]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /api/tenants/:tenantId/fiscal-periods/:id/lock
 * Body: { lockedBy }
 * Guards: Must be closed first (not open)
 */
router.put('/fiscal-periods/:id/lock', async (req, res) => {
  try {
    const { id } = req.params;
    const { lockedBy = 'bot' } = req.body;
    const tid = req.tenantId;

    const ref = tenantCol(tid, 'fiscalPeriods').doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).json({ success: false, message: 'Fiscal period not found' });
    }

    const period = snap.data();
    if (period.status === 'locked') {
      return res.json({ success: true, message: 'Period is already locked' });
    }
    if (period.status === 'open') {
      return res.status(400).json({ success: false, message: 'Cannot lock an open period — close it first' });
    }

    await ref.update({
      status: 'locked',
      lockedBy,
      lockedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await writeAuditLog(tid, {
      userId: lockedBy,
      userEmail: lockedBy,
      action: 'accounting.period_lock',
      module: 'accounting',
      description: `Locked fiscal period ${period.year}-${String(period.period).padStart(2, '0')}`,
      entityId: id,
      entityType: 'fiscal_period',
      severity: 'critical',
    });

    res.json({ success: true, message: `Period ${period.year}-${String(period.period).padStart(2, '0')} locked` });
  } catch (error) {
    console.error('[fiscal-periods/lock]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/tenants/:tenantId/fiscal-years/:yearId/opening-balances
 * Posts opening balance journal entry for a fiscal year.
 * Body: { lines: [{ accountId, accountCode, accountName, debit, credit }], createdBy? }
 */
router.post('/fiscal-years/:yearId/opening-balances', async (req, res) => {
  try {
    const { yearId } = req.params;
    const { lines, createdBy = 'bot' } = req.body;
    const tid = req.tenantId;

    if (!Array.isArray(lines) || lines.length < 1) {
      return res.status(400).json({ success: false, message: 'At least 1 line is required' });
    }

    // Validate balance
    let totalDebit = 0, totalCredit = 0;
    for (const line of lines) {
      totalDebit += Number(line.debit) || 0;
      totalCredit += Number(line.credit) || 0;
    }
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return res.status(400).json({ success: false, message: `Opening balances do not balance: debit=${totalDebit.toFixed(2)}, credit=${totalCredit.toFixed(2)}` });
    }

    // Check fiscal year exists
    const yearRef = tenantCol(tid, 'fiscalYears').doc(yearId);
    const yearSnap = await yearRef.get();
    if (!yearSnap.exists) {
      return res.status(404).json({ success: false, message: 'Fiscal year not found' });
    }
    const fy = yearSnap.data();
    if (fy.openingBalancesPosted) {
      return res.status(400).json({ success: false, message: 'Opening balances already posted for this fiscal year' });
    }

    const fyYear = fy.year;

    // Create opening balance JE + GL atomically
    const result = await db.runTransaction(async (transaction) => {
      // Generate entry number
      const settingsRef = db.doc(`tenants/${tid}/settings/accounting`);
      const settingsSnap = await transaction.get(settingsRef);
      let prefix = 'JE', nextNum = 1;
      if (settingsSnap.exists) {
        const s = settingsSnap.data() || {};
        prefix = s.journalEntryPrefix || 'JE';
        const byYear = s.nextJournalNumberByYear || {};
        nextNum = byYear[String(fyYear)] || s.nextJournalNumber || 1;
        transaction.set(settingsRef, {
          nextJournalNumber: nextNum + 1,
          nextJournalNumberByYear: { ...byYear, [String(fyYear)]: nextNum + 1 },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      } else {
        transaction.set(settingsRef, {
          journalEntryPrefix: 'JE',
          nextJournalNumber: 2,
          nextJournalNumberByYear: { [String(fyYear)]: 2 },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      }

      const entryNumber = `${prefix}-${fyYear}-${String(nextNum).padStart(4, '0')}`;

      // JE doc
      const jeRef = db.collection(`tenants/${tid}/journalEntries`).doc();
      const numberedLines = lines.map((l, idx) => ({
        lineNumber: idx + 1,
        accountId: l.accountId,
        accountCode: l.accountCode || '',
        accountName: l.accountName || '',
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
        description: l.description || 'Opening balance',
      }));

      transaction.set(jeRef, {
        entryNumber,
        date: `${fyYear}-01-01`,
        description: `Opening balances for fiscal year ${fyYear}`,
        reference: '',
        source: 'opening',
        sourceId: yearId,
        lines: numberedLines,
        totalDebit,
        totalCredit,
        status: 'posted',
        postedAt: admin.firestore.FieldValue.serverTimestamp(),
        postedBy: createdBy,
        fiscalYear: fyYear,
        fiscalPeriod: 1,
        createdBy,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // GL entries
      for (const line of numberedLines) {
        const glRef = db.collection(`tenants/${tid}/generalLedger`).doc();
        transaction.set(glRef, {
          accountId: line.accountId,
          accountCode: line.accountCode,
          accountName: line.accountName,
          journalEntryId: jeRef.id,
          entryNumber,
          entryDate: `${fyYear}-01-01`,
          description: line.description || `Opening balance ${fyYear}`,
          debit: line.debit,
          credit: line.credit,
          balance: 0,
          fiscalYear: fyYear,
          fiscalPeriod: 1,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      // Mark fiscal year as having opening balances
      transaction.update(yearRef, {
        openingBalancesPosted: true,
        openingBalanceEntryId: jeRef.id,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { entryId: jeRef.id, entryNumber };
    });

    await writeAuditLog(tid, {
      userId: createdBy,
      userEmail: createdBy,
      action: 'accounting.opening_balances_posted',
      module: 'accounting',
      description: `Posted opening balances for fiscal year ${fyYear} (${lines.length} accounts)`,
      entityId: result.entryId,
      entityType: 'journal_entry',
      metadata: { fiscalYearId: yearId, year: fyYear, accountCount: lines.length, totalDebit, totalCredit },
      severity: 'info',
    });

    res.status(201).json({ success: true, journalEntryId: result.entryId, entryNumber: result.entryNumber });
  } catch (error) {
    console.error('[fiscal-years/opening-balances]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── LEAVE MANAGEMENT ENDPOINTS ─────────────────────────────────────────────

/**
 * PUT /api/tenants/:tenantId/leave/requests/:id/approve
 * Body: { approvedBy, approverName? }
 */
router.put('/leave/requests/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { approvedBy, approverName = '' } = req.body;
    const tid = req.tenantId;

    if (!approvedBy) {
      return res.status(400).json({ success: false, message: 'approvedBy is required' });
    }

    const ref = tenantCol(tid, 'leave_requests').doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).json({ success: false, message: 'Leave request not found' });
    }

    const request = snap.data();
    if (request.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Cannot approve: status is '${request.status}'` });
    }

    await ref.update({
      status: 'approved',
      approverId: approvedBy,
      approverName: approverName || approvedBy,
      approvedDate: getTodayTL(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await writeAuditLog(tid, {
      userId: approvedBy,
      userEmail: approvedBy,
      action: 'leave.approve',
      module: 'leave',
      description: `Approved leave request for ${request.employeeName || id} (${request.leaveType}, ${request.startDate} to ${request.endDate})`,
      entityId: id,
      entityType: 'leave_request',
      severity: 'info',
    });

    res.json({ success: true, message: 'Leave request approved' });
  } catch (error) {
    console.error('[leave/approve]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /api/tenants/:tenantId/leave/requests/:id/reject
 * Body: { rejectedBy, reason }
 */
router.put('/leave/requests/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectedBy, reason } = req.body;
    const tid = req.tenantId;

    if (!rejectedBy || !reason) {
      return res.status(400).json({ success: false, message: 'rejectedBy and reason are required' });
    }

    const ref = tenantCol(tid, 'leave_requests').doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).json({ success: false, message: 'Leave request not found' });
    }

    const request = snap.data();
    if (request.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Cannot reject: status is '${request.status}'` });
    }

    await ref.update({
      status: 'rejected',
      approverId: rejectedBy,
      approverName: rejectedBy,
      rejectionReason: reason,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await writeAuditLog(tid, {
      userId: rejectedBy,
      userEmail: rejectedBy,
      action: 'leave.reject',
      module: 'leave',
      description: `Rejected leave request for ${request.employeeName || id}: ${reason}`,
      entityId: id,
      entityType: 'leave_request',
      metadata: { reason },
      severity: 'info',
    });

    res.json({ success: true, message: 'Leave request rejected' });
  } catch (error) {
    console.error('[leave/reject]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── VERIFICATION ENDPOINTS (Phase 3) ──────────────────────────────────────

/**
 * GET /api/tenants/:tenantId/verify/payroll/:runId
 * Verifies a payroll run: checks record count, totals, tax math.
 */
router.get('/verify/payroll/:runId', async (req, res) => {
  try {
    const { runId } = req.params;
    const tid = req.tenantId;

    const runSnap = await tenantCol(tid, 'payrollRuns').doc(runId).get();
    if (!runSnap.exists) {
      return res.status(404).json({ success: false, message: 'Payroll run not found' });
    }
    const run = runSnap.data();

    // Fetch records
    const recordsSnap = await tenantCol(tid, 'payrollRecords')
      .where('payrollRunId', '==', runId)
      .get();

    const issues = [];
    let sumGross = 0, sumNet = 0, sumWIT = 0, sumINSSEmp = 0;

    // Check record count
    if (recordsSnap.size !== (run.employeeCount || run.expectedRecordCount || 0)) {
      issues.push({
        severity: 'error',
        field: 'employeeCount',
        message: `Record count mismatch: run says ${run.employeeCount || run.expectedRecordCount}, found ${recordsSnap.size}`,
      });
    }

    recordsSnap.docs.forEach((doc) => {
      const r = doc.data();
      const empLabel = r.employeeName || doc.id;

      // Sum totals
      sumGross += r.totalGrossPay || r.grossPay || 0;
      sumNet += r.netPay || 0;

      // Check individual record math
      const gross = r.totalGrossPay || r.grossPay || 0;
      const net = r.netPay || 0;
      const totalDed = r.totalDeductions || 0;

      // Net should equal gross - deductions
      if (Math.abs(gross - totalDed - net) > 0.02) {
        issues.push({
          severity: 'error',
          field: 'netPay',
          employee: empLabel,
          message: `${empLabel}: net ($${net}) ≠ gross ($${gross}) - deductions ($${totalDed}) [diff: $${(gross - totalDed - net).toFixed(2)}]`,
        });
      }

      // Check for negative net pay
      if (net < 0) {
        issues.push({
          severity: 'warning',
          field: 'netPay',
          employee: empLabel,
          message: `${empLabel}: negative net pay ($${net})`,
        });
      }

      // Verify WIT
      const deductions = r.deductions || [];
      const witDed = deductions.find(d => d.type === 'income_tax');
      if (witDed) {
        sumWIT += witDed.amount;
        if (witDed.amount > gross * 0.101) {
          issues.push({
            severity: 'warning',
            field: 'WIT',
            employee: empLabel,
            message: `${empLabel}: WIT ($${witDed.amount.toFixed(2)}) seems high (>${(gross * 0.10).toFixed(2)})`,
          });
        }
      }

      const inssDed = deductions.find(d => d.type === 'inss_employee');
      if (inssDed) sumINSSEmp += inssDed.amount;
    });

    // Check run-level totals
    if (run.totalGrossPay && Math.abs(run.totalGrossPay - sumGross) > 0.02) {
      issues.push({
        severity: 'error',
        field: 'totalGrossPay',
        message: `Total gross mismatch: run header says $${run.totalGrossPay}, records sum to $${sumGross.toFixed(2)}`,
      });
    }
    if (run.totalNetPay && Math.abs(run.totalNetPay - sumNet) > 0.02) {
      issues.push({
        severity: 'error',
        field: 'totalNetPay',
        message: `Total net mismatch: run header says $${run.totalNetPay}, records sum to $${sumNet.toFixed(2)}`,
      });
    }

    const passed = issues.filter(i => i.severity === 'error').length === 0;
    res.json({
      success: true,
      passed,
      runId,
      status: run.status,
      recordCount: recordsSnap.size,
      totals: {
        gross: Math.round(sumGross * 100) / 100,
        net: Math.round(sumNet * 100) / 100,
        wit: Math.round(sumWIT * 100) / 100,
        inssEmployee: Math.round(sumINSSEmp * 100) / 100,
      },
      issues,
    });
  } catch (error) {
    console.error('[verify/payroll]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/tenants/:tenantId/verify/trial-balance
 * Verifies that the trial balance balances (total debits == total credits).
 * Query: ?year=2026&period=3 (optional filters)
 */
router.get('/verify/trial-balance', async (req, res) => {
  try {
    const tid = req.tenantId;
    const { year, period } = req.query;

    let totalDebit = 0, totalCredit = 0;
    const accountBalances = {};
    let glEntryCount = 0;

    // When no filters, use snapshot+delta for scalability
    if (!year && !period) {
      const asOfDate = getTodayTL();
      const bSnapshot = await findLatestSnapshotBefore(tid, asOfDate);

      if (bSnapshot) {
        for (const entry of (bSnapshot.accounts || [])) {
          totalDebit += entry.cumulativeDebit || 0;
          totalCredit += entry.cumulativeCredit || 0;
          const key = entry.accountCode || entry.accountId;
          accountBalances[key] = { accountCode: entry.accountCode, accountName: entry.accountName, debit: entry.cumulativeDebit || 0, credit: entry.cumulativeCredit || 0 };
        }
        const delta = await queryGLDelta(tid, bSnapshot.periodEndDate, asOfDate);
        glEntryCount = (bSnapshot.accounts || []).length + delta.length;
        for (const d of delta) {
          totalDebit += d.debit || 0;
          totalCredit += d.credit || 0;
          const key = d.accountCode || d.accountId;
          if (!accountBalances[key]) {
            accountBalances[key] = { accountCode: d.accountCode, accountName: d.accountName, debit: 0, credit: 0 };
          }
          accountBalances[key].debit += d.debit || 0;
          accountBalances[key].credit += d.credit || 0;
        }
      } else {
        const glSnap = await tenantCol(tid, 'generalLedger').get();
        glEntryCount = glSnap.size;
        glSnap.docs.forEach((doc) => {
          const d = doc.data();
          totalDebit += d.debit || 0;
          totalCredit += d.credit || 0;
          const key = d.accountCode || d.accountId;
          if (!accountBalances[key]) {
            accountBalances[key] = { accountCode: d.accountCode, accountName: d.accountName, debit: 0, credit: 0 };
          }
          accountBalances[key].debit += d.debit || 0;
          accountBalances[key].credit += d.credit || 0;
        });
      }
    } else {
      // Filtered by year/period — use Firestore where clauses
      let query = tenantCol(tid, 'generalLedger');
      if (year) query = query.where('fiscalYear', '==', parseInt(year));
      if (period) query = query.where('fiscalPeriod', '==', parseInt(period));

      const glSnap = await query.get();
      glEntryCount = glSnap.size;
      glSnap.docs.forEach((doc) => {
        const d = doc.data();
        totalDebit += d.debit || 0;
        totalCredit += d.credit || 0;
        const key = d.accountCode || d.accountId;
        if (!accountBalances[key]) {
          accountBalances[key] = { accountCode: d.accountCode, accountName: d.accountName, debit: 0, credit: 0 };
        }
        accountBalances[key].debit += d.debit || 0;
        accountBalances[key].credit += d.credit || 0;
      });
    }

    const diff = Math.abs(totalDebit - totalCredit);
    const balanced = diff < 0.01;

    const issues = [];
    if (!balanced) {
      issues.push({
        severity: 'error',
        message: `Trial balance does not balance: debits=$${totalDebit.toFixed(2)}, credits=$${totalCredit.toFixed(2)}, diff=$${diff.toFixed(2)}`,
      });
    }

    res.json({
      success: true,
      passed: balanced,
      totalDebit: Math.round(totalDebit * 100) / 100,
      totalCredit: Math.round(totalCredit * 100) / 100,
      difference: Math.round(diff * 100) / 100,
      accountCount: Object.keys(accountBalances).length,
      glEntryCount,
      issues,
    });
  } catch (error) {
    console.error('[verify/trial-balance]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/tenants/:tenantId/verify/compliance
 * Checks various compliance rules: missing tax IDs, salary below minimum, etc.
 */
router.get('/verify/compliance', async (req, res) => {
  try {
    const tid = req.tenantId;
    const issues = [];

    // Fetch active employees
    const empSnap = await tenantCol(tid, 'employees')
      .where('status', '==', 'active')
      .get();

    const TL_MINIMUM_WAGE = 115; // $115 USD

    empSnap.docs.forEach((doc) => {
      const emp = doc.data();
      const name = `${emp.personalInfo?.firstName || ''} ${emp.personalInfo?.lastName || ''}`.trim() || doc.id;
      const salary = Number(emp.jobDetails?.salary || emp.compensationDetails?.baseSalary || 0);

      // Check salary
      if (salary <= 0) {
        issues.push({ severity: 'error', category: 'salary', employee: name, message: `${name}: No salary configured` });
      } else if (salary < TL_MINIMUM_WAGE) {
        issues.push({ severity: 'warning', category: 'salary', employee: name, message: `${name}: Salary $${salary} is below minimum wage ($${TL_MINIMUM_WAGE})` });
      }

      // Check tax ID (TIN)
      if (!emp.personalInfo?.taxId && !emp.personalInfo?.tin) {
        issues.push({ severity: 'warning', category: 'tax', employee: name, message: `${name}: No tax ID / TIN on file` });
      }

      // Check INSS number
      if (!emp.personalInfo?.inssNumber && !emp.personalInfo?.socialSecurityNumber) {
        issues.push({ severity: 'warning', category: 'inss', employee: name, message: `${name}: No INSS number on file` });
      }

      // Check bank details
      if (!emp.bankDetails?.accountNumber && !emp.paymentInfo?.bankAccount) {
        issues.push({ severity: 'info', category: 'payment', employee: name, message: `${name}: No bank account on file (will need cash payment)` });
      }
    });

    // Check for fiscal year
    const currentYear = getCurrentYear();
    const fySnap = await tenantCol(tid, 'fiscalYears')
      .where('year', '==', currentYear)
      .limit(1)
      .get();
    if (fySnap.empty) {
      issues.push({ severity: 'warning', category: 'fiscal', message: `No fiscal year set up for ${currentYear}` });
    }

    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;

    res.json({
      success: true,
      passed: errorCount === 0,
      summary: {
        employees: empSnap.size,
        errors: errorCount,
        warnings: warningCount,
        info: issues.filter(i => i.severity === 'info').length,
      },
      issues,
    });
  } catch (error) {
    console.error('[verify/compliance]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
// OpenClaw Chat Relay
// ============================================================================

async function openClawChat(message, sessionKey) {
  const url = `${OPENCLAW_HTTP_URL}/v1/chat/completions`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENCLAW_PASSWORD}`,
        'x-openclaw-agent-id': 'main',
        'x-openclaw-session-key': sessionKey || 'main',
      },
      body: JSON.stringify({
        model: 'openclaw:main',
        messages: [{ role: 'user', content: message }],
        stream: false,
        user: sessionKey || 'webchat',
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Gateway HTTP ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = await res.json();
    const choice = data.choices?.[0];
    const reply = choice?.message?.content || '(No response)';

    return { reply, toolNames: [] };
  } finally {
    clearTimeout(timeout);
  }
}

// System prompt prefix for in-app chat
function buildChatSystemPrefix(user, options = {}) {
  const userName = user.name || user.email || 'a staff member';
  const tenantId = options.tenantId || 'unknown';
  const allowWrites = !!options.allowWrites;

  return `[SYSTEM — IN-APP CHAT CONTEXT]
This is the Meza HR/Payroll management app (in-app chat widget), NOT WhatsApp.
User: ${userName}${user.name && user.email ? ` (${user.email})` : ''}.
Current tenantId: ${tenantId}. Operate only on this tenant.
WRITE_CONFIRMATION_STATE: ${allowWrites ? 'confirmed' : 'not-confirmed'}.

CAPABILITIES:
- You can read all HR data: employees, departments, payroll, leave, attendance, interviews, jobs, invoices, bills, expenses.
- Keep responses concise — this is a small chat panel.

WRITE SAFETY:
- If WRITE_CONFIRMATION_STATE is "not-confirmed", do NOT call write tools. Read-only responses only.
- If WRITE_CONFIRMATION_STATE is "confirmed", execute only the explicitly confirmed action.

PERSONALITY:
- This app is for companies in Timor-Leste. Occasionally mix in Tetun words: Bondia (good morning), Botarde (good afternoon), Obrigadu/a (thank you), Diak (good/OK), Bele (can/sure), Maun/Mana (brother/sister).
- Use them sparingly.

RESTRICTIONS:
- Never delete data in bulk. Single-item changes only.
[END SYSTEM CONTEXT]

User message: `;
}

// Pending chat action helpers (write confirmation for Phase 2)
const PENDING_CHAT_TTL_MS = 10 * 60 * 1000;

function pendingActionDocRef(tenantId, userId, sessionKey) {
  const docId = `${userId}__${sessionKey || 'default'}`;
  return db.doc(`tenants/${tenantId}/chat_pending/${docId}`);
}

async function getPendingChatAction(tenantId, userId, sessionKey) {
  const ref = pendingActionDocRef(tenantId, userId, sessionKey);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const data = snap.data() || {};
  const expiresAt = data.expiresAt?.toDate ? data.expiresAt.toDate() : data.expiresAt ? new Date(data.expiresAt) : null;
  if (expiresAt && expiresAt.getTime() < Date.now()) {
    await ref.delete().catch(() => {});
    return null;
  }
  return { message: typeof data.message === 'string' ? data.message : '' };
}

async function setPendingChatAction(tenantId, userId, sessionKey, message, intent) {
  const ref = pendingActionDocRef(tenantId, userId, sessionKey);
  await ref.set({
    message,
    intent: intent || 'write',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + PENDING_CHAT_TTL_MS)),
  }, { merge: true });
}

async function clearPendingChatAction(tenantId, userId, sessionKey) {
  const ref = pendingActionDocRef(tenantId, userId, sessionKey);
  await ref.delete().catch(() => {});
}

// POST /api/tenants/:tenantId/chat — AI chat relay to OpenClaw gateway
app.post('/api/tenants/:tenantId/chat', chatLimiter, authenticateFirebaseToken, async (req, res) => {
  const requestId = genId();
  const { tenantId } = req.params;

  // Tenant scoping
  if (ALLOWED_TENANT_ID) {
    const allowed = ALLOWED_TENANT_ID.split(',').map(s => s.trim());
    if (!allowed.includes(tenantId)) {
      return res.status(403).json({ success: false, message: 'Access denied for this tenant', requestId });
    }
  }

  if (!OPENCLAW_PASSWORD) {
    return res.status(503).json({ success: false, message: 'Chat unavailable — gateway not configured', requestId });
  }

  if (!firebaseInitialized) {
    return res.status(503).json({ success: false, message: 'Firebase not initialized', requestId });
  }

  req.setTimeout(120000);

  try {
    const { message, sessionKey } = req.body || {};

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ success: false, message: 'message field is required', requestId });
    }

    const trimmedMessage = message.slice(0, 2000).trim();
    if (!trimmedMessage) {
      return res.status(400).json({ success: false, message: 'message cannot be empty', requestId });
    }

    const safeSessionKey = sanitizeSessionKey(sessionKey || 'default');
    const intent = classifyChatIntent(trimmedMessage);
    let effectiveMessage = trimmedMessage;
    let allowWrites = false;

    // Clear stale pending action on any non-confirm/cancel message
    if (!isConfirmMessage(trimmedMessage) && !isCancelMessage(trimmedMessage)) {
      await clearPendingChatAction(tenantId, req.user.uid, safeSessionKey);
    }

    if (intent === 'cancel') {
      await clearPendingChatAction(tenantId, req.user.uid, safeSessionKey);
      return res.json({
        success: true,
        reply: 'Cancelled. I will not make any data changes.',
        actions: [],
        requestId,
      });
    }

    if (intent === 'confirm') {
      const pending = await getPendingChatAction(tenantId, req.user.uid, safeSessionKey);
      if (!pending || !pending.message) {
        return res.json({
          success: true,
          reply: 'I do not have any pending change to confirm right now.',
          actions: [],
          requestId,
        });
      }
      allowWrites = true;
      effectiveMessage = pending.message;
      await clearPendingChatAction(tenantId, req.user.uid, safeSessionKey);
    } else if (intent === 'write') {
      // Write intent detected — save pending action and ask for confirmation
      await setPendingChatAction(tenantId, req.user.uid, safeSessionKey, trimmedMessage, intent);
      return res.json({
        success: true,
        reply: `I understand you want to: "${trimmedMessage}"\n\nThis will modify data. Please reply **"yes"** or **"confirm"** to proceed, or **"cancel"** to abort.`,
        actions: [],
        requestId,
      });
    }

    const systemPrefix = buildChatSystemPrefix(req.user, { tenantId, allowWrites });
    const prefixedMessage = systemPrefix + effectiveMessage;
    const chatSessionKey = `agent:main:${tenantId}:webchat-${req.user.uid}:${safeSessionKey}`;

    const result = await openClawChat(prefixedMessage, chatSessionKey);
    const { reply, toolNames } = result;
    const actions = detectActions(toolNames, reply);
    const warnings = [];

    if (actions.length > 0) {
      console.log(`[${requestId}] Chat actions detected:`, actions.join(', '));
    }

    // Audit log
    try {
      await db.collection(`tenants/${tenantId}/chat_audit`).add({
        requestId,
        userId: req.user.uid,
        userEmail: req.user.email,
        message: trimmedMessage,
        effectiveMessage,
        intent,
        allowWrites,
        replyLength: reply.length,
        sessionKey: safeSessionKey,
        chatSessionKey,
        actions,
        toolNames: (toolNames || []).slice(0, 50),
        warnings,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (auditErr) {
      console.error(`[${requestId}] Chat audit log failed:`, auditErr.message);
    }

    res.json({
      success: true,
      reply,
      actions,
      requestId,
      warnings,
    });
  } catch (error) {
    console.error(`[${requestId}] Chat error:`, error.message);
    res.status(502).json({
      success: false,
      message: error.message || 'Failed to communicate with AI gateway',
      requestId,
    });
  }
});

// ============================================================================
// Humanize tool names for step display
// ============================================================================

function humanizeToolName(toolName) {
  const map = {
    get_employees: 'Fetching employees',
    get_employee_details: 'Loading employee details',
    search_employees: 'Searching employees',
    get_departments: 'Loading departments',
    get_payroll_runs: 'Fetching payroll runs',
    get_payroll_records: 'Loading payroll records',
    calculate_payroll: 'Calculating payroll',
    run_payroll: 'Running payroll',
    approve_payroll: 'Approving payroll run',
    reject_payroll: 'Rejecting payroll run',
    mark_payroll_paid: 'Marking payroll as paid',
    repair_payroll_run: 'Repairing payroll run',
    get_journal_entries: 'Fetching journal entries',
    create_journal_entry: 'Creating journal entry',
    post_journal_entry: 'Posting journal entry',
    void_journal_entry: 'Voiding journal entry',
    get_general_ledger: 'Loading general ledger',
    get_trial_balance: 'Generating trial balance',
    get_income_statement: 'Generating income statement',
    get_balance_sheet: 'Generating balance sheet',
    get_chart_of_accounts: 'Loading chart of accounts',
    create_fiscal_year: 'Creating fiscal year',
    close_fiscal_period: 'Closing fiscal period',
    reopen_fiscal_period: 'Reopening fiscal period',
    lock_fiscal_period: 'Locking fiscal period',
    post_opening_balances: 'Posting opening balances',
    get_leave_requests: 'Fetching leave requests',
    approve_leave: 'Approving leave request',
    reject_leave: 'Rejecting leave request',
    verify_payroll: 'Verifying payroll',
    verify_trial_balance: 'Verifying trial balance',
    check_compliance: 'Checking compliance',
    get_attendance: 'Loading attendance records',
    get_invoices: 'Fetching invoices',
    get_bills: 'Fetching bills',
    get_expenses: 'Loading expenses',
    get_settings: 'Loading settings',
  };
  if (map[toolName]) return map[toolName];
  // Fallback: convert snake_case to Title Case with "..."
  return toolName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) + '...';
}

// ============================================================================
// POST /api/tenants/:tenantId/chat-stream — SSE streaming chat relay
// ============================================================================

app.post('/api/tenants/:tenantId/chat-stream', chatLimiter, authenticateFirebaseToken, async (req, res) => {
  const requestId = genId();
  const { tenantId } = req.params;

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const sendEvent = (data) => {
    if (!res.writableEnded) res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Tenant check
  if (ALLOWED_TENANT_ID) {
    const allowed = ALLOWED_TENANT_ID.split(',').map(s => s.trim());
    if (!allowed.includes(tenantId)) {
      sendEvent({ type: 'error', content: 'Access denied for this tenant' });
      return res.end();
    }
  }

  if (!OPENCLAW_PASSWORD) {
    sendEvent({ type: 'error', content: 'Chat unavailable — gateway not configured' });
    return res.end();
  }

  if (!firebaseInitialized) {
    sendEvent({ type: 'error', content: 'Firebase not initialized' });
    return res.end();
  }

  req.setTimeout(120000);

  // Handle client disconnect
  req.on('close', () => {
    if (!res.writableEnded) res.end();
  });

  try {
    const { message, sessionKey } = req.body || {};
    if (!message || typeof message !== 'string') {
      sendEvent({ type: 'error', content: 'message field is required' });
      return res.end();
    }

    const trimmedMessage = message.slice(0, 2000).trim();
    if (!trimmedMessage) {
      sendEvent({ type: 'error', content: 'message cannot be empty' });
      return res.end();
    }

    const safeSessionKey = sanitizeSessionKey(sessionKey || 'default');

    // Step 1: Understanding request
    sendEvent({ type: 'status', content: 'Understanding your request...' });
    const intent = classifyChatIntent(trimmedMessage);
    let effectiveMessage = trimmedMessage;
    let allowWrites = false;

    // Handle pending actions
    if (!isConfirmMessage(trimmedMessage) && !isCancelMessage(trimmedMessage)) {
      await clearPendingChatAction(tenantId, req.user.uid, safeSessionKey);
    }

    if (intent === 'cancel') {
      await clearPendingChatAction(tenantId, req.user.uid, safeSessionKey);
      sendEvent({ type: 'complete', content: 'Cancelled. I will not make any data changes.' });
      return res.end();
    }

    if (intent === 'confirm') {
      const pending = await getPendingChatAction(tenantId, req.user.uid, safeSessionKey);
      if (!pending || !pending.message) {
        sendEvent({ type: 'complete', content: 'I do not have any pending change to confirm right now.' });
        return res.end();
      }
      allowWrites = true;
      effectiveMessage = pending.message;
      await clearPendingChatAction(tenantId, req.user.uid, safeSessionKey);
      sendEvent({ type: 'step', content: 'Confirmation received — executing action', status: 'done' });
    } else if (intent === 'write') {
      await setPendingChatAction(tenantId, req.user.uid, safeSessionKey, trimmedMessage, intent);
      sendEvent({
        type: 'complete',
        content: `I understand you want to: "${trimmedMessage}"\n\nThis will modify data. Please reply **"yes"** or **"confirm"** to proceed, or **"cancel"** to abort.`,
      });
      return res.end();
    }

    // Step 2: Calling AI
    sendEvent({ type: 'status', content: 'Working on it...' });

    const systemPrefix = buildChatSystemPrefix(req.user, { tenantId, allowWrites });
    const prefixedMessage = systemPrefix + effectiveMessage;
    const chatSessionKey = `agent:main:${tenantId}:webchat-${req.user.uid}:${safeSessionKey}`;

    const url = `${OPENCLAW_HTTP_URL}/v1/chat/completions`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);

    try {
      const ocRes = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENCLAW_PASSWORD}`,
          'x-openclaw-agent-id': 'main',
          'x-openclaw-session-key': chatSessionKey,
        },
        body: JSON.stringify({
          model: 'openclaw:main',
          messages: [{ role: 'user', content: prefixedMessage }],
          stream: true,
          user: chatSessionKey,
        }),
        signal: controller.signal,
      });

      if (!ocRes.ok) {
        const body = await ocRes.text().catch(() => '');
        throw new Error(`Gateway HTTP ${ocRes.status}: ${body.slice(0, 200)}`);
      }

      const contentType = ocRes.headers.get('content-type') || '';
      if (contentType.includes('text/event-stream') || contentType.includes('text/plain')) {
        // SSE streaming from OpenClaw
        let fullContent = '';
        const toolNames = [];
        const completedSteps = new Set();
        let buffer = '';
        const textDecoder = new TextDecoder();

        for await (const chunk of ocRes.body) {
          buffer += (typeof chunk === 'string') ? chunk : textDecoder.decode(chunk, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const payload = line.slice(6).trim();
            if (payload === '[DONE]') continue;

            try {
              const parsed = JSON.parse(payload);
              const choice = parsed.choices?.[0];
              const delta = choice?.delta;
              const message = choice?.message;

              // Extract content from delta (streaming) or message (non-streaming/final)
              const content = delta?.content || message?.content;
              if (content) {
                fullContent += content;
                sendEvent({ type: 'chunk', content });
              }

              // Detect tool calls in stream (both delta and message formats)
              const tcList = delta?.tool_calls || message?.tool_calls || [];
              for (const tc of tcList) {
                if (tc.function?.name && !completedSteps.has(tc.function.name)) {
                  toolNames.push(tc.function.name);
                  completedSteps.add(tc.function.name);
                  sendEvent({ type: 'step', content: humanizeToolName(tc.function.name), status: 'running' });
                }
              }
            } catch (_e) {
              // Ignore unparseable chunks
            }
          }
        }

        // Mark all steps as done
        for (const tn of toolNames) {
          sendEvent({ type: 'step', content: humanizeToolName(tn), status: 'done' });
        }

        const actions = detectActions(toolNames, fullContent);
        sendEvent({ type: 'complete', content: fullContent || '(No response)', actions });

        // Audit log
        try {
          await db.collection(`tenants/${tenantId}/chat_audit`).add({
            requestId, userId: req.user.uid, userEmail: req.user.email,
            message: trimmedMessage, effectiveMessage, intent, allowWrites,
            replyLength: fullContent.length, sessionKey: safeSessionKey,
            chatSessionKey, actions, toolNames: toolNames.slice(0, 50),
            streaming: true, createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        } catch (auditErr) {
          console.error(`[${requestId}] Chat audit log failed:`, auditErr.message);
        }
      } else {
        // Non-streaming JSON fallback (OpenClaw returned regular JSON)
        const data = await ocRes.json();
        const choice = data.choices?.[0];
        const reply = choice?.message?.content || '(No response)';

        // Extract tool names from non-streaming response if available
        const toolNames = [];
        const toolCalls = choice?.message?.tool_calls || [];
        for (const tc of toolCalls) {
          if (tc.function?.name) {
            toolNames.push(tc.function.name);
            sendEvent({ type: 'step', content: humanizeToolName(tc.function.name), status: 'done' });
          }
        }

        const actions = detectActions(toolNames, reply);
        sendEvent({ type: 'complete', content: reply, actions });

        // Audit log
        try {
          await db.collection(`tenants/${tenantId}/chat_audit`).add({
            requestId, userId: req.user.uid, userEmail: req.user.email,
            message: trimmedMessage, effectiveMessage, intent, allowWrites,
            replyLength: reply.length, sessionKey: safeSessionKey,
            chatSessionKey, actions, toolNames: toolNames.slice(0, 50),
            streaming: false, createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        } catch (auditErr) {
          console.error(`[${requestId}] Chat audit log failed:`, auditErr.message);
        }
      }
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    console.error(`[${requestId}] Chat-stream error:`, error.message);
    sendEvent({ type: 'error', content: error.message || 'Failed to communicate with AI gateway' });
  } finally {
    if (!res.writableEnded) res.end();
  }
});

// ============================================================================
// Mount router (API-key-protected routes — AFTER chat endpoint so chat uses Firebase token auth instead)
// ============================================================================

app.use('/api/tenants/:tenantId', router);

// ============================================================================
// 404 handler
// ============================================================================

app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.path}` });
});

// ============================================================================
// Error handler
// ============================================================================

app.use((err, req, res, _next) => {
  console.error('[meza-api] Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// ============================================================================
// Start server
// ============================================================================

app.listen(PORT, '127.0.0.1', () => {
  console.log(`[meza-api] Listening on 127.0.0.1:${PORT}`);
  console.log(`[meza-api] Health check: http://127.0.0.1:${PORT}/api/health`);
});
