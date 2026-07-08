import { useState, useEffect } from 'react';
import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import { Menu, X, LogOut, LayoutDashboard, Image as ImageIcon, Megaphone, Trophy, UserMinus, UserCog, Building2, DoorOpen } from 'lucide-react';
import { menusConfig as menus } from '../utils/menuConfig';

export default function MainLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const [permissions, setPermissions] = useState([]);

  useEffect(() => {
    const userSession = localStorage.getItem('user_guru');
    if (!userSession) {
      navigate('/login-guru');
    } else {
      const perms = localStorage.getItem('user_permissions');
      if (perms) {
        setPermissions(JSON.parse(perms));
      }
      
      // Sync with database in background
      const syncPermissions = async () => {
        try {
          const userObj = JSON.parse(userSession);
          const { supabase } = await import('../services/supabaseClient');
          const { data: jabatanGuru } = await supabase.from('jabatan_guru').select('*').eq('guru_id', userObj.id).maybeSingle();
          if (jabatanGuru) {
            let userPermissions = [];
            if (Array.isArray(jabatanGuru.hak_akses)) {
              userPermissions = [...jabatanGuru.hak_akses];
            }

            const roles = [jabatanGuru.jabatan_utama, jabatanGuru.jabatan_lain_1, jabatanGuru.jabatan_lain_2, jabatanGuru.jabatan_lain_3].filter(Boolean);
            if (roles.length > 0) {
              const { data: listJabatan } = await supabase.from('data_jabatan').select('hak_akses').in('nama_jabatan', roles);
              if (listJabatan) {
                listJabatan.forEach(item => {
                  if (Array.isArray(item.hak_akses)) userPermissions = [...userPermissions, ...item.hak_akses];
                });
              }
            }
            const finalPerms = [...new Set(userPermissions)];
            setPermissions(finalPerms);
            localStorage.setItem('user_permissions', JSON.stringify(finalPerms));
          }
        } catch (e) {
          console.error('Failed to sync permissions:', e);
        }
      };
      
      syncPermissions();
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('user_guru');
    navigate('/login-guru');
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const isActive = (path) => location.pathname === path;

  const hasAccess = (path) => {
    if (permissions.includes('*')) return true;
    return permissions.includes(path);
  };

  const NavItem = ({ to, icon: Icon, children }) => {
    if (!hasAccess(to)) return null;
    return (
      <Link 
        to={to} 
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition group font-medium text-sm ${
          isActive(to) ? 'bg-primary text-white' : 'text-gray-600 hover:bg-bgSoft hover:text-primary'
        }`}
      >
        <Icon size={18} className={isActive(to) ? 'text-white' : 'text-gray-400 group-hover:text-primary transition'} />
        {children}
      </Link>
    );
  };

  // Define menus structrure to conditionally render section headers
  // The menus config is now imported from utils/menuConfig.js

  return (
    <div className="flex h-screen overflow-hidden relative bg-bgSoft text-gray-800 font-sans print:h-auto print:overflow-visible">
      {/* MOBILE OVERLAY */}
      {isMobileMenuOpen && (
        <div 
          onClick={toggleMobileMenu} 
          className="fixed inset-0 bg-black bg-opacity-50 z-30 transition-opacity duration-300 md:hidden"
        ></div>
      )}

      {/* SIDEBAR */}
      <aside 
        className={`fixed inset-y-0 right-0 z-40 w-64 bg-white shadow-xl flex flex-col transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:inset-auto print:hidden ${
          isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-20 flex items-center justify-center border-b border-gray-100 px-6 shrink-0 bg-white">
          <img src="https://www.e-ujian.com/smpithm/logo" alt="Logo" className="w-10 h-10 object-contain mr-3" />
          <div>
            <h1 className="font-bold text-primary text-sm leading-tight">SIAKAD</h1>
            <p className="text-xs text-gray-400">SMP IT HM</p>
          </div>
          <button onClick={toggleMobileMenu} className="md:hidden ml-auto text-gray-500 focus:outline-none">
            <X size={20} />
          </button>
        </div>

        {/* Menu Links */}
        <nav className="flex-1 py-4 px-4 space-y-1 overflow-y-auto pb-10">
          {menus.map((menuGroup, idx) => {
            const hasVisibleItems = menuGroup.items.some(item => hasAccess(item.to));
            if (!hasVisibleItems) return null;

            return (
              <div key={idx}>
                <div className={`text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-3 ${idx > 0 ? 'mt-6' : 'mt-2'}`}>
                  {menuGroup.group}
                </div>
                {menuGroup.items.map((item, itemIdx) => (
                  <NavItem key={itemIdx} to={item.to} icon={item.icon}>{item.label}</NavItem>
                ))}
              </div>
            );
          })}
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
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden print:overflow-visible">
        <header className="h-16 bg-white shadow-sm flex items-center justify-between px-4 md:hidden z-20 shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <img src="https://www.e-ujian.com/smpithm/logo" alt="Logo" className="w-8 h-8" />
            <span className="font-bold text-primary">SIAKAD</span>
          </div>
          <button onClick={toggleMobileMenu} className="text-gray-600 focus:outline-none p-2 rounded hover:bg-gray-100">
            <Menu size={24} />
          </button>
        </header>

        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-bgSoft p-4 md:p-8 print:p-0 print:overflow-visible print:bg-white">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
