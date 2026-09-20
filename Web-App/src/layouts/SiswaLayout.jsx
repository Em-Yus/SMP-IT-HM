import { useState, useEffect } from 'react';
import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import { Menu, X, LogOut, Home, User, CalendarDays, CheckSquare, Book, FileText, Award, Wallet, Receipt, Trophy, Mail, Radio, Laptop } from 'lucide-react';

export default function SiswaLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState(() => localStorage.getItem('school_logo_url') || 'https://www.e-ujian.com/smpithm/logo');
  const [schoolName, setSchoolName] = useState(() => localStorage.getItem('school_name') || 'SMP IT HM');
  const [activeExam, setActiveExam] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const userSession = localStorage.getItem('user_siswa');
    if (!userSession) {
      navigate('/login-siswa');
    }

    const fetchLembaga = async () => {
      try {
        const { supabase } = await import('../services/supabaseClient');
        const { data: lemb } = await supabase.from('data_lembaga').select('logo_url, nama_lembaga').limit(1).maybeSingle();
        if (lemb?.logo_url) {
          setLogoUrl(lemb.logo_url);
          localStorage.setItem('school_logo_url', lemb.logo_url);
        }
        if (lemb?.nama_lembaga) {
          setSchoolName(lemb.nama_lembaga);
          localStorage.setItem('school_name', lemb.nama_lembaga);
        }

        // Pengecekan Jadwal Ujian Aktif Siswa
        const sessionStr = localStorage.getItem('user_siswa');
        if (sessionStr) {
          const userObj = JSON.parse(sessionStr);
          let kelasId = userObj.kelas_id;
          if (!kelasId && userObj.kelas) {
            const { data: kData } = await supabase.from('data_kelas').select('id').ilike('nama_kelas', userObj.kelas).maybeSingle();
            if (kData) kelasId = kData.id;
          }

          const now = new Date();
          const year = now.getFullYear();
          const month = String(now.getMonth() + 1).padStart(2, '0');
          const day = String(now.getDate()).padStart(2, '0');
          const todayStr = `${year}-${month}-${day}`;
          const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

          let cbtQuery = supabase
            .from('cbt_jadwal_ujian')
            .select('id, nama_ujian, tanggal_ujian, jam_mulai, jam_selesai, status')
            .eq('tanggal_ujian', todayStr);

          if (kelasId) {
            cbtQuery = cbtQuery.or(`kelas_id.eq.${kelasId},kelas_id.is.null`);
          } else {
            cbtQuery = cbtQuery.is('kelas_id', null);
          }

          const { data: jadwals } = await cbtQuery;

          if (jadwals && jadwals.length > 0) {
            const active = jadwals.find(j => {
              const mulai = j.jam_mulai?.slice(0, 5) || '00:00';
              const selesai = j.jam_selesai?.slice(0, 5) || '23:59';
              return currentTime >= mulai && currentTime <= selesai;
            });
            setActiveExam(active || null);
          } else {
            setActiveExam(null);
          }
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchLembaga();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('user_siswa');
    navigate('/login-siswa');
  };

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
  const isActive = (path) => location.pathname === path;

  const NavItem = ({ to, icon: Icon, children }) => (
    <Link 
      to={to} 
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition group font-medium text-sm ${
        isActive(to) ? 'bg-primary text-white' : 'text-gray-600 hover:bg-bgSoft hover:text-primary'
      }`}
    >
      <Icon size={18} className={isActive(to) ? 'text-white' : 'text-gray-400 group-hover:text-accent transition'} />
      {children}
    </Link>
  );

  return (
    <div className="flex h-screen overflow-hidden relative bg-bgSoft text-gray-800 font-sans">
      {/* MOBILE OVERLAY */}
      {isMobileMenuOpen && (
        <div 
          onClick={toggleMobileMenu} 
          className="fixed inset-0 bg-black bg-opacity-50 z-30 transition-opacity duration-300 md:hidden"
        ></div>
      )}

      {/* SIDEBAR */}
      <aside 
        className={`fixed inset-y-0 right-0 z-40 w-64 bg-white shadow-xl flex flex-col transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:inset-auto ${
          isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-20 flex items-center justify-center border-b border-gray-100 px-6 shrink-0 bg-white">
          <img src={logoUrl} alt="Logo" className="w-10 h-10 object-contain mr-3" />
          <div className="min-w-0">
            <h1 className="font-bold text-accent text-sm leading-tight">PORTAL SISWA</h1>
            <p className="text-xs text-gray-400 truncate max-w-[130px]">{schoolName}</p>
          </div>
          <button onClick={toggleMobileMenu} className="md:hidden ml-auto text-gray-500 focus:outline-none">
            <X size={20} />
          </button>
        </div>

        {/* Menu Links */}
        <nav className="flex-1 py-4 px-4 space-y-1 overflow-y-auto pb-10 custom-scrollbar">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 mt-2 px-3">Menu Utama</div>
          <NavItem to="/dashboard-siswa" icon={Home}>Dashboard</NavItem>
          <NavItem to="/profil-siswa" icon={User}>Profil & Data Diri</NavItem>
          {activeExam && (
            <Link 
              to={`/cbt/ujian/${activeExam.id}`}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition font-bold text-sm bg-red-600 text-white shadow-md hover:bg-red-700 animate-pulse my-1"
            >
              <Radio size={18} />
              <span>Ujian CBT Aktif</span>
            </Link>
          )}
          
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 mt-6 px-3">Akademik & Kelas</div>
          <NavItem to="/jadwal-pelajaran-siswa" icon={CalendarDays}>Jadwal Pelajaran</NavItem>
          <NavItem to="/presensi-saya" icon={CheckSquare}>Presensi Saya</NavItem>
          <NavItem to="/mengaji-siswa" icon={Book}>Kelas Mengaji</NavItem>
          
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 mt-6 px-3">Hasil Belajar</div>
          <NavItem to="/nilai-siswa" icon={FileText}>Nilai Harian & Ujian</NavItem>
          <NavItem to="/rapor-siswa" icon={Award}>Rapor Digital</NavItem>

          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 mt-6 px-3">Keuangan</div>
          <NavItem to="/tagihan-saya" icon={Wallet}>Tagihan & Pembayaran</NavItem>

          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 mt-6 px-3">Kesiswaan</div>
          <NavItem to="/prestasi-ekskul-siswa" icon={Trophy}>Prestasi & Ekskul</NavItem>
        </nav>

        <div className="p-4 border-t border-gray-100 shrink-0 bg-white flex gap-2">
          <button onClick={handleLogout} className="flex-1 flex items-center justify-center gap-2 text-red-500 hover:bg-red-50 py-2 rounded-lg transition font-medium">
            <LogOut size={18} /> Keluar
          </button>
          <button onClick={toggleMobileMenu} className="md:hidden flex items-center justify-center text-gray-500 hover:bg-gray-100 px-3 py-2 rounded-lg transition bg-gray-50 border border-gray-200" title="Tutup Menu">
            <X size={20} />
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden w-full">
        <header className="h-16 bg-white shadow-sm flex items-center justify-between px-4 md:hidden z-20 shrink-0">
          <div className="flex items-center gap-3">
            <img src={logoUrl} alt="Logo" className="w-8 h-8 object-contain" />
            <span className="font-bold text-accent">Portal Siswa</span>
          </div>
          <button onClick={toggleMobileMenu} className="text-gray-600 focus:outline-none p-2 rounded hover:bg-gray-100">
            <Menu size={24} />
          </button>
        </header>

        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-bgSoft p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
