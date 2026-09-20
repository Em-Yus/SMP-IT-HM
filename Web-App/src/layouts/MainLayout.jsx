import { useState, useEffect, useMemo } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { 
  Menu, X, LogOut, LayoutDashboard, Image as ImageIcon, Megaphone, 
  Trophy, UserMinus, UserCog, Building2, DoorOpen, Search,
  FileSignature, FileCheck, FileText, CalendarDays, BookOpen
} from 'lucide-react';
import { menusConfig as menus } from '../utils/menuConfig';

export default function MainLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const [permissions, setPermissions] = useState([]);
  const [userRoles, setUserRoles] = useState([]);
  const [logoUrl, setLogoUrl] = useState(() => localStorage.getItem('school_logo_url') || 'https://www.e-ujian.com/smpithm/logo');
  const [schoolName, setSchoolName] = useState(() => localStorage.getItem('school_name') || 'SMP IT HM');
  const [searchQuery, setSearchQuery] = useState('');
  const [cbtStatus, setCbtStatus] = useState(() => {
    try {
      const saved = localStorage.getItem('cbt_status');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return {
      hasKetuaPanitia: false,
      isKetuaSignedSop: false,
      isKetuaUser: false,
      isPanitiaMember: false,
      loaded: false
    };
  });

  useEffect(() => {
    const userSession = localStorage.getItem('user_guru');
    if (!userSession) {
      navigate('/login-guru');
    } else {
      const perms = localStorage.getItem('user_permissions');
      if (perms) {
        setPermissions(JSON.parse(perms));
      }
      const storedRoles = localStorage.getItem('user_roles');
      if (storedRoles) {
        setUserRoles(JSON.parse(storedRoles));
      }
      
      // Sync with database in background
      const syncPermissions = async () => {
        try {
          const userObj = JSON.parse(userSession);
          const { supabase } = await import('../services/supabaseClient');

          // Check if teacher is inactive
          if (userObj && userObj.id) {
            const { data: guruCheck } = await supabase.from('data_guru').select('tanggal_keluar').eq('id', userObj.id).maybeSingle();
            if (guruCheck && guruCheck.tanggal_keluar) {
              localStorage.clear();
              navigate('/login-guru');
              return;
            }
          }

          let currentUserRoles = [];
          const { data: jabatanGuru } = await supabase.from('jabatan_guru').select('*').eq('guru_id', userObj.id).maybeSingle();
          if (jabatanGuru) {
            let userPermissions = [];
            if (Array.isArray(jabatanGuru.hak_akses)) {
              userPermissions = [...jabatanGuru.hak_akses];
            }

            const roles = [jabatanGuru.jabatan_utama, jabatanGuru.jabatan_lain_1, jabatanGuru.jabatan_lain_2, jabatanGuru.jabatan_lain_3].filter(Boolean);
            currentUserRoles = roles;
            setUserRoles(roles);
            localStorage.setItem('user_roles', JSON.stringify(roles));

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

          // Sync logo & name from data_lembaga
          const { data: lembaga } = await supabase.from('data_lembaga').select('logo_url, nama_lembaga').limit(1).maybeSingle();
          if (lembaga?.logo_url) {
            setLogoUrl(lembaga.logo_url);
            localStorage.setItem('school_logo_url', lembaga.logo_url);
          }
          if (lembaga?.nama_lembaga) {
            setSchoolName(lembaga.nama_lembaga);
            localStorage.setItem('school_name', lembaga.nama_lembaga);
          }

          // Sync status kemunculan menu CBT berdasarkan 2 Aturan:
          // Rule 1: Menu SOP muncul ketika ada salah satu guru yang jabatannya sebagai ketua panitia ujian
          // Rule 2: Menu Jadwal & Bank Soal muncul ketika ketua panitia sudah menandatangani Halaman SOP (atau bagi Panitia)
          try {
            let hasKetuaPanitia = false;
            let ketuaGuruId = null;

            // Rule 1: Ambil penunjukan Ketua Panitia LANGSUNG dari Data Pegawai (jabatan_guru)
            const { data: listGuruJabatan } = await supabase
              .from('jabatan_guru')
              .select('guru_id, jabatan_utama, jabatan_lain_1, jabatan_lain_2, jabatan_lain_3');

            const foundKetua = listGuruJabatan?.find(jg => {
              const jRoles = [jg.jabatan_utama, jg.jabatan_lain_1, jg.jabatan_lain_2, jg.jabatan_lain_3];
              return jRoles.some(r => (r || '').toLowerCase().includes('ketua panitia'));
            });

            if (foundKetua) {
              hasKetuaPanitia = true;
              ketuaGuruId = foundKetua.guru_id;
            }

            let isKetuaSignedSop = false;
            if (hasKetuaPanitia) {
              const { data: sop } = await supabase
                .from('cbt_sop_persetujuan')
                .select('id, tanda_tangan_ketua, is_approved, is_tata_tertib_approved')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

              isKetuaSignedSop = !!(sop && (sop.tanda_tangan_ketua || sop.is_approved || sop.is_tata_tertib_approved));
            }

            const isKetuaUser = (Number(ketuaGuruId) === Number(userObj?.id)) || (userObj?.role === 'admin') || currentUserRoles.some(r => (r || '').toLowerCase().includes('ketua panitia'));

            const isPanitiaMember = isKetuaUser || currentUserRoles.some(r => {
              const lower = (r || '').toLowerCase();
              return lower.includes('sekretaris') || lower.includes('bendahara panitia') || lower.includes('waka') || lower.includes('kurikulum') || lower.includes('operator');
            });

            const newCbtStatus = {
              hasKetuaPanitia,
              isKetuaSignedSop,
              isKetuaUser,
              isPanitiaMember,
              loaded: true
            };

            setCbtStatus(newCbtStatus);
            localStorage.setItem('cbt_status', JSON.stringify(newCbtStatus));
          } catch (cbtErr) {
            console.error('Failed to sync CBT menu status:', cbtErr);
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
    // Menu CBT:
    // Menu SOP: Muncul untuk Panitia ketika ditunjuk, dan untuk guru lain HANYA ketika dokumen SOP sudah ditandatangani Ketua Panitia
    if (path === '/cbt/sop-ujian') {
      return cbtStatus.hasKetuaPanitia && (cbtStatus.isPanitiaMember || cbtStatus.isKetuaSignedSop);
    }
    // Menu Jadwal: Muncul ketika Ketua Panitia sudah menandatangani Halaman SOP (atau bagi Panitia)
    if (path === '/cbt/jadwal') {
      return cbtStatus.hasKetuaPanitia && (cbtStatus.isPanitiaMember || cbtStatus.isKetuaSignedSop);
    }
    // Menu Bank Soal: Muncul untuk Panitia dan semua Guru ketika SOP sudah ditandatangani
    if (path === '/cbt/bank-soal') {
      return cbtStatus.hasKetuaPanitia && (cbtStatus.isPanitiaMember || cbtStatus.isKetuaSignedSop);
    }
    if (path.startsWith('/cbt/')) {
      return cbtStatus.hasKetuaPanitia;
    }

    // Kebijakan Kepala Sekolah: Cetak QR & Master Jam Kerja Guru hanya untuk Kepsek, Bendahara, Waka Kurikulum, Operator, Admin
    if (path === '/cetak-qr-presensi-guru' || path === '/master-jam-guru') {
      const userSession = localStorage.getItem('user_guru');
      const userObj = userSession ? JSON.parse(userSession) : null;
      if (userObj?.role === 'admin') return true;
      return userRoles.some(r => {
        const lower = (r || '').toLowerCase();
        return lower.includes('kepala sekolah') || lower.includes('kepsek') || lower.includes('bendahara') || lower.includes('waka') || lower.includes('kurikulum') || lower.includes('operator') || lower.includes('admin');
      });
    }

    // Rekap Honor Guru dapat diakses oleh semua guru
    if (path === '/rekap-honor-guru') {
      return true;
    }

    if (permissions.includes('*')) return true;
    return permissions.includes(path);
  };

  const NavItem = ({ to, icon: Icon, children }) => {
    if (!hasAccess(to)) return null;
    return (
      <Link 
        to={to} 
        onClick={() => setIsMobileMenuOpen(false)}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition group font-medium text-sm ${
          isActive(to) ? 'bg-primary text-white' : 'text-gray-600 hover:bg-bgSoft hover:text-primary'
        }`}
      >
        <Icon size={18} className={isActive(to) ? 'text-white' : 'text-gray-400 group-hover:text-primary transition'} />
        {children}
      </Link>
    );
  };

  // Filtered menus based on search query, permissions, and role
  const filteredMenus = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const processedMenus = menus.map(group => {
      if (group.group === "Ujian CBT & Asesmen") {
        const items = [];
        // Menu SOP: Muncul untuk Panitia ketika ditunjuk, atau semua guru ketika dokumen SOP sudah ditandatangani
        if (cbtStatus.hasKetuaPanitia && (cbtStatus.isPanitiaMember || cbtStatus.isKetuaSignedSop)) {
          items.push({ to: "/cbt/sop-ujian", icon: FileCheck, label: "SOP" });
        }
        // Menu Jadwal: Muncul untuk Panitia atau ketika Ketua Panitia sudah menandatangani Halaman SOP
        if (cbtStatus.hasKetuaPanitia && (cbtStatus.isPanitiaMember || cbtStatus.isKetuaSignedSop)) {
          items.push({ to: "/cbt/jadwal", icon: CalendarDays, label: "Jadwal Ujian" });
        }
        return {
          ...group,
          items
        };
      }
      return group;
    });

    return processedMenus
      .map(group => {
        const filteredItems = group.items.filter(item => {
          if (!hasAccess(item.to)) return false;
          if (!q) return true;
          const matchLabel = item.label.toLowerCase().includes(q);
          const matchGroup = group.group.toLowerCase().includes(q);
          return matchLabel || matchGroup;
        });

        return {
          ...group,
          items: filteredItems
        };
      })
      .filter(group => group.items.length > 0);
  }, [menus, searchQuery, permissions, userRoles, cbtStatus]);

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
          <img src={logoUrl} alt="Logo" className="w-10 h-10 object-contain mr-3" />
          <div className="min-w-0">
            <h1 className="font-bold text-primary text-sm leading-tight">SIAKAD</h1>
            <p className="text-xs text-gray-400 truncate max-w-[130px]">{schoolName}</p>
          </div>
          <button onClick={toggleMobileMenu} className="md:hidden ml-auto text-gray-500 focus:outline-none">
            <X size={20} />
          </button>
        </div>

        {/* Search Bar Menu */}
        <div className="px-4 pt-3 pb-2 shrink-0 border-b border-gray-100">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari menu..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-8 pr-7 py-2 text-xs font-medium text-gray-800 placeholder-gray-400 outline-none focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/10 transition"
            />
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded-full hover:bg-gray-200 transition"
                title="Hapus pencarian"
              >
                <X size={13} />
              </button>
            ) : null}
          </div>
        </div>

        {/* Menu Links */}
        <nav className="flex-1 py-3 px-4 space-y-1 overflow-y-auto pb-10 scrollbar-custom">
          {filteredMenus.length === 0 ? (
            <div className="py-10 px-2 text-center">
              <div className="w-10 h-10 bg-gray-100 text-gray-400 rounded-xl flex items-center justify-center mx-auto mb-2">
                <Search size={18} />
              </div>
              <p className="text-xs font-bold text-gray-700">Menu tidak ditemukan</p>
              <p className="text-[11px] text-gray-400 mt-1">
                Tidak ada menu yang sesuai dengan "{searchQuery}"
              </p>
              <button
                onClick={() => setSearchQuery('')}
                className="mt-3 text-xs text-primary font-bold hover:underline"
              >
                Reset Pencarian
              </button>
            </div>
          ) : (
            filteredMenus.map((menuGroup, idx) => {
              const hasVisibleItems = menuGroup.items.some(item => hasAccess(item.to));
              if (!hasVisibleItems) return null;

              return (
                <div key={idx}>
                  <div className={`text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-3 ${idx > 0 ? 'mt-5' : 'mt-1'}`}>
                    {menuGroup.group}
                  </div>
                  {menuGroup.items.map((item, itemIdx) => (
                    <NavItem key={itemIdx} to={item.to} icon={item.icon}>{item.label}</NavItem>
                  ))}
                </div>
              );
            })
          )}
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
            <img src={logoUrl} alt="Logo" className="w-8 h-8 object-contain" />
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
