import React from 'react';
import HotDogNav from './HotDogNav';
import { 
  UserPlus, 
  Users, 
  Clock, 
  TrendingUp, 
  Calculator, 
  BarChart3,
  Briefcase,
  Calendar,
  UserCog,
  Building,
  Building2,
  Heart,
  Target,
  Award,
  Shield,
  FileText,
  CreditCard,
  DollarSign,
  PieChart
} from 'lucide-react';

const Header: React.FC = () => {
  const modules = [
    {
      id: 'hiring',
      label: 'Hiring',
      icon: <UserPlus className="h-6 w-6" />,
      sub: [
        { id: 'create-job', label: 'Create Job', icon: <Briefcase className="h-5 w-5" />, path: '/hiring/create-job' },
        { id: 'candidates', label: 'Candidates', icon: <Users className="h-5 w-5" />, path: '/hiring/candidates' },
        { id: 'interviews', label: 'Interviews', icon: <Calendar className="h-5 w-5" />, path: '/hiring/interviews' },
        { id: 'onboarding', label: 'Onboarding', icon: <UserPlus className="h-5 w-5" />, path: '/hiring/onboarding' },
        { id: 'offboarding', label: 'Offboarding', icon: <UserCog className="h-5 w-5" />, path: '/hiring/offboarding' }
      ]
    },
    {
      id: 'staff',
      label: 'Staff',
      icon: <Users className="h-6 w-6" />,
      sub: [
        { id: 'all-employees', label: 'All Employees', icon: <Users className="h-5 w-5" />, path: '/staff/employees' },
        { id: 'add-employee', label: 'Add Employee', icon: <UserPlus className="h-5 w-5" />, path: '/staff/add' },
        { id: 'departments', label: 'Departments', icon: <Building className="h-5 w-5" />, path: '/staff/departments' },
        { id: 'org-chart', label: 'Org Chart', icon: <Building2 className="h-5 w-5" />, path: '/staff/org-chart' }
      ]
    },
    {
      id: 'timeleave',
      label: 'Time & Leave',
      icon: <Clock className="h-6 w-6" />,
      sub: [
        { id: 'time-tracking', label: 'Time Tracking', icon: <Clock className="h-5 w-5" />, path: '/time-leave/tracking' },
        { id: 'attendance', label: 'Attendance', icon: <Calendar className="h-5 w-5" />, path: '/time-leave/attendance' },
        { id: 'leave-requests', label: 'Leave Requests', icon: <Heart className="h-5 w-5" />, path: '/time-leave/requests' },
        { id: 'scheduling', label: 'Scheduling', icon: <Calendar className="h-5 w-5" />, path: '/time-leave/scheduling' }
      ]
    },
    {
      id: 'performance',
      label: 'Performance',
      icon: <TrendingUp className="h-6 w-6" />,
      sub: [
        { id: 'goals', label: 'Goals & OKRs', icon: <Target className="h-5 w-5" />, path: '/performance/goals' },
        { id: 'reviews', label: 'Reviews', icon: <Award className="h-5 w-5" />, path: '/performance/reviews' },
        { id: 'training', label: 'Training', icon: <Award className="h-5 w-5" />, path: '/performance/training' },
        { id: 'disciplinary', label: 'Disciplinary', icon: <Shield className="h-5 w-5" />, path: '/performance/disciplinary' }
      ]
    },
    {
      id: 'payroll',
      label: 'Payroll',
      icon: <Calculator className="h-6 w-6" />,
      sub: [
        { id: 'run-payroll', label: 'Run Payroll', icon: <Calculator className="h-5 w-5" />, path: '/payroll/run' },
        { id: 'history', label: 'History', icon: <FileText className="h-5 w-5" />, path: '/payroll/history' },
        { id: 'tax-reports', label: 'Tax Reports', icon: <FileText className="h-5 w-5" />, path: '/payroll/taxes' },
        { id: 'transfers', label: 'Bank Transfers', icon: <CreditCard className="h-5 w-5" />, path: '/payroll/transfers' },
        { id: 'benefits', label: 'Benefits', icon: <Heart className="h-5 w-5" />, path: '/payroll/benefits' },
        { id: 'deductions', label: 'Deductions', icon: <DollarSign className="h-5 w-5" />, path: '/payroll/deductions' }
      ]
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: <BarChart3 className="h-6 w-6" />,
      sub: [
        { id: 'employee-reports', label: 'Employee Reports', icon: <Users className="h-5 w-5" />, path: '/reports/employees' },
        { id: 'payroll-reports', label: 'Payroll Reports', icon: <Calculator className="h-5 w-5" />, path: '/reports/payroll' },
        { id: 'attendance-reports', label: 'Attendance', icon: <Calendar className="h-5 w-5" />, path: '/reports/attendance' },
        { id: 'custom-reports', label: 'Custom Reports', icon: <PieChart className="h-5 w-5" />, path: '/reports/custom' }
      ]
    }
  ];

  return <HotDogNav modules={modules} />;
};

export default Header;
