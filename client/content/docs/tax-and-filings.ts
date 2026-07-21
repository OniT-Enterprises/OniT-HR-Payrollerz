/**
 * /docs/tax-and-filings content — Timor-Leste WIT, INSS and annual income tax
 * filing calendar, and exactly what Xefe generates for each obligation.
 * Rendered by the shared docs article page with the marketing design
 * language (lime accent, docs/DESIGN_MARKETING.md).
 *
 * PUBLIC-SAFE (docs/PUBLIC_SITE.md): statutes, deadlines and Xefe's own
 * product behavior only — never data sourcing, internal file paths, or
 * sign-off status. Sourced from docs/MONEY_CHAIN.md §3, docs/AUDIENCE_SPLIT.md
 * and client/lib/tax/compliance.ts.
 */
import type { LocalizedDocArticle } from "@/lib/docs/types";

export const article: LocalizedDocArticle = {
  en: {
    titleTop: "Taxes and",
    titleAccent: "statutory filings",
    lede: "Every monthly and annual date a Timor-Leste employer owes to the tax office and Social Security — and exactly what Xefe prepares for each one, straight from payroll you've already paid.",
    blocks: [
      {
        type: "prose",
        body: "Xefe computes your wage income tax (WIT) and INSS contributions from payroll you've actually run and paid — never from an estimate. Each month, that payroll turns straight into the exact figures your return needs. You stay in control of what actually gets submitted and when: Xefe prepares the numbers and the paperwork, not the click that files them.",
      },
      { type: "heading", id: "calendar", text: "The monthly calendar" },
      {
        type: "deadlines",
        items: [
          {
            day: "10",
            small: "following month",
            title: "INSS remuneration statement",
            body: "The monthly remuneration statement (DR), built in the INSS portal's official Excel template, submitted through the employer portal.",
          },
          {
            day: "15",
            small: "following month",
            title: "Wage income tax (WIT)",
            body: "The monthly ATTL wage income tax return and its payment — both due the same day.",
          },
          {
            day: "20",
            small: "following month",
            title: "INSS payment",
            body: "Late payment accrues 1% interest per month or fraction (Decree-Law 20/2017, Art. 39). Xefe flags an overdue balance with a running estimate.",
          },
        ],
      },
      { type: "heading", id: "generates", text: "What Xefe generates" },
      {
        type: "list",
        items: [
          "Monthly WIT return figures — the tax withheld and the taxable base behind it, ready for the ATTL form.",
          "Your INSS declaration, built to the INSS portal's own official Excel template, ready to upload as-is.",
          "Each employee's annual WIT certificate — a record of the wages paid and tax withheld for the year.",
          "The annual employer wage-tax reconciliation, matching twelve months of filings against the year.",
          "The working figures behind your annual income tax return (TADR-IT 1), organized for your accountant to check and file.",
        ],
      },
      {
        type: "heading",
        id: "return-vs-payment",
        text: "Return vs payment",
      },
      {
        type: "prose",
        body: "A filing and its payment are always two separate obligations, and Xefe tracks them separately. Marking a return as filed doesn't mark the tax as paid — an unpaid balance stays visibly overdue even after the paperwork is in. Record the payment once it clears, and Xefe posts the matching clearing entry to your books automatically, so your ledger and your filings never drift apart.",
      },
      {
        type: "table",
        headers: ["Obligation", "Return due", "Payment due"],
        rows: [
          ["INSS remuneration statement", "10th", "20th"],
          ["Wage income tax (WIT)", "15th", "15th"],
        ],
      },
      {
        type: "heading",
        id: "assisted-filing",
        text: "Assisted filing, honestly",
      },
      {
        type: "prose",
        body: "Xefe prepares exact figures and exports built to the government's own templates — the INSS portal's remuneration statement, the ATTL wage tax form. Submitting them still happens on the government's own portals, under your name. For the annual income tax return, Xefe goes one step further and prepares a full workpaper of the figures behind it — but the return itself is built for an accountant to review and file. Xefe never files anything on your behalf.",
      },
      {
        type: "callout",
        body: "Xefe calculates. You, or your accountant, submit. That split is deliberate: the numbers are exact, but the responsibility for filing stays with someone who can sign for it.",
      },
      {
        type: "callout",
        body: "The simple flow applies safe defaults, so a first-time small business is never asked to make a tax decision by accident. Accountant-grade detail — return-by-return figures, reconciliations, the annual workpaper — is there the moment you need it. See the accountant partners page for what changes once one joins your team.",
      },
    ],
  },
  pt: {
    titleTop: "Impostos e",
    titleAccent: "obrigações fiscais",
    lede: "Todas as datas mensais e anuais que uma empresa em Timor-Leste deve à Autoridade Tributária e à Segurança Social — e exatamente o que o Xefe prepara para cada uma, a partir da folha de pagamento que já processou e pagou.",
    blocks: [
      {
        type: "prose",
        body: "O Xefe calcula o seu imposto sobre salários (WIT) e as contribuições do INSS a partir da folha de pagamento que efetivamente processou e pagou — nunca de uma estimativa. Todos os meses, essa folha transforma-se diretamente nos valores exatos de que a sua declaração precisa. A decisão sobre o que é efetivamente submetido, e quando, continua a ser sua: o Xefe prepara os números e os documentos, não o clique que os entrega.",
      },
      { type: "heading", id: "calendar", text: "O calendário mensal" },
      {
        type: "deadlines",
        items: [
          {
            day: "10",
            small: "mês seguinte",
            title: "Declaração de remunerações INSS",
            body: "A declaração mensal de remunerações (DR), construída no modelo Excel oficial do portal do INSS, submetida através do portal do empregador.",
          },
          {
            day: "15",
            small: "mês seguinte",
            title: "Imposto sobre salários (WIT)",
            body: "A declaração mensal à ATTL e o respetivo pagamento — ambos no mesmo dia.",
          },
          {
            day: "20",
            small: "mês seguinte",
            title: "Pagamento do INSS",
            body: "O atraso acumula juros de 1% por mês ou fração (Decreto-Lei 20/2017, art. 39.º). O Xefe assinala um saldo em atraso com uma estimativa atualizada.",
          },
        ],
      },
      { type: "heading", id: "generates", text: "O que o Xefe prepara" },
      {
        type: "list",
        items: [
          "Os valores da declaração mensal de WIT — o imposto retido e a base tributável que o sustenta, prontos para o formulário da ATTL.",
          "A sua declaração de INSS, construída no modelo Excel oficial do portal, pronta a submeter tal como está.",
          "O certificado anual de WIT de cada trabalhador — um registo dos salários pagos e do imposto retido durante o ano.",
          "A reconciliação anual do imposto sobre salários do empregador, cruzando doze meses de declarações com o ano.",
          "Os valores de trabalho por trás da sua declaração anual de imposto sobre o rendimento (TADR-IT 1), organizados para o seu contabilista rever e entregar.",
        ],
      },
      {
        type: "heading",
        id: "return-vs-payment",
        text: "Declaração vs pagamento",
      },
      {
        type: "prose",
        body: "Uma declaração e o respetivo pagamento são sempre duas obrigações separadas, e o Xefe acompanha-as em separado. Marcar uma declaração como entregue não marca o imposto como pago — um saldo por pagar continua visivelmente em atraso mesmo depois de o documento estar entregue. Registe o pagamento assim que ele se concretizar, e o Xefe lança automaticamente o respetivo lançamento de regularização na sua contabilidade, para que os livros e as declarações nunca se desalinhem.",
      },
      {
        type: "table",
        headers: ["Obrigação", "Declaração até", "Pagamento até"],
        rows: [
          ["Declaração de remunerações INSS", "dia 10", "dia 20"],
          ["Imposto sobre salários (WIT)", "dia 15", "dia 15"],
        ],
      },
      {
        type: "heading",
        id: "assisted-filing",
        text: "Entrega assistida, com honestidade",
      },
      {
        type: "prose",
        body: "O Xefe prepara valores exatos e exportações construídas nos próprios modelos do governo — a declaração de remunerações do portal do INSS, o formulário de imposto sobre salários da ATTL. A submissão continua a acontecer nos portais do próprio governo, em seu nome. Para a declaração anual de imposto sobre o rendimento, o Xefe vai mais além e prepara um papel de trabalho completo com os valores subjacentes — mas a declaração em si é construída para o seu contabilista rever e entregar. O Xefe nunca entrega nada em seu nome.",
      },
      {
        type: "callout",
        body: "O Xefe calcula. Você, ou o seu contabilista, entrega. Essa separação é deliberada: os números são exatos, mas a responsabilidade pela entrega continua com alguém que a pode assinar.",
      },
      {
        type: "callout",
        body: "O fluxo simples aplica valores seguros por defeito, para que uma pequena empresa a começar nunca seja levada a tomar uma decisão fiscal por acidente. O detalhe ao nível do contabilista — valores declaração a declaração, reconciliações, o papel de trabalho anual — está disponível assim que precisar dele. Veja a página de parceiros contabilísticos para saber o que muda quando um contabilista se junta à sua equipa.",
      },
    ],
  },
  tet: {
    titleTop: "Impostu no",
    titleAccent: "deklarasaun obrigatóriu",
    lede: "Data ida-idak, fulan-fulan no tinan-tinan, ne'ebé empreza iha Timor-Leste tenke selu ba Autoridade Tributária no Seguransa Sosiál — no saida presiza mak Xefe prepara ba data ida-idak, hahú husi folha pagamentu ne'ebé ita selu ona.",
    blocks: [
      {
        type: "prose",
        body: "Xefe kalkula ita-nia impostu saláriu (WIT) no kontribuisaun INSS husi folha pagamentu ne'ebé ita prosesa no selu ona — nunka husi estimativa. Kada fulan, folha ne'e sai valór loloos ne'ebé deklarasaun presiza. Ita kontinua kontrola saida mak submete loloos no bainhira; Xefe prepara de'it númeru no dokumentu sira, la'ós klik ne'ebé entrega sira-ne'e.",
      },
      { type: "heading", id: "calendar", text: "Kalendáriu fulan-fulan nian" },
      {
        type: "deadlines",
        items: [
          {
            day: "10",
            small: "fulan tuir mai",
            title: "Deklarasaun remunerasaun INSS",
            body: "Deklarasaun remunerasaun (DR) fulan-fulan, halo tuir modelu Excel ofisiál portál INSS nian, submete liuhusi portál empregadór.",
          },
          {
            day: "15",
            small: "fulan tuir mai",
            title: "Impostu saláriu (WIT)",
            body: "Deklarasaun mensál ba ATTL no nia pagamentu — rua-rua iha loron hanesan.",
          },
          {
            day: "20",
            small: "fulan tuir mai",
            title: "Pagamentu INSS",
            body: "Atrazu akumula 1% kada fulan ka frasaun (Dekretu-Lei 20/2017, art. 39) — Xefe avizu ho estimativa moris.",
          },
        ],
      },
      { type: "heading", id: "generates", text: "Saida mak Xefe prepara" },
      {
        type: "list",
        items: [
          "Valór deklarasaun WIT fulan-fulan — impostu retein no baze taxável iha okos, prontu ba formuláriu ATTL.",
          "Ita-nia deklarasaun INSS, halo tuir modelu Excel ofisiál portál nian, prontu atu submete tuir mós.",
          "Sertifikadu WIT anuál trabalhadór ida-idak — rejistu saláriu ne'ebé selu no impostu ne'ebé retein durante tinan ida.",
          "Rekonsiliasaun anuál impostu saláriu empregadór nian, kompara deklarasaun 12 fulan ho tinan tomak.",
          "Valór servisu iha okos deklarasaun anuál rendimentu (TADR-IT 1), organizadu ba ita-nia kontabilista atu verifika no entrega.",
        ],
      },
      {
        type: "heading",
        id: "return-vs-payment",
        text: "Deklarasaun vs pagamentu",
      },
      {
        type: "prose",
        body: "Deklarasaun ida no nia pagamentu nunka obrigasaun hanesan, no Xefe kontrola sira ketak. Marka deklarasaun hanesan entregadu la marka impostu hanesan selu ona — saldu seidauk selu kontinua atrazadu ho klaru maski dokumentu tama ona. Rejistu pagamentu bainhira ida-ne'e klaru, no Xefe lansa automátiku lansamentu regularizasaun ba ita-nia livru kontabilidade — atu livru no deklarasaun sira kontinua hanesan.",
      },
      {
        type: "table",
        headers: ["Obrigasaun", "Deklarasaun to'o", "Pagamentu to'o"],
        rows: [
          ["Deklarasaun remunerasaun INSS", "loron 10", "loron 20"],
          ["Impostu saláriu (WIT)", "loron 15", "loron 15"],
        ],
      },
      {
        type: "heading",
        id: "assisted-filing",
        text: "Entrega ho asisténsia, ho lia loos",
      },
      {
        type: "prose",
        body: "Xefe prepara valór loloos no esportasaun ne'ebé halo tuir modelu governu nian rasik — deklarasaun remunerasaun portál INSS nian, formuláriu impostu saláriu ATTL nian. Submisaun kontinua akontese iha portál governu nian rasik, ho ita-nia naran. Ba deklarasaun anuál impostu rendimentu, Xefe halo liu tan no prepara valór servisu kompletu iha okos — maibé deklarasaun rasik halo ba ita-nia kontabilista atu verifika no entrega. Xefe nunka entrega buat ida ba ita-nia naran.",
      },
      {
        type: "callout",
        body: "Xefe kalkula. Ita, ka ita-nia kontabilista, entrega. Fahe ida-ne'e mak deliberadu: númeru sira loloos, maibé responsabilidade entrega kontinua iha ema ne'ebé bele asina ba ne'e.",
      },
      {
        type: "callout",
        body: "Fluxu simples aplika valór seguru automátiku, atu empreza kiik ne'ebé foin hahú nunka husu atu halo desizaun impostu ho la hatene. Detallu nivel kontabilista — valór deklarasaun ba deklarasaun, rekonsiliasaun, valór servisu anuál — disponivel bainhira ita presiza. Haree pájina parseiru kontabilista atu hatene saida mak muda bainhira kontabilista tama ita-nia ekipa.",
      },
    ],
  },
};
