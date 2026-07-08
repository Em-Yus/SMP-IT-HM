import { useState, useEffect } from 'react';
import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import { Menu, X, LogOut, Home, User, CalendarDays, CheckSquare, Book, FileText, Award, Wallet, Receipt, Trophy, Mail } from 'lucide-react';

export default function SiswaLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const userSession = localStorage.getItem('user_siswa');
    if (!userSession) {
      navigate('/login-siswa');
    }
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
          <img src="https://www.e-ujian.com/smpithm/logo" alt="Logo" className="w-10 h-10 object-contain mr-3" />
          <div>
            <h1 className="font-bold text-accent text-sm leading-tight">PORTAL SISWA</h1>
            <p className="text-xs text-gray-400">SMP IT HM</p>
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
            <img src="https://www.e-ujian.com/smpithm/logo" alt="Logo" className="w-8 h-8" />
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
