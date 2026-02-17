/**
 * Ekipa — Tetum-first i18n
 * Simple translation system using Zustand for language state
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Language = 'tet' | 'en';

interface I18nState {
  language: Language;
  setLanguage: (lang: Language) => void;
  loadLanguage: () => Promise<void>;
}

const LANGUAGE_KEY = '@ekipa/language';

export const useI18nStore = create<I18nState>((set) => ({
  language: 'tet',

  setLanguage: async (language: Language) => {
    set({ language });
    await AsyncStorage.setItem(LANGUAGE_KEY, language);
  },

  loadLanguage: async () => {
    try {
      const saved = await AsyncStorage.getItem(LANGUAGE_KEY);
      if (saved === 'en' || saved === 'tet') {
        set({ language: saved });
      }
    } catch {
      // Default to Tetum
    }
  },
}));

const translations: Record<string, Record<Language, string>> = {
  // ── Navigation ───────────────────────────────────
  'nav.home': { tet: 'Uma', en: 'Home' },
  'nav.payslips': { tet: 'Recibo Salariu', en: 'Payslips' },
  'nav.leave': { tet: 'Lisensa', en: 'Leave' },
  'nav.profile': { tet: 'Perfil', en: 'Profile' },

  // ── Login ────────────────────────────────────────
  'login.title': { tet: 'Ekipa', en: 'Ekipa' },
  'login.tagline': { tet: 'Ita-nia portal funsionáriu', en: 'Your employee portal' },
  'login.email': { tet: 'Email', en: 'Email' },
  'login.password': { tet: 'Senha', en: 'Password' },
  'login.signIn': { tet: 'Tama', en: 'Sign In' },
  'login.error.invalid': { tet: 'Email ka senha la loos', en: 'Invalid email or password' },
  'login.error.tooMany': { tet: 'Tentativa barak demais. Favór koko fali depois.', en: 'Too many attempts. Please try again later.' },
  'login.error.generic': { tet: 'La konsege tama. Favór koko fali.', en: 'Sign in failed. Please try again.' },
  'login.error.noAccess': { tet: 'Ita seidauk iha asesu. Kontaktu RH.', en: 'No access yet. Contact your HR admin.' },

  // ── Home ─────────────────────────────────────────
  'home.greeting': { tet: 'Bondia', en: 'Good morning' },
  'home.greetingAfternoon': { tet: 'Botardi', en: 'Good afternoon' },
  'home.greetingEvening': { tet: 'Bonoiti', en: 'Good evening' },
  'home.nextPayday': { tet: 'Loron pagamentu tuir mai', en: 'Next payday' },
  'home.days': { tet: 'loron', en: 'days' },
  'home.leaveBalance': { tet: 'Balansu lisensa', en: 'Leave balance' },
  'home.daysRemaining': { tet: 'loron restu', en: 'days remaining' },
  'home.recentPayslip': { tet: 'Recibo foun', en: 'Latest payslip' },
  'home.quickActions': { tet: 'Asaun lais', en: 'Quick actions' },
  'home.requestLeave': { tet: 'Husu lisensa', en: 'Request leave' },
  'home.viewPayslips': { tet: 'Haree recibo', en: 'View payslips' },

  // ── Payslips ─────────────────────────────────────
  'payslips.title': { tet: 'Recibo Salariu', en: 'Payslips' },
  'payslips.gross': { tet: 'Brútu', en: 'Gross' },
  'payslips.net': { tet: 'Líkidu', en: 'Net' },
  'payslips.earnings': { tet: 'Rendimentu', en: 'Earnings' },
  'payslips.deductions': { tet: 'Dedusaun', en: 'Deductions' },
  'payslips.baseSalary': { tet: 'Salário baze', en: 'Base salary' },
  'payslips.overtime': { tet: 'Oras extra', en: 'Overtime' },
  'payslips.allowances': { tet: 'Subsídiu', en: 'Allowances' },
  'payslips.wit': { tet: 'Imposto (WIT)', en: 'Withholding tax (WIT)' },
  'payslips.inss': { tet: 'INSS funsionáriu', en: 'INSS employee' },
  'payslips.share': { tet: 'Fahe PDF', en: 'Share PDF' },
  'payslips.empty': { tet: 'Seidauk iha recibo', en: 'No payslips yet' },

  // ── Leave ────────────────────────────────────────
  'leave.title': { tet: 'Lisensa', en: 'Leave' },
  'leave.balance': { tet: 'Balansu', en: 'Balance' },
  'leave.history': { tet: 'Istória', en: 'History' },
  'leave.request': { tet: 'Husu lisensa', en: 'Request leave' },
  'leave.annual': { tet: 'Lisensa anual', en: 'Annual leave' },
  'leave.sick': { tet: 'Lisensa moras', en: 'Sick leave' },
  'leave.maternity': { tet: 'Lisensa maternidade', en: 'Maternity leave' },
  'leave.paternity': { tet: 'Lisensa paternidade', en: 'Paternity leave' },
  'leave.unpaid': { tet: 'Lisensa la ho pagamentu', en: 'Unpaid leave' },
  'leave.bereavement': { tet: 'Lisensa luto', en: 'Bereavement leave' },
  'leave.marriage': { tet: 'Lisensa kazamentu', en: 'Marriage leave' },
  'leave.used': { tet: 'Uza ona', en: 'Used' },
  'leave.remaining': { tet: 'Restu', en: 'Remaining' },
  'leave.pending': { tet: 'Pendente', en: 'Pending' },
  'leave.approved': { tet: 'Aprova ona', en: 'Approved' },
  'leave.rejected': { tet: 'Rejeita ona', en: 'Rejected' },
  'leave.cancelled': { tet: 'Kansela ona', en: 'Cancelled' },
  'leave.type': { tet: 'Tipu lisensa', en: 'Leave type' },
  'leave.startDate': { tet: 'Loron hahú', en: 'Start date' },
  'leave.endDate': { tet: 'Loron remata', en: 'End date' },
  'leave.reason': { tet: 'Razaun', en: 'Reason' },
  'leave.submit': { tet: 'Submete', en: 'Submit' },
  'leave.cancel': { tet: 'Kansela', en: 'Cancel' },
  'leave.empty': { tet: 'Seidauk iha pedidu lisensa', en: 'No leave requests yet' },
  'leave.days': { tet: 'loron', en: 'days' },
  'leave.of': { tet: 'husi', en: 'of' },

  // ── Profile ──────────────────────────────────────
  'profile.title': { tet: 'Perfil', en: 'Profile' },
  'profile.personalInfo': { tet: 'Informasaun pesoál', en: 'Personal information' },
  'profile.jobDetails': { tet: 'Detallu servisu', en: 'Job details' },
  'profile.documents': { tet: 'Dokumentu', en: 'Documents' },
  'profile.attendance': { tet: 'Prezensia', en: 'Attendance' },
  'profile.settings': { tet: 'Konfigurasaun', en: 'Settings' },
  'profile.language': { tet: 'Lian', en: 'Language' },
  'profile.signOut': { tet: 'Sai', en: 'Sign out' },
  'profile.department': { tet: 'Departamentu', en: 'Department' },
  'profile.position': { tet: 'Pozisaun', en: 'Position' },
  'profile.startDate': { tet: 'Loron hahú servisu', en: 'Start date' },
  'profile.employeeId': { tet: 'ID funsionáriu', en: 'Employee ID' },
  'profile.phone': { tet: 'Telefone', en: 'Phone' },
  'profile.email': { tet: 'Email', en: 'Email' },
  'profile.present': { tet: 'Prezente', en: 'Present' },
  'profile.late': { tet: 'Tardi', en: 'Late' },
  'profile.absent': { tet: 'Auzente', en: 'Absent' },

  // ── Common ───────────────────────────────────────
  'common.loading': { tet: 'Karrega hela...', en: 'Loading...' },
  'common.error': { tet: 'Erru', en: 'Error' },
  'common.retry': { tet: 'Koko fali', en: 'Retry' },
  'common.noData': { tet: 'Seidauk iha dadus', en: 'No data yet' },
  'common.poweredBy': { tet: 'husi Meza', en: 'powered by Meza' },
};

export function t(key: string): string {
  const lang = useI18nStore.getState().language;
  return translations[key]?.[lang] ?? translations[key]?.['en'] ?? key;
}

export function useT() {
  const language = useI18nStore((s) => s.language);
  return (key: string): string => {
    return translations[key]?.[language] ?? translations[key]?.['en'] ?? key;
  };
}
