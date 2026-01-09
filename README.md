# OniT HR Payroll System

A comprehensive, modern HR and Payroll management system built with React, TypeScript, Express.js, and SQLite. Designed for companies to efficiently manage employees, departments, payroll, hiring, and organizational data. Features a local-first development approach with easy migration to Google Firestore for cloud deployment.

![OniT HR Payroll](https://img.shields.io/badge/OniT-HR%20Payroll-blue)
![React](https://img.shields.io/badge/React-18.x-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)
![Express](https://img.shields.io/badge/Express.js-4.x-green)
![SQLite](https://img.shields.io/badge/SQLite-3.x-lightblue)
![Vite](https://img.shields.io/badge/Vite-5.x-purple)

## 🚀 Features

### 👥 Employee Management

- **Complete Employee Profiles** - Personal info, job details, compensation, documents
- **Bulk CSV Import** - Import employees with intelligent column mapping
- **Profile Completeness Tracking** - Visual indicators for missing information
- **Document Management** - Track ID cards, passports, visas with expiry dates
- **Employee Directory** - Searchable, filterable employee listings

### 🏢 Department Management

- **Dynamic Departments** - Create and manage organizational departments
- **Visual Customization** - Custom icons, colors, and shapes for departments
- **Director & Manager Assignment** - Assign leadership roles
- **Department Analytics** - Staff counts, payroll costs, statistics

### 📊 Dashboard & Analytics

- **Staff Dashboard** - Real-time employee statistics and breakdowns
- **Time & Leave Dashboard** - Employee time tracking overview
- **Payroll Reports** - Comprehensive salary and compensation reports
- **Organization Chart** - Visual representation of company structure

### 👤 Hiring & Offboarding

- **Job Adverts Management** - Create and manage job openings with:
  - Contract Type (Permanent / Fixed-Term)
  - Contract Duration (for fixed-term positions)
  - Probation Period (Article 14 of the Labour Code)
  - Candidate status tracking
- **Candidate Management** - Track applications and candidates through the hiring pipeline
- **Offboarding Process** - Structured employee departure workflow
- **Exit Interviews** - Built-in exit interview management
- **Status Tracking** - Monitor onboarding/offboarding progress

### 🔧 System Features

- **Local-First Development** - SQLite database for rapid development and testing
- **RESTful API** - Express.js backend with well-structured API routes
- **Responsive Design** - Works on desktop, tablet, and mobile
- **Data Export** - CSV export capabilities with local data persistence
- **Search & Filtering** - Advanced search across all modules
- **Dark/Light Theme** - Customizable interface themes
- **Cloud Migration Ready** - Easy export to Google Firestore for production deployment

## 🛠️ Technology Stack

### Frontend
- **Framework**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS, Radix UI, Lucide Icons
- **State Management**: React Context, Custom Hooks
- **Forms**: React Hook Form, Zod Validation
- **Routing**: React Router v6
- **Charts**: Recharts
- **File Processing**: Papa Parse (CSV)

### Backend (Local Development)
- **Server**: Express.js (Node.js)
- **Database**: SQLite 3
- **API Routes**: RESTful API for employees, departments, jobs, candidates, etc.

### Cloud (Production)
- **Database**: Google Firestore
- **Authentication**: Firebase Authentication
- **Storage**: Firebase Cloud Storage

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (version 18.x or higher)
- **npm** or **yarn** package manager
- **Git** (for version control)

## 🚀 Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/OniT-Enterprises/OniT-HR-Payroll-2.git
cd OniT-HR-Payroll-2
```

### 2. Install Dependencies

```bash
npm install
# or
yarn install
```

### 3. Local Development Setup (SQLite + Express)

The application uses SQLite for local development with an Express.js backend.

**No additional configuration is required** for local development. The SQLite database (`payroll.db`) is automatically initialized on first run.

### 4. Environment Variables (Optional)

Create a `.env.local` file in the root directory for any custom configuration:

```env
# Development environment variables (optional)
# The application runs with SQLite locally by default
```

### 5. Run the Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5173` with the Express.js API backend running on `http://localhost:3000`.

## 📁 Project Structure

```
OniT-HR-Payroll/
├── client/                 # Frontend application
│   ├── components/         # Reusable UI components
│   │   ├── ui/            # Base UI components
│   │   ├── layout/        # Layout components
│   │   └── ...            # Feature components
│   ├── pages/             # Application pages
│   │   ├── staff/         # Employee management
│   │   ├── hiring/        # Recruitment & offboarding
│   │   ├── dashboards/    # Analytics dashboards
│   │   ├── payroll/       # Payroll management
│   │   ├── time-leave/    # Time & Leave tracking
│   │   └── reports/       # Reporting modules
│   ├── services/          # API service clients
│   │   ├── localDataService.ts  # SQLite data operations
│   │   ├── employeeService.ts
│   │   ├── departmentService.ts
│   │   └── ...
│   ├── lib/               # Utility libraries
│   ├── hooks/             # Custom React hooks
│   ├── contexts/          # React contexts
│   └── types/             # TypeScript type definitions
├── server/                # Express.js backend
│   ├── routes/            # API routes
│   │   ├── employees.ts
│   │   ├── departments.ts
│   │   ├── jobs.ts
│   │   ├── candidates.ts
│   │   └── ...
│   ├── db.ts             # SQLite database initialization
│   └── index.ts          # Express server entry point
├── shared/               # Shared utilities and types
├── public/               # Static assets
├── payroll.db            # SQLite database file
├── package.json          # Dependencies and scripts
└── vite.config.ts        # Vite configuration
```

## 🔐 Authentication

The system includes built-in authentication with demo credentials:

- **Demo Admin**: `admin@onit.com` / `admin123`
- **Demo User**: `user@onit.com` / `user123`

For production, configure Firebase Authentication with your preferred providers.

## 📈 Key Modules

### Employee Management (`/staff`)

- **All Employees** - Complete employee directory with search and filtering
- **Add Employee** - New employee onboarding form
- **Departments** - Department management and analytics
- **Organization Chart** - Visual company structure

### Dashboards (`/dashboards`)

- **Staff Dashboard** - Employee overview and statistics
- **Time & Leave** - Time tracking and leave management
- **Hiring Dashboard** - Recruitment pipeline overview

### Hiring (`/hiring`)

- **Create Job Advert** - Post new job openings with contract details (type, duration, probation period)
- **Candidate Selection** - Manage candidates in the recruitment pipeline
- **Interviews** - Track interview scheduling and results
- **Onboarding** - Manage new hire onboarding process
- **Offboarding** - Employee departure management with exit interviews

### Payroll (`/payroll`)

- **Run Payroll** - Process monthly payroll calculations
- **Bank Transfers** - Manage salary payment transfers
- **Deductions & Advances** - Handle employee deductions and advances
- **Benefits Enrollment** - Employee benefit management
- **Payroll History** - View historical payroll records
- **Tax Reports** - Generate tax documentation

### Reports (`/reports`)

- **Payroll Reports** - Comprehensive payroll analytics
- **Attendance Reports** - Attendance tracking and analysis
- **Employee Reports** - Individual employee data exports
- **Custom Reports** - Generate custom business reports

## 🚀 Development Workflow

### Local Development (SQLite)

1. Run `npm run dev` to start both the Vite frontend and Express backend
2. Data is stored in `payroll.db` (SQLite)
3. API calls are made to the local Express server (`http://localhost:3000`)
4. Use the CSV export feature to backup data locally

### Migrating to Firestore (Production)

When ready to deploy to production with Google Firestore:

1. Set up Firebase project at [Firebase Console](https://console.firebase.google.com)
2. Enable Firestore Database, Authentication, and Storage
3. Export data from SQLite to JSON/CSV format
4. Import data into Firestore using Firebase Admin SDK or custom migration scripts
5. Update the `client/lib/firebase.ts` with your Firebase config
6. Deploy to Firebase Hosting or Vercel/Netlify

For detailed migration instructions, see [DEPLOYMENT.md](DEPLOYMENT.md).

## 📊 Database Schema (SQLite)

The SQLite database includes tables for:
- **employees** - Employee information and compensation
- **departments** - Department data and hierarchy
- **jobs** - Job advert postings with contract details
- **candidates** - Recruitment pipeline data
- **payroll** - Payroll records and calculations

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:

- Create an issue in this repository
- Review existing documentation in the repository
- Check [AGENTS.md](AGENTS.md) for development guidelines

## 🔄 Recent Updates

- ✅ SQLite + Express.js backend for local development
- ✅ Job Advert management with contract type, duration, and probation period fields
- ✅ RESTful API for all core modules (employees, departments, jobs, candidates)
- ✅ Bulk CSV import with column mapping
- ✅ Department management with visual customization
- ✅ Comprehensive offboarding workflow
- ✅ Profile completeness tracking
- ✅ Real-time data synchronization (local)
- ✅ Cloud migration path to Firestore

## 🎯 Roadmap

- [ ] Full Firestore integration for production
- [ ] Mobile application (React Native)
- [ ] Advanced reporting and predictive analytics
- [ ] Machine learning-based candidate matching
- [ ] Automated payroll processing
- [ ] Advanced role-based permissions (RBAC)
- [ ] API integrations (HR systems, accounting software)
- [ ] Performance review module enhancements

## 📚 Additional Documentation

- [AGENTS.md](AGENTS.md) - Development guidelines and coding standards
- [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment and production setup
- [ENVIRONMENT.md](ENVIRONMENT.md) - Environment variables and configuration
- [CONTRIBUTING.md](CONTRIBUTING.md) - Contribution guidelines

---

**OniT Enterprises** - Building the future of HR technology

## Quick Start Example

```bash
# 1. Clone and install
git clone https://github.com/OniT-Enterprises/OniT-HR-Payroll-2.git
cd OniT-HR-Payroll-2
npm install

# 2. Start development
npm run dev

# 3. Open browser to http://localhost:5173
# Login with demo@onit.com / demo123

# 4. Create your first job advert
# Navigate to Hiring → Create Job Advert
# Fill in contract details and post

# 5. Export data anytime
# Use the Export feature to backup your data locally
```
