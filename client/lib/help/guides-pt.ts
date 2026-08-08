/**
 * Operational guides, Portuguese. See guides-en.ts for the authoring rules —
 * describe what is TRUE (deadlines, order, law), never where to click.
 */
import type { HelpArticle } from "./content";

export const MONTH_PT: HelpArticle = {
  slug: "your-month",
  kind: "guide",
  locale: "pt",
  updated: "2026-08-08",
  title: "O seu mês, do início ao fim",
  summary:
    "O processamento salarial em Timor-Leste é um ritmo mensal com dois prazos legais. Este é o ciclo completo, pela ordem em que tem de acontecer.",
  keywords: [
    "mensal",
    "ciclo",
    "prazo",
    "INSS",
    "IRS",
    "declaração",
    "DR",
    "aprovar",
  ],
  intro: [
    "Todos os meses têm a mesma forma. Depois de a ver uma vez, nada no Xefe o apanha desprevenido.",
    "Dois destes passos têm prazos legais e os restantes não. São os prazos que dão sentido a esta página — falhar um custa dinheiro, e nenhum dos serviços do Estado o vai lembrar.",
  ],
  groups: [
    {
      id: "each-month",
      heading: "Todos os meses",
      blurb: "Por esta ordem. Cada passo precisa do anterior.",
      entries: [
        {
          id: "record-differences",
          heading: "1. Registe o que foi diferente",
          body: [
            "Não precisa de registar que as pessoas vieram trabalhar. O Xefe parte do princípio de que todos cumpriram o mês normal e paga por inteiro — que é o que a lei pede e o que é verdade na maioria dos dias.",
            "O que se regista são as exceções: alguém faltou, alguém trabalhou a mais. A lei timorense quer exatamente essas duas coisas — um registo das faltas justificadas e injustificadas, e um registo do início e do termo das horas extraordinárias.",
          ],
          when: "Em qualquer altura do mês. Mais fácil à medida que acontece.",
        },
        {
          id: "run-payroll",
          heading: "2. Processe os salários",
          body: [
            "O Xefe calcula a remuneração ilíquida, o imposto sobre salários a reter, as duas contribuições para a segurança social e o que chega efetivamente às mãos de cada pessoa.",
            "Pode alterar qualquer valor antes de submeter. Se o fizer, o Xefe assinala essa pessoa como ajustada manualmente para que quem aprova possa vê-lo — um número alterado nunca deve parecer um número calculado.",
          ],
          when: "Depois de lançadas as faltas e as horas extraordinárias do mês.",
        },
        {
          id: "approval",
          heading: "3. Outra pessoa aprova",
          body: [
            "Quem prepara o processamento não pode ser quem o aprova. Não é uma preferência do Xefe — está imposto na base de dados, por isso ninguém contorna a regra usando outro ecrã.",
            "Existe porque os salários são o dinheiro mais fácil de desviar em qualquer empresa, e um segundo par de olhos é o controlo que o deteta. Numa empresa de uma só pessoa, pode receber permissão para aprovar os seus próprios processamentos — mas é uma decisão deliberada, não o comportamento por defeito.",
          ],
          when: "Antes de alguém ser pago.",
        },
        {
          id: "pay-and-record",
          heading: "4. Pague a todos e depois diga ao Xefe que o fez",
          body: [
            "Aprovar um processamento não movimenta dinheiro — continua a pagar por transferência bancária ou em numerário. O que o Xefe precisa depois é que confirme que aconteceu.",
            "É essa confirmação que fecha os salários na contabilidade e transforma os montantes de imposto e de segurança social em dívidas ao Estado, prontas para as duas entregas seguintes. Se a saltar, as suas contas mostram salários que nunca pagou.",
          ],
          when: "Assim que as pessoas tiverem o dinheiro.",
        },
        {
          id: "inss",
          heading: "5. Declare e pague a segurança social (INSS)",
          body: [
            "São duas coisas distintas, com duas datas distintas: a declaração com todos os trabalhadores e o que auferiram, e depois o pagamento dos 4% retidos a cada trabalhador mais os 6% a seu cargo.",
            "O Xefe gera o ficheiro da declaração para o portal do INSS. Não o carrega nem paga — isso é consigo.",
            "As contribuições em atraso vencem juros de 1% por cada mês ou fração.",
          ],
          when: "Declarar nos primeiros 10 dias do mês seguinte. Pagar entre o dia 10 e o dia 20.",
        },
        {
          id: "wit",
          heading: "6. Entregue e pague o imposto sobre salários",
          body: [
            "O imposto que reteve nos salários não é seu — está a guardá-lo para a administração fiscal, e é neste mês que o entrega.",
            "O Xefe prepara a declaração e os valores. Tal como no INSS, entregar e pagar são passos seus.",
          ],
          when: "Até ao dia 15 do mês seguinte (Lei Tributária, art. 23.º).",
        },
      ],
    },
    {
      id: "each-year",
      heading: "Uma vez por ano",
      blurb:
        "Mais duas datas, ambas fáceis de esquecer precisamente por só surgirem uma vez.",
      entries: [
        {
          id: "subsidio",
          heading: "O décimo terceiro mês (subsídio anual)",
          body: [
            "Cada trabalhador tem direito a **pelo menos** mais um mês por ano. Quem está consigo há menos de um ano recebe a parte proporcional, não nada.",
            "Esse mês é o **salário base** — não as horas extraordinárias, não os subsídios, não outras gratificações. O art. 39.º(4) deixa de fora da *remuneração* os abonos de despesas, os prémios de desempenho da empresa, o trabalho extraordinário e outros benefícios extraordinários, e o subsídio calcula-se sobre o que resta.",
            "É um direito legal e um mínimo, não uma gratificação que decide dar. Um contrato pode prometer mais.",
          ],
          when: "Até 20 de dezembro (Lei do Trabalho, art. 44.º).",
        },
        {
          id: "annual-tax",
          heading: "A declaração anual de rendimentos",
          body: [
            "O Xefe reúne os apuramentos de que o seu contabilista precisa e guarda o registo de quem os reviu.",
            "Não produz o formulário oficial nem o entrega. Dizer o contrário seria dizer-lhe que um trabalho está feito quando não está.",
          ],
          when: "Depois do fecho do ano, com o seu contabilista.",
        },
      ],
    },
  ],
};

export const LEAVER_PT: HelpArticle = {
  slug: "when-someone-leaves",
  kind: "guide",
  locale: "pt",
  updated: "2026-08-08",
  title: "Quando alguém sai",
  summary:
    "O que fará mais raramente e o mais fácil de errar. O que é devido a quem sai, o que o Xefe calcula por si, e o prazo que continua a custar-lhe dinheiro se lhe escapar.",
  keywords: [
    "cessação",
    "despedimento",
    "demissão",
    "acerto final",
    "compensação",
    "aviso prévio",
  ],
  intro: [
    "Quase tudo no Xefe se usa todos os meses, e ganha-se prática. O acerto final talvez o faça duas vezes por ano — e é o maior pagamento que alguma vez fará a uma só pessoa.",
    "O Xefe calcula tudo. Esta página serve para conseguir avaliar se o valor faz sentido, e para não lhe escapar o passo que nem sequer é sobre dinheiro.",
  ],
  groups: [
    {
      id: "what-is-owed",
      heading: "O que é devido",
      blurb:
        "O Xefe apura cada uma destas parcelas e coloca-as no recibo final. São direitos, não gestos.",
      entries: [
        {
          id: "why-they-left",
          heading: "Comece pela data e pelo motivo",
          body: [
            "Tudo o resto depende destes dois factos, por isso são a primeira coisa que o Xefe pergunta e a única que não deve adivinhar.",
            "O despedimento por justa causa é o único motivo que retira a compensação por tempo de serviço — e apenas quando o processo foi devidamente cumprido: acusação escrita, oportunidade de defesa e decisão formal. O Xefe pede que alguém confirme que isso aconteceu, em vez de o deduzir de uma lista, porque um despedimento que saltou esses passos mantém o direito.",
          ],
        },
        {
          id: "untaken-leave",
          heading: "As férias não gozadas são pagas em dinheiro",
          body: [
            "Os dias não gozados não se perdem à saída — são convertidos em dinheiro no recibo final.",
            "Há uma regra separada que vale a pena conhecer: se o trabalhador foi *impedido* de gozar as férias, esses dias são pagos a dobrar. Férias que ele próprio decidiu adiar não têm penalização. O Xefe pergunta qual foi o caso; nunca presume que a culpa é sua.",
          ],
        },
        {
          id: "service-compensation",
          heading: "Compensação por tempo de serviço",
          body: [
            "Um mês de salário por cada cinco anos de trabalho. É habitualmente a maior rubrica do recibo final.",
            "**Isso é o mínimo legal, não a resposta.** Muitos empregadores timorenses prometem bastante mais no contrato — acumular um mês por *ano* de serviço é comum aqui, cinco vezes o mínimo legal. Verifique o que acordou antes de pagar o mínimo; o Xefe calcula o mínimo e não conhece o seu contrato.",
            "O Xefe conta blocos completos de cinco anos, que é a leitura menor onde a lei é omissa — sete anos pagam um mês, não 1,4. Essa interpretação está explicada em *Onde o Xefe toma posição sobre a lei*, e vale uma conversa com o seu contabilista quando o valor é elevado.",
          ],
        },
        {
          id: "thirteenth",
          heading: "A parte proporcional do décimo terceiro",
          body: [
            "Quem sai em junho ganhou metade de um décimo terceiro. É pago com o restante acerto final, sem esperar por dezembro.",
            "Calculado sobre o salário base, tal como o de dezembro — horas extraordinárias e subsídios não o aumentam.",
          ],
        },
        {
          id: "notice",
          heading: "Aviso prévio — trabalhado ou pago",
          body: [
            "Ou cumpre o aviso prévio, ou é pago em substituição. A duração depende da antiguidade: **15 dias até dois anos, 30 dias acima disso**.",
            "Num despedimento por extinção do posto de trabalho, o trabalhador tem ainda direito a tempo pago durante o aviso para procurar outro emprego — **dois dias pagos por semana** (art. 53.º(4)). O Xefe conta semanas completas e apresenta o valor como mínimo, porque a lei não diz o que uma semana incompleta final dá direito.",
          ],
        },
      ],
    },
    {
      id: "the-trap",
      heading: "O passo que não é sobre dinheiro",
      blurb:
        "Falhar este continua a custar-lhe depois de a pessoa sair, e nada no ecrã lho vai dizer.",
      entries: [
        {
          id: "declare-cessation",
          heading: "Comunique ao INSS que o vínculo cessou",
          body: [
            "Enquanto não o declarar, **presume-se legalmente que o vínculo se mantém** — e as contribuições com ele. Não pagar nada à pessoa não altera isso; a obrigação segue a declaração, não o recibo.",
            "Assim, um trabalhador cuja saída não foi declarada vai acumulando contribuições que lhe são exigidas, mês após mês, com 1% de juros por cada um.",
          ],
          when: "Até ao dia 10 do mês seguinte à saída (DL 20/2017, art. 5.º).",
        },
        {
          id: "paid-once",
          heading: "Cada uma destas parcelas é paga uma só vez",
          body: [
            "Se as datas de um trabalhador que sai abrangerem dois processamentos, tudo o que está acima poderia plausivelmente ser pago duas vezes — e pareceria correto em ambos.",
            "O Xefe impede-o: cada parcela do acerto final fica marcada como liquidada da primeira vez que é paga, e um segundo processamento sobre o mesmo período não a volta a pagar.",
          ],
        },
      ],
    },
  ],
};

export const BOUNDARIES_PT: HelpArticle = {
  slug: "what-xefe-does-not-do",
  kind: "guide",
  locale: "pt",
  updated: "2026-08-08",
  title: "O que o Xefe não faz",
  summary:
    "As tarefas que continuam a ser suas, e os pontos em que o Xefe pára de propósito em vez de adivinhar. Vale a pena ler uma vez, porque presumir que uma entrega foi feita é o erro mais caro que existe.",
  keywords: [
    "entregar",
    "submeter",
    "carregar",
    "portal",
    "pagamento",
    "registar",
    "aconselhamento",
    "limites",
  ],
  intro: [
    "Um programa que faz discretamente *quase* todo o trabalho é mais perigoso do que um que faz metade, porque só se descobre no pior momento.",
    "Por isso esta página é a fronteira honesta. Nada aqui é uma falha que nos escapou — cada ponto é ou uma obrigação que é legalmente sua, ou um sítio onde adivinhar lhe custaria mais do que parar.",
  ],
  groups: [
    {
      id: "still-yours",
      heading: "Continua a ser consigo",
      blurb:
        "O Xefe prepara cada um destes por completo. Nenhum fica concluído sem a sua ação.",
      entries: [
        {
          id: "no-filing",
          heading: "O Xefe não entrega nada ao Estado",
          body: [
            "Produz o ficheiro da declaração do INSS e os valores da declaração fiscal, corretos e prontos. Não entra no portal do INSS nem submete à administração fiscal.",
            "É o ponto que merece mais clareza, porque um ficheiro gerado parece muito com um ficheiro entregue. Se ninguém o carregou, nada foi entregue — e o prazo passou na mesma.",
          ],
        },
        {
          id: "no-payments",
          heading: "O Xefe não movimenta dinheiro",
          body: [
            "Nenhum banco em Timor-Leste disponibiliza uma ligação que o permitisse. Os salários saem quando faz a transferência ou entrega o numerário.",
            "Para um lote de salários bancário, o Xefe monta o pacote que o banco realmente quer e uma carta de acompanhamento em português. Enviá-lo e assinar a ordem de pagamento são consigo.",
          ],
        },
        {
          id: "no-registration",
          heading: "O Xefe não regista a sua empresa nem inscreve os trabalhadores",
          body: [
            "O registo comercial, o seu número de empregador na segurança social, os números fiscais seus ou dos seus trabalhadores — tudo isso se trata no serviço competente, não aqui.",
            "O Xefe guarda os números depois de existirem e avisa-o quando falta algum, antes que bloqueie alguma coisa. Não os consegue obter por si.",
          ],
        },
      ],
    },
    {
      id: "refuses",
      heading: "Onde o Xefe pára de propósito",
      blurb:
        "Em cada um destes casos, apresentar um número convincente seria pior do que não apresentar nenhum.",
      entries: [
        {
          id: "petroleum",
          heading: "Recusa processar salários de um contratante petrolífero",
          body: [
            "Os trabalhadores de uma parte num Acordo Petrolífero são tributados por uma tabela inteiramente separada, com taxas diferentes e um serviço diferente. O Xefe não implementou esse regime.",
            "Processá-los às taxas comuns reteria a menos — e a diferença é legalmente do empregador, não do trabalhador. Por isso o assistente pára, em vez de calcular algo plausível.",
          ],
        },
        {
          id: "dismissal",
          heading: "Não decide se um despedimento foi lícito",
          body: [
            "Saber se um despedimento por justa causa retira a compensação por tempo de serviço depende de ter havido um processo devido: acusação escrita, oportunidade real de defesa, decisão formal.",
            "Nenhuma lista pendente o pode comprovar. O Xefe pede que uma pessoa identificada o ateste, e trata um despedimento que saltou esses passos como mantendo o direito.",
          ],
        },
        {
          id: "no-guessing",
          heading: "Não adivinha quando a lei é genuinamente ambígua",
          body: [
            "Onde a lei admite mais do que uma leitura, o Xefe fica pelo lado conservador — retém a mais em vez de a menos, revela em vez de deduzir — e di-lo no ecrã onde isso importa.",
            "Cada uma dessas escolhas está escrita em *Onde o Xefe toma posição sobre a lei*, com o artigo em que assenta, para que o seu contabilista possa discordar de uma frase concreta e não de um total.",
          ],
        },
      ],
    },
    {
      id: "not-advice",
      heading: "E não é aconselhamento",
      blurb:
        "A última fronteira, e a que mais conta quando os valores são elevados.",
      entries: [
        {
          id: "professional-advice",
          heading: "O Xefe não é o seu contabilista nem o seu advogado",
          body: [
            "Aplica a lei timorense com todo o cuidado que consegue e mostra o raciocínio — o artigo por detrás de cada regra, os valores, e onde ficou em dúvida.",
            "Isso serve para tornar o trabalho de um profissional mais rápido, não para o substituir. Para qualquer situação grande ou contestada — uma compensação por longa antiguidade, um despedimento, uma inspeção — os valores aqui são o ponto de partida dessa conversa.",
          ],
        },
      ],
    },
  ],
};
