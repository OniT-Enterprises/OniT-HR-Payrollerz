/**
 * /docs/running-payroll — public documentation article.
 *
 * Content data for the shared docs renderer (client/lib/docs/types.ts).
 * PUBLIC-SAFE (docs/PUBLIC_SITE.md): statutes and Xefe's own product
 * behavior only — never data sourcing, internal file paths, or sign-off
 * status.
 */
import type { LocalizedDocArticle } from "@/lib/docs/types";

export const article: LocalizedDocArticle = {
  en: {
    titleTop: "Running",
    titleAccent: "payroll",
    lede: "From opening the wizard to handing out payslips — what happens at each step, and the one place Xefe asks you to subscribe.",
    blocks: [
      {
        type: "prose",
        body: "Every payroll run in Xefe follows the same path: build it, get someone else to approve it, pay it, and hand out payslips. The engine handles the tax and social-security arithmetic; you review the numbers before they go anywhere.",
      },
      { type: "heading", id: "before-you-run", text: "Before you run" },
      {
        type: "prose",
        body: "Two things need to be in place before you open Run Payroll.",
      },
      {
        type: "list",
        items: [
          "Every employee needs a salary and contracted hours set on their profile — that's the starting point the engine uses for the period.",
          "Attendance is the one hours-entry workflow in Xefe. Whatever you record there — worked hours, overtime, absences — flows into payroll automatically; you don't re-enter anything.",
          "Night hours (21:00–06:00, including shifts that cross midnight) are detected automatically and paid at the statutory premium.",
        ],
      },
      { type: "heading", id: "the-run", text: "The run" },
      {
        type: "steps",
        items: [
          {
            title: "Open Run Payroll",
            body: "Start a new run from the Payroll menu.",
          },
          {
            title: "Confirm the period",
            body: "The pay period and pay date are pre-filled from your configured pay frequency. Adjust them only if this run is a genuine one-off.",
          },
          {
            title: "Review each employee",
            body: "Check hours, overtime, bonuses and deductions for everyone on the roster. Validation flags a missing salary, zero hours, or overtime past the legal 16 h/week cap before you can move on.",
          },
          {
            title: "Let the engine do the maths",
            body: "Withholding tax (WIT) and INSS contributions are calculated per employee, following Timor-Leste's statutory rules — never estimated. Every figure stays visible for review.",
          },
          {
            title: "Submit for approval",
            body: "This writes the run and its records. Building and reviewing a run is free on every plan — submitting is too. The run now waits for someone else to approve it.",
          },
        ],
      },
      { type: "heading", id: "approval", text: "Approval" },
      {
        type: "prose",
        body: "A payroll run can't be approved by the person who created it. A second person with payroll access has to open it and approve it — a database rule, not just a screen, so even a request that bypasses the app is refused if the approver and the creator match.\n\nApproving is also the one paid step anywhere in Xefe. Building, reviewing and reporting stay free on every plan; approving a run — what Xefe calls finalizing it — needs an active subscription. If you're on the free plan, you'll only be asked to subscribe at this step.",
      },
      { type: "heading", id: "payment", text: "Payment" },
      {
        type: "prose",
        body: "Once a run is approved, mark it as paid. Xefe asks for the payment date and a bank reference — both are required, and once attached to the run, that evidence can't be changed; a mistake gets fixed with a reversing entry, never by rewriting the record.\n\nMarking a run paid also generates your salary bank pack. For BNU, that's the emailed Excel transfer list and signed payment order the bank actually expects — the same style pack is available for BNCTL as a best-effort layout, worth confirming with your branch.",
      },
      {
        type: "ledger",
        title: "Settlement journal",
        when: "on payment",
        foot: "Salaries leave the bank through the bank's own salary-batch process, with a signed payment order.",
        rows: [
          { code: "2210", name: "Net salaries payable", side: "dr" },
          { code: "11xx", name: "Cash / bank", side: "cr" },
        ],
      },
      { type: "heading", id: "payslips", text: "Payslips" },
      {
        type: "prose",
        body: "Every employee gets their own payslip as soon as the run is approved — you don't need to wait until it's paid. Each one is a PDF, trilingual in English, Portuguese and Tetun, with gross pay, every earning and deduction, and net pay laid out line by line.",
      },
      {
        type: "callout",
        body: "Curious how a payroll run becomes closed books? The payroll money chain article walks through every state change, the journals that move the money, the statutory deadlines that follow, and the guarantees that hold it all together — see /docs/payroll-money-chain.",
      },
    ],
  },
  pt: {
    titleTop: "Como processar",
    titleAccent: "a folha de pagamento",
    lede: "Desde abrir o assistente até entregar os recibos — o que acontece em cada passo, e o único ponto em que o Xefe pede uma subscrição.",
    blocks: [
      {
        type: "prose",
        body: "Cada processamento de folha no Xefe segue o mesmo caminho: preparar, obter a aprovação de uma segunda pessoa, pagar e entregar os recibos de vencimento. O motor calcula o imposto e a segurança social; os valores ficam sempre visíveis para revisão antes de avançar.",
      },
      { type: "heading", id: "before-you-run", text: "Antes de processar" },
      {
        type: "prose",
        body: "Duas coisas têm de estar prontas antes de abrir o Processar Folha.",
      },
      {
        type: "list",
        items: [
          "Cada funcionário precisa de um salário e de horas contratadas definidas no seu perfil — é o ponto de partida que o motor usa para o período.",
          "A Presença é o único fluxo de registo de horas no Xefe. Tudo o que aí regista — horas trabalhadas, horas extra, faltas — entra automaticamente na folha; não é preciso repetir nada.",
          "As horas noturnas (21h00–06h00, incluindo turnos que atravessam a meia-noite) são detetadas automaticamente e pagas com o acréscimo legal.",
        ],
      },
      { type: "heading", id: "the-run", text: "O processamento" },
      {
        type: "steps",
        items: [
          {
            title: "Abrir o Processar Folha",
            body: "Comece um novo processamento a partir do menu Folha.",
          },
          {
            title: "Confirmar o período",
            body: "O período de pagamento e a data de pagamento vêm pré-preenchidos a partir da frequência de pagamento configurada. Só os ajuste se este processamento for mesmo excecional.",
          },
          {
            title: "Rever cada funcionário",
            body: "Confirme horas, horas extra, bónus e deduções de cada pessoa na lista. A validação sinaliza um salário em falta, zero horas, ou horas extra acima do limite legal de 16 h/semana antes de poder avançar.",
          },
          {
            title: "Deixar o motor calcular",
            body: "O imposto sobre salários (WIT) e as contribuições do INSS são calculados por funcionário, seguindo as regras legais de Timor-Leste — nunca estimados. Cada valor fica visível para revisão.",
          },
          {
            title: "Submeter para aprovação",
            body: "Este passo grava o processamento e os seus registos. Preparar e rever a folha é grátis em qualquer plano — submeter também. O processamento fica agora à espera que outra pessoa o aprove.",
          },
        ],
      },
      { type: "heading", id: "approval", text: "Aprovação" },
      {
        type: "prose",
        body: 'Um processamento de folha não pode ser aprovado por quem o criou. Uma segunda pessoa com acesso à folha tem de o abrir e aprovar — uma regra da base de dados, não só do ecrã, por isso um pedido que contorne a aplicação é recusado se o aprovador e o criador forem a mesma pessoa.\n\nAprovar é também o único passo pago em todo o Xefe. Preparar, rever e gerar relatórios continuam grátis em qualquer plano; aprovar um processamento — o que o Xefe chama de "finalizar" — exige uma subscrição ativa. Quem está no plano gratuito só é convidado a subscrever neste passo.',
      },
      { type: "heading", id: "payment", text: "Pagamento" },
      {
        type: "prose",
        body: "Depois de aprovado, marque o processamento como pago. O Xefe pede a data do pagamento e uma referência bancária — ambas obrigatórias — e, uma vez associada ao processamento, essa evidência não pode ser alterada; um erro corrige-se com um lançamento de estorno, nunca reescrevendo o registo.\n\nMarcar como pago também gera o seu pacote bancário de salários. Para o BNU, é a lista de transferências em Excel enviada por email e a ordem de pagamento assinada, no formato que o banco realmente espera — o mesmo tipo de pacote está disponível para o BNCTL como modelo best-effort, a confirmar com a sua agência.",
      },
      {
        type: "ledger",
        title: "Lançamento de liquidação",
        when: "no pagamento",
        foot: "Os salários saem do banco pelo processo de lote salarial do próprio banco, com ordem de pagamento assinada.",
        rows: [
          { code: "2210", name: "Salários líquidos a pagar", side: "dr" },
          { code: "11xx", name: "Caixa / banco", side: "cr" },
        ],
      },
      { type: "heading", id: "payslips", text: "Recibos de vencimento" },
      {
        type: "prose",
        body: "Cada funcionário recebe o seu recibo assim que o processamento é aprovado — não é preciso esperar que seja pago. Cada recibo é um PDF trilingue, em inglês, português e tétum, com o salário bruto, cada rendimento e dedução, e o salário líquido, linha a linha.",
      },
      {
        type: "callout",
        body: "Quer perceber como um processamento de folha se torna livros fechados? O artigo A cadeia do dinheiro da folha percorre cada mudança de estado, os lançamentos que movem o dinheiro, os prazos legais que se seguem, e as garantias que sustentam tudo isto — veja /docs/payroll-money-chain.",
      },
    ],
  },
  tet: {
    titleTop: "Oinsá atu",
    titleAccent: "halo saláriu",
    lede: "Husi loke assistente to'o fó payslip — saida mak akontese iha pasu ida-idak, no fatin úniku ne'ebé Xefe husu subskrisaun.",
    blocks: [
      {
        type: "prose",
        body: "Prosesamentu saláriu ida-idak iha Xefe lori dalan hanesan: prepara, husu ema seluk atu aprova, selu, no fó payslip. Motór trata kálkulu impostu no seguransa sosiál nian; valor sira kontinua vizível ba revizaun antes sira lao ba oin.",
      },
      { type: "heading", id: "before-you-run", text: "Antes ita halo saláriu" },
      {
        type: "prose",
        body: "Buat rua tenke iha ona molok ita loke Halo Saláriu.",
      },
      {
        type: "list",
        items: [
          "Trabalhador ida-idak presiza saláriu no oras kontratu ne'ebé konfigura iha nia perfíl — ne'e mak ponta partida ne'ebé motór uza ba períodu ne'e.",
          "Prezensa mak fluxu úniku ba rejista oras iha Xefe. Buat hotu ne'ebé ita rejista iha ne'e — oras servisu, oras extra, falta — tama automátikamente ba saláriu; la presiza hakerek fila fali.",
          "Oras kalan (21:00–06:00, inklui turnu ne'ebé liu meia-noite) deteta automátikamente no selu ho aumentu legál.",
        ],
      },
      { type: "heading", id: "the-run", text: "Prosesu Saláriu" },
      {
        type: "steps",
        items: [
          {
            title: "Loke Halo Saláriu",
            body: "Hahu prosesamentu foun husi menu Folha.",
          },
          {
            title: "Konfirma períodu",
            body: "Períodu pagamentu no data pagamentu tama automátikamente husi frekuénsia pagamentu ne'ebé ita konfigura ona. Muda de'it se prosesamentu ida-ne'e mak esesaun loloos.",
          },
          {
            title: "Reviza trabalhador ida-idak",
            body: "Konfirma oras, oras extra, bónus no dedusaun ba ema ida-idak iha lista. Validasaun hatudu saláriu falta, oras zero, ka oras extra liu limite legál oras 16 kada semana molok ita bele kontinua.",
          },
          {
            title: "Husik motór halo kálkulu",
            body: "Impostu saláriu (WIT) no kontribuisaun INSS kalkula ba trabalhador ida-idak, tuir regra legál Timor-Leste — nunka estima. Valor ida-idak kontinua vizível ba revizaun.",
          },
          {
            title: "Submete ba aprovasaun",
            body: "Pasu ida-ne'e hakerek prosesamentu no rejistu sira. Prepara no reviza folha grátis iha planu hotu — submete mós grátis. Prosesamentu agora hein ema seluk atu aprova.",
          },
        ],
      },
      { type: "heading", id: "approval", text: "Aprovasaun" },
      {
        type: "prose",
        body: "Prosesamentu saláriu labele aprovadu husi ema ne'ebé kria. Ema segundu ne'ebé iha asesu ba folha tenke loke no aprova — regra baze dadus nian, la'ós de'it iha ekrã, tan ne'e mésmu pedidu ne'ebé kontorna aplikasaun rejeitadu se aprovadór no kriadór hanesan ema ida.\n\nAprova mós mak pasu úniku ne'ebé selu iha Xefe tomak. Prepara, reviza no kria relatóriu kontinua grátis iha planu hotu; aprova prosesamentu ida — buat ne'ebé Xefe bolu \"finaliza\" — presiza subskrisaun ativu. Se ita iha planu grátis, konvida de'it atu subskreve iha pasu ida-ne'e.",
      },
      { type: "heading", id: "payment", text: "Pagamentu" },
      {
        type: "prose",
        body: "Depois aprovadu ona, marka prosesamentu hanesan selu ona. Xefe husu data pagamentu no referénsia banku — rua-rua obrigatóriu — no bainhira liga tiha ona ba prosesamentu, evidénsia ne'e nunka bele muda; sala hadi'a ho lansamentu estornu, nunka hakerek fila fali rejistu.\n\nMarka hanesan selu ona mós kria ita-nia pakote banku saláriu nian. Ba BNU, ne'e mak lista transferénsia Excel haruka liuhusi email no orden pagamentu asinadu, iha formatu ne'ebé banku hakarak duni — pakote hanesan mós disponível ba BNCTL nu'udar modelu best-effort, diak liu konfirma ho ita-nia agénsia.",
      },
      {
        type: "ledger",
        title: "Lansamentu likidasaun",
        when: "iha pagamentu",
        foot: "Saláriu sira sai husi banku liuhusi prosesu lote saláriu banku nian rasik, ho orden pagamentu asinadu.",
        rows: [
          { code: "2210", name: "Saláriu líkidu atu selu", side: "dr" },
          { code: "11xx", name: "Kaixa / banku", side: "cr" },
        ],
      },
      { type: "heading", id: "payslips", text: "Payslip" },
      {
        type: "prose",
        body: "Trabalhador ida-idak simu nia payslip rasik hafoin prosesamentu aprovadu — la presiza hein to'o selu ona. Payslip ida-idak mak PDF trilingue, iha Ingles, Portugés no Tetun, ho saláriu brutu, rendimentu no dedusaun ida-idak, no saláriu líkidu, liña ba liña.",
      },
      {
        type: "callout",
        body: "Hakarak hatene oinsá prosesamentu saláriu sai livru taka? Artigu Kadeia osan folha nian la'o liuhusi mudansa estadu ida-idak, lansamentu sira-ne'ebé book osan, prazu legál sira-ne'ebé tuir, no garantia sira-ne'ebé kaer buat hotu metin — haree /docs/payroll-money-chain.",
      },
    ],
  },
};
