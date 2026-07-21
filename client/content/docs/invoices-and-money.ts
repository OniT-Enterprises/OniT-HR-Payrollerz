/**
 * /docs/invoices-and-money — public documentation article.
 *
 * Content data for the shared docs renderer (client/lib/docs/types.ts).
 * PUBLIC-SAFE (docs/PUBLIC_SITE.md): statutes and Xefe's own product
 * behavior only — never data sourcing, internal file paths, tests, or
 * sign-off status. The hosted invoice page is described as a "private
 * page", never by its token/link-storage mechanics. Sourced from
 * docs/INVOICING.md, docs/AUDIENCE_SPLIT.md and docs/MONEY_CHAIN.md.
 */
import type { LocalizedDocArticle } from "@/lib/docs/types";

export const article: LocalizedDocArticle = {
  en: {
    titleTop: "Invoices, bills and",
    titleAccent: "expenses",
    lede: "Where the everyday money lives: what customers owe you, what you owe suppliers, and what the business has spent. Every document you create here posts its own balanced journal entry to your books automatically.",
    blocks: [
      {
        type: "prose",
        body: "This is the day-to-day money work — sending an invoice, paying a supplier, logging a fuel receipt, matching your bank statement. You do the everyday task in plain language; Xefe keeps the accounting behind it in step, automatically.",
      },
      { type: "heading", id: "invoices", text: "Invoices" },
      {
        type: "steps",
        items: [
          {
            title: "Create it",
            body: "Add your customer, the line items and your payment terms. Save it as a draft while you're still deciding, or send it straight away.",
          },
          {
            title: "Send it",
            body: "Sending creates a private hosted page for that invoice, which you can share by WhatsApp or email — no login required. Your customer sees a clean page in Tetun, English or Portuguese, with a button to download the PDF. That PDF is frozen exactly as it looked the moment you sent it, even if you change your invoice template afterwards.",
          },
          {
            title: "Record the payment when it arrives",
            body: "Log cash, bank transfer, card, mobile money or cheque against the invoice. The balance still owed updates immediately, and once it's fully paid the invoice is marked paid — nothing else to do.",
          },
        ],
      },
      { type: "heading", id: "recurring-invoices", text: "Recurring invoices" },
      {
        type: "prose",
        body: "For a customer you bill on a schedule — work paid monthly, a subscription — set it up once as a recurring invoice, and Xefe generates a fresh invoice automatically at the interval you choose. Pause it whenever the arrangement changes; every invoice it generates works exactly like one you created by hand — send it, share it, get paid.",
      },
      { type: "heading", id: "bills-and-expenses", text: "Bills and expenses" },
      {
        type: "prose",
        body: "This is the other side of the same coin: money going out instead of coming in.",
      },
      {
        type: "list",
        items: [
          "Record a supplier bill as soon as it arrives, due date included, so nothing slips past you",
          "Mark a bill paid once you've settled it, and what you still owe updates on its own",
          "Log everyday expenses with their receipts attached — fuel, supplies, rent, whatever the business spent on",
          "Supplier withholding tax stays out of the everyday path by default — an ordinary bill needs no extra decisions. If your accountant wants finer control over it, turning on advanced tax mode in Settings adds those controls without changing how anyone else works",
        ],
      },
      { type: "heading", id: "bank-reconciliation", text: "Bank reconciliation" },
      {
        type: "prose",
        body: "Import your bank statement and Xefe lines each transaction up against the invoices, bills and payroll payments you've already recorded. Matching a transaction is not just tidying a list — it settles the books: the invoice or bill it belongs to is marked paid and the matching journal entry is posted, so your records and your bank agree.",
      },
      {
        type: "callout",
        body: "Accounting owns the formal side of all of this — journal entries, the general ledger, the trial balance, the income statement and the balance sheet. You never have to post any of it yourself: every invoice, bill, expense, payment and reconciled transaction on this page feeds it automatically.",
      },
    ],
  },
  pt: {
    titleTop: "Faturas, contas e",
    titleAccent: "despesas",
    lede: "Onde vive o dinheiro do dia a dia: o que os clientes lhe devem, o que deve a fornecedores, e o que a empresa gastou. Cada documento que cria aqui lança automaticamente o seu próprio lançamento equilibrado nos livros.",
    blocks: [
      {
        type: "prose",
        body: "Este é o trabalho diário com dinheiro — enviar uma fatura, pagar um fornecedor, registar um recibo de combustível, reconciliar o extrato bancário. Faz a tarefa do dia a dia em linguagem simples; o Xefe mantém a contabilidade por trás sempre atualizada, automaticamente.",
      },
      { type: "heading", id: "invoices", text: "Faturas" },
      {
        type: "steps",
        items: [
          {
            title: "Crie a fatura",
            body: "Adicione o cliente, os itens e as condições de pagamento. Guarde como rascunho enquanto decide, ou envie de imediato.",
          },
          {
            title: "Envie-a",
            body: "Enviar cria uma página privada para essa fatura, que pode partilhar por WhatsApp ou email — sem necessidade de login. O cliente vê uma página limpa em Tétum, Inglês ou Português, com um botão para descarregar o PDF. Esse PDF fica congelado exatamente como estava no momento do envio, mesmo que altere o modelo da fatura depois.",
          },
          {
            title: "Registe o pagamento quando chegar",
            body: "Registe dinheiro, transferência bancária, cartão, mobile money ou cheque contra a fatura. O saldo em dívida atualiza-se de imediato e, assim que estiver totalmente paga, a fatura fica marcada como paga — sem mais nenhum passo.",
          },
        ],
      },
      { type: "heading", id: "recurring-invoices", text: "Faturas recorrentes" },
      {
        type: "prose",
        body: "Para um cliente que fatura com regularidade — trabalho pago todos os meses, uma subscrição — configure uma vez como fatura recorrente e o Xefe gera automaticamente uma nova fatura no intervalo que escolher. Pause-a sempre que o acordo mudar; cada fatura gerada funciona exatamente como uma criada à mão — enviar, partilhar, receber o pagamento.",
      },
      { type: "heading", id: "bills-and-expenses", text: "Contas e despesas" },
      {
        type: "prose",
        body: "É o outro lado da mesma moeda: dinheiro a sair em vez de a entrar.",
      },
      {
        type: "list",
        items: [
          "Registe uma conta de fornecedor assim que chegar, com a data de vencimento incluída, para nada passar despercebido",
          "Marque uma conta como paga assim que a liquidar, e o que ainda deve atualiza-se sozinho",
          "Registe as despesas do dia a dia com os respetivos recibos anexados — combustível, material, renda, o que a empresa gastar",
          "A retenção a fornecedores fica fora do fluxo diário por defeito — uma conta normal não precisa de decisões extra. Se o seu contabilista quiser mais controlo sobre isso, ativar o modo fiscal avançado em Definições acrescenta esses controlos sem mudar o modo de trabalhar de mais ninguém",
        ],
      },
      { type: "heading", id: "bank-reconciliation", text: "Reconciliação bancária" },
      {
        type: "prose",
        body: "Importe o extrato bancário e o Xefe alinha cada transação com as faturas, contas e pagamentos de folha que já registou. Corresponder uma transação não é só arrumar uma lista — liquida os livros: a fatura ou conta a que pertence fica marcada como paga e o lançamento correspondente é lançado, para que os seus registos e o seu banco fiquem de acordo.",
      },
      {
        type: "callout",
        body: "A Contabilidade fica responsável pela parte formal de tudo isto — lançamentos, razão geral, balancete, demonstração de resultados e balanço. Nunca precisa de lançar nada disto à mão: cada fatura, conta, despesa, pagamento e transação reconciliada nesta página alimenta-a automaticamente.",
      },
    ],
  },
  tet: {
    titleTop: "Fatura, konta no",
    titleAccent: "despeza",
    lede: "Ne'e mak fatin ba osan loron-loron — saida mak kliente sira selu ba ita, saida mak ita selu ba fornesedor, no saida mak negósiu gasta ona. Dokumentu ida-idak ita kria iha ne'e lansa automátiku nia lansamentu jornál balansadu rasik ba ita-nia livru kontabilidade.",
    blocks: [
      {
        type: "prose",
        body: "Ne'e mak servisu osan loron-loron — haruka fatura, selu fornesedor, rejista resibu kombustível, kombina ita-nia transasaun banku. Ita halo tarefa loron-loron ho lian simples; Xefe rai kontabilidade iha kotuk atualizadu nafatin, automátiku.",
      },
      { type: "heading", id: "invoices", text: "Fatura" },
      {
        type: "steps",
        items: [
          {
            title: "Kria fatura",
            body: "Tau kliente, item sira no kondisaun pagamentu. Rai nu'udar raskuñu bainhira ita seidauk deside, ka haruka kedas.",
          },
          {
            title: "Haruka",
            body: "Haruka kria pájina privada ida ba fatura ne'e, ne'ebé ita bele fahe liu husi WhatsApp ka email — la presiza login. Kliente haree pájina moos ida iha Tetun, Inglés ka Portugés, ho butaun atu download PDF. PDF ne'e hela nafatin hanesan iha momentu haruka, maski ita muda modelu fatura nian depois.",
          },
          {
            title: "Rejista pagamentu bainhira to'o",
            body: "Rejista osan-kontante, transferénsia bankária, kartaun, osan móvel ka xeke kontra fatura ne'e. Saldo divida atualiza kedas, no bainhira selu ona hotu, fatura marka hanesan selu tiha — laiha pasu seluk atu halo.",
          },
        ],
      },
      { type: "heading", id: "recurring-invoices", text: "Fatura rekorrente" },
      {
        type: "prose",
        body: "Ba kliente ida ne'ebé ita fatura kada fulan — servisu ne'ebé selu regulár, subskrisaun — konfigura dala ida de'it nu'udar fatura rekorrente, no Xefe sei gera fatura foun automátiku tuir intervalu ne'ebé ita hili. Pausa bainhira arranju muda; fatura ida-idak ne'ebé gera funsiona hanesan ida ne'ebé ita kria ho liman rasik — haruka, fahe, simu pagamentu.",
      },
      { type: "heading", id: "bills-and-expenses", text: "Konta no despeza" },
      {
        type: "prose",
        body: "Ne'e mak kona-ba osan ne'ebé sai, la'ós osan ne'ebé tama.",
      },
      {
        type: "list",
        items: [
          "Rejista konta (fatura husi fornesedor) kedas bainhira to'o, inklui data vensimentu, atu laiha buat ida haleu",
          "Marka konta hanesan selu tiha bainhira ita likida ona, no saldo ne'ebé ita sei selu atualiza automátiku",
          "Rejista despeza loron-loron ho resibu aneksu — kombustível, material, aluguel, buat hotu ne'ebé negósiu gasta ba",
          "Retensaun fornesedór la mosu iha fluxu loron-loron — konta normál la presiza desizaun adisionál. Se ita-nia kontabilista hakarak kontrolu detallu liu, ativa modu impostu avansadu iha Konfigurasaun aumenta kontrolu sira-ne'e sein muda oinsá ema seluk servisu",
        ],
      },
      { type: "heading", id: "bank-reconciliation", text: "Rekonsiliasaun banku" },
      {
        type: "prose",
        body: "Importa ita-nia transasaun banku no Xefe kombina transasaun ida-idak ho fatura, konta no pagamentu folha ne'ebé ita rejista ona. Kombina transasaun ida la'ós de'it organiza lista — ida-ne'e rekonsilia livru sira: fatura ka konta ne'ebé nia liga ba marka hanesan selu tiha no lansamentu jornál kombinadu tama, atu ita-nia rejistu no ita-nia banku hanesan.",
      },
      {
        type: "callout",
        body: "Kontabilidade mak sira-nian ba parte formál husi buat hotu ne'e — lansamentu jornál, livru jerál, balansu prova, demonstrasaun rendimentu no balansu. Ita nunka presiza lansa ida-ne'e ho liman rasik: fatura, konta, despeza, pagamentu no transasaun rekonsilia ida-idak iha pájina ne'e tama automátiku ba nia.",
      },
    ],
  },
};
