/**
 * Operational guides, Tetun. See guides-en.ts for the authoring rules.
 *
 * ⚠️ These are machine-assisted drafts, like the rest of the app's Tetun, and
 * are queued for the same native-speaker pass. They quote deadlines and legal
 * entitlements, so a wrong word here is not merely awkward — treat this file
 * as the highest-priority half of that review.
 */
import type { HelpArticle } from "./content";

export const MONTH_TET: HelpArticle = {
  slug: "your-month",
  kind: "guide",
  locale: "tet",
  updated: "2026-08-08",
  title: "Ita-nia fulan, hahú to'o remata",
  summary:
    "Prosesa saláriu iha Timor-Leste mak ritmu fulan-fulan ho prazu legál rua. Ne'e siklu tomak, tuir orden ne'ebé tenke akontese.",
  keywords: [
    "fulan-fulan",
    "siklu",
    "prazu",
    "INSS",
    "impostu",
    "deklarasaun",
    "DR",
    "aprova",
  ],
  intro: [
    "Fulan hotu-hotu iha forma hanesan. Bainhira ita haree dala ida ona, buat ida iha Xefe la hakfodak ita.",
    "Pasu rua husi sira-ne'e iha prazu legál, seluk lae. Prazu sira mak razaun pájina ne'e nian — lakon ida gasta osan, no serbisu Estadu nian ida mós sei la fó hanoin ba ita.",
  ],
  groups: [
    {
      id: "each-month",
      heading: "Fulan-fulan",
      blurb: "Tuir orden ne'e. Pasu ida-idak presiza ida molok nia.",
      entries: [
        {
          id: "record-differences",
          heading: "1. Rejista saida mak la hanesan",
          body: [
            "Ita la presiza rejista katak ema bá servisu. Xefe hanoin katak ema hotu kumpre fulan normál no selu tomak — ne'e mak lei husu, no ne'e mak loos iha loron barak.",
            "Saida mak ita rejista mak esesaun sira: ema ruma falta, ema ruma servisu liu tan. Lei Timor-Leste nian husu duni buat rua ne'e — rejistu falta justifikadu no injustifikadu, no rejistu oras hahú no remata ba serbisu extraordináriu.",
          ],
          when: "Iha tempu ida de'it durante fulan. Fasil liu bainhira akontese.",
        },
        {
          id: "run-payroll",
          heading: "2. Prosesa saláriu",
          body: [
            "Xefe sura saláriu brutu, impostu saláriu ne'ebé tenke retein, kontribuisaun seguransa sosiál rua, no osan ne'ebé to'o duni ba ema ida-idak nia liman.",
            "Ita bele troka valór ida de'it molok submete. Se ita troka, Xefe marka ema ne'e nu'udar ajusta ho liman atu ema ne'ebé aprova bele haree — númeru ne'ebé troka nunka bele hanesan númeru ne'ebé makina sura.",
          ],
          when: "Depois falta no oras extra fulan ne'e nian tama ona.",
        },
        {
          id: "approval",
          heading: "3. Ema seluk aprova",
          body: [
            "Ema ne'ebé prepara prosesamentu la bele sai ema ne'ebé aprova. Ne'e la'ós Xefe nia gostu — nia iha base dadus nia laran, entaun ema ida la bele hases liu ekrán seluk.",
            "Nia iha tanba saláriu mak osan fasil liu atu dezvia iha empreza ida, no matan rua mak kontrolu ne'ebé deteta. Se ita empreza ho ema ida de'it, ita bele simu permisaun atu aprova ita-nia prosesamentu rasik — maibé ne'e desizaun ne'ebé ita foti ho konsiénsia, la'ós padraun.",
          ],
          when: "Molok ema ida simu osan.",
        },
        {
          id: "pay-and-record",
          heading: "4. Selu ema hotu, depois hatete ba Xefe",
          body: [
            "Aprova prosesamentu la book osan — ita kontinua selu liuhosi transferénsia bankária ka osan iha liman. Depois, Xefe presiza katak ita konfirma pagamentu akontese ona.",
            "Konfirmasaun ne'e mak taka saláriu iha kontabilidade no muda valór impostu no seguransa sosiál sai tusan ba Estadu, prontu ba entrega rua tuir mai. Se ita lakon, ita-nia konta hatudu saláriu ne'ebé ita nunka selu.",
          ],
          when: "Kedas bainhira ema simu sira-nia osan.",
        },
        {
          id: "inss",
          heading: "5. Deklara no selu seguransa sosiál (INSS)",
          body: [
            "Buat rua ketak, ho data rua ketak: deklarasaun ho traballadór hotu no sira-nia rendimentu, depois pagamentu 4% ne'ebé retein husi traballadór ida-idak tan 6% husi ita.",
            "Xefe halo arkivu deklarasaun ba portál INSS. Nia la hasa'e no la selu — ne'e ita-nia serbisu.",
            "Kontribuisaun atrazadu selu juru 1% ba fulan ida-idak ka parte husi fulan.",
          ],
          when: "Deklara iha loron 10 primeiru fulan tuirmai. Selu entre loron 10 no loron 20.",
        },
        {
          id: "wit",
          heading: "6. Entrega no selu impostu saláriu",
          body: [
            "Impostu ne'ebé ita retein husi saláriu la'ós ita-nia — ita rai de'it ba administrasaun fiskál, no fulan ne'e mak ita entrega.",
            "Xefe prepara deklarasaun no valór sira. Hanesan INSS, entrega no pagamentu mak ita-nia serbisu.",
          ],
          when: "To'o loron 15 fulan tuirmai (Lei Tributária, Art. 23).",
        },
      ],
    },
    {
      id: "each-year",
      heading: "Dala ida kada tinan",
      blurb: "Data rua tan, rua ne'e fasil haluha tanba mosu de'it dala ida.",
      entries: [
        {
          id: "subsidio",
          heading: "Fulan sanulu-resin-tolu (subsídiu anuál)",
          body: [
            "Traballadór ida-idak iha direitu ba saláriu fulan ida tan kada tinan. Ema ne'ebé servisu ho ita menus husi tinan ida simu parte proporsionál, la'ós buat ida.",
            "Ne'e direitu legál, la'ós prémiu ne'ebé ita hili atu fó.",
          ],
          when: "To'o loron 20 Dezembru (Lei Trabálhu, Art. 44).",
        },
        {
          id: "annual-tax",
          heading: "Deklarasaun rendimentu anuál",
          body: [
            "Xefe halibur kálkulu sira ne'ebé ita-nia kontabilista presiza no rai rejistu se mak revee.",
            "Nia la halo formuláriu ofisiál no la entrega. Dehan buat seluk katak fó sala ba ita katak serbisu remata ona bainhira seidauk.",
          ],
          when: "Depois taka tinan, ho ita-nia kontabilista.",
        },
      ],
    },
  ],
};

export const LEAVER_TET: HelpArticle = {
  slug: "when-someone-leaves",
  kind: "guide",
  locale: "tet",
  updated: "2026-08-08",
  title: "Bainhira ema ida sai",
  summary:
    "Buat ne'ebé ita halo raru liu no fasil liu atu sala. Saida mak ema ne'ebé sai iha direitu ba, saida mak Xefe sura ba ita, no prazu ida ne'ebé kontinua gasta osan se ita lakon.",
  keywords: [
    "sesasaun",
    "despedimentu",
    "demisaun",
    "pagamentu ikus",
    "kompensasaun",
    "avizu prévia",
  ],
  intro: [
    "Xefe nia parte barak ita uza fulan-fulan, entaun ita hatene di'ak. Pagamentu ikus karik ita halo dala rua kada tinan — no ne'e pagamentu boot liu ne'ebé ita sei halo ba ema ida.",
    "Xefe sura hotu. Pájina ne'e atu ita bele haree se valór ne'e halo sentidu, no atu ita la lakon pasu ne'ebé la'ós kona-ba osan.",
  ],
  groups: [
    {
      id: "what-is-owed",
      heading: "Saida mak tenke selu",
      blurb:
        "Xefe sura parte ida-idak no tau iha resibu ikus. Sira-ne'e direitu, la'ós favór.",
      entries: [
        {
          id: "why-they-left",
          heading: "Hahú ho data no motivu",
          body: [
            "Buat hotu tuir mai depende ba faktu rua ne'e, entaun sira mak buat primeiru ne'ebé Xefe husu no buat ida ne'ebé ita la bele adivinha.",
            "Despedimentu ho justa causa mak motivu ida de'it ne'ebé hasai kompensasaun tempu servisu nian — no de'it bainhira prosesu kumpre duni: akuzasaun hakerek, oportunidade atu defende, no desizaun formál. Xefe husu ema ruma atu konfirma katak ne'e akontese duni, duke dedus husi lista, tanba despedimentu ne'ebé lakon pasu sira-ne'e nafatin iha direitu.",
          ],
        },
        {
          id: "untaken-leave",
          heading: "Lisensa ne'ebé la goza selu ho osan",
          body: [
            "Loron ne'ebé la goza la lakon bainhira sai — sira muda sai osan iha resibu ikus.",
            "Iha regra ketak ida ne'ebé di'ak atu hatene: se traballadór *hetan impedimentu* atu goza nia lisensa, loron sira-ne'e selu dala rua. Lisensa ne'ebé nia rasik hili atu adia laiha penalidade. Xefe husu ida ne'ebé mak akontese; nia nunka hanoin katak sala mak ita-nia.",
          ],
        },
        {
          id: "service-compensation",
          heading: "Kompensasaun ba tempu servisu",
          body: [
            "Saláriu fulan ida ba kada tinan lima servisu. Baibain ne'e liña boot liu iha resibu ikus.",
            "Xefe sura bloku kompletu tinan lima nian, ne'ebé mak leitura ki'ik liu iha fatin ne'ebé lei nonook — tinan hitu selu fulan ida, la'ós 1,4. Interpretasaun ne'e esplika iha *Fatin ne'ebé Xefe foti pozisaun kona-ba lei*, no vale koalia ho ita-nia kontabilista bainhira valór boot.",
          ],
        },
        {
          id: "thirteenth",
          heading: "Parte proporsionál husi fulan sanulu-resin-tolu",
          body: [
            "Ema ne'ebé sai iha Juñu manán ona sorin husi fulan sanulu-resin-tolu. Selu hamutuk ho pagamentu ikus, la hein Dezembru.",
          ],
        },
        {
          id: "notice",
          heading: "Avizu prévia — servisu ka selu",
          body: [
            "Ka nia kumpre períodu avizu prévia, ka ita selu nu'udar substituisaun. Iha despedimentu tanba postu servisu lakon, traballadór iha direitu mós ba tempu ho pagamentu durante avizu atu buka servisu seluk.",
          ],
        },
      ],
    },
    {
      id: "the-trap",
      heading: "Pasu ne'ebé la'ós kona-ba osan",
      blurb:
        "Lakon ida ne'e kontinua gasta ita-nia osan depois ema ne'e sai ona, no buat ida iha ekrán sei la hatete ba ita.",
      entries: [
        {
          id: "declare-cessation",
          heading: "Hatete ba INSS katak vínkulu remata ona",
          body: [
            "To'o ita deklara, **lei prezume katak vínkulu sei iha nafatin** — no kontribuisaun sira mós. La selu buat ida ba ema ne'e la troka ida-ne'e; obrigasaun tuir deklarasaun, la'ós resibu.",
            "Entaun traballadór ne'ebé nia saída seidauk deklara kontinua akumula kontribuisaun ne'ebé ita tenke selu, fulan ba fulan, ho juru 1% ba ida-idak.",
          ],
          when: "To'o loron 10 fulan tuirmai depois nia sai (DL 20/2017, Art. 5).",
        },
        {
          id: "paid-once",
          heading: "Parte ida-idak selu dala ida de'it",
          body: [
            "Se traballadór nia data sira kobre prosesamentu rua, buat hotu iha leten bele selu dala rua — no sei hanesan loos iha rua ne'e.",
            "Xefe bloka ne'e: parte ida-idak husi pagamentu ikus marka nu'udar selu tiha ona iha dala primeiru, no prosesamentu daruak ba períodu hanesan sei la selu fila fali.",
          ],
        },
      ],
    },
  ],
};
