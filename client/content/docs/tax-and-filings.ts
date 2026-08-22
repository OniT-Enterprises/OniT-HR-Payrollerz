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
          "Income-tax installment figures at 0.5% of the reviewed turnover base — quarterly when last year's turnover was $1 million or less, monthly above that, or monthly whenever the tax office registered you that way.",
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
          ["Services tax", "15th", "15th"],
          ["Income-tax installment", "15th", "15th"],
        ],
      },
      { type: "heading", id: "paying", text: "Paying it at the bank" },
      {
        type: "prose",
        body: "Each tax is paid into its own government collection account, and putting a payment in the wrong one is a real risk when four of them differ by three digits. So Xefe names the exact account for the tax you are paying, builds the transfer description the tax office reconciles by — your taxpayer number comes first, because that is the part that identifies the payment — and generates the signed payment order your bank needs. Once the money has moved, recording it here posts it to your books: an income-tax installment is held as tax paid in advance, because it is credited against your annual bill rather than being an expense.",
      },
      {
        type: "callout",
        body: "If the tax office assessed a penalty or late interest, you enter those figures from the notice. Xefe does not estimate them — the published rate for late tax is not something we can verify, and inventing one would be worse than leaving the field to you. Social Security is the exception: its 1% per month is written into the law, so Xefe calculates that one for you.",
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
  id: {
    titleTop: "Pajak dan",
    titleAccent: "pelaporan wajib",
    lede: "Setiap tanggal bulanan dan tahunan yang wajib dipenuhi pemberi kerja Timor-Leste kepada kantor pajak dan Jaminan Sosial — dan persis apa yang Xefe siapkan untuk masing-masingnya, langsung dari penggajian yang sudah Anda bayarkan.",
    blocks: [
      {
        type: "prose",
        body: "Xefe menghitung pajak penghasilan upah (WIT) dan iuran INSS Anda dari penggajian yang benar-benar Anda jalankan dan bayarkan — tidak pernah dari perkiraan. WIT mengikuti bulan saat upah dibayarkan, dan setiap karyawan harus ditandai sebagai penduduk atau bukan penduduk memakai uji kependudukan pajak; kewarganegaraan dan status pemegang saham tidak menciptakan pengecualian pajak. Anda tetap memegang kendali atas apa yang benar-benar disampaikan dan kapan: Xefe menyiapkan angka dan dokumennya, bukan klik yang menyampaikannya.",
      },
      { type: "heading", id: "calendar", text: "Kalender bulanan" },
      {
        type: "deadlines",
        items: [
          {
            day: "10",
            small: "bulan berikutnya",
            title: "Laporan remunerasi INSS",
            body: "Laporan remunerasi bulanan (DR), disusun dalam templat Excel resmi portal INSS, disampaikan melalui portal pemberi kerja.",
          },
          {
            day: "15",
            small: "bulan berikutnya",
            title: "Pajak penghasilan upah (WIT)",
            body: "Pelaporan pajak penghasilan upah bulanan ATTL beserta pembayarannya — keduanya jatuh tempo pada hari yang sama.",
          },
          {
            day: "20",
            small: "bulan berikutnya",
            title: "Pembayaran INSS",
            body: "Keterlambatan pembayaran dikenakan bunga 1% per bulan atau bagian dari bulan (Dekrit-Undang-Undang 20/2017, Art. 39). Xefe menandai saldo yang terlambat beserta perkiraan berjalannya.",
          },
        ],
      },
      { type: "heading", id: "generates", text: "Apa yang Xefe hasilkan" },
      {
        type: "list",
        items: [
          "Angka pelaporan WIT bulanan — pajak yang dipotong dan dasar kena pajak di baliknya, siap untuk formulir ATTL.",
          "Pelaporan INSS Anda, disusun mengikuti templat Excel resmi portal INSS itu sendiri, siap diunggah apa adanya.",
          "Sertifikat WIT tahunan setiap karyawan — catatan upah yang dibayarkan dan pajak yang dipotong sepanjang tahun.",
          "Rekonsiliasi pajak upah pemberi kerja tahunan, mencocokkan dua belas bulan pelaporan terhadap tahun tersebut.",
          "Bantuan pajak jasa untuk penerimaan hotel, restoran/bar dan telekomunikasi. Usaha campuran hanya memasukkan penerimaan jasa yang ditetapkan; Xefe tidak pernah mengenakan pajak atas seluruh peredaran usaha hanya berdasarkan label sektornya.",
          "Angka angsuran pajak penghasilan sebesar 0,5% dari dasar peredaran usaha yang telah ditinjau — triwulanan bila peredaran usaha tahun lalu $1 juta atau kurang, bulanan di atas itu, atau bulanan bila kantor pajak mendaftarkan Anda demikian.",
          "Angka kerja di balik pelaporan pajak penghasilan tahunan Anda (TADR-IT 1), termasuk daftar penyusutan fiskal 100% menurut Schedule VII, tertata untuk diperiksa dan dilaporkan oleh akuntan Anda.",
        ],
      },
      {
        type: "heading",
        id: "return-vs-payment",
        text: "Pelaporan vs pembayaran",
      },
      {
        type: "prose",
        body: "Sebuah pelaporan dan pembayarannya adalah kewajiban yang terpisah. Xefe melacak kedua statusnya untuk WIT dan INSS. Pajak jasa dan angsuran pajak penghasilan masing-masing memiliki catatan pelaporannya sendiri: melaporkan yang satu tidak pernah menandai yang lain sebagai dilaporkan hanya karena bulannya sama. Begitu sebuah pelaporan dicatat sebagai disampaikan, angka yang dinyatakannya dibekukan; buktinya masih dapat ditambahkan.",
      },
      {
        type: "table",
        headers: ["Kewajiban", "Pelaporan jatuh tempo", "Pembayaran jatuh tempo"],
        rows: [
          ["Laporan remunerasi INSS", "tanggal 10", "tanggal 20"],
          ["Pajak penghasilan upah (WIT)", "tanggal 15", "tanggal 15"],
          ["Pajak jasa", "tanggal 15", "tanggal 15"],
          ["Angsuran pajak penghasilan", "tanggal 15", "tanggal 15"],
        ],
      },
      { type: "heading", id: "paying", text: "Membayar di bank" },
      {
        type: "prose",
        body: "Setiap pajak dibayarkan ke rekening penerimaan negara miliknya sendiri, dan salah rekening adalah risiko nyata ketika empat rekening itu hanya berbeda tiga angka. Karena itu Xefe menyebutkan rekening yang tepat untuk pajak yang Anda bayar, menyusun keterangan transfer yang dipakai kantor pajak untuk merekonsiliasi — nomor wajib pajak Anda di depan, karena itulah yang mengidentifikasi pembayaran — dan menghasilkan perintah pembayaran bertanda tangan yang diminta bank. Setelah uang berpindah, mencatatnya di sini memasukkannya ke buku Anda: angsuran pajak penghasilan disimpan sebagai pajak dibayar di muka, karena dikreditkan terhadap tagihan tahunan Anda, bukan beban.",
      },
      {
        type: "callout",
        body: "Jika kantor pajak menetapkan denda atau bunga keterlambatan, Anda memasukkan angka itu dari suratnya. Xefe tidak memperkirakannya — tarif resmi untuk pajak terlambat tidak dapat kami verifikasi, dan mengarangnya akan lebih buruk daripada menyerahkan kolom itu kepada Anda. Jaminan Sosial adalah pengecualian: 1% per bulan tertulis dalam undang-undang, jadi yang itu Xefe hitung untuk Anda.",
      },
      {
        type: "heading",
        id: "assisted-filing",
        text: "Pelaporan terpandu, sejujurnya",
      },
      {
        type: "prose",
        body: "Xefe menyiapkan angka yang eksak dan ekspor yang dibangun mengikuti templat pemerintah sendiri — laporan remunerasi portal INSS, formulir pajak upah ATTL. Penyampaiannya tetap terjadi di portal pemerintah sendiri, atas nama Anda. Untuk pelaporan pajak penghasilan tahunan, Xefe melangkah satu tahap lebih jauh dan menyiapkan kertas kerja lengkap berisi angka di baliknya — tetapi pelaporannya sendiri dibuat untuk diperiksa dan disampaikan oleh seorang akuntan. Xefe tidak pernah menyampaikan apa pun atas nama Anda.",
      },
      {
        type: "callout",
        body: "Xefe menghitung. Anda, atau akuntan Anda, yang menyampaikan. Pembagian itu disengaja: angkanya eksak, tetapi tanggung jawab atas pelaporannya tetap pada orang yang dapat menandatanganinya.",
      },
      {
        type: "callout",
        body: "Alur sederhana menerapkan bawaan yang aman, sehingga usaha kecil yang baru pertama kali memakainya tidak pernah diminta mengambil keputusan pajak secara tidak sengaja. Kedalaman setingkat akuntan — angka pelaporan satu per satu, rekonsiliasi, kertas kerja tahunan — tersedia begitu Anda membutuhkannya. Lihat halaman mitra akuntan untuk apa yang berubah setelah seorang akuntan bergabung dengan tim Anda.",
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
          "Valores do imposto prestacional a 0,5% da base revista — trimestral quando o volume de negócios do ano anterior foi de $1 milhão ou menos, mensal acima disso, ou mensal sempre que a autoridade tributária o tenha registado assim.",
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
          ["Imposto sobre serviços", "dia 15", "dia 15"],
          ["Imposto prestacional", "dia 15", "dia 15"],
        ],
      },
      { type: "heading", id: "paying", text: "Pagar no banco" },
      {
        type: "prose",
        body: "Cada imposto é pago numa conta de cobrança própria do Estado, e enganar-se na conta é um risco real quando quatro delas diferem em três dígitos. Por isso o Xefe indica a conta exata do imposto que está a pagar, compõe a descrição da transferência pela qual a autoridade tributária faz a reconciliação — o seu número de contribuinte vem primeiro, porque é essa a parte que identifica o pagamento — e gera a ordem de pagamento assinada que o banco exige. Depois de o dinheiro sair, registá-lo aqui lança-o na contabilidade: uma prestação do imposto sobre o rendimento fica como imposto pago antecipadamente, porque é creditada na sua conta anual e não é uma despesa.",
      },
      {
        type: "callout",
        body: "Se a autoridade tributária tiver avaliado multa ou juros de mora, introduz esses valores a partir do aviso. O Xefe não os estima — a taxa aplicável ao pagamento em atraso não é algo que possamos verificar, e inventá-la seria pior do que deixar o campo consigo. A Segurança Social é a exceção: o seu 1% por mês está escrito na lei, por isso esse o Xefe calcula.",
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
          "Valór impostu prestasaun 0,5% hosi baze ne'ebé revee — trimestrál karik volume negósiu tinan kotuk $1 millaun ka menus, mensál se liu tan, ka mensál karik autoridade tributária rejista ita nune'e.",
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
          ["Impostu servisu", "loron 15", "loron 15"],
          ["Impostu prestasaun", "loron 15", "loron 15"],
        ],
      },
      { type: "heading", id: "paying", text: "Selu iha banku" },
      {
        type: "prose",
        body: "Impostu ida-idak selu ba nia konta kobransa Estadu nian rasik, no sala konta mak risku loos bainhira konta haat ne'e la hanesan de'it iha tolu dígitu. Tan ne'e Xefe temi konta loos ba impostu ne'ebé ita selu, halo deskrisaun transferénsia ne'ebé autoridade tributária uza atu rekonsilia — númeru kontribuinte ita nian mai uluk, tan ne'e mak parte ne'ebé identifika pagamentu — no prepara orden pagamentu asinadu ne'ebé banku presiza. Wainhira osan sai tiha ona, rejista iha ne'e hatama ba livru kontas: prestasaun impostu rendimentu nian hela nu'udar impostu selu antes, tan sai kréditu ba konta anuál, la'ós despeza.",
      },
      {
        type: "callout",
        body: "Karik autoridade tributária taka multa ka juru tarde, ita hatama valór sira ne'e husi avizu. Xefe la estima sira — taxa ba impostu tarde la'ós buat ne'ebé ami bele verifika, no hatama númeru la iha baze sei aat liu duké husik kampu ne'e ba ita. Seguransa Sosiál mak esesaun: nia 1% kada fulan hakerek iha lei, tan ne'e ida ne'e Xefe kalkula ba ita.",
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
