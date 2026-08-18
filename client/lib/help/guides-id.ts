/**
 * Operational guides, Indonesian.
 *
 * Same reader as guides-en: the person running the business, first-time
 * software user, on a phone, usually stuck mid-task.
 *
 * ONE RULE holds all of them together: describe what is TRUE, never where to
 * click. Deadlines, the order operations must happen in, and what the law
 * requires do not move when we redesign a screen.
 */
import type { HelpArticle } from "./content";

export const MONTH_ID: HelpArticle = {
  slug: "your-month",
  kind: "guide",
  locale: "id",
  updated: "2026-08-08",
  title: "Bulan Anda, dari awal sampai akhir",
  summary:
    "Penggajian di Timor-Leste adalah irama bulanan dengan dua tenggat pemerintah di dalamnya. Inilah seluruh siklusnya, dalam urutan yang harus terjadi.",
  keywords: [
    "bulanan",
    "siklus",
    "tenggat",
    "INSS",
    "WIT",
    "pelaporan",
    "DR",
    "lapor",
    "setujui",
  ],
  intro: [
    "Setiap bulan berbentuk sama. Begitu Anda melihatnya sekali, tidak ada lagi yang mengejutkan di Xefe.",
    "Dua dari langkah-langkah ini punya tenggat hukum dan sisanya tidak. Tenggat itulah yang sebenarnya menjadi tujuan halaman ini — melewatkan satu saja menimbulkan biaya, dan tidak satu pun kantor pemerintah akan mengingatkan Anda.",
  ],
  groups: [
    {
      id: "each-month",
      heading: "Setiap bulan",
      blurb: "Dalam urutan ini. Setiap langkah memerlukan langkah sebelumnya.",
      entries: [
        {
          id: "record-differences",
          heading: "1. Catat apa yang berbeda",
          body: [
            "Anda tidak perlu mencatat bahwa orang datang bekerja. Xefe menganggap semua orang bekerja normal sebulan penuh dan membayar mereka penuh — yang sekaligus merupakan yang diminta undang-undang dan yang benar pada kebanyakan hari.",
            "Yang Anda catat adalah pengecualiannya: ada yang tidak hadir, ada yang bekerja lebih. Hukum Timor-Leste menginginkan persis dua hal itu — daftar ketidakhadiran yang beralasan dan tanpa alasan, serta daftar waktu mulai dan berakhirnya lembur.",
          ],
          when: "Kapan saja sepanjang bulan. Paling mudah saat kejadiannya berlangsung.",
        },
        {
          id: "run-payroll",
          heading: "2. Jalankan penggajiannya",
          body: [
            "Xefe menghitung gaji bruto, pajak penghasilan upah yang harus dipotong, kedua iuran jaminan sosial, dan berapa yang benar-benar sampai ke tangan tiap orang.",
            "Anda dapat mengubah angka mana pun sebelum mengajukannya. Jika Anda mengubahnya, Xefe menandai orang itu sebagai disesuaikan manual agar penyetujunya dapat melihatnya — angka yang diubah tidak boleh terlihat seperti angka yang dihitung.",
          ],
          when: "Setelah ketidakhadiran dan lembur bulan itu masuk.",
        },
        {
          id: "approval",
          heading: "3. Orang lain yang menyetujuinya",
          body: [
            "Orang yang menyiapkan penggajian tidak boleh menjadi orang yang menyetujuinya. Ini bukan preferensi Xefe — ini ditegakkan di basis data, sehingga tidak ada yang bisa mengakalinya lewat layar lain.",
            "Aturan ini ada karena penggajian adalah uang yang paling mudah dialihkan dalam usaha mana pun, dan sepasang mata kedua adalah kendali yang menangkapnya. Jika usaha Anda dijalankan seorang diri, Anda dapat diberi izin menyetujui proses Anda sendiri — tetapi itu keputusan yang Anda ambil secara sengaja, bukan bawaan.",
          ],
          when: "Sebelum siapa pun dibayar.",
        },
        {
          id: "pay-and-record",
          heading: "4. Bayar semua orang, lalu beri tahu Xefe bahwa Anda sudah membayar",
          body: [
            "Menyetujui sebuah proses tidak memindahkan uang — Anda tetap membayar lewat transfer bank atau tunai. Yang Xefe perlukan setelahnya adalah konfirmasi Anda bahwa pembayarannya sudah terjadi.",
            "Konfirmasi itulah yang menutup upah dalam pembukuan Anda dan mengubah jumlah pajak serta jaminan sosial menjadi utang Anda kepada pemerintah, siap untuk kedua pelaporan di bawah. Lewatkan itu dan pembukuan Anda akan menunjukkan upah yang tidak pernah Anda bayarkan.",
          ],
          when: "Segera setelah orang-orang menerima uangnya.",
        },
        {
          id: "inss",
          heading: "5. Laporkan dan bayar jaminan sosial (INSS)",
          body: [
            "Dua hal terpisah, dengan dua tanggal terpisah: pelaporan yang mendaftar setiap pekerja dan berapa yang mereka peroleh, lalu pembayaran 4% yang dipotong dari tiap pekerja ditambah 6% dari Anda.",
            "Xefe menghasilkan berkas pelaporan untuk portal INSS. Xefe tidak mengunggahnya dan tidak membayar — keduanya Anda yang lakukan.",
            "Iuran yang terlambat dikenakan bunga 1% untuk setiap bulan atau bagian dari bulan.",
          ],
          when: "Laporkan dalam 10 hari pertama bulan berikutnya. Bayar antara tanggal 10 dan 20.",
        },
        {
          id: "wit",
          heading: "6. Laporkan dan bayar pajak penghasilan upah",
          body: [
            "Pajak yang Anda potong dari upah bukan milik Anda — Anda hanya menahannya untuk otoritas pajak, dan inilah bulan Anda menyerahkannya.",
            "Xefe menyiapkan pelaporan dan angkanya. Seperti INSS, penyampaian dan pembayarannya adalah tugas Anda.",
          ],
          when: "Paling lambat tanggal 15 bulan berikutnya (Undang-Undang Pajak dan Bea, Sec. 23).",
        },
      ],
    },
    {
      id: "each-year",
      heading: "Sekali setahun",
      blurb: "Dua tanggal lagi, keduanya mudah terlupa karena hanya datang sekali.",
      entries: [
        {
          id: "subsidio",
          heading: "Bulan ketiga belas (subsídio anual)",
          body: [
            "Setiap pekerja berhak atas **sekurang-kurangnya** satu bulan tambahan per tahun. Orang yang bekerja dengan Anda kurang dari setahun penuh mendapat bagian proporsional, bukan nol.",
            "Bulan itu dihitung dari **gaji pokok** — bukan lembur, bukan tunjangan, bukan bonus lain. Art. 39(4) mengeluarkan tunjangan penggantian biaya, penghargaan laba, lembur dan manfaat luar biasa lainnya dari *remuneração*, dan subsidinya dihitung dari sisanya.",
            "Ini hak menurut undang-undang dan sebuah batas bawah, bukan bonus yang Anda pilih untuk diberikan. Kontrak boleh menjanjikan lebih.",
          ],
          when: "Paling lambat 20 Desember (UU Ketenagakerjaan, Art. 44).",
        },
        {
          id: "annual-tax",
          heading: "Pelaporan pajak penghasilan tahunan",
          body: [
            "Xefe menyusun perhitungan yang dibutuhkan akuntan Anda dan menyimpan catatan siapa yang meninjaunya.",
            "Xefe tidak membuat formulir resminya dan tidak menyampaikannya. Apa pun yang menyatakan sebaliknya berarti memberi tahu Anda bahwa sebuah pekerjaan selesai padahal belum.",
          ],
          when: "Setelah akhir tahun, bersama akuntan Anda.",
        },
      ],
    },
  ],
};

export const LEAVER_ID: HelpArticle = {
  slug: "when-someone-leaves",
  kind: "guide",
  locale: "id",
  updated: "2026-08-08",
  title: "Ketika seseorang keluar",
  summary:
    "Hal paling jarang yang akan Anda kerjakan dan paling mudah salah. Apa yang menjadi hak orang yang keluar, apa yang Xefe hitungkan untuk Anda, dan satu tenggat yang terus menagih Anda bila terlewat.",
  keywords: [
    "pemutusan",
    "pengunduran diri",
    "pemecatan",
    "gaji terakhir",
    "pesangon",
    "keluar",
    "pemberitahuan",
    "penghentian",
  ],
  intro: [
    "Sebagian besar Xefe Anda pakai setiap bulan, jadi Anda menjadi fasih. Gaji terakhir mungkin Anda kerjakan dua kali setahun — dan itu pembayaran tunggal terbesar yang pernah Anda lakukan kepada satu orang.",
    "Xefe menghitung semuanya. Halaman ini ada agar Anda dapat menilai apakah angkanya masuk akal, dan agar Anda tidak melewatkan langkah yang sama sekali bukan tentang uang.",
  ],
  groups: [
    {
      id: "what-is-owed",
      heading: "Apa yang menjadi hak orang yang keluar",
      blurb:
        "Xefe menghitung masing-masing dan menaruhnya pada slip gaji terakhir. Semuanya adalah hak, bukan pemberian sukarela.",
      entries: [
        {
          id: "why-they-left",
          heading: "Mulai dari tanggal dan alasannya",
          body: [
            "Semua di bawah ini bergantung pada dua fakta tersebut, jadi itulah yang pertama ditanyakan Xefe dan satu-satunya yang tidak boleh Anda tebak.",
            "Pemecatan karena kesalahan berat adalah satu-satunya alasan yang menghapus kompensasi masa kerja — dan hanya bila prosesnya diikuti dengan benar: tuduhan tertulis, kesempatan menjawab, dan putusan resmi. Xefe meminta seseorang mengonfirmasi bahwa itu benar-benar terjadi alih-alih menyimpulkannya dari sebuah menu pilihan, karena pemecatan yang melewati langkah-langkah itu tetap mempertahankan haknya.",
          ],
        },
        {
          id: "untaken-leave",
          heading: "Cuti tahunan yang tidak pernah diambil dibayar tunai",
          body: [
            "Hari yang tidak terpakai tidak hangus saat keluar — semuanya diuangkan pada slip gaji terakhir.",
            "Ada aturan terpisah yang perlu diketahui: jika pekerja *dihalangi* mengambil cutinya, hari-hari itu dibayar dua kali lipat. Cuti yang memang mereka pilih untuk ditunda tidak dikenai denda. Xefe menanyakan yang mana; ia tidak pernah menganggap Anda yang bersalah.",
          ],
        },
        {
          id: "service-compensation",
          heading: "Kompensasi masa kerja, untuk masa kerja yang panjang",
          body: [
            "Satu bulan gaji untuk setiap lima tahun bekerja. Ini biasanya baris terbesar pada slip gaji terakhir.",
            "**Itu batas minimum menurut hukum, bukan jawabannya.** Banyak pemberi kerja Timor-Leste menjanjikan jauh lebih banyak dalam kontrak — mengakru satu bulan per *tahun* masa kerja lazim di sini, yaitu lima kali batas bawah menurut undang-undang. Periksa apa yang sebenarnya Anda sepakati sebelum membayar minimumnya; Xefe menghitung batas bawahnya dan tidak mengetahui isi kontrak Anda.",
            "Xefe menghitung blok lima tahun yang genap, yaitu pembacaan yang lebih kecil di tempat undang-undangnya diam — tujuh tahun dibayar satu bulan, bukan 1,4. Penafsiran itu diuraikan dalam *Di mana Xefe mengambil sikap atas hukum*, dan layak dibicarakan dengan akuntan Anda bila jumlahnya besar.",
          ],
        },
        {
          id: "thirteenth",
          heading: "Bagian dari bulan ketiga belas",
          body: [
            "Orang yang keluar pada bulan Juni telah memperoleh setengah bulan ketiga belas. Itu dibayarkan bersama sisa gaji terakhirnya alih-alih menunggu Desember.",
            "Dihitung dari gaji pokok, seperti yang bulan Desember — lembur dan tunjangan tidak menaikkannya.",
          ],
        },
        {
          id: "notice",
          heading: "Pemberitahuan — dijalani atau dibayar",
          body: [
            "Entah mereka menjalani masa pemberitahuannya atau Anda membayarnya sebagai gantinya. Lamanya bergantung pada masa kerja: **15 hari untuk masa kerja sampai dua tahun, 30 hari di atas itu**.",
            "Dalam perampingan, pekerja juga berhak atas waktu berbayar selama masa pemberitahuan itu untuk mencari pekerjaan lain — **dua hari berbayar per minggu** (Art. 53(4)). Xefe menghitung minggu penuh dan melabeli angkanya sebagai batas minimum, karena undang-undangnya tidak menyatakan berapa yang diperoleh sisa minggu yang tidak genap.",
          ],
        },
      ],
    },
    {
      id: "the-trap",
      heading: "Langkah yang bukan tentang uang",
      blurb:
        "Melewatkan yang satu ini terus menimbulkan biaya setelah orangnya pergi, dan tidak ada apa pun di layar Anda yang akan memberi tahu.",
      entries: [
        {
          id: "declare-cessation",
          heading: "Beri tahu INSS bahwa hubungan kerjanya berakhir",
          body: [
            "Sampai Anda melaporkannya, **hubungan kerja itu secara hukum dianggap masih ada** — dan begitu pula iurannya. Tidak membayar orang itu apa pun tidak mengubahnya; kewajibannya mengikuti pelaporan, bukan slip gaji.",
            "Jadi seorang yang keluar tanpa dilaporkan diam-diam mengakru iuran yang menjadi utang Anda, bulan demi bulan, dengan bunga 1% untuk masing-masingnya.",
          ],
          when: "Paling lambat tanggal 10 bulan setelah mereka keluar (DL 20/2017, Art. 5).",
        },
        {
          id: "paid-once",
          heading: "Masing-masing ini dibayar tepat satu kali",
          body: [
            "Jika tanggal seorang yang keluar tumpang tindih dengan dua proses penggajian, semua di atas bisa saja terbayar dua kali — dan akan terlihat benar pada kedua prosesnya.",
            "Xefe mencegahnya: setiap hak gaji terakhir ditandai sebagai telah dilunasi pada saat pertama kali dibayarkan, dan proses kedua atas periode yang sama tidak akan membayarkannya lagi.",
          ],
        },
      ],
    },
  ],
};

export const BOUNDARIES_ID: HelpArticle = {
  slug: "what-xefe-does-not-do",
  kind: "guide",
  locale: "id",
  updated: "2026-08-08",
  title: "Apa yang tidak Xefe lakukan",
  summary:
    "Pekerjaan yang tetap menjadi tugas Anda, dan tempat-tempat Xefe sengaja berhenti alih-alih menebak. Layak dibaca sekali, karena mengira sebuah pelaporan sudah terjadi adalah kekeliruan paling mahal yang tersedia.",
  keywords: [
    "lapor",
    "pelaporan",
    "kirim",
    "unggah",
    "portal",
    "pembayaran",
    "daftar",
    "nasihat",
    "batas",
  ],
  intro: [
    "Perangkat lunak yang diam-diam mengerjakan *hampir* seluruh pekerjaan lebih berbahaya daripada yang mengerjakan separuhnya, karena Anda baru mengetahuinya pada saat yang salah.",
    "Jadi halaman ini adalah batas yang jujur. Tidak ada satu pun di sini yang merupakan celah yang kami lupakan — masing-masing adalah pekerjaan yang secara hukum memang tugas Anda, atau tempat di mana menebak akan lebih merugikan Anda daripada berhenti.",
  ],
  groups: [
    {
      id: "still-yours",
      heading: "Tetap menjadi tugas Anda",
      blurb:
        "Xefe menyiapkan masing-masing ini sepenuhnya. Tidak satu pun selesai sampai Anda bertindak.",
      entries: [
        {
          id: "no-filing",
          heading: "Xefe tidak menyampaikan apa pun kepada pemerintah",
          body: [
            "Ia menghasilkan berkas pelaporan INSS dan angka pelaporan pajak, benar dan siap. Ia tidak masuk ke portal INSS, dan tidak menyampaikan apa pun kepada otoritas pajak.",
            "Inilah yang paling perlu dijelaskan, karena berkas yang dihasilkan sangat mirip dengan berkas yang sudah dilaporkan. Jika tidak ada yang mengunggahnya, tidak ada yang dilaporkan — dan tenggatnya tetap lewat.",
          ],
        },
        {
          id: "no-payments",
          heading: "Xefe tidak memindahkan uang",
          body: [
            "Tidak ada bank di Timor-Leste yang menyediakan antarmuka yang memungkinkannya. Gaji berpindah ketika Anda melakukan transfer atau menyerahkan uang tunainya.",
            "Untuk batch gaji bank, Xefe menyusun paket yang memang diinginkan bank beserta surat pengantar dalam bahasa Portugis. Mengirimkannya dan menandatangani surat perintah bayar adalah tugas Anda.",
          ],
        },
        {
          id: "no-registration",
          heading: "Xefe tidak mendaftarkan usaha Anda atau mendaftarkan pekerja Anda",
          body: [
            "Pendaftaran perusahaan, nomor jaminan sosial pemberi kerja Anda, nomor pajak untuk Anda atau staf Anda — semuanya terjadi di kantor yang bersangkutan, bukan di sini.",
            "Xefe mencatat nomor-nomor itu begitu ada, dan memberi tahu Anda ketika satu belum ada sebelum hal itu menghambat sesuatu. Xefe tidak dapat mengurusnya untuk Anda.",
          ],
        },
      ],
    },
    {
      id: "refuses",
      heading: "Di mana Xefe berhenti dengan sengaja",
      blurb:
        "Pada masing-masing ini, menghasilkan angka yang terkesan pasti akan lebih buruk daripada tidak menghasilkan apa pun.",
      entries: [
        {
          id: "petroleum",
          heading: "Ia menolak menjalankan penggajian untuk kontraktor perminyakan",
          body: [
            "Karyawan dari pihak dalam sebuah Perjanjian Perminyakan dikenai pajak menurut daftar yang sepenuhnya terpisah, dengan tarif berbeda dan meja pelaporan yang berbeda. Xefe belum membangun rezim itu.",
            "Menjalankan mereka dengan tarif biasa akan memotong terlalu sedikit — dan kekurangannya secara hukum menjadi tanggungan pemberi kerja, bukan pekerja. Karena itu pemandunya berhenti alih-alih menghitung sesuatu yang tampak masuk akal.",
          ],
        },
        {
          id: "dismissal",
          heading: "Ia tidak memutuskan apakah sebuah pemecatan sah",
          body: [
            "Apakah pemecatan karena kesalahan menghapus kompensasi masa kerja bergantung pada apakah prosesnya benar-benar terjadi: tuduhan tertulis, kesempatan nyata untuk menjawab, sebuah putusan resmi.",
            "Tidak ada menu pilihan yang dapat membuktikan itu. Xefe meminta orang yang disebut namanya untuk menyatakannya, dan memperlakukan pemecatan yang melewati langkah-langkah tersebut sebagai tetap mempertahankan haknya.",
          ],
        },
        {
          id: "no-guessing",
          heading: "Ia tidak menebak ketika hukumnya memang tidak jelas",
          body: [
            "Di mana undang-undangnya memungkinkan lebih dari satu pembacaan, Xefe mengambil sisi yang konservatif — memotong lebih daripada kurang, mengungkapkan daripada menyimpulkan — dan menyatakannya di layar tempat hal itu penting.",
            "Setiap pilihan semacam itu dituliskan dalam *Di mana Xefe mengambil sikap atas hukum*, lengkap dengan pasal yang menjadi dasarnya, sehingga akuntan Anda dapat berbeda pendapat dengan sebuah kalimat tertentu, bukan dengan keseluruhannya.",
          ],
        },
      ],
    },
    {
      id: "not-advice",
      heading: "Dan ini bukan nasihat",
      blurb:
        "Batas terakhir, dan yang paling penting ketika jumlahnya besar.",
      entries: [
        {
          id: "professional-advice",
          heading: "Xefe bukan akuntan atau pengacara Anda",
          body: [
            "Ia menerapkan hukum Timor-Leste secermat mungkin dan menunjukkan perhitungannya — pasal di balik setiap aturan, jumlahnya, dan di mana ia tidak yakin.",
            "Itu dimaksudkan untuk mempercepat pekerjaan seorang profesional, bukan menggantikannya. Untuk apa pun yang besar atau diperselisihkan — pembayaran masa kerja panjang, sebuah pemecatan, sebuah audit — angka di sini adalah titik awal percakapan tersebut.",
          ],
        },
      ],
    },
  ],
};
