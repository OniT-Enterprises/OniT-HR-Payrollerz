/**
 * SEFOPE (Secretaria de Estado da Formação Profissional e Emprego) Form Mappings
 * For employment registration with Timor-Leste Labor Ministry
 */

import { Employee } from '@/services/employeeService';
import { CompanyDetails } from '@/types/settings';

// Form field labels in Portuguese (TL official language)
export const SEFOPE_LABELS = {
  // Header
  formTitle: 'Formulário de Registo de Emprego',
  formSubtitle: 'SEFOPE - Secretaria de Estado da Formação Profissional e Emprego',
  registrationNumber: 'Número de Registo',
  registrationDate: 'Data de Registo',

  // Section titles
  employerSection: 'DADOS DA ENTIDADE EMPREGADORA',
  employeeSection: 'DADOS DO TRABALHADOR',
  employmentSection: 'DADOS DO EMPREGO',
  socialSecuritySection: 'SEGURANÇA SOCIAL',
  declarationSection: 'DECLARAÇÃO',

  // Employer fields
  companyName: 'Nome da Empresa',
  companyTIN: 'NIF (Número de Identificação Fiscal)',
  companyAddress: 'Morada',
  companyPhone: 'Telefone',
  companyEmail: 'Email',
  businessType: 'Tipo de Negócio',

  // Employee fields
  fullName: 'Nome Completo',
  biNumber: 'Número do Bilhete de Identidade',
  biExpiry: 'Data de Validade do BI',
  nationality: 'Nacionalidade',
  residencyStatus: 'Estatuto de Residência',
  dateOfBirth: 'Data de Nascimento',
  address: 'Morada',
  phone: 'Telefone',
  email: 'Email',
  emergencyContact: 'Contacto de Emergência',

  // Employment fields
  employeeId: 'Número de Funcionário',
  position: 'Cargo/Função',
  department: 'Departamento',
  hireDate: 'Data de Admissão',
  employmentType: 'Tipo de Contrato',
  workLocation: 'Local de Trabalho',
  monthlySalary: 'Salário Mensal (USD)',
  fundingSource: 'Fonte de Financiamento',
  projectCode: 'Código do Projeto',

  // Social Security fields
  inssNumber: 'Número do INSS',
  taxStatus: 'Estatuto Fiscal',
  isResident: 'Residente Fiscal',

  // Employment types (translations)
  employmentTypes: {
    'full-time': 'Tempo Inteiro',
    'part-time': 'Tempo Parcial',
    'contract': 'Contrato a Termo',
    'intern': 'Estágio',
    'open_ended': 'Contrato Sem Termo',
    'fixed_term': 'Contrato a Termo',
    'agency': 'Agência',
    'contractor': 'Prestador de Serviços',
  },

  // Residency status (translations)
  residencyStatuses: {
    timorese: 'Timorense',
    permanent_resident: 'Residente Permanente',
    foreign_worker: 'Trabalhador Estrangeiro',
  },

  // Business types
  businessTypes: {
    SA: 'Sociedade Anónima',
    Lda: 'Sociedade por Quotas',
    Unipessoal: 'Empresa Unipessoal',
    ENIN: 'Entidade Nacional',
    NGO: 'ONG',
    Government: 'Governo',
    Other: 'Outro',
  },

  // Declaration text
  declaration: 'Declaro que os dados acima são verdadeiros e completos, de acordo com as informações disponíveis.',

  // Footer
  employerSignature: 'Assinatura do Empregador',
  employeeSignature: 'Assinatura do Trabalhador',
  date: 'Data',
  officialUseOnly: 'USO OFICIAL',
  stampArea: 'Área para Carimbo',
};

export interface SefopeFormData {
  // Employer
  companyName: string;
  companyTIN: string;
  companyAddress: string;
  companyCity: string;
  companyPhone: string;
  companyEmail: string;
  businessType: string;

  // Employee
  employeeFullName: string;
  biNumber: string;
  biExpiry: string;
  nationality: string;
  residencyStatus: string;
  dateOfBirth: string;
  employeeAddress: string;
  employeePhone: string;
  employeeEmail: string;
  emergencyContactName: string;
  emergencyContactPhone: string;

  // Employment
  employeeId: string;
  position: string;
  department: string;
  hireDate: string;
  employmentType: string;
  workLocation: string;
  monthlySalary: number;
  fundingSource?: string;
  projectCode?: string;

  // Social Security
  sefopeNumber?: string;
  sefopeRegistrationDate?: string;
  inssNumber: string;
  isResident: boolean;
}

/**
 * Map employee and company data to SEFOPE form fields
 */
export function mapToSefopeForm(
  employee: Employee,
  company: Partial<CompanyDetails>
): SefopeFormData {
  const fullName = `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`;

  return {
    // Employer data
    companyName: company.legalName || company.tradingName || 'Not Specified',
    companyTIN: company.tinNumber || '',
    companyAddress: company.registeredAddress || '',
    companyCity: company.city || '',
    companyPhone: company.phone || '',
    companyEmail: company.email || '',
    businessType: company.businessType
      ? SEFOPE_LABELS.businessTypes[company.businessType] || company.businessType
      : '',

    // Employee data
    employeeFullName: fullName,
    biNumber: employee.documents?.bilheteIdentidade?.number ||
              employee.documents?.employeeIdCard?.number || '',
    biExpiry: employee.documents?.bilheteIdentidade?.expiryDate ||
              employee.documents?.employeeIdCard?.expiryDate || '',
    nationality: employee.documents?.nationality || 'Timorense',
    residencyStatus: employee.documents?.residencyStatus
      ? SEFOPE_LABELS.residencyStatuses[employee.documents.residencyStatus] || employee.documents.residencyStatus
      : 'Timorense',
    dateOfBirth: employee.personalInfo.dateOfBirth || '',
    employeeAddress: employee.personalInfo.address || '',
    employeePhone: employee.personalInfo.phone || '',
    employeeEmail: employee.personalInfo.email || '',
    emergencyContactName: employee.personalInfo.emergencyContactName || '',
    emergencyContactPhone: employee.personalInfo.emergencyContactPhone || '',

    // Employment data
    employeeId: employee.jobDetails.employeeId || '',
    position: employee.jobDetails.position || '',
    department: employee.jobDetails.department || '',
    hireDate: employee.jobDetails.hireDate || '',
    employmentType: employee.jobDetails.employmentType
      ? SEFOPE_LABELS.employmentTypes[employee.jobDetails.employmentType as keyof typeof SEFOPE_LABELS.employmentTypes] || employee.jobDetails.employmentType
      : '',
    workLocation: employee.jobDetails.workLocation || '',
    monthlySalary: employee.compensation.monthlySalary || 0,
    fundingSource: employee.jobDetails.fundingSource,
    projectCode: employee.jobDetails.projectCode,

    // Social Security
    sefopeNumber: employee.jobDetails.sefopeNumber,
    sefopeRegistrationDate: employee.jobDetails.sefopeRegistrationDate,
    inssNumber: employee.documents?.socialSecurityNumber?.number || '',
    isResident: employee.compensation?.isResident ?? true,
  };
}

/**
 * Validate required fields for SEFOPE registration
 */
export function validateSefopeForm(data: SefopeFormData): {
  isValid: boolean;
  missingFields: string[];
} {
  const requiredFields: (keyof SefopeFormData)[] = [
    'companyName',
    'companyTIN',
    'employeeFullName',
    'biNumber',
    'nationality',
    'dateOfBirth',
    'position',
    'hireDate',
    'monthlySalary',
  ];

  const missingFields: string[] = [];

  for (const field of requiredFields) {
    const value = data[field];
    if (!value || (typeof value === 'string' && !value.trim())) {
      missingFields.push(field);
    }
  }

  return {
    isValid: missingFields.length === 0,
    missingFields,
  };
}

/**
 * Format date for SEFOPE form (DD/MM/YYYY)
 */
export function formatSefopeDate(dateString: string | undefined): string {
  if (!dateString) return '';

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;

    return date.toLocaleDateString('pt-TL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'Asia/Dili',
    });
  } catch {
    return dateString;
  }
}

/**
 * Format currency for SEFOPE form
 */
export function formatSefopeCurrency(amount: number): string {
  return `$${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}
