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
  methods: ['GET', 'POST', 'OPTIONS'],
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
 * Body: { date, description, reference?, source?, sourceId?, lines: [{ accountId, accountCode?, accountName?, debit, credit, description? }] }
 * Lines must balance (sum of debits == sum of credits).
 * Entry is created with status 'posted' and GL entries are written in the same transaction.
 */
router.post('/journal-entries', async (req, res) => {
  try {
    const { date, description, reference, source, sourceId, lines } = req.body;

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

      transaction.set(journalRef, {
        entryNumber,
        date: entryDate,
        description,
        reference: reference || '',
        source: source || 'rezerva',
        sourceId: sourceId || null,
        sourceRef: reference || '',
        lines: numberedLines,
        totalDebit,
        totalCredit,
        status: 'posted',
        postedAt: admin.firestore.FieldValue.serverTimestamp(),
        postedBy: 'rezerva-sync',
        fiscalYear: year,
        fiscalPeriod: month,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // --- Write GL entries ---
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

      return { id: journalRef.id, entryNumber };
    });

    console.log(`[journal-entries] Created ${result.entryNumber} for tenant ${tid} (source: ${source || 'rezerva'})`);
    res.status(201).json({ success: true, id: result.id, entryNumber: result.entryNumber });
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
    const glSnap = await tenantCol(req.tenantId, 'generalLedger').get();
    const balances = {};

    glSnap.docs.forEach((doc) => {
      const d = doc.data();
      const key = d.accountId || d.accountCode;
      if (!balances[key]) {
        balances[key] = {
          accountId: d.accountId || '',
          accountCode: d.accountCode || '',
          accountName: d.accountName || '',
          accountType: '',
          debit: 0,
          credit: 0,
        };
      }
      balances[key].debit += d.debit || 0;
      balances[key].credit += d.credit || 0;
    });

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
        accountType: acct.type || acct.subType || '',
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

    // Fetch GL entries filtered by date range
    const glSnap = await tenantCol(req.tenantId, 'generalLedger').get();
    const glEntries = glSnap.docs
      .map((doc) => doc.data())
      .filter((entry) => {
        const d = entry.entryDate || entry.date || '';
        const dateStr = typeof d === 'string' ? d.split('T')[0] : '';
        return dateStr >= periodStart && dateStr <= periodEnd;
      });

    // Aggregate by account
    const accountTotals = {};
    for (const entry of glEntries) {
      const key = entry.accountId || entry.accountCode;
      if (!accountTotals[key]) {
        accountTotals[key] = { debit: 0, credit: 0 };
      }
      accountTotals[key].debit += entry.debit || 0;
      accountTotals[key].credit += entry.credit || 0;
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

    // Fetch all GL entries up to asOf date
    const glSnap = await tenantCol(req.tenantId, 'generalLedger').get();
    const glEntries = glSnap.docs
      .map((doc) => doc.data())
      .filter((entry) => {
        const d = entry.entryDate || entry.date || '';
        const dateStr = typeof d === 'string' ? d.split('T')[0] : '';
        return dateStr <= asOf;
      });

    // Aggregate by account
    const accountTotals = {};
    for (const entry of glEntries) {
      const key = entry.accountId || entry.accountCode;
      if (!accountTotals[key]) {
        accountTotals[key] = { debit: 0, credit: 0 };
      }
      accountTotals[key].debit += entry.debit || 0;
      accountTotals[key].credit += entry.credit || 0;
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
      // Phase 1: read-only, so ask for confirmation but explain no writes yet
      await setPendingChatAction(tenantId, req.user.uid, safeSessionKey, trimmedMessage, intent);
      return res.json({
        success: true,
        reply: `I understand you want to: "${trimmedMessage}"\nWrite operations are not yet available in this version. I can only read data for now.`,
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
