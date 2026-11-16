/** Help centre copy, in English and Indonesian. Both languages must have the same structure (a test checks this). */
import type { AppIconName } from '../../components/AppIcon'

export type GuideId = 'dashboard' | 'tasks' | 'focus' | 'clients' | 'reports' | 'invoices' | 'settings'

export interface HelpContent {
  title: string
  intro: string
  quickStart: { title: string; steps: { title: string; body: string }[] }
  guides: Record<GuideId, { title: string; summary: string; points: string[] }>
  glossary: { term: string; meaning: string }[]
  faq: { q: string; a: string }[]
  shortcuts: { keys: string[]; action: string }[]
}

export const GUIDE_ORDER: GuideId[] = ['dashboard', 'tasks', 'focus', 'clients', 'invoices', 'reports', 'settings']
export const GUIDE_ROUTE: Record<GuideId, string> = { dashboard: '/', tasks: '/tasks', focus: '/focus', clients: '/clients', reports: '/reports', invoices: '/invoices', settings: '/settings' }
export const GUIDE_ICON: Record<GuideId, AppIconName> = { dashboard: 'today', tasks: 'tasks', focus: 'focus', clients: 'clients', reports: 'reports', invoices: 'invoices', settings: 'settings' }

export function guideForPath(path: string): GuideId {
  const hit = GUIDE_ORDER.find((g) => g !== 'dashboard' && path.startsWith(GUIDE_ROUTE[g]))
  return hit ?? 'dashboard'
}

const en: HelpContent = {
  title: 'Help centre',
  intro: 'New to Taskly? Start with the five steps below, or search for a word you do not understand.',
  quickStart: {
    title: 'Get started in 5 steps',
    steps: [
      { title: 'Add your clients', body: 'Clients → Add client. Enter their time zone, working hours and hourly rate. A first project is created for you.' },
      { title: 'Create tasks', body: 'Tasks → Add task, or type in "Add a task…" at the bottom of any column and press Enter.' },
      { title: 'Set deadlines', body: 'Open a task and pick a deadline in your time. Taskly also shows it in the client\'s time.' },
      { title: 'Track your time', body: 'Press Start timer in a task, or use Focus for Pomodoro sessions. Only one timer runs at a time.' },
      { title: 'Report to clients', body: 'Reports shows the week: hours, amounts, a CSV/PDF timesheet and a ready-to-send progress update.' },
    ],
  },
  guides: {
    dashboard: {
      title: 'Dashboard',
      summary: 'Your day at a glance.',
      points: [
        'The blue card shows how many tasks must be completed within the next 3 days (today included), how many are in progress, and how much time you tracked today and this week.',
        'Upcoming deadlines lists the nearest open tasks. Tick the box to mark one as done.',
        'The focus timer starts or pauses a Pomodoro without leaving the page.',
        'Clients right now shows each client\'s local time, whether they are working, and today\'s overlap.',
      ],
    },
    tasks: {
      title: 'Tasks',
      summary: 'Plan work on a Kanban board or in a list.',
      points: [
        'Drag cards between To-do, In progress, In revision and Done. With a keyboard: Space to pick up, arrows to move, Space to drop.',
        'Click a card (or press Enter) to open it: title, deadline, tags, subtasks, notes and time tracking.',
        'Search and the client filter narrow the board; they stay in the address bar, so you can bookmark a view.',
        'List view sorts by deadline, title, status, client or creation date. Click a column header to sort.',
        'Calendar view shows each task on its due day. Drag a task to another day to move its due date, or use + on a day to add a task due then.',
        'Finished tasks can be archived with Archive on the card in Done (or in the task panel). They leave the board, list and calendar but still count in reports. The Archive view lists them, with Restore to bring one back.',
        'A task that is called off can be cancelled with Cancel on its card (To-do, In progress or In revision). The time logged on it is removed, so it is never billed. The Cancelled view lists these tasks; Restore puts one back on the board, starting from 0h 00m.',
        'An orange "Due outside client\'s working hours" note warns you when a deadline falls when the client is off.',
      ],
    },
    focus: {
      title: 'Focus (Pomodoro)',
      summary: 'Work in focused blocks with short breaks.',
      points: [
        'Pick a task under "Working on", then press Start. Focus time is saved to that task as a Pomodoro entry; breaks are not.',
        'After each focus session comes a short break; after every fourth, a long break. Skip moves on without counting the session.',
        'Change the lengths in Settings (minutes). Turn on desktop notifications to be told when a phase ends.',
        'The timer keeps going on other pages and after a reload. The sidebar shows it on every page.',
        'Two timers: Standard counts up with no breaks (the same timer as Start timer in a task); Pomodoro works in focus blocks with breaks. Whichever runs shows on the dashboard card "Active timer".',
        'Forgotten timers are caught: after 3 hours (and when your workday ends) Taskly asks "Still working?", it asks what to do with time while the app was closed or asleep, and after 12 hours it stops the timer and marks the time "check" (not billed). Change the limits in Settings → Timer.',
        'Worked without the timer? In the task, use Add time manually: pick the day, start time and duration, and add a note.',
      ],
    },
    clients: {
      title: 'Clients',
      summary: 'See when your working hours overlap.',
      points: [
        'Each row draws a 24-hour day in your time zone: grey = your hours, coloured = theirs, blue band = overlap, red line = now.',
        '"Best time to send" tells you whether to send now or when the client will next be at work.',
        'Use the arrows to look at other days; weekends and days off show no client hours.',
        '"My hours" sets your own working hours. Click a client\'s name to edit their details, projects or archive them.',
      ],
    },
    reports: {
      title: 'Reports',
      summary: 'Your week in numbers, ready to share.',
      points: [
        'Tiles show tracked time (compared with last week), the daily average, tasks completed and focus sessions.',
        'The bar chart shows hours per day; the busiest day is dark blue. The client bars show each client\'s share.',
        'Timesheet: hours × rate per client, in their own currency. Export all entries as CSV or one client as PDF.',
        'Progress update drafts a message from the week\'s work. Edit it, then Copy text or Open in email.',
      ],
    },
    invoices: {
      title: 'Invoices',
      summary: 'Bill clients from your tracked time, then print or save as PDF.',
      points: [
        "New invoice: pick a client and a period. Billable time on each of their tasks becomes a line: hours × the client's rate.",
        "The number (e.g. INV-2026-001), due date and tax come from Settings. The client's country (from their time zone) picks the tax rate.",
        'Edit lines, discount, tax and notes while the invoice is a draft. Changes save by themselves.',
        'Mark as sent locks the invoice. Mark as paid when the money arrives; sent invoices past their due date show as Overdue.',
        'Print / Save PDF opens the print window: pick your printer, or "Save as PDF" to get a file to email to the client.',
        'Taskly warns you when part of the period is already billed in another invoice for the same client.',
        'Send via WhatsApp (the green tab next to Preview) works when the client has a phone number and your Business details have yours. Send a polite message with every line and the total, or an image of the invoice.',
      ],
    },
    settings: {
      title: 'Settings',
      summary: 'Tax rates per country and invoice defaults.',
      points: [
        'Tax rates: add one per country, e.g. PPN 11% for Indonesia or GST 10% for Australia. Quick add offers common rates; check them first.',
        'Type: Added taxes (VAT, PPN, GST) go on top of the subtotal. Withheld taxes (e.g. PPh 23) are deducted by the client.',
        'Invoice defaults: number prefix, payment terms in days, payment details (bank account) and default notes.',
        'Units: the names each invoice line is counted in, e.g. Hours, Project, Day. Every line picks one, and it is printed on the invoice. Tracked time uses the unit named like "Hours".',
        'Your company name, address, tax ID and logo are on the Profile page, under Business details.',
      ],
    },
  },
  glossary: [
    { term: 'Overlap', meaning: 'The hours when you and a client are both at work. The best time for calls and quick replies.' },
    { term: 'Time zone', meaning: 'The local time of a place, such as Jakarta (UTC+7) or Berlin (UTC+1). Your zone comes from this device.' },
    { term: 'UTC offset', meaning: 'How many hours a zone is ahead of or behind UTC, the world reference time. UTC+7 is 7 hours ahead.' },
    { term: 'Daylight saving (DST)', meaning: 'Some countries move their clocks one hour in spring and autumn. Taskly adjusts automatically per city.' },
    { term: 'Working hours', meaning: 'The start and end time and working days of you or a client, in their own time zone.' },
    { term: 'Best time to send', meaning: 'When a message will land while the client is at work, so it is read sooner.' },
    { term: 'Kanban', meaning: 'A board with a column per status. Moving a card shows progress at a glance.' },
    { term: 'To-do / In progress / In revision / Done', meaning: 'Not started / being worked on / changes requested by the client / finished.' },
    { term: 'Subtask', meaning: 'A small step inside a task. The bar on the card shows how many are done.' },
    { term: 'Tag', meaning: 'A short label such as "UI" or "Urgent" to group tasks. "Urgent" is shown in red.' },
    { term: 'Overdue', meaning: 'The deadline has passed and the task is not done.' },
    { term: 'Timer / Tracking', meaning: 'A running clock that records time on a task until you press Stop.' },
    { term: 'Time entry', meaning: 'One recorded block of time on a task, from a timer, a Pomodoro, or added by hand.' },
    { term: 'Pomodoro', meaning: 'A focus method: work in blocks (default 25 minutes) separated by short breaks, with a longer break every few blocks.' },
    { term: 'Focus session', meaning: 'A finished Pomodoro focus block. Reports count focus entries of 10 minutes or more.' },
    { term: 'Timesheet', meaning: 'A table of hours worked per client, with rate and amount, used for invoicing.' },
    { term: 'Hourly rate', meaning: 'What a client pays per hour, in their currency. Amount = hours × rate.' },
    { term: 'Progress update', meaning: 'A short written status for a client: done, in progress, next, and time logged. Also called an async update.' },
    { term: 'Archive', meaning: 'Hide a client or project without deleting it. Restore it any time from the Clients page.' },
    { term: 'Sync', meaning: 'Keeping your data the same on every device. The sidebar shows whether everything is saved, still syncing, or waiting for a connection.' },
  ],
  faq: [
    { q: 'Where is my data stored?', a: 'In your Taskly account (Supabase), with a copy on this device so the app works offline. Changes sync to your other devices within seconds, and logging out removes the copy from this device.' },
    { q: 'Do I need to confirm my email?', a: 'Usually yes: after signing up, open the link in the email we send you, then log in. Check your spam folder if it does not arrive within a few minutes.' },
    { q: 'I forgot my password. What now?', a: 'On the login page click "Forgot password?", enter your email and open the reset link we send (it works once and expires after an hour). To change a password you still know, open Profile; the old one is not needed.' },
    { q: 'Why does a deadline show two times?', a: 'The first is your time; the second is the client\'s local time, shown when the two differ, so you both read the same deadline.' },
    { q: 'What happens if I travel to another time zone?', a: 'Taskly uses this device\'s time zone. Deadlines keep the same moment and are simply shown in your new local time.' },
    { q: 'Does the timer keep running if I close the tab?', a: 'Yes. Timers are saved, and a Pomodoro focus session that runs out while the tab is closed is logged to the exact minute it ended.' },
    { q: 'Why did a very short time entry disappear?', a: 'Entries shorter than 5 seconds are treated as accidental clicks and are not saved.' },
    { q: 'I do not get Pomodoro notifications.', a: 'Turn them on in Focus → Settings and allow notifications in the browser. A background tab may show them up to a minute late.' },
    { q: 'How do I save a timesheet as PDF?', a: 'Press PDF next to a client in Reports. A print page opens: choose "Save as PDF". If nothing opens, allow pop-ups for this site.' },
    { q: 'Are amounts in different currencies added together?', a: 'No. Each client keeps their own currency, and totals are never mixed.' },
    { q: 'Can I use Taskly on my phone?', a: 'Yes. On small screens the menu moves to a bar at the bottom of the screen.' },
    { q: 'How do I change the language?', a: 'Use the EN / ID switch in the sidebar (on phones, at the top).' },
  ],
  shortcuts: [
    { keys: ['?'], action: 'Open this help centre' },
    { keys: ['Esc'], action: 'Close a panel or dialog' },
    { keys: ['Space'], action: 'Pick up or drop a focused task card' },
    { keys: ['←', '→', '↑', '↓'], action: 'Move a picked-up card between and within columns' },
    { keys: ['Enter'], action: 'Open the focused task, or add a task in a quick-add field' },
    { keys: ['Tab'], action: 'Move to the next button or field' },
  ],
}

const id: HelpContent = {
  title: 'Pusat bantuan',
  intro: 'Baru memakai Taskly? Mulai dari lima langkah di bawah, atau cari kata yang belum Anda pahami.',
  quickStart: {
    title: 'Mulai dalam 5 langkah',
    steps: [
      { title: 'Tambahkan klien', body: 'Klien → Tambah klien. Isi zona waktu, jam kerja, dan tarif per jam. Proyek pertama dibuat otomatis.' },
      { title: 'Buat tugas', body: 'Tugas → Tambah tugas, atau ketik di "Tambah tugas…" di bawah kolom mana pun lalu tekan Enter.' },
      { title: 'Atur tenggat', body: 'Buka tugas dan pilih tenggat dalam waktu Anda. Taskly juga menampilkannya dalam waktu klien.' },
      { title: 'Catat waktu kerja', body: 'Tekan Mulai timer di tugas, atau pakai Fokus untuk sesi Pomodoro. Hanya satu timer yang berjalan sekaligus.' },
      { title: 'Laporkan ke klien', body: 'Laporan menampilkan minggu Anda: jam, jumlah tagihan, timesheet CSV/PDF, dan progress update siap kirim.' },
    ],
  },
  guides: {
    dashboard: {
      title: 'Dasbor',
      summary: 'Ringkasan hari Anda dalam satu layar.',
      points: [
        'Kartu biru menampilkan jumlah tugas yang harus selesai dalam 3 hari ini (termasuk hari ini), tugas yang sedang dikerjakan, dan waktu yang tercatat hari ini serta minggu ini.',
        'Tenggat terdekat menampilkan tugas terbuka yang paling dekat. Centang kotaknya untuk menandai selesai.',
        'Timer fokus memulai atau menjeda Pomodoro tanpa pindah halaman.',
        'Klien saat ini menampilkan jam lokal tiap klien, apakah mereka sedang bekerja, dan overlap hari ini.',
      ],
    },
    tasks: {
      title: 'Tugas',
      summary: 'Rencanakan pekerjaan di papan Kanban atau daftar.',
      points: [
        'Seret kartu antara Yang belum dikerjakan, Dikerjakan, Revisi, dan Selesai. Dengan keyboard: Spasi untuk mengangkat, panah untuk memindah, Spasi untuk meletakkan.',
        'Klik kartu (atau tekan Enter) untuk membukanya: judul, tenggat, tag, subtugas, catatan, dan pencatatan waktu.',
        'Pencarian dan filter klien menyaring papan; keduanya tersimpan di alamat halaman, jadi tampilannya bisa di-bookmark.',
        'Tampilan Daftar bisa diurutkan menurut tenggat, judul, status, klien, atau tanggal dibuat. Klik judul kolom untuk mengurutkan.',
        'Tampilan Kalender menampilkan tugas pada hari tenggatnya. Seret tugas ke hari lain untuk memindahkan tenggat, atau klik + pada sebuah hari untuk menambah tugas dengan tenggat hari itu.',
        'Tugas yang selesai bisa diarsipkan dengan tombol Arsipkan di kartu kolom Selesai (atau di panel tugas). Tugas itu hilang dari board, daftar dan kalender, tetapi tetap dihitung di laporan. Tampilan Arsip mendaftarnya, dengan tombol Kembalikan untuk memunculkannya lagi.',
        'Tugas yang tidak jadi bisa dibatalkan dengan tombol Batalkan di kartunya (Yang belum dikerjakan, Dikerjakan atau Revisi). Waktu yang tercatat dihapus, jadi tidak pernah ditagihkan. Tampilan Dibatalkan mendaftar tugas ini; Kembalikan menaruhnya lagi di board, mulai dari 0h 00m.',
        'Catatan oranye "Tenggat di luar jam kerja klien" muncul bila tenggat jatuh saat klien tidak bekerja.',
      ],
    },
    focus: {
      title: 'Fokus (Pomodoro)',
      summary: 'Kerja dalam blok fokus dengan jeda singkat.',
      points: [
        'Pilih tugas di "Sedang mengerjakan", lalu tekan Mulai. Waktu fokus disimpan ke tugas itu sebagai catatan Pomodoro; waktu istirahat tidak.',
        'Setiap sesi fokus diikuti istirahat pendek; setiap sesi keempat diikuti istirahat panjang. Lewati berpindah tanpa menghitung sesi.',
        'Ubah durasi di Pengaturan (menit). Aktifkan notifikasi desktop agar diberi tahu saat fase berakhir.',
        'Timer tetap berjalan di halaman lain dan setelah halaman dimuat ulang. Sidebar menampilkannya di setiap halaman.',
        'Dua jenis timer: Standar menghitung naik tanpa istirahat (sama dengan Mulai timer di tugas); Pomodoro bekerja dalam blok fokus dengan istirahat. Mana pun yang berjalan tampil di kartu dasbor "Timer aktif".',
        'Timer yang terlupa tertangkap: setelah 3 jam (dan saat jam kerja selesai) Taskly bertanya "Masih bekerja?", bertanya soal waktu ketika aplikasi tertutup atau perangkat tidur, dan setelah 12 jam timer berhenti sendiri dengan tanda "perlu dicek" (tidak ditagihkan). Atur batasnya di Pengaturan → Timer.',
        'Bekerja tanpa timer? Di tugas, pakai Tambah waktu manual: pilih tanggal, jam mulai dan durasi, lalu tambahkan catatan.',
      ],
    },
    clients: {
      title: 'Klien',
      summary: 'Lihat kapan jam kerja Anda overlap.',
      points: [
        'Setiap baris menggambar satu hari 24 jam dalam zona waktu Anda: abu-abu = jam Anda, berwarna = jam klien, pita biru = overlap, garis merah = sekarang.',
        '"Waktu terbaik mengirim" memberi tahu apakah kirim sekarang atau kapan klien kembali bekerja.',
        'Pakai tombol panah untuk melihat hari lain; akhir pekan dan hari libur tidak menampilkan jam klien.',
        '"Jam kerja saya" mengatur jam kerja Anda sendiri. Klik nama klien untuk mengubah data, proyek, atau mengarsipkannya.',
      ],
    },
    reports: {
      title: 'Laporan',
      summary: 'Minggu Anda dalam angka, siap dibagikan.',
      points: [
        'Kartu menampilkan waktu tercatat (dibanding minggu lalu), rata-rata harian, tugas selesai, dan sesi fokus.',
        'Grafik batang menampilkan jam per hari; hari tersibuk berwarna biru tua. Batang klien menunjukkan porsi tiap klien.',
        'Timesheet: jam × tarif per klien, dalam mata uang masing-masing. Ekspor semua catatan ke CSV atau satu klien ke PDF.',
        'Progress update menyusun pesan dari pekerjaan minggu ini. Edit, lalu Salin teks atau Buka di email.',
      ],
    },
    invoices: {
      title: 'Tagihan',
      summary: 'Tagih klien dari waktu kerja yang tercatat, lalu cetak atau simpan sebagai PDF.',
      points: [
        'Invoice baru: pilih klien dan periode. Waktu yang bisa ditagih di setiap tugas klien menjadi satu baris: jam × tarif klien.',
        'Nomor (mis. INV-2026-001), jatuh tempo dan pajak diambil dari Pengaturan. Negara klien (dari zona waktunya) menentukan tarif pajak.',
        'Ubah rincian, diskon, pajak dan catatan selama invoice masih draf. Perubahan tersimpan otomatis.',
        'Tandai terkirim mengunci invoice. Tandai lunas saat pembayaran masuk; invoice terkirim yang lewat jatuh tempo tampil sebagai Lewat jatuh tempo.',
        'Cetak / Simpan PDF membuka jendela cetak: pilih printer, atau "Simpan sebagai PDF" untuk mendapatkan file yang bisa dikirim ke klien.',
        'Taskly memberi peringatan bila sebagian periode sudah ditagih di invoice lain untuk klien yang sama.',
        'Kirim lewat WhatsApp (tab hijau di samping Pratinjau) aktif bila klien punya nomor HP dan nomor Anda ada di Data usaha. Kirim pesan sopan berisi semua rincian dan total, atau gambar invoice.',
      ],
    },
    settings: {
      title: 'Pengaturan',
      summary: 'Tarif pajak per negara dan pengaturan invoice.',
      points: [
        'Tarif pajak: tambahkan per negara, mis. PPN 11% untuk Indonesia atau GST 10% untuk Australia. Tambah cepat menawarkan tarif umum; periksa dulu.',
        'Jenis: pajak Ditambahkan (PPN, VAT, GST) dihitung di atas subtotal. Pajak Dipotong (mis. PPh 23) dikurangkan oleh klien.',
        'Pengaturan invoice: awalan nomor, jangka waktu bayar dalam hari, info pembayaran (rekening bank) dan catatan bawaan.',
        'Satuan: nama satuan hitung tiap baris invoice, mis. Hours, Project, Day. Setiap baris memilih satu, dan satuannya ikut tercetak di invoice. Waktu kerja tercatat memakai satuan seperti "Hours".',
        'Nama perusahaan, alamat, NPWP dan logo diatur di halaman Profil, bagian Data usaha.',
      ],
    },
  },
  glossary: [
    { term: 'Overlap', meaning: 'Jam ketika Anda dan klien sama-sama bekerja. Waktu terbaik untuk rapat dan balasan cepat.' },
    { term: 'Zona waktu', meaning: 'Waktu lokal suatu tempat, misalnya Jakarta (UTC+7) atau Berlin (UTC+1). Zona Anda diambil dari perangkat ini.' },
    { term: 'Selisih UTC', meaning: 'Berapa jam suatu zona lebih cepat atau lambat dari UTC, waktu acuan dunia. UTC+7 berarti 7 jam lebih cepat.' },
    { term: 'Waktu musim panas (DST)', meaning: 'Beberapa negara memajukan atau memundurkan jam satu jam di musim semi dan gugur. Taskly menyesuaikan otomatis per kota.' },
    { term: 'Jam kerja', meaning: 'Jam mulai, jam selesai, dan hari kerja Anda atau klien, dalam zona waktu masing-masing.' },
    { term: 'Waktu terbaik mengirim', meaning: 'Saat pesan tiba ketika klien sedang bekerja, sehingga lebih cepat dibaca.' },
    { term: 'Kanban', meaning: 'Papan dengan satu kolom per status. Memindah kartu memperlihatkan kemajuan sekilas.' },
    { term: 'Yang belum dikerjakan / Dikerjakan / Revisi / Selesai', meaning: 'Belum dimulai / sedang dikerjakan / ada permintaan perubahan dari klien / sudah selesai.' },
    { term: 'Subtugas', meaning: 'Langkah kecil di dalam tugas. Bar di kartu menunjukkan berapa yang sudah selesai.' },
    { term: 'Tag', meaning: 'Label singkat seperti "UI" atau "Urgent" untuk mengelompokkan tugas. "Urgent" tampil merah.' },
    { term: 'Terlambat', meaning: 'Tenggat sudah lewat dan tugas belum selesai.' },
    { term: 'Timer / Melacak', meaning: 'Jam yang berjalan dan mencatat waktu pada tugas sampai Anda menekan Stop.' },
    { term: 'Catatan waktu', meaning: 'Satu blok waktu yang tercatat pada tugas, dari timer, Pomodoro, atau ditambahkan manual.' },
    { term: 'Pomodoro', meaning: 'Metode fokus: kerja dalam blok (bawaan 25 menit) diselingi istirahat pendek, dengan istirahat lebih panjang setiap beberapa blok.' },
    { term: 'Sesi fokus', meaning: 'Satu blok fokus Pomodoro yang selesai. Laporan menghitung catatan fokus 10 menit atau lebih.' },
    { term: 'Timesheet', meaning: 'Tabel jam kerja per klien beserta tarif dan jumlah, dipakai untuk penagihan.' },
    { term: 'Tarif per jam', meaning: 'Bayaran klien per jam, dalam mata uang mereka. Jumlah = jam × tarif.' },
    { term: 'Progress update', meaning: 'Status tertulis singkat untuk klien: selesai, sedang dikerjakan, berikutnya, dan waktu tercatat. Disebut juga update asinkron.' },
    { term: 'Arsip', meaning: 'Menyembunyikan klien atau proyek tanpa menghapusnya. Bisa dipulihkan kapan saja dari halaman Klien.' },
    { term: 'Sinkron', meaning: 'Menjaga data Anda sama di semua perangkat. Sidebar menunjukkan apakah semua sudah tersimpan, sedang disinkronkan, atau menunggu koneksi.' },
  ],
  faq: [
    { q: 'Di mana data saya disimpan?', a: 'Di akun Taskly Anda (Supabase), dengan salinan di perangkat ini agar aplikasi tetap jalan saat offline. Perubahan tersinkron ke perangkat lain dalam hitungan detik, dan keluar akun menghapus salinan di perangkat ini.' },
    { q: 'Apakah saya perlu mengonfirmasi email?', a: 'Biasanya ya: setelah daftar, buka tautan di email yang kami kirim, lalu masuk. Cek folder spam bila tidak datang dalam beberapa menit.' },
    { q: 'Saya lupa kata sandi. Bagaimana?', a: 'Di halaman masuk klik "Lupa kata sandi?", masukkan email Anda, lalu buka link reset yang kami kirim (hanya bisa dipakai sekali dan berlaku satu jam). Untuk mengubah kata sandi yang masih Anda ingat, buka Profil; kata sandi lama tidak diperlukan.' },
    { q: 'Mengapa tenggat menampilkan dua waktu?', a: 'Yang pertama waktu Anda; yang kedua waktu lokal klien, ditampilkan bila berbeda, agar Anda dan klien membaca tenggat yang sama.' },
    { q: 'Bagaimana kalau saya bepergian ke zona waktu lain?', a: 'Taskly memakai zona waktu perangkat ini. Tenggat tetap pada momen yang sama, hanya ditampilkan dalam waktu lokal Anda yang baru.' },
    { q: 'Apakah timer tetap berjalan jika tab ditutup?', a: 'Ya. Timer tersimpan, dan sesi fokus Pomodoro yang habis saat tab tertutup dicatat tepat pada menit berakhirnya.' },
    { q: 'Kenapa catatan waktu yang sangat singkat hilang?', a: 'Catatan kurang dari 5 detik dianggap salah klik dan tidak disimpan.' },
    { q: 'Notifikasi Pomodoro tidak muncul.', a: 'Aktifkan di Fokus → Pengaturan dan izinkan notifikasi di browser. Tab yang ada di belakang bisa menampilkannya terlambat hingga satu menit.' },
    { q: 'Bagaimana menyimpan timesheet sebagai PDF?', a: 'Tekan PDF di samping klien di Laporan. Halaman cetak terbuka: pilih "Simpan sebagai PDF". Bila tidak terbuka, izinkan pop-up untuk situs ini.' },
    { q: 'Apakah jumlah dalam mata uang berbeda dijumlahkan?', a: 'Tidak. Setiap klien tetap memakai mata uangnya sendiri, dan total tidak pernah dicampur.' },
    { q: 'Bisakah Taskly dipakai di HP?', a: 'Bisa. Di layar kecil menu pindah ke bar di bagian bawah layar.' },
    { q: 'Bagaimana mengganti bahasa?', a: 'Pakai pilihan EN / ID di sidebar (di HP, di bagian atas).' },
  ],
  shortcuts: [
    { keys: ['?'], action: 'Buka pusat bantuan ini' },
    { keys: ['Esc'], action: 'Tutup panel atau dialog' },
    { keys: ['Spasi'], action: 'Angkat atau letakkan kartu tugas yang terfokus' },
    { keys: ['←', '→', '↑', '↓'], action: 'Pindahkan kartu yang diangkat antar dan di dalam kolom' },
    { keys: ['Enter'], action: 'Buka tugas yang terfokus, atau tambah tugas di kolom tambah cepat' },
    { keys: ['Tab'], action: 'Pindah ke tombol atau kolom berikutnya' },
  ],
}

export const helpContent: Record<'en' | 'id', HelpContent> = { en, id }

export type HelpHit =
  | { kind: 'guide'; guide: GuideId; title: string; text: string }
  | { kind: 'step'; title: string; text: string }
  | { kind: 'term'; title: string; text: string }
  | { kind: 'faq'; title: string; text: string }

/** Every word of the query must appear (case- and accent-insensitive) in the title or text. */
export function searchHelp(c: HelpContent, query: string): HelpHit[] {
  const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  const words = norm(query).split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const hits: HelpHit[] = [
    ...c.quickStart.steps.map((s) => ({ kind: 'step' as const, title: s.title, text: s.body })),
    ...GUIDE_ORDER.flatMap((g) => c.guides[g].points.map((p) => ({ kind: 'guide' as const, guide: g, title: c.guides[g].title, text: p }))),
    ...c.glossary.map((x) => ({ kind: 'term' as const, title: x.term, text: x.meaning })),
    ...c.faq.map((x) => ({ kind: 'faq' as const, title: x.q, text: x.a })),
  ]
  return hits.filter((h) => {
    const hay = norm(`${h.title} ${h.text}`)
    return words.every((w) => hay.includes(w))
  })
}
