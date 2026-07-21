/**
 * Public documentation manifest — the single registry the hub, routes,
 * SEO/static-heads and locale plumbing all read. React-free (imported by
 * scripts/generate-static-heads.ts).
 *
 * Adding an article: content file in client/content/docs/<slug>.ts, a
 * loader in client/lib/docs/registry.ts, one entry here, sitemap.xml ×3.
 */
import type { DocsManifestEntry } from "./types";

export const DOCS_MANIFEST: DocsManifestEntry[] = [
  {
    slug: "getting-started",
    category: "guides",
    seo: {
      title: "Getting Started — Xefe Documentation",
      description:
        "Create your Xefe account, set up your Timor-Leste company, add your team and get ready for your first payroll.",
      keywords:
        "Xefe setup, Timor-Leste payroll setup, add employees, company setup Timor-Leste",
      url: "/docs/getting-started",
      alternates: {
        tet: {
          title: "Hahu ho Xefe — Dokumentasaun",
          description:
            "Kria ita-nia konta Xefe, konfigura ita-nia empreza Timor-Leste, aumenta ita-nia ekipa no prepara ba folha pagamentu primeiru.",
        },
        pt: {
          title: "Começar — Documentação Xefe",
          description:
            "Crie a sua conta Xefe, configure a sua empresa em Timor-Leste, adicione a equipa e prepare-se para a primeira folha.",
        },
      },
    },
    hub: {
      en: {
        tag: "Guide",
        title: "Getting started",
        desc: "Create your account, set up the company, add your team, and get ready for your first payroll.",
      },
      pt: {
        tag: "Guia",
        title: "Começar",
        desc: "Crie a conta, configure a empresa, adicione a equipa e prepare a primeira folha.",
      },
      tet: {
        tag: "Gía",
        title: "Hahu",
        desc: "Kria konta, konfigura empreza, aumenta ekipa no prepara folha pagamentu primeiru.",
      },
    },
  },
  {
    slug: "running-payroll",
    category: "guides",
    seo: {
      title: "Running Payroll — Xefe Documentation",
      description:
        "From hours to payslips: run payroll with statutory WIT and INSS, two-person approval, bank payment pack and trilingual payslips.",
      keywords:
        "run payroll Timor-Leste, WIT calculation, INSS payroll, payroll approval, payslips Tetun",
      url: "/docs/running-payroll",
      alternates: {
        tet: {
          title: "Halo Folha Pagamentu — Dokumentasaun Xefe",
          description:
            "Husi oras servisu to'o payslip: halo folha ho WIT no INSS legál, aprovasaun ema rua, pakote banku no payslip iha lian tolu.",
        },
        pt: {
          title: "Processar a Folha — Documentação Xefe",
          description:
            "Das horas aos recibos: processe a folha com WIT e INSS legais, aprovação a duas pessoas, pacote bancário e recibos trilingues.",
        },
      },
    },
    hub: {
      en: {
        tag: "Guide",
        title: "Running payroll",
        desc: "Hours flow in, the engine computes WIT and INSS, a second person approves, the bank pack pays it out.",
      },
      pt: {
        tag: "Guia",
        title: "Processar a folha",
        desc: "As horas entram, o motor calcula WIT e INSS, uma segunda pessoa aprova, o pacote bancário paga.",
      },
      tet: {
        tag: "Gía",
        title: "Halo folha pagamentu",
        desc: "Oras tama, motór kalkula WIT no INSS, ema segundu aprova, pakote banku selu.",
      },
    },
  },
  {
    slug: "tax-and-filings",
    category: "guides",
    seo: {
      title: "Taxes & Statutory Filings — Xefe Documentation",
      description:
        "The Timor-Leste statutory calendar in Xefe: monthly WIT and INSS, official-template exports, and the annual returns your accountant files.",
      keywords:
        "Timor-Leste tax deadlines, INSS declaration, WIT return, ATTL filing, annual income tax Timor-Leste",
      url: "/docs/tax-and-filings",
      alternates: {
        tet: {
          title: "Impostu & Deklarasaun Legál — Dokumentasaun Xefe",
          description:
            "Kalendáriu legál Timor-Leste iha Xefe: WIT no INSS mensál, esporta iha modelu ofisiál, no deklarasaun anuál ne'ebé ita-nia kontabilista entrega.",
        },
        pt: {
          title: "Impostos & Declarações Legais — Documentação Xefe",
          description:
            "O calendário legal de Timor-Leste no Xefe: WIT e INSS mensais, exportações em modelo oficial e as declarações anuais que o seu contabilista entrega.",
        },
      },
    },
    hub: {
      en: {
        tag: "Guide",
        title: "Taxes & statutory filings",
        desc: "The monthly calendar, what Xefe generates in the official templates, and how the annual returns work.",
      },
      pt: {
        tag: "Guia",
        title: "Impostos & declarações",
        desc: "O calendário mensal, o que o Xefe gera nos modelos oficiais e como funcionam as declarações anuais.",
      },
      tet: {
        tag: "Gía",
        title: "Impostu & deklarasaun",
        desc: "Kalendáriu mensál, saida mak Xefe jera iha modelu ofisiál, no oinsá deklarasaun anuál sira serbisu.",
      },
    },
  },
  {
    slug: "invoices-and-money",
    category: "guides",
    seo: {
      title: "Invoices, Bills & Expenses — Xefe Documentation",
      description:
        "Send invoices with private hosted pages, record bills and expenses, reconcile the bank — every document posts its own balanced journal.",
      keywords:
        "invoices Timor-Leste, hosted invoice link, bills expenses, bank reconciliation, small business accounting Timor-Leste",
      url: "/docs/invoices-and-money",
      alternates: {
        tet: {
          title: "Fatura, Konta & Despeza — Dokumentasaun Xefe",
          description:
            "Haruka fatura ho pájina privada, rejista konta no despeza, rekonsilia banku — dokumentu ida-idak rejista nia lansamentu ekilibradu rasik.",
        },
        pt: {
          title: "Faturas, Contas & Despesas — Documentação Xefe",
          description:
            "Envie faturas com páginas privadas, registe contas e despesas, reconcilie o banco — cada documento regista o seu próprio lançamento equilibrado.",
        },
      },
    },
    hub: {
      en: {
        tag: "Guide",
        title: "Invoices, bills & expenses",
        desc: "Day-to-day money with automatic bookkeeping — hosted invoice pages, supplier bills, and bank reconciliation.",
      },
      pt: {
        tag: "Guia",
        title: "Faturas, contas & despesas",
        desc: "O dinheiro do dia a dia com contabilidade automática — páginas de fatura, contas de fornecedores e reconciliação bancária.",
      },
      tet: {
        tag: "Gía",
        title: "Fatura, konta & despeza",
        desc: "Osan loron-loron ho kontabilidade automátiku — pájina fatura, konta fornesedór no rekonsiliasaun banku.",
      },
    },
  },
  {
    slug: "time-and-leave",
    category: "guides",
    seo: {
      title: "Attendance, Leave & Shifts — Xefe Documentation",
      description:
        "Record hours once and they flow into payroll: attendance, Timor-Leste statutory leave types, shift coverage and server-computed balances.",
      keywords:
        "attendance Timor-Leste, leave types Lei 4/2012, maternity leave INSS, shift scheduling, timesheets",
      url: "/docs/time-and-leave",
      alternates: {
        tet: {
          title: "Prezensa, Lisensa & Turnu — Dokumentasaun Xefe",
          description:
            "Rejista oras dala ida de'it no sira tama ba folha: prezensa, tipu lisensa legál Timor-Leste, kobertura turnu no saldu ne'ebé servidór kalkula.",
        },
        pt: {
          title: "Assiduidade, Licenças & Turnos — Documentação Xefe",
          description:
            "Registe as horas uma vez e elas entram na folha: assiduidade, licenças legais de Timor-Leste, cobertura de turnos e saldos calculados no servidor.",
        },
      },
    },
    hub: {
      en: {
        tag: "Guide",
        title: "Attendance, leave & shifts",
        desc: "Hours recorded once flow into payroll — with the full set of Timor-Leste statutory leave types.",
      },
      pt: {
        tag: "Guia",
        title: "Assiduidade, licenças & turnos",
        desc: "Horas registadas uma vez entram na folha — com todas as licenças legais de Timor-Leste.",
      },
      tet: {
        tag: "Gía",
        title: "Prezensa, lisensa & turnu",
        desc: "Oras rejista dala ida tama ba folha — ho tipu lisensa legál Timor-Leste hotu.",
      },
    },
  },
  {
    slug: "payroll-money-chain",
    category: "architecture",
    custom: true,
    seo: {
      title: "The Payroll Money Chain — Xefe Documentation",
      description:
        "From a draft payroll run to closed books: approval steps, the three journals that move the money, every Timor-Leste statutory deadline, and seven system-enforced guarantees.",
      keywords:
        "payroll journal Timor-Leste, payroll approval, INSS payment deadline, WIT payment deadline, payroll accounting Timor-Leste, salary settlement journal",
      url: "/docs/payroll-money-chain",
      alternates: {
        tet: {
          title: "Kadeia Osan Folha Pagamentu nian — Dokumentasaun Xefe",
          description:
            "Husi prosesamentu rascunho to'o livru taka: pasu aprovasaun, lansamentu tolu ne'ebé book osan, prazu legál Timor-Leste hotu, no garantia hitu ne'ebé sistema impoin.",
        },
        pt: {
          title: "A Cadeia do Dinheiro da Folha — Documentação Xefe",
          description:
            "De um processamento em rascunho a livros fechados: passos de aprovação, os três lançamentos que movem o dinheiro, todos os prazos legais de Timor-Leste e sete garantias impostas pelo sistema.",
        },
      },
    },
    hub: {
      en: {
        tag: "Architecture",
        title: "The payroll money chain",
        desc: "How a run becomes closed books — the state machine, the journals, the deadlines, and the guarantees.",
      },
      pt: {
        tag: "Arquitetura",
        title: "A cadeia do dinheiro da folha",
        desc: "Como um processamento se torna livros fechados — a máquina de estados, os lançamentos, os prazos e as garantias.",
      },
      tet: {
        tag: "Arkitetura",
        title: "Kadeia osan folha nian",
        desc: "Oinsá prosesamentu sai livru taka — mákina estadu, lansamentu, prazu no garantia sira.",
      },
    },
  },
];

export function docsManifestBySlug(slug: string): DocsManifestEntry | undefined {
  return DOCS_MANIFEST.find((entry) => entry.slug === slug);
}
