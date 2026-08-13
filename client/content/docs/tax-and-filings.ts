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
        body: "Xefe computes your wage income tax (WIT) and INSS contributions from payroll you've actually run and paid — never from an estimate. WIT follows the month wages are paid, and each employee must be marked resident or non-resident using the tax residence tests; nationality and shareholder status do not create a tax exemption. You stay in control of what actually gets submitted and when: Xefe prepares the numbers and the paperwork, not the click that files them.",
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
          "Services-tax assistance for hotel, restaurant/bar and telecommunications receipts. Mixed businesses enter only their designated-service receipts; Xefe never taxes all turnover from the sector label alone.",
          "Income-tax installment figures at 0.5% of the reviewed turnover base, with quarterly/monthly frequency based on prior-year turnover.",
          "The working figures behind your annual income tax return (TADR-IT 1), including Schedule VII's 100% tax-depreciation schedule, organized for your accountant to check and file.",
        ],
      },
      {
        type: "heading",
        id: "return-vs-payment",
        text: "Return vs payment",
      },
      {
        type: "prose",
        body: "A filing and its payment are separate obligations. Xefe tracks both statuses for WIT and INSS. Services tax and income-tax installments each have their own declaration record: filing one never marks another as filed just because the month matches. Once a declaration is recorded as filed, its declared figures are frozen; evidence can still be added.",
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
        body: "O Xefe calcula o imposto sobre salários (WIT) e o INSS a partir da folha efetivamente processada e paga. O WIT segue o mês em que o salário é pago, e cada trabalhador deve ser classificado como residente ou não residente pelos testes de residência fiscal; nacionalidade e qualidade de acionista não criam isenção. A entrega continua sob o seu controlo.",
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
          "Apoio ao imposto sobre serviços para receitas de hotel, restaurante/bar e telecomunicações. Negócios mistos introduzem apenas receitas de serviços designados.",
          "Valores do imposto prestacional a 0,5% da base revista, com frequência trimestral ou mensal conforme o volume de negócios do ano anterior.",
          "Os valores de trabalho da declaração anual (TADR-IT 1), incluindo a tabela fiscal de depreciação de 100% do Anexo VII, para revisão do contabilista.",
        ],
      },
      {
        type: "heading",
        id: "return-vs-payment",
        text: "Declaração vs pagamento",
      },
      {
        type: "prose",
        body: "A declaração e o pagamento são obrigações separadas. O Xefe acompanha ambos os estados para WIT e INSS. O imposto sobre serviços e o imposto prestacional têm, cada um, o seu próprio registo de declaração: entregar um não marca outro como entregue no mesmo mês. Depois de registada a entrega, os valores declarados ficam congelados; ainda pode acrescentar comprovativos.",
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
        body: "Xefe kalkula WIT no INSS husi folha ne'ebé prosesa no selu ona. WIT tuir fulan ne'ebé saláriu selu, no traballadór ida-idak tenke hili rezidente ka la'ós rezidente tuir teste rezidénsia fiskál; nasionalidade no acionista la halo izensaun. Ita kontinua kontrola submisaun.",
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
          "Asisténsia impostu servisu ba resibu hotel, restaurante/bar no telekomunikasaun. Negósiu mistu hatama deit resibu servisu dezignadu.",
          "Valór impostu prestasaun 0,5% hosi baze ne'ebé revee, ho frekuénsia trimestrál ka mensál tuir volume negósiu tinan kotuk.",
          "Valór servisu TADR-IT 1, inklui tabela depreciasaun fiskál 100% Anexu VII, ba kontabilista atu verifika.",
        ],
      },
      {
        type: "heading",
        id: "return-vs-payment",
        text: "Deklarasaun vs pagamentu",
      },
      {
        type: "prose",
        body: "Deklarasaun no pagamentu mak obrigasaun ketak. Xefe akompaña estadu rua ba WIT no INSS. Impostu servisu no impostu prestasaun ida-idak iha rejistu deklarasaun rasik; entrega ida la marka ida seluk iha fulan hanesan. Depois rejista nu'udar hatama ona, valór deklaradu labele muda; bele aumenta evidénsia.",
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
