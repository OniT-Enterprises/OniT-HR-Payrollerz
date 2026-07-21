/**
 * /docs/time-and-leave — public documentation article.
 *
 * PUBLIC-SAFE (docs/PUBLIC_SITE.md): statutes, deadlines and Xefe's own
 * product behavior only — never data sourcing, internal file paths, tests,
 * or sign-off status. Mirrors the workflow invariants in docs/TIME_LEAVE.md
 * without exposing any internal collection names, routes, or code paths.
 */
import type { LocalizedDocArticle } from "@/lib/docs/types";

export const article: LocalizedDocArticle = {
  en: {
    titleTop: "Attendance, leave and shifts,",
    titleAccent: "one hours-entry screen",
    lede: "Record hours once and Xefe carries them straight into payroll — overtime, night work, and Sunday or public-holiday premiums calculated the way the Labour Law requires. No spreadsheets, no re-entry.",
    blocks: [
      {
        type: "heading",
        id: "attendance",
        text: "Attendance",
      },
      {
        type: "prose",
        body: "Attendance is the one place hours get recorded — there's no separate time-tracking screen to keep in sync. Hours, breaks, lateness, and overtime are worked out the same way no matter how a day gets entered.",
      },
      {
        type: "steps",
        items: [
          {
            title: "Clock in and out",
            body: "Mark a day with its clock-in and clock-out times as it happens.",
          },
          {
            title: "Bulk entry",
            body: "Enter hours for a whole team at once, instead of one employee at a time.",
          },
          {
            title: "Import a spreadsheet",
            body: "Already keeping records elsewhere? Import them directly — any layout works, and Xefe reads messy files too, so there's no need to reformat anything first.",
          },
        ],
      },
      {
        type: "list",
        items: [
          "A day with no record is treated as not yet recorded, not as an absence — only an explicit absence counts as one.",
          "Overtime, night-shift hours, and Sunday or public-holiday premiums are calculated automatically from the recorded times.",
          "Every adjustment to a record is logged, so there's always a clear trail of who changed what.",
          "Managers see and adjust attendance for their own team; owners and HR admins see the whole company.",
        ],
      },
      {
        type: "heading",
        id: "leave",
        text: "Leave",
      },
      {
        type: "prose",
        body: "Employees request leave, a manager or HR admin decides it, and approved leave flows straight into payroll and the attendance record for those days — nothing needs to be re-entered. Leave is counted in working days: weekends and public holidays don't count against a balance, and half-days are supported.\n\nXefe ships with the leave types set out in Timor-Leste's Labour Law (Lei 4/2012) already configured, and a company can add its own custom types on top for anything the law doesn't cover.",
      },
      {
        type: "table",
        headers: ["Leave type", "Typical length", "Pay", "Statute"],
        rows: [
          ["Annual leave", "12 working days a year", "Full pay", "Art. 32"],
          [
            "Sick leave",
            "12 days a year, with a medical certificate",
            "First 6 days full pay, next 6 days half pay",
            "Art. 34",
          ],
          [
            "Maternity leave",
            "12 weeks (at least 10 after the birth)",
            "Paid directly by INSS to workers who qualify",
            "Art. 59",
          ],
          [
            "Paternity leave",
            "5 working days",
            "Paid directly by INSS to workers who qualify",
            "Art. 60",
          ],
          [
            "Leave after a pregnancy loss",
            "4 weeks",
            "Same INSS arrangement as maternity leave",
            "Art. 59(4)",
          ],
          [
            "Family event leave",
            "3 days a year, pooled",
            "Full pay",
            "Art. 33(3)",
          ],
          ["Study leave", "For sitting exams", "Full pay", "Art. 76(3)"],
          ["Unpaid leave", "As agreed", "Unpaid", "—"],
          ["Custom types", "Set by the company", "Set by the company", "—"],
        ],
      },
      {
        type: "list",
        items: [
          "Maternity, paternity, and post-loss leave are paid directly by Timor-Leste's social security institute (INSS) to workers who meet the contribution requirement — Xefe helps prepare the declaration a worker needs for that claim.",
          "Family event leave is one pooled allowance covering marriage, a death in the family, and community or religious events — not three separate entitlements.",
          "A returning mother's paid breastfeeding time and a pregnant worker's paid time for medical exams are handled as ordinary worked time in attendance, never docked.",
          "A company can add its own custom leave types — for example, a local practice not covered by statute — alongside the built-in ones.",
        ],
      },
      {
        type: "heading",
        id: "shifts",
        text: "Shifts",
      },
      {
        type: "prose",
        body: "Shifts are planned on a weekly grid, organized by site and by shift slot, so a manager can see coverage for the whole week at a glance. Once a week's coverage looks right, it can be copied forward to the next week instead of being rebuilt from scratch.",
      },
      {
        type: "heading",
        id: "balances-and-timesheets",
        text: "Balances and timesheets",
      },
      {
        type: "prose",
        body: "Leave balances and weekly timesheets are never hand-edited — they're computed from approved attendance and leave records, so the numbers everyone sees always match what actually happened. That also means balances stay accurate automatically as approvals come in, with nothing for an admin to reconcile.",
      },
      {
        type: "callout",
        body: "Employees see their own payslips, leave balances, and attendance history — and can request leave — in the Ekipa app, right from their phone. Every request they submit flows straight to their manager for a decision.",
      },
    ],
  },
  pt: {
    titleTop: "Presença, licenças e turnos,",
    titleAccent: "um único ecrã de registo",
    lede: "Registe as horas uma vez e o Xefe leva-as diretamente à folha de pagamento — horas extraordinárias, trabalho noturno e adicionais de domingo ou feriado calculados como a Lei do Trabalho exige. Sem folhas de cálculo, sem reintrodução de dados.",
    blocks: [
      {
        type: "heading",
        id: "attendance",
        text: "Presença",
      },
      {
        type: "prose",
        body: "A presença é o único lugar onde as horas são registadas — não há um ecrã separado de controlo de horas para manter sincronizado. Horas, pausas, atrasos e horas extraordinárias são calculados da mesma forma, seja qual for a maneira como o dia é introduzido.",
      },
      {
        type: "steps",
        items: [
          {
            title: "Entrada e saída",
            body: "Marque um dia com a hora de entrada e de saída à medida que acontece.",
          },
          {
            title: "Introdução em lote",
            body: "Introduza as horas de toda uma equipa de uma vez, em vez de um funcionário de cada vez.",
          },
          {
            title: "Importar uma folha de cálculo",
            body: "Já mantém registos noutro lugar? Importe-os diretamente — qualquer formato serve, e o Xefe também lê ficheiros desorganizados, por isso não precisa de reformatar nada primeiro.",
          },
        ],
      },
      {
        type: "list",
        items: [
          "Um dia sem registo é tratado como ainda não registado, não como falta — só uma falta explícita conta como tal.",
          "Horas extraordinárias, horas noturnas e adicionais de domingo ou feriado são calculados automaticamente a partir dos horários registados.",
          "Cada ajuste a um registo fica registado, para que haja sempre um histórico claro de quem alterou o quê.",
          "Os gestores veem e ajustam a presença da sua própria equipa; os proprietários e administradores de RH veem toda a empresa.",
        ],
      },
      {
        type: "heading",
        id: "leave",
        text: "Licenças",
      },
      {
        type: "prose",
        body: "O funcionário pede a licença, um gestor ou administrador de RH decide, e a licença aprovada passa diretamente para a folha de pagamento e para o registo de presença desses dias — nada precisa de ser reintroduzido. A licença é contada em dias úteis: fins de semana e feriados não contam para o saldo, e são aceites meios-dias.\n\nO Xefe já vem configurado com os tipos de licença previstos na Lei do Trabalho de Timor-Leste (Lei 4/2012), e uma empresa pode ainda acrescentar os seus próprios tipos personalizados para o que a lei não cobre.",
      },
      {
        type: "table",
        headers: ["Tipo de licença", "Duração típica", "Pagamento", "Artigo"],
        rows: [
          [
            "Férias anuais",
            "12 dias úteis por ano",
            "Salário completo",
            "Art. 32.º",
          ],
          [
            "Licença por doença",
            "12 dias por ano, com certificado médico",
            "Primeiros 6 dias a 100%, os 6 seguintes a 50%",
            "Art. 34.º",
          ],
          [
            "Licença de maternidade",
            "12 semanas (pelo menos 10 após o parto)",
            "Paga diretamente pelo INSS aos trabalhadores elegíveis",
            "Art. 59.º",
          ],
          [
            "Licença de paternidade",
            "5 dias úteis",
            "Paga diretamente pelo INSS aos trabalhadores elegíveis",
            "Art. 60.º",
          ],
          [
            "Licença por interrupção da gravidez",
            "4 semanas",
            "Mesmo regime do INSS que a licença de maternidade",
            "Art. 59.º(4)",
          ],
          [
            "Licença por motivo familiar",
            "3 dias por ano, em conjunto",
            "Salário completo",
            "Art. 33.º(3)",
          ],
          [
            "Licença de estudo",
            "Para realização de provas",
            "Salário completo",
            "Art. 76.º(3)",
          ],
          ["Licença sem vencimento", "Conforme acordado", "Sem pagamento", "—"],
          [
            "Tipos personalizados",
            "Definido pela empresa",
            "Definido pela empresa",
            "—",
          ],
        ],
      },
      {
        type: "list",
        items: [
          "A licença de maternidade, de paternidade e por interrupção da gravidez são pagas diretamente pelo Instituto Nacional de Segurança Social (INSS) aos trabalhadores que cumprem o requisito de contribuições — o Xefe ajuda a preparar a declaração necessária para esse pedido.",
          "A licença por motivo familiar é uma única alocação que cobre casamento, falecimento de familiar e eventos comunitários ou religiosos — não são três direitos separados.",
          "As pausas pagas para amamentação de uma trabalhadora que regressa e o tempo pago de uma trabalhadora grávida para exames médicos são tratados como tempo de trabalho normal na presença, nunca descontados.",
          "Uma empresa pode acrescentar os seus próprios tipos de licença personalizados — por exemplo, uma prática local não prevista na lei — para além dos tipos já incluídos.",
        ],
      },
      {
        type: "heading",
        id: "shifts",
        text: "Turnos",
      },
      {
        type: "prose",
        body: "Os turnos são planeados numa grelha semanal, organizada por local e por horário de turno, para que um gestor veja a cobertura de toda a semana de relance. Depois de a cobertura de uma semana estar correta, pode ser copiada para a semana seguinte em vez de ser reconstruída do zero.",
      },
      {
        type: "heading",
        id: "balances-and-timesheets",
        text: "Saldos e folhas de horas",
      },
      {
        type: "prose",
        body: "Os saldos de licenças e as folhas de horas semanais nunca são editados manualmente — são calculados a partir dos registos de presença e de licença aprovados, para que os números que todos veem correspondam sempre ao que realmente aconteceu. Isso também significa que os saldos se mantêm corretos automaticamente à medida que as aprovações acontecem, sem nada para um administrador reconciliar.",
      },
      {
        type: "callout",
        body: "Os funcionários veem os seus próprios recibos de vencimento, saldos de licença e histórico de presença — e podem pedir licença — na aplicação Ekipa, diretamente do telemóvel. Cada pedido que submetem segue diretamente para o seu gestor decidir.",
      },
    ],
  },
  tet: {
    titleTop: "Prezensa, lisensa no turnu,",
    titleAccent: "ekrã rejistu ida de'it",
    lede: "Rejista oras dala ida de'it no Xefe lori diretamente ba folha pagamentu — oras estra, servisu kalan, no adisional Domingu ka feriadu kalkula tuir Lei Trabálhu presiza. Laiha spreadsheet, laiha hatama fila fali.",
    blocks: [
      {
        type: "heading",
        id: "attendance",
        text: "Prezensa",
      },
      {
        type: "prose",
        body: "Prezensa mak fatin ida de'it atu rejista oras — laiha ekrã separadu ba kontrola oras atu hametin hamutuk. Oras, pausa, atrazu, no oras estra kalkula hanesan de'it, uza métodu naran de'it atu hatama loron ida.",
      },
      {
        type: "steps",
        items: [
          {
            title: "Oras tama no sai",
            body: "Marka loron ida ho oras tama no sai wainhira loron ne'e mosu.",
          },
          {
            title: "Hatama hamutuk",
            body: "Hatama oras ba ekipa tomak dala ida, duké empregadu ida-ida.",
          },
          {
            title: "Importa spreadsheet",
            body: "Rai ona registu iha fatin seluk? Importa diretamente — formatu naran de'it serve, no Xefe bele lee mós fixeiru la organizadu, tan ne'e la presiza reformata buat ida uluk.",
          },
        ],
      },
      {
        type: "list",
        items: [
          "Loron ne'ebé laiha registu konsidera nu'udar seidauk rejista, la'ós faltas — de'it faltas explísitu mak konta nu'udar faltas.",
          "Oras estra, oras servisu kalan, no adisional Domingu ka feriadu kalkula automátiku husi oras rejistadu sira.",
          "Kada mudansa ba registu rejista, atu iha rasta klaru kona-ba se mak muda saida.",
          "Manajer haree no muda prezensa ba nia própriu ekipa; na'in no admin RH haree kompañia tomak.",
        ],
      },
      {
        type: "heading",
        id: "leave",
        text: "Lisensa",
      },
      {
        type: "prose",
        body: "Empregadu husu lisensa, manajer ka admin RH decide, no lisensa aprovadu tama diretamente ba folha pagamentu no registu prezensa ba loron sira-ne'e — laiha buat atu hatama fila fali. Lisensa sura nu'udar loron servisu: fim de semana no feriadu la konta ba balansu, no meiu-loron mós asetadu.\n\nXefe mai ona ho tipu lisensa tuir Lei Trabálhu Timor-Leste (Lei 4/2012) konfiguradu ona, no kompañia bele aumenta mós nia tipu personalizadu rasik ba buat ne'ebé lei la kobre.",
      },
      {
        type: "table",
        headers: ["Tipu lisensa", "Durasaun jerál", "Pagamentu", "Artigu"],
        rows: [
          ["Lisensa Anual", "loron servisu 12 kada tinan", "Saláriu kompletu", "Art. 32"],
          [
            "Lisensa Doensa",
            "loron 12 kada tinan, ho sertifikadu médiku",
            "Loron 6 primeiru 100%, loron 6 tuir mai 50%",
            "Art. 34",
          ],
          [
            "Lisensa Maternidade",
            "semana 12 (pelu menus 10 depois partu)",
            "INSS selu diretamente ba traballadór ne'ebé kualifika",
            "Art. 59",
          ],
          [
            "Lisensa Paternidade",
            "loron servisu 5",
            "INSS selu diretamente ba traballadór ne'ebé kualifika",
            "Art. 60",
          ],
          [
            "Lisensa interrupsaun gravidés",
            "semana 4",
            "Regime INSS hanesan lisensa maternidade",
            "Art. 59(4)",
          ],
          [
            "Lisensa espesiál (eventu família)",
            "loron 3 kada tinan, hamutuk",
            "Saláriu kompletu",
            "Art. 33(3)",
          ],
          ["Lisensa Estudu", "ba tuir prova avaliasaun", "Saláriu kompletu", "Art. 76(3)"],
          ["Lisensa la selu", "tuir akordu", "La selu", "—"],
          ["Tipu personalizadu", "kompañia mak define", "kompañia mak define", "—"],
        ],
      },
      {
        type: "list",
        items: [
          "Lisensa maternidade, paternidade, no interrupsaun gravidés INSS selu diretamente ba traballadór ne'ebé kumpri kontribuisaun presiza — Xefe ajuda prepara deklarasaun ne'ebé traballadór presiza ba pedidu subsídiu ne'e.",
          "Lisensa espesiál mak alokasaun ida de'it ne'ebé kobre kazamentu, mate família nian, no eventu komunidade ka relijiozu — la'ós direitu tolu separadu.",
          "Pausa selu ba amamentasaun traballadora ne'ebé fila husi lisensa maternidade, no tempu selu traballadora isin-rua nian ba konsulta médiku, trata nu'udar tempu servisu normál iha prezensa, la bele deskonta.",
          "Kompañia bele aumenta nia tipu lisensa personalizadu rasik — porezemplu, prátika lokál ne'ebé lei la kobre — hamutuk ho tipu sira-ne'ebé mai ona.",
        ],
      },
      {
        type: "heading",
        id: "shifts",
        text: "Turnu",
      },
      {
        type: "prose",
        body: "Turnu sira planeia iha grid semanál, organiza tuir fatin no oráriu turnu, atu manajer bele haree kobertura semana tomak ho vista ida de'it. Bainhira kobertura semana ida diak ona, bele kopia ba semana tuir mai duké harii fila fali husi zero.",
      },
      {
        type: "heading",
        id: "balances-and-timesheets",
        text: "Balansu no timesheet",
      },
      {
        type: "prose",
        body: "Balansu lisensa no timesheet semanál nunka edita ho liman — sira kalkula husi registu prezensa no lisensa ne'ebé aprova ona, atu númeru ne'ebé ema hotu haree sempre kombina ho buat ne'ebé loloos akontese. Ida-ne'e mós signifika balansu sempre loloos automátiku bainhira aprovasaun sira tama, laiha buat ida ba admin atu rekonsilia.",
      },
      {
        type: "callout",
        body: "Empregadu haree sira-nia payslip rasik, balansu lisensa, no istória prezensa — no bele husu lisensa — iha aplikasaun Ekipa, direitamente husi telefone. Kada pedidu ne'ebé sira submete lori diretamente ba sira-nia manajer atu decide.",
      },
    ],
  },
};
