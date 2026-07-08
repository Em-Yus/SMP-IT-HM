import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, Megaphone } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

export default function LandingPage() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [pengumuman, setPengumuman] = useState([]);
  const [galeri, setGaleri] = useState([]);
  
  const [heroImg, setHeroImg] = useState('');
  const [profilImg, setProfilImg] = useState('https://images.unsplash.com/photo-1577896337627-8013880e9819?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80');
  const [tagline, setTagline] = useState('Mengaji - Berprestasi - Berakhlaq Terpuji');
  const [sejarah1, setSejarah1] = useState('Didirikan pada tahun 2019 oleh Ust. Ahmad Nurudin atas keprihatinan sahabatnya, Ust. Ahmad Syathori, terhadap anak-anak lulusan SD yang belum mampu membaca Al-Qur\'an.');
  const [sejarah2, setSejarah2] = useState('Sejak awal, sekolah ini berfokus pada pendidikan Islam berbasis pesantren, agar siswa tidak malu belajar agama dari nol.');

  const [loggedInRole, setLoggedInRole] = useState(null);

  const convertToDirectLink = (url) => {
    if (!url) return "";
    if (url.includes('drive.google.com')) {
      let match = url.match(/\/d\/(.+?)(\/|$)/);
      if (match) return "https://drive.google.com/uc?export=view&id=" + match[1];
      match = url.match(/id=(.+?)($|&)/);
      if (match) return "https://drive.google.com/uc?export=view&id=" + match[1];
    }
    return url;
  };

  useEffect(() => {
    // Check if user is logged in
    if (localStorage.getItem('user_guru')) {
      setLoggedInRole('guru');
    } else if (localStorage.getItem('user_siswa')) {
      setLoggedInRole('siswa');
    }

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const fetchCmsData = async () => {
      try {
        // Coba fetch dari Supabase untuk Pengumuman Publik
        const { data: pengumumanData } = await supabase
          .from('cms_pengumuman')
          .select('*')
          .eq('status', 'Aktif')
          .in('target', ['Publik', 'Semua'])
          .order('created_at', { ascending: false });

        if (pengumumanData) {
          setPengumuman(pengumumanData);
        }

        // Coba fetch dari Supabase untuk Galeri
        const { data: galeriData } = await supabase
          .from('cms_galeri')
          .select('*')
          .order('album_date', { ascending: false })
          .limit(5);

        if (galeriData && galeriData.length > 0) {
          setGaleri(galeriData);
        }

        // Coba fetch dari Supabase untuk Beranda
        const { data: berandaData, error: berandaError } = await supabase
          .from('cms_beranda')
          .select('*')
          .eq('id', 1)
          .single();

        if (!berandaError && berandaData) {
          if (berandaData.hero_img) setHeroImg(convertToDirectLink(berandaData.hero_img));
          if (berandaData.profil_img) setProfilImg(convertToDirectLink(berandaData.profil_img));
          if (berandaData.tagline) setTagline(berandaData.tagline);
          if (berandaData.sejarah_1) setSejarah1(berandaData.sejarah_1);
          if (berandaData.sejarah_2) setSejarah2(berandaData.sejarah_2);
        } else {
          // Fallback dari Google Apps Script jika cms_beranda belum ada isinya (opsional)
          const gasUrl = "https://script.google.com/macros/s/AKfycbw7eSoHxYApJJ8ht18mWXHHl_ZOcb7BteVgUp5xb-348wS0GX5rQWqackypGsPKDcKR-w/exec?type=landing";
          const res = await fetch(gasUrl);
          const result = await res.json();
          if (result.status === 'success') {
            const data = result.data;
            if (data.hero && !berandaData?.hero_img) setHeroImg(convertToDirectLink(data.hero));
            if (data.profil && !berandaData?.profil_img) setProfilImg(convertToDirectLink(data.profil));
            if ((!galeriData || galeriData.length === 0) && data.galeri) {
              const mappedGaleri = data.galeri.map((g, i) => ({ id: i, url: convertToDirectLink(g.url) }));
              setGaleri(mappedGaleri);
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch CMS Data', err);
      }
    };
    fetchCmsData();
  }, []);

  // Use Intersection Observer for Reveal Animation
  useEffect(() => {
    const reveals = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('active');
          }
        });
      },
      { threshold: 0.1 }
    );
    reveals.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="bg-gray-50 text-gray-800 font-sans">
      {/* NAVBAR */}
      <nav className={`fixed w-full z-50 transition-all duration-300 ${isScrolled ? 'glass-nav py-2' : 'transparent-nav py-4'}`}>
        <div className="container mx-auto px-6 flex justify-between items-center">
          <a href="#" className="flex items-center gap-3 group">
            <img src="https://www.e-ujian.com/smpithm/logo" alt="Logo SMP IT" className="w-12 h-12 object-contain filter drop-shadow-md" />
            <div className="flex flex-col">
              <span className={`brand-text text-lg font-bold transition-colors leading-tight tracking-wide ${isScrolled ? 'brand-text-main' : ''}`}>SMP IT</span>
              <span className={`brand-text text-sm font-semibold transition-colors leading-tight ${isScrolled ? 'brand-text-sub' : ''}`}>Hidayatul Mubtadi-ien</span>
            </div>
          </a>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-6">
            <div className="flex space-x-8 font-medium">
              <a href="#hero-section" className="nav-item transition duration-300">Beranda</a>
              <a href="#profil" className="nav-item transition duration-300">Profil</a>
              <a href="#akademik" className="nav-item transition duration-300">Akademik</a>
              <a href="#ppdb" className="nav-item transition duration-300">PPDB</a>
              <a href="#kontak" className="nav-item transition duration-300">Kontak</a>
            </div>
            {loggedInRole ? (
              <Link to={loggedInRole === 'guru' ? "/dashboard-guru" : "/dashboard-siswa"} className="bg-[#85c226] hover:bg-green-600 text-white px-5 py-2 rounded-full font-bold transition transform hover:scale-105 shadow-md text-sm flex items-center gap-2">
                <i className="fas fa-columns"></i> <span>Dashboard</span>
              </Link>
            ) : (
              <Link to="/login-siswa" className="bg-[#85c226] hover:bg-green-600 text-white px-5 py-2 rounded-full font-bold transition transform hover:scale-105 shadow-md text-sm flex items-center gap-2">
                <i className="fas fa-sign-in-alt"></i> <span>Login / Daftar</span>
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className={`md:hidden text-2xl focus:outline-none transition-colors drop-shadow-md ${isScrolled ? 'text-[#2a2c87]' : 'text-white'}`}>
            <Menu />
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-white border-t mt-4 shadow-lg absolute w-full text-gray-800">
            <a href="#hero-section" onClick={() => setIsMobileMenuOpen(false)} className="block py-3 px-6 hover:bg-blue-50 hover:text-[#85c226]">Beranda</a>
            <a href="#profil" onClick={() => setIsMobileMenuOpen(false)} className="block py-3 px-6 hover:bg-blue-50 hover:text-[#85c226]">Profil</a>
            <a href="#akademik" onClick={() => setIsMobileMenuOpen(false)} className="block py-3 px-6 hover:bg-blue-50 hover:text-[#85c226]">Akademik</a>
            <a href="#ppdb" onClick={() => setIsMobileMenuOpen(false)} className="block py-3 px-6 hover:bg-blue-50 hover:text-[#85c226]">PPDB</a>
            <a href="#kontak" onClick={() => setIsMobileMenuOpen(false)} className="block py-3 px-6 hover:bg-blue-50 hover:text-[#85c226]">Kontak</a>
            <div className="border-t border-gray-100 p-4">
              {loggedInRole ? (
                <Link to={loggedInRole === 'guru' ? "/dashboard-guru" : "/dashboard-siswa"} className="block text-center bg-[#85c226] text-white py-3 rounded-lg font-bold hover:bg-green-600 transition">
                  Buka Dashboard
                </Link>
              ) : (
                <Link to="/login-siswa" className="block text-center bg-[#2a2c87] text-white py-3 rounded-lg font-bold hover:bg-blue-900 transition">
                  Login / Daftar
                </Link>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* HERO SECTION */}
      <section 
        id="hero-section" 
        className="relative h-screen flex items-center justify-center parallax text-center px-4 overflow-hidden bg-[#2a2c87]"
        style={heroImg ? { backgroundImage: `linear-gradient(rgba(42, 44, 135, 0.5), rgba(133, 194, 38, 0.4)), url('${heroImg}')` } : {}}
      >
        <div className="hero-overlay"></div>
        <div className="absolute top-20 left-10 w-64 h-64 bg-white/5 rounded-full blur-3xl float-anim z-1" style={{ animationDelay: '0s' }}></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-[#85c226]/10 rounded-full blur-3xl float-anim z-1" style={{ animationDelay: '2s' }}></div>
        <div className="relative z-20 text-white max-w-4xl pt-20">
          <span className="bg-[#85c226] px-3 py-1 rounded-full text-sm font-bold tracking-wide mb-4 inline-block uppercase shadow-lg">
            NPSN: 70004822
          </span>
          <h1 className="text-4xl md:text-6xl font-bold mb-4 drop-shadow-lg">
            SMP IT <br /> Hidayatul Mubtadi-ien
          </h1>
          
          {pengumuman.length > 0 && (
             <div className="bg-yellow-400/90 text-[#2a2c87] rounded-2xl p-5 mb-8 text-left max-w-2xl mx-auto shadow-xl backdrop-blur-sm border-2 border-yellow-300 animate-pulse-slow">
                <h3 className="font-extrabold flex items-center gap-2 mb-2 text-lg"><Megaphone size={20} className="animate-bounce" /> Pengumuman Terbaru</h3>
                <ul className="space-y-3">
                  {pengumuman.map(p => (
                    <li key={p.id} className="border-l-2 border-[#2a2c87] pl-3">
                       <strong className="block text-sm uppercase tracking-wide opacity-80">{p.judul}</strong> 
                       <span className="text-base font-semibold">{p.isi}</span>
                    </li>
                  ))}
                </ul>
             </div>
          )}

          <p className="text-xl md:text-2xl font-light mb-8 italic drop-shadow-md reveal" style={{ transitionDelay: '0.2s' }}>
            "{tagline}"
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center reveals-up">
            <Link to="/pendaftaran-siswa" className="bg-[#85c226] hover:bg-green-600 text-white px-8 py-3 rounded-full font-bold transition transform hover:scale-105 shadow-lg border border-transparent">
              Daftar Sekarang
            </Link>
            <a href="#profil" className="bg-transparent border-2 border-white hover:bg-white hover:text-[#2a2c87] text-white px-8 py-3 rounded-full font-bold transition shadow-lg">
              Tentang Kami
            </a>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none z-10">
          <svg className="relative block w-full h-[100px] md:h-[150px]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 320" preserveAspectRatio="none">
            <path fill="#f9fafb" fillOpacity="1" d="M0,192L48,202.7C96,213,192,235,288,229.3C384,224,480,192,576,170.7C672,149,768,139,864,154.7C960,171,1056,213,1152,218.7C1248,224,1344,192,1392,176L1440,160V320H1392C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320H0Z"></path>
          </svg>
        </div>
      </section>

      {/* PROFIL SEKOLAH */}
      <section id="profil" className="py-20 bg-gray-50">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16 reveal">
            <h2 className="text-3xl font-bold text-[#2a2c87] mb-2">Profil Sekolah</h2>
            <div className="w-20 h-1 bg-[#85c226] mx-auto rounded"></div>
          </div>
          <div className="grid md:grid-cols-2 gap-12 items-center mb-16">
            <div className="reveal-left">
              <img src={profilImg} alt="Kegiatan Belajar" referrerPolicy="no-referrer" className="rounded-lg shadow-xl hover:shadow-2xl transition duration-300 w-full h-80 object-cover transform hover:rotate-1" />
            </div>
            <div className="reveal-right">
              <h3 className="text-2xl font-bold text-[#2a2c87] mb-4">Sejarah Singkat</h3>
              <p className="text-gray-700 leading-relaxed mb-6">
                {sejarah1}
              </p>
              <p className="text-gray-700 leading-relaxed">
                {sejarah2}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* AKADEMIK & PROGRAM */}
      <section id="akademik" className="py-20 bg-white">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16 reveal">
            <h2 className="text-3xl font-bold text-[#2a2c87] mb-2">Akademik & Program Unggulan</h2>
            <div className="w-20 h-1 bg-[#85c226] mx-auto rounded mb-4"></div>
            <p className="text-gray-600 max-w-2xl mx-auto">Kurikulum Merdeka dengan penguatan nilai-nilai pesantren, Al-Qur'an, dan Kitab Salaf.</p>
          </div>
          <div className="grid md:grid-cols-4 gap-6">
            <div className="bg-gray-50 p-6 rounded-lg text-center hover:bg-[#2a2c87] hover:text-white group transition duration-300 reveal">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-white">
                <i className="fas fa-quran text-2xl text-[#2a2c87]"></i>
              </div>
              <h3 className="font-bold text-lg mb-2">Tartil Al-Qur'an</h3>
              <p className="text-sm opacity-80">Target kelulusan khatam Al-Qur'an dengan bacaan yang fasih.</p>
            </div>
            <div className="bg-gray-50 p-6 rounded-lg text-center hover:bg-[#2a2c87] hover:text-white group transition duration-300 reveal">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-white">
                <i className="fas fa-laptop-code text-2xl text-[#2a2c87]"></i>
              </div>
              <h3 className="font-bold text-lg mb-2">Informatika & AI</h3>
              <p className="text-sm opacity-80">Multimedia, Canva, Pemrograman Dasar, dan Pengenalan AI.</p>
            </div>
            <div className="bg-gray-50 p-6 rounded-lg text-center hover:bg-[#2a2c87] hover:text-white group transition duration-300 reveal">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-white">
                <i className="fas fa-book-open text-2xl text-[#2a2c87]"></i>
              </div>
              <h3 className="font-bold text-lg mb-2">Kitab Kuning</h3>
              <p className="text-sm opacity-80">Mempelajari Nahwu Shorof (Jurumiyah), Taisirul Kholaq, & Mabadiul Fiqih.</p>
            </div>
            <div className="bg-gray-50 p-6 rounded-lg text-center hover:bg-[#2a2c87] hover:text-white group transition duration-300 reveal">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-white">
                <i className="fas fa-film text-2xl text-[#2a2c87]"></i>
              </div>
              <h3 className="font-bold text-lg mb-2">Filmaking</h3>
              <p className="text-sm opacity-80">Proyek khusus kelas 9 untuk mengembangkan kreativitas digital.</p>
            </div>
          </div>
          
          <div className="mt-16 bg-[#2a2c87] rounded-2xl p-8 md:p-12 text-white relative overflow-hidden reveal">
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-[#85c226] opacity-20"></div>
            <div className="relative z-10 grid md:grid-cols-2 gap-8 items-center">
              <div>
                <h3 className="text-2xl font-bold mb-4">Kegiatan Ekstrakurikuler</h3>
                <p className="mb-6 opacity-90">Kami menyeimbangkan akademik dengan kegiatan positif untuk membangun karakter siswa.</p>
                <ul className="space-y-3">
                  <li className="flex items-center"><i className="fas fa-star text-[#85c226] mr-3"></i> OSIS (Aktif sejak 2023)</li>
                  <li className="flex items-center"><i className="fas fa-campground text-[#85c226] mr-3"></i> Pramuka (Gema Pramuka Juara Umum)</li>
                  <li className="flex items-center"><i className="fas fa-drum text-[#85c226] mr-3"></i> Hadroh (Seni Musik Islam)</li>
                  <li className="flex items-center"><i className="fas fa-running text-[#85c226] mr-3"></i> Senam Bersama & Olahraga</li>
                </ul>
              </div>
              <div className="text-center md:text-right">
                <div className="inline-block bg-white/10 backdrop-blur p-6 rounded-xl border border-white/20">
                  <h4 className="text-4xl font-bold text-[#85c226] mb-2">6+ Piala</h4>
                  <p>Diraih pada Gema Pramuka 2023 & 2024</p>
                  <p className="text-sm mt-2 opacity-75">(Juara 1, 2, dan 3)</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATISTIK SISWA */}
      <section className="py-16 bg-[#85c226]/10 relative parallax" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1577896337627-8013880e9819?ixlib=rb-1.2.1&auto=format&fit=crop&w=1950&q=80')" }}>
        <div className="absolute inset-0 bg-[#2a2c87]/80"></div>
        <div className="container mx-auto px-6 relative z-10 text-center text-white">
          <h2 className="text-3xl font-bold mb-12">Pertumbuhan Siswa Pesat</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="reveal-scale">
              <div className="text-5xl font-bold text-[#85c226] mb-2">12</div>
              <div className="text-sm uppercase tracking-wide">Siswa Awal (2019)</div>
            </div>
            <div className="reveal-scale" style={{ transitionDelay: '0.1s' }}>
              <div className="text-5xl font-bold text-[#85c226] mb-2">114</div>
              <div className="text-sm uppercase tracking-wide">Total Siswa Saat Ini</div>
            </div>
            <div className="reveal-scale" style={{ transitionDelay: '0.2s' }}>
              <div className="text-5xl font-bold text-[#85c226] mb-2">39</div>
              <div className="text-sm uppercase tracking-wide">Siswa Baru 2024</div>
            </div>
            <div className="reveal-scale" style={{ transitionDelay: '0.3s' }}>
              <div className="text-5xl font-bold text-[#85c226] mb-2">7</div>
              <div className="text-sm uppercase tracking-wide">Guru Mengaji</div>
            </div>
          </div>
        </div>
      </section>

      {/* PPDB */}
      <section id="ppdb" className="py-20 bg-white">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 items-start">
            <div className="reveal">
              <h2 className="text-3xl font-bold text-[#2a2c87] mb-6">Penerimaan Peserta Didik Baru</h2>
              <p className="text-gray-600 mb-6">Bergabunglah bersama kami untuk mencetak generasi Qur'ani yang berprestasi dan berteknologi.</p>
              <div className="bg-blue-50 p-6 rounded-lg border-l-4 border-[#85c226] mb-6">
                <h4 className="font-bold text-[#2a2c87] mb-2">Jadwal Pendaftaran (2026/2027)</h4>
                <p className="text-gray-700">Januari - Juni 2027</p>
              </div>
              <h4 className="font-bold text-lg mb-4 text-[#2a2c87]">Syarat Pendaftaran:</h4>
              <ul className="space-y-2 text-gray-600 mb-8">
                <li className="flex items-center"><i className="fas fa-check text-green-500 mr-2"></i> Ijazah SD/MI</li>
                <li className="flex items-center"><i className="fas fa-check text-green-500 mr-2"></i> Fotokopi KK & Akta Lahir</li>
                <li className="flex items-center"><i className="fas fa-check text-green-500 mr-2"></i> Pas Foto</li>
              </ul>
              <a href="https://wa.me/6282130769848" target="_blank" rel="noreferrer" className="inline-block bg-[#2a2c87] text-white px-8 py-3 rounded-lg font-bold hover:bg-blue-900 transition shadow-lg">
                <i className="fab fa-whatsapp mr-2"></i> Hubungi Panitia
              </a>
            </div>
            
            <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100 reveal relative">
              <div className="absolute top-0 right-0 bg-[#85c226] text-white px-4 py-1 rounded-bl-lg rounded-tr-lg font-bold text-sm">
                SPP GRATIS
              </div>
              <h3 className="text-2xl font-bold text-[#2a2c87] mb-4 text-center">Biaya PPM</h3>
              <p className="text-center text-gray-500 text-sm mb-6">Pembayaran Pengembangan Mutu (Dapat Dicicil)</p>
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="font-semibold text-gray-700">Kelas 7</span>
                  <span className="font-bold text-[#2a2c87] text-xl">Rp 1.000.000</span>
                </div>
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="font-semibold text-gray-700">Kelas 8</span>
                  <span className="font-bold text-[#2a2c87] text-xl">Rp 500.000</span>
                </div>
                <div className="flex justify-between items-center pb-2">
                  <span className="font-semibold text-gray-700">Kelas 9</span>
                  <span className="font-bold text-[#2a2c87] text-xl">Rp 1.000.000</span>
                </div>
              </div>
              <div className="mt-8 bg-blue-50 p-4 rounded text-center text-sm text-gray-600">
                <p>Pembayaran via Transfer Bank / QRIS</p>
                <p className="mt-1">Tersedia layanan Login Siswa/Wali untuk cek pembayaran & raport digital.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* GALERI */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[#2a2c87]">Galeri Kegiatan</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 auto-rows-[200px] mb-8">
            {galeri.length > 0 ? (
              galeri.map((item, index) => (
                <div key={item.id} className={`${index === 0 ? 'col-span-2 row-span-2' : ''} rounded-xl overflow-hidden shadow-lg group`}>
                  <img src={item.url} alt={`Galeri ${index}`} referrerPolicy="no-referrer" className="w-full h-full object-cover group-hover:scale-110 transition duration-500" />
                </div>
              ))
            ) : (
              [1, 2, 3, 4, 5].map((_, idx) => (
                <div key={idx} className={`${idx === 0 ? 'col-span-2 row-span-2' : ''} rounded-xl overflow-hidden shadow-lg group bg-gray-200 skeleton`}></div>
              ))
            )}
          </div>
          <div className="text-center mt-8">
            <Link to="/galeri" className="inline-block border-2 border-[#2a2c87] text-[#2a2c87] hover:bg-[#2a2c87] hover:text-white font-bold py-2 px-8 rounded-full transition duration-300">
              Lihat Semua Galeri
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer id="kontak" className="bg-[#2a2c87] text-white pt-16 pb-8">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-12 mb-12">
            <div>
              <h3 className="text-xl font-bold mb-4 text-[#85c226]">Lokasi Kampus</h3>
              <p className="leading-relaxed opacity-80 mb-4">
                Gang Yayasan, Dusun Sukaseneng RT 026 RW 010 <br />
                Desa Compreng, Kec. Compreng <br />
                Kabupaten Subang - 41258
              </p>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-4 text-[#85c226]">Hubungi Kami</h3>
              <ul className="space-y-3 opacity-80">
                <li className="flex items-center"><i className="fab fa-whatsapp w-6 text-[#85c226]"></i> +62 821-3076-9848</li>
                <li className="flex items-center"><i className="fas fa-envelope w-6 text-[#85c226]"></i> smpithm2019@gmail.com</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/20 pt-8 text-center text-sm opacity-60 flex flex-col md:flex-row justify-between items-center">
            <p>&copy; 2026 SMP IT Hidayatul Mubtadi-ien. All rights reserved.</p>
            <p className="mt-2 md:mt-0">Sistem Informasi Sekolah Terpadu (SIST)</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
