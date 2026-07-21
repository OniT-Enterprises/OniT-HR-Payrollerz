/**
 * /docs/getting-started — public documentation article.
 *
 * PUBLIC-SAFE (docs/PUBLIC_SITE.md): statutes, deadlines and Xefe's own
 * product behavior only — never data sourcing, internal file paths, tests,
 * or sign-off status.
 */
import type { LocalizedDocArticle } from "@/lib/docs/types";

export const article: LocalizedDocArticle = {
  en: {
    titleTop: "Getting started",
    titleAccent: "with Xefe",
    lede: "Create your account, set up your company, add your team, and get ready for your first payroll — in about the time it takes to make coffee.",
    blocks: [
      {
        type: "prose",
        body: "Xefe brings HR, payroll, time & leave, invoicing, and accounting together for Timor-Leste businesses, with Timor-Leste's own tax and labor rules — wage income tax (WIT) withholding, INSS contributions, and statutory leave — built in as the default.\n\nEvery feature is free to use. The only thing that ever needs a subscription is finalizing a payroll run. Setting up your company, adding your team, building a draft payroll, invoicing, and reporting are all free from day one.",
      },
      {
        type: "heading",
        id: "create-your-account",
        text: "Create your account",
      },
      {
        type: "steps",
        items: [
          {
            title: "Sign up",
            body: "Go to the sign-up page and enter your full name, work email, and a password — or continue with Google in one click. No card is needed.",
          },
          {
            title: "Name your company",
            body: "Enter your company's name. Xefe turns it into a short company address automatically, which you can edit if you'd rather choose your own. Create the account and you're straight into Xefe.",
          },
        ],
      },
      {
        type: "heading",
        id: "first-run-setup",
        text: "First-run setup",
      },
      {
        type: "prose",
        body: "The first time you sign in, a short setup wizard walks you through three quick steps. You can skip ahead to your dashboard at any point — nothing you've entered is lost, and Xefe picks up where you left off.",
      },
      {
        type: "steps",
        items: [
          {
            title: "Company details",
            body: "Enter your legal company name and Tax Identification Number (TIN/NIF) — the only two required fields. Trading name, address, phone, email, sector, and team size are optional and can wait. Your Employer NISS (INSS registration number) is added separately later, in Settings → Company Details, once you're ready to file INSS.",
          },
          {
            title: "Salary payment",
            body: "Choose how you pay salaries: cash, or bank transfer. Cash needs no bank details at all. Bank transfer needs a bank name and account number — BNU, Bank Mandiri, ANZ, and BNCTL all appear as options.",
          },
          {
            title: "Payroll basics",
            body: "Pick your monthly pay day (any day from 1 to 28) and confirm your currency — Timor-Leste uses USD. Xefe applies Timor-Leste's default rates automatically: WIT withholding above $500/month, INSS at 4% employee / 6% employer, a 44-hour standard week, and default leave entitlements under Timor-Leste labor law. Every one of these stays editable later in Settings.",
          },
        ],
      },
      {
        type: "heading",
        id: "add-your-team",
        text: "Add your team",
      },
      {
        type: "steps",
        items: [
          {
            title: "Add an employee",
            body: "From People, add each person's basics — name, email, date of birth — plus job details (department, job title, start date, employment type) and monthly salary. Timorese staff need a Bilhete de Identidade and an INSS number on file; foreign staff need a passport. The rest of the profile can be filled in later.",
          },
          {
            title: "Invite your teammates",
            body: "Go to Settings → Team access to invite people by email and give each one a role — Owner, HR administrator, Accountant, Manager, or Viewer. Each role starts with standard access to only the parts of Xefe that job needs, so an accountant sees the books without member management, and a manager sees only their own team.",
          },
        ],
      },
      {
        type: "heading",
        id: "your-first-payroll",
        text: "Your first payroll",
      },
      {
        type: "prose",
        body: "With your team in place, build a draft payroll run and review every calculated amount — wages, WIT, INSS, overtime — before anything is final. A second person approves the run (never the same person who built it), and finalizing it is the one step that needs an active subscription. See our Running payroll guide for the full walkthrough, from a draft run to paid payslips.",
      },
      {
        type: "callout",
        body: "Stuck on anything? Message us on WhatsApp at +670 7337 1307 — support is available in English, Portuguese, and Tetun.",
      },
    ],
  },
  pt: {
    titleTop: "Começar",
    titleAccent: "com o Xefe",
    lede: "Crie a conta, configure a empresa, adicione a equipa e prepare a primeira folha de pagamento — no tempo que demora a fazer um café.",
    blocks: [
      {
        type: "prose",
        body: "O Xefe reúne RH, folha de pagamento, tempo & licenças, faturação e contabilidade para empresas em Timor-Leste, com as regras fiscais e laborais de Timor-Leste — retenção do imposto sobre o rendimento do trabalho (IRT), contribuições para o INSS e licenças legais — já incluídas por defeito.\n\nTodas as funcionalidades são gratuitas. A única coisa que alguma vez exige subscrição é finalizar um processamento de folha. Configurar a empresa, adicionar a equipa, preparar um processamento em rascunho, faturar e gerar relatórios são gratuitos desde o primeiro dia.",
      },
      {
        type: "heading",
        id: "create-your-account",
        text: "Criar a sua conta",
      },
      {
        type: "steps",
        items: [
          {
            title: "Registar-se",
            body: "Aceda à página de registo e introduza o seu nome completo, email de trabalho e uma palavra-passe — ou continue com o Google num só clique. Não é preciso cartão.",
          },
          {
            title: "Dê o nome à sua empresa",
            body: "Introduza o nome da sua empresa. O Xefe transforma-o automaticamente num endereço de empresa curto, que pode editar se preferir escolher o seu próprio. Crie a conta e entra diretamente no Xefe.",
          },
        ],
      },
      {
        type: "heading",
        id: "first-run-setup",
        text: "Configuração inicial",
      },
      {
        type: "prose",
        body: "Na primeira vez que inicia sessão, um pequeno assistente de configuração guia-o por três passos rápidos. Pode avançar para o painel a qualquer momento — nada do que introduziu se perde, e o Xefe retoma onde parou.",
      },
      {
        type: "steps",
        items: [
          {
            title: "Dados da empresa",
            body: "Introduza o nome legal da empresa e o Número de Identificação Fiscal (NIF) — os únicos dois campos obrigatórios. Nome comercial, morada, telefone, email, setor e dimensão da equipa são opcionais e podem esperar. O NISS da entidade empregadora é adicionado depois, em Definições → Dados da Empresa, quando estiver pronto para submeter o INSS.",
          },
          {
            title: "Pagamento de salários",
            body: "Escolha como paga os salários: dinheiro ou transferência bancária. Dinheiro não precisa de quaisquer dados bancários. Transferência bancária precisa do nome do banco e do número da conta — BNU, Bank Mandiri, ANZ e BNCTL aparecem todos como opções.",
          },
          {
            title: "Noções básicas da folha",
            body: "Escolha o seu dia de pagamento mensal (de 1 a 28) e confirme a moeda — Timor-Leste usa USD. O Xefe aplica automaticamente os valores padrão de Timor-Leste: retenção de IRT acima de $500/mês, INSS a 4% funcionário / 6% empregador, uma semana padrão de 44 horas, e as licenças padrão previstas na lei laboral de Timor-Leste. Tudo isto pode ser alterado depois nas Definições.",
          },
        ],
      },
      {
        type: "heading",
        id: "add-your-team",
        text: "Adicione a sua equipa",
      },
      {
        type: "steps",
        items: [
          {
            title: "Adicionar um funcionário",
            body: "Em Pessoas, adicione os dados básicos de cada pessoa — nome, email, data de nascimento —, os dados profissionais (departamento, cargo, data de início, tipo de contrato) e o salário mensal. Os funcionários timorenses precisam de Bilhete de Identidade e de um número de INSS registado; os funcionários estrangeiros precisam de passaporte. O resto do perfil pode ser preenchido mais tarde.",
          },
          {
            title: "Convide a sua equipa",
            body: "Vá a Definições → Acesso da equipa para convidar pessoas por email e atribuir a cada uma uma função — Proprietário, Administrador de RH, Contabilista, Gestor ou Consulta. Cada função começa com acesso padrão apenas às partes do Xefe que esse trabalho precisa: um contabilista vê a contabilidade sem gerir membros, e um gestor vê apenas a sua própria equipa.",
          },
        ],
      },
      {
        type: "heading",
        id: "your-first-payroll",
        text: "A sua primeira folha de pagamento",
      },
      {
        type: "prose",
        body: "Com a equipa pronta, prepare um processamento em rascunho e reveja cada valor calculado — salários, IRT, INSS, horas extraordinárias — antes de qualquer coisa ser final. Uma segunda pessoa aprova o processamento (nunca quem o preparou), e finalizá-lo é o único passo que exige uma subscrição ativa. Consulte o nosso guia Processar a folha para o percurso completo, desde um processamento em rascunho até aos recibos pagos.",
      },
      {
        type: "callout",
        body: "Ficou com dúvidas? Contacte-nos pelo WhatsApp através do +670 7337 1307 — o apoio está disponível em inglês, português e tétum.",
      },
    ],
  },
  tet: {
    titleTop: "Hahu",
    titleAccent: "ho Xefe",
    lede: "Kria ita-nia konta, konfigura ita-nia empreza, aumenta ita-nia ekipa, no prepara ba folha pagamentu primeiru — iha tempu ne'ebé bele halo kafé de'it.",
    blocks: [
      {
        type: "prose",
        body: "Xefe hamutuk RH, folha pagamentu, tempu & lisensa, fatura no kontabilidade ba empreza sira iha Timor-Leste, ho regra impostu no Lei Trabálhu Timor-Leste nian rasik — retensaun WIT, kontribuisaun INSS, no lisensa legál — konfigura ona nu'udar padraun.\n\nFitur hotu-hotu grátis atu uza. De'it buat ida mak presiza subskrisaun: finaliza folha pagamentu ida. Konfigura empreza, aumenta ekipa, prepara rascunho folha, halo fatura no relatóriu — hotu-hotu grátis dezde loron dahuluk.",
      },
      {
        type: "heading",
        id: "create-your-account",
        text: "Kria ita-nia konta",
      },
      {
        type: "steps",
        items: [
          {
            title: "Rejistu",
            body: "Ba pájina rejistu no hatama ita-nia naran kompletu, email servisu, no password — ka kontinua ho Google ho klik ida de'it. La presiza kartaun.",
          },
          {
            title: "Fó naran ba ita-nia empreza",
            body: "Hatama naran ita-nia empreza. Xefe troka ba enderesu empreza badak automátikamente, ne'ebé ita bele edita se ita hakarak hili rasik. Kria konta no ita tama direitamente ba Xefe.",
          },
        ],
      },
      {
        type: "heading",
        id: "first-run-setup",
        text: "Konfigurasaun dahuluk",
      },
      {
        type: "prose",
        body: "Dala dahuluk ita tama, wizard konfigurasaun badak sei akompaña ita liu husi pasu tolu lalais. Bele salta ba dashboard iha kualkér tempu — buat ne'ebé ita hatama ona la lakon, no Xefe kontinua husi fatin ne'ebé ita para.",
      },
      {
        type: "steps",
        items: [
          {
            title: "Detállu empreza",
            body: "Hatama naran legál empreza no NIF (Numeru Identifikasaun Fiskal) — de'it rua mak obrigatóriu. Naran komersiál, enderesu, telefone, email, setór no tamañu ekipa mak opsionál no bele hein. NISS Empregador (númeru rejistu INSS empreza nian) hatama depois, iha Konfigurasaun → Detállu Empreza, bainhira ita prontu atu entrega INSS.",
          },
          {
            title: "Pagamentu saláriu",
            body: "Hili oinsá ita selu saláriu: osan ka transferénsia bankária. Osan la presiza detallu banku ida. Transferénsia bankária presiza naran banku no numeru konta — BNU, Bank Mandiri, ANZ no BNCTL hotu-hotu mosu nu'udar opsaun.",
          },
          {
            title: "Baze folha pagamentu",
            body: "Hili ita-nia loron pagamentu mensál (husi 1 to'o 28) no konfirma moeda — Timor-Leste uza USD. Xefe aplika taxa padraun Timor-Leste automátikamente: retensaun WIT liu $500/fulan, INSS 4% trabalhador / 6% empregadór, semana padraun 44 oras, no lisensa padraun tuir Lei Trabálhu Timor-Leste. Buat hotu ne'e bele muda depois iha Konfigurasaun.",
          },
        ],
      },
      {
        type: "heading",
        id: "add-your-team",
        text: "Aumenta ita-nia ekipa",
      },
      {
        type: "steps",
        items: [
          {
            title: "Aumenta funsionáriu",
            body: "Iha Pessoal, hatama detallu báziku ema ida-idak — naran, email, data moris — hamutuk ho detallu servisu (departamentu, kargu, data hahú, tipu kontratu) no saláriu mensál. Trabalhador Timor-oan presiza Bilhete de Identidade no numeru INSS rejistadu; trabalhador estranjeiru presiza pasaporte. Restu perfil bele kompleta depois.",
          },
          {
            title: "Konvida ita-nia kolega",
            body: "Ba Konfigurasaun → Asesu ekipa atu konvida ema liu husi email no fó papél ba ida-idak — Na'in, Administradór RH, Kontabilista, Jestór, ka Lee de'it. Kada papél hahú ho asesu padraun de'it ba parte Xefe ne'ebé servisu ne'e presiza — kontabilista haree livru kontabilidade la'ós jere membru, no jestór haree de'it nia própriu ekipa.",
          },
        ],
      },
      {
        type: "heading",
        id: "your-first-payroll",
        text: "Ita-nia folha primeiru",
      },
      {
        type: "prose",
        body: "Bainhira ekipa prontu ona, prepara rascunho folha pagamentu no reviza montante kalkuladu ida-idak — saláriu, WIT, INSS, oras estra — molok buat ida sai final. Ema segundu aprova folha ne'e (nunka ema ne'ebé prepara), no finaliza mak pasu úniku ne'ebé presiza subskrisaun ativu. Haree ami-nia gia Halo folha pagamentu ba buat hotu-hotu, husi rascunho to'o payslip selu ona.",
      },
      {
        type: "callout",
        body: "Presiza ajuda? Haruka mensajen ba ami iha WhatsApp iha +670 7337 1307 — suporte iha lian Inglés, Portugés no Tetun.",
      },
    ],
  },
};
