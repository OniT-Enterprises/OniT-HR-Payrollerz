import React from 'react';
import HotDogNav from './HotDogNav';
import { useI18n } from "@/i18n/I18nProvider";
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
  const { t } = useI18n();
  const modules = [
    {
      id: 'hiring',
      label: t('nav.hiring'),
      icon: <UserPlus className="h-6 w-6" />,
      sub: [
        { id: 'create-job', label: t('nav.jobPostings'), icon: <Briefcase className="h-5 w-5" />, path: '/hiring/create-job' },
        { id: 'candidates', label: t('nav.candidates'), icon: <Users className="h-5 w-5" />, path: '/hiring/candidates' },
        { id: 'interviews', label: t('nav.interviews'), icon: <Calendar className="h-5 w-5" />, path: '/hiring/interviews' },
        { id: 'onboarding', label: t('nav.onboarding'), icon: <UserPlus className="h-5 w-5" />, path: '/hiring/onboarding' },
        { id: 'offboarding', label: t('nav.offboarding'), icon: <UserCog className="h-5 w-5" />, path: '/hiring/offboarding' }
      ]
    },
    {
      id: 'staff',
      label: t('nav.staff'),
      icon: <Users className="h-6 w-6" />,
      sub: [
        { id: 'all-employees', label: t('nav.allEmployees'), icon: <Users className="h-5 w-5" />, path: '/staff/employees' },
        { id: 'add-employee', label: t('nav.addEmployee'), icon: <UserPlus className="h-5 w-5" />, path: '/staff/add' },
        { id: 'departments', label: t('nav.departments'), icon: <Building className="h-5 w-5" />, path: '/staff/departments' },
        { id: 'org-chart', label: t('nav.orgChart'), icon: <Building2 className="h-5 w-5" />, path: '/staff/org-chart' }
      ]
    },
    {
      id: 'timeleave',
      label: t('nav.timeLeave'),
      icon: <Clock className="h-6 w-6" />,
      sub: [
        { id: 'time-tracking', label: t('nav.timeTracking'), icon: <Clock className="h-5 w-5" />, path: '/time-leave/tracking' },
        { id: 'attendance', label: t('nav.attendance'), icon: <Calendar className="h-5 w-5" />, path: '/time-leave/attendance' },
        { id: 'leave-requests', label: t('nav.leaveRequests'), icon: <Heart className="h-5 w-5" />, path: '/time-leave/requests' },
        { id: 'scheduling', label: t('nav.shiftSchedules'), icon: <Calendar className="h-5 w-5" />, path: '/time-leave/scheduling' }
      ]
    },
    {
      id: 'performance',
      label: t('nav.performance'),
      icon: <TrendingUp className="h-6 w-6" />,
      sub: [
        { id: 'goals', label: t('nav.goalsOkrs'), icon: <Target className="h-5 w-5" />, path: '/performance/goals' },
        { id: 'reviews', label: t('nav.reviews'), icon: <Award className="h-5 w-5" />, path: '/performance/reviews' },
        { id: 'training', label: t('nav.training'), icon: <Award className="h-5 w-5" />, path: '/performance/training' },
        { id: 'disciplinary', label: t('nav.disciplinary'), icon: <Shield className="h-5 w-5" />, path: '/performance/disciplinary' }
      ]
    },
    {
      id: 'payroll',
      label: t('nav.payroll'),
      icon: <Calculator className="h-6 w-6" />,
      sub: [
        { id: 'run-payroll', label: t('nav.runPayroll'), icon: <Calculator className="h-5 w-5" />, path: '/payroll/run' },
        { id: 'history', label: t('nav.payrollHistory'), icon: <FileText className="h-5 w-5" />, path: '/payroll/history' },
        { id: 'tax-reports', label: t('nav.taxReports'), icon: <FileText className="h-5 w-5" />, path: '/payroll/taxes' },
        { id: 'transfers', label: t('nav.bankTransfers'), icon: <CreditCard className="h-5 w-5" />, path: '/payroll/transfers' },
        { id: 'benefits', label: t('nav.benefits'), icon: <Heart className="h-5 w-5" />, path: '/payroll/benefits' },
        { id: 'deductions', label: t('nav.deductions'), icon: <DollarSign className="h-5 w-5" />, path: '/payroll/deductions' }
      ]
    },
    {
      id: 'reports',
      label: t('nav.reports'),
      icon: <BarChart3 className="h-6 w-6" />,
      sub: [
        { id: 'employee-reports', label: t('nav.employeeReports'), icon: <Users className="h-5 w-5" />, path: '/reports/employees' },
        { id: 'payroll-reports', label: t('nav.payrollReports'), icon: <Calculator className="h-5 w-5" />, path: '/reports/payroll' },
        { id: 'attendance-reports', label: t('nav.attendance'), icon: <Calendar className="h-5 w-5" />, path: '/reports/attendance' },
        { id: 'custom-reports', label: t('nav.customReports'), icon: <PieChart className="h-5 w-5" />, path: '/reports/custom' }
      ]
    }
  ];

  return <HotDogNav modules={modules} />;
};

export default Header;
