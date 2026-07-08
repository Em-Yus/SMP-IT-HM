import { Home, FileSignature, Users, Briefcase, School, BookOpen, CalendarDays, Clock, Edit3, Award, Wallet, Receipt, FileText, Mail, LayoutDashboard, Image as ImageIcon, Megaphone, Trophy, UserMinus, UserCog, Building2, DoorOpen, ClipboardList, Target, Activity, Book, UserCheck, Puzzle, User } from 'lucide-react';

export const menusConfig = [
  {
    group: "Menu Utama",
    items: [
      { to: "/dashboard-guru", icon: Home, label: "Dashboard" },
      { to: "/profil-guru", icon: User, label: "Profil Saya" }
    ]
  },
  {
    group: "Master Data",
    items: [
      { to: "/data-lembaga", icon: Building2, label: "Identitas Lembaga" },
      { to: "/data-siswa", icon: Users, label: "Data Siswa Aktif" },
      { to: "/data-periodik-siswa", icon: ClipboardList, label: "Data Periodik Siswa" },
      { to: "/siswa-nonaktif", icon: UserMinus, label: "Siswa Nonaktif" },
      { to: "/data-pegawai", icon: UserCog, label: "Data Pegawai" },
      { to: "/pegawai-nonaktif", icon: UserMinus, label: "Pegawai Nonaktif" },
      { to: "/data-jabatan", icon: Briefcase, label: "Data Jabatan" },
      { to: "/data-kelas", icon: School, label: "Data Kelas" },
      { to: "/data-ruang", icon: DoorOpen, label: "Data Ruang" },
      { to: "/mata-pelajaran", icon: BookOpen, label: "Mata Pelajaran" },
      { to: "/data-surat", icon: Mail, label: "Data Surat" }
    ]
  },
  {
    group: "Akademik & Presensi",
    items: [
      { to: "/jadwal-guru", icon: CalendarDays, label: "Jadwal Mengajar" },
      { to: "/presensi-guru", icon: Clock, label: "Presensi Pegawai" },
      { to: "/presensi-siswa", icon: UserCheck, label: "Presensi Siswa" },
      { to: "/tujuan-pembelajaran", icon: Target, label: "Tujuan Pembelajaran" },
      { to: "/kelas-mengaji", icon: Book, label: "Kelas Mengaji" },
      { to: "/input-nilai", icon: Edit3, label: "Input Nilai" },
      { to: "/catatan-wali", icon: FileText, label: "Catatan Wali Kelas" },
      { to: "/rapor-guru", icon: Award, label: "Cetak Rapor" }
    ]
  },
  {
    group: "Keuangan",
    items: [
      { to: "/tagihan-siswa", icon: Wallet, label: "Tagihan Siswa" },
      { to: "/rekap-bayar", icon: Receipt, label: "Rekap Bayar" },
      { to: "/input-biaya-pengembangan-mutu", icon: Wallet, label: "Biaya Pengembangan Mutu" },
      { to: "/pemasukan-lainnya", icon: Wallet, label: "Pemasukan Lainnya" }
    ]
  },
  {
    group: "Administrasi & Kesiswaan",
    items: [
      { to: "/surat-kepsek", icon: FileText, label: "Surat Kepsek" },
      { to: "/surat-kesiswaan", icon: Mail, label: "Surat Kesiswaan" },
      { to: "/kartu-siswa", icon: UserCog, label: "Cetak Kartu Siswa" },
      { to: "/admin/pendaftaran-spmb", icon: FileText, label: "Pendaftaran SPMB" },
      { to: "/verifikasi-ppdb", icon: FileSignature, label: "Verifikasi PPDB" },
      { to: "/prestasi", icon: Trophy, label: "Prestasi Siswa" },
      { to: "/ekstrakurikuler", icon: Activity, label: "Ekstrakurikuler" },
      { to: "/kokurikuler", icon: Puzzle, label: "Kokurikuler" }
    ]
  },
  {
    group: "Portal CMS",
    items: [
      { to: "/cms-beranda", icon: LayoutDashboard, label: "Pengaturan Beranda" },
      { to: "/cms-galeri", icon: ImageIcon, label: "Galeri Website" },
      { to: "/cms-pengumuman", icon: Megaphone, label: "Pengumuman" }
    ]
  }
];
