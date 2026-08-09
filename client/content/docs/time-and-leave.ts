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
    lede: "Record hours once and Xefe carries them straight into payroll — overtime, night work, and rest-day or public-holiday premiums calculated the way the Labour Law requires. No spreadsheets, no re-entry.",
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
          "Overtime, night-shift hours, and rest-day or public-holiday premiums are calculated automatically from the recorded times. The double rate follows your company's actual weekly rest day — Sunday by default, or the day you close instead if the business cannot stop on a Sunday (Arts. 27(2), 30(2)).",
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
        body: "Employees request leave, a manager or HR admin decides it, and approved leave flows straight into payroll and the attendance record for those days — nothing needs to be re-entered. Leave is counted in working days, and which days those are follows the working week you set in Settings. Timor-Leste's normal working week may run up to 44 hours (Art. 25(1)), which does not fit into five 8-hour days, so a six-day week resting on Sunday is common here — and on that week a Saturday of leave IS deducted. Public holidays never count against a balance, and half-days are supported.\n\nXefe ships with the leave types set out in Timor-Leste's Labour Law (Lei 4/2012) already configured, and a company can add its own custom types on top for anything the law doesn't cover.",
      },
      {
        type: "table",
        headers: ["Leave type", "Typical length", "Pay", "Statute"],
        rows: [
          ["Annual leave", "At least 12 working days a year", "Full pay", "Art. 32(2)"],
          [
            "Sick leave",
            "Up to 12 days a year, with a medical certificate",
            "First 6 days full pay, next 6 days half pay",
            "Art. 33(4)",
          ],
          [
            "Maternity leave",
            "At least 12 weeks, of which 10 must follow the birth",
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
          "Every figure in the table is a legal MINIMUM, not a ceiling: Art. 1(2) of the Labour Law lets a contract depart from the Code only \"para estabelecer condições mais favoráveis ao trabalhador\" — more favourably to the worker. Whatever your contract promises above these, it owes. The one exception is sick leave, where Art. 33(4) caps the PAID days at 12.",
          "Maternity, paternity, and post-loss leave are paid directly by Timor-Leste's social security institute (INSS) to workers who meet the contribution requirement — Xefe helps prepare the declaration a worker needs for that claim.",
          "Family event leave is one pooled allowance covering marriage, a death in the family, and community or religious events — not three separate entitlements.",
          "Breastfeeding and prenatal check-ups are paid time, not leave. Art. 62 gives a returning mother two paid one-hour breaks a day until the child turns six months old, and a pregnant worker paid time off for medical exams as often as needed — in both cases 'sem perda de remuneração'. Xefe does not yet track these hour-level dispensations automatically: record them in attendance as time worked so they are not docked.",
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
        id: "night-shifts",
        text: "Night shifts",
      },
      {
        type: "prose",
        body: "For an overnight shift, enter the day it starts and an end time earlier than the start — for example, 22:00 to 06:00. Xefe treats the end as the following morning. If the Night row is hidden in Coverage view, open the shift-slot settings for that work site and enable it.",
      },
      {
        type: "list",
        items: [
          "A scheduled shift is the plan, not proof of hours worked. Record the employee's actual clock-in and clock-out in Attendance.",
          "Xefe counts the actual time worked between 21:00 and 06:00 as night work and carries those hours into payroll with the statutory 25% supplement (Art. 28).",
          "Draft shifts stay with the manager. Publish the schedule when it is ready for employees to see in Ekipa.",
        ],
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
    lede: "Registe as horas uma vez e o Xefe leva-as diretamente à folha de pagamento — horas extraordinárias, trabalho noturno e adicionais de dia de descanso semanal ou feriado calculados como a Lei do Trabalho exige. Sem folhas de cálculo, sem reintrodução de dados.",
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
          "Horas extraordinárias, horas noturnas e adicionais de dia de descanso semanal ou feriado são calculados automaticamente a partir dos horários registados. A remuneração a dobrar segue o dia de descanso semanal efetivo da sua empresa — o domingo, por regra, ou o dia em que a empresa descansa quando o serviço não pode ser interrompido (arts. 27.º(2) e 30.º(2)).",
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
        body: "O funcionário pede a licença, um gestor ou administrador de RH decide, e a licença aprovada passa diretamente para a folha de pagamento e para o registo de presença desses dias — nada precisa de ser reintroduzido. A licença é contada em dias úteis, e quais são esses dias segue a semana de trabalho que definir nas Definições. Em Timor-Leste o período normal de trabalho pode ir até 44 horas por semana (art. 25.º(1)), o que não cabe em cinco dias de 8 horas, pelo que uma semana de seis dias com descanso ao domingo é comum — e nessa semana um sábado de licença É descontado. Os feriados nunca contam para o saldo, e são aceites meios-dias.\n\nO Xefe já vem configurado com os tipos de licença previstos na Lei do Trabalho de Timor-Leste (Lei 4/2012), e uma empresa pode ainda acrescentar os seus próprios tipos personalizados para o que a lei não cobre.",
      },
      {
        type: "table",
        headers: ["Tipo de licença", "Duração típica", "Pagamento", "Artigo"],
        rows: [
          [
            "Férias anuais",
            "Pelo menos 12 dias úteis por ano",
            "Salário completo",
            "Art. 32.º(2)",
          ],
          [
            "Licença por doença",
            "Até 12 dias por ano, com certificado médico",
            "Primeiros 6 dias a 100%, os 6 seguintes a 50%",
            "Art. 33.º(4)",
          ],
          [
            "Licença de maternidade",
            "No mínimo 12 semanas, das quais 10 após o parto",
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
          "Todos os valores da tabela são MÍNIMOS legais, não tetos: o art. 1.º(2) da Lei do Trabalho só permite afastar o Código \"para estabelecer condições mais favoráveis ao trabalhador\". O que o seu contrato prometer acima disto, é devido. A exceção é a licença por doença, em que o art. 33.º(4) limita a 12 os dias PAGOS.",
          "A licença de maternidade, de paternidade e por interrupção da gravidez são pagas diretamente pelo Instituto Nacional de Segurança Social (INSS) aos trabalhadores que cumprem o requisito de contribuições — o Xefe ajuda a preparar a declaração necessária para esse pedido.",
          "A licença por motivo familiar é uma única alocação que cobre casamento, falecimento de familiar e eventos comunitários ou religiosos — não são três direitos separados.",
          "As pausas para amamentação e as consultas pré-natais são tempo pago, não licença. O art. 62.º dá à trabalhadora que regressa duas pausas pagas de uma hora por dia até o filho completar seis meses, e à trabalhadora grávida tempo pago para exames médicos as vezes que forem necessárias — em ambos os casos 'sem perda de remuneração'. O Xefe ainda não regista automaticamente estas dispensas ao nível da hora: registe-as na assiduidade como tempo trabalhado para que não sejam descontadas.",
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
        id: "night-shifts",
        text: "Turnos noturnos",
      },
      {
        type: "prose",
        body: "Para um turno que atravessa a meia-noite, introduza o dia em que começa e uma hora de fim anterior à hora de início — por exemplo, das 22:00 às 06:00. O Xefe considera que o turno termina na manhã seguinte. Se a linha Noite estiver oculta na vista Cobertura, abra as definições dos horários de turno desse local de trabalho e ative-a.",
      },
      {
        type: "list",
        items: [
          "Um turno planeado é o plano, não a prova das horas trabalhadas. Registe a entrada e a saída reais do funcionário em Presença.",
          "O Xefe conta o tempo efetivamente trabalhado entre as 21:00 e as 06:00 como trabalho noturno e leva essas horas para a folha com o acréscimo legal de 25% (art. 28.º).",
          "Os turnos em rascunho ficam com o gestor. Publique a escala quando estiver pronta para os funcionários a verem no Ekipa.",
        ],
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
    lede: "Rejista oras dala ida de'it no Xefe lori diretamente ba folha pagamentu — oras estra, servisu kalan, no adisional loron deskansa semanál ka feriadu kalkula tuir Lei Trabálhu presiza. Laiha spreadsheet, laiha hatama fila fali.",
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
          "Oras estra, oras servisu kalan, no adisional loron deskansa semanál ka feriadu kalkula automátiku husi oras rejistadu sira. Taxa dobru tuir kompañia nia loron deskansa semanál loloos — Domingu nu'udar regra, ka loron seluk bainhira negósiu la bele taka iha Domingu (Art. 27(2), 30(2)).",
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
        body: "Empregadu husu lisensa, manajer ka admin RH decide, no lisensa aprovadu tama diretamente ba folha pagamentu no registu prezensa ba loron sira-ne'e — laiha buat atu hatama fila fali. Lisensa sura nu'udar loron servisu, no loron sira-ne'ebé tuir semana servisu ne'ebé ita tau iha Konfigurasaun. Iha Timor-Leste, períodu servisu normál bele to'o oras 44 kada semana (Art. 25(1)), ne'ebé la tama iha loron lima ho oras 8, entaun semana loron neen ho deskansa iha Domingu baibain iha ne'e — no iha semana ne'e, sábadu ida lisensa nian SEI deskonta. Feriadu nunka konta ba balansu, no meiu-loron mós asetadu.\n\nXefe mai ona ho tipu lisensa tuir Lei Trabálhu Timor-Leste (Lei 4/2012) konfiguradu ona, no kompañia bele aumenta mós nia tipu personalizadu rasik ba buat ne'ebé lei la kobre.",
      },
      {
        type: "table",
        headers: ["Tipu lisensa", "Durasaun jerál", "Pagamentu", "Artigu"],
        rows: [
          ["Lisensa Anual", "Pelu menus loron servisu 12 kada tinan", "Saláriu kompletu", "Art. 32(2)"],
          [
            "Lisensa Doensa",
            "To'o loron 12 kada tinan, ho sertifikadu médiku",
            "Loron 6 primeiru 100%, loron 6 tuir mai 50%",
            "Art. 33(4)",
          ],
          [
            "Lisensa Maternidade",
            "Pelu menus semana 12, ne'ebé 10 tenke depois partu",
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
          "Valór hotu iha tabela ne'e MÍNIMU legál, la'ós teto: Art. 1(2) Lei Trabálhu nian só permite hases husi Kódigu bainhira fó kondisaun di'ak liu ba traballadór. Saida mak ita-nia kontratu promete liu ne'e, tenke selu. Esesaun mak lisensa doensa, ne'ebé Art. 33(4) limita loron SELU ba 12.",
          "Lisensa maternidade, paternidade, no interrupsaun gravidés INSS selu diretamente ba traballadór ne'ebé kumpri kontribuisaun presiza — Xefe ajuda prepara deklarasaun ne'ebé traballadór presiza ba pedidu subsídiu ne'e.",
          "Lisensa espesiál mak alokasaun ida de'it ne'ebé kobre kazamentu, mate família nian, no eventu komunidade ka relijiozu — la'ós direitu tolu separadu.",
          "Pausa amamentasaun no konsulta antes-partu mak tempu ho pagamentu, la'ós lisensa. Art. 62 fó ba traballadora ne'ebé fila mai pausa rua ho pagamentu, oras ida kada ida, kada loron to'o oan halo fulan neen, no ba traballadora isin-rua tempu ho pagamentu ba ezame médiku dala hira mak presiza — iha kazu rua ne'e 'sem perda de remuneração'. Xefe seidauk rejista automátikamente dispensa sira-ne'e iha nivel oras: rejista sira iha prezensa nu'udar tempu servisu atu labele deskonta.",
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
        id: "night-shifts",
        text: "Turnu kalan",
      },
      {
        type: "prose",
        body: "Ba turnu ne'ebé liu kalan-baluk, hatama loron ne'ebé turnu hahú no oras remata ne'ebé sedu liu oras hahú — porezemplu, 22:00 to'o 06:00. Xefe konsidera katak turnu remata iha dadeer loron tuir mai. Se liña Kalan subar iha vista Kobertura, loke konfigurasaun oras turnu ba lokal servisu ne'e no ativa.",
      },
      {
        type: "list",
        items: [
          "Turnu ne'ebé planeia mak planu, la'ós prova oras ne'ebé servisu loloos. Rejista empregadu nia oras tama no sai loloos iha Prezensa.",
          "Xefe sura tempu servisu loloos entre 21:00 no 06:00 nu'udar servisu kalan no lori oras sira-ne'e ba folha pagamentu ho adisionál legál 25% (Art. 28).",
          "Turnu rascunhu hela ho manajer. Publika eskala bainhira prontu atu empregadu sira bele haree iha Ekipa.",
        ],
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
