import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import LandingPage from './pages/LandingPage';
import LoginGuru from './pages/LoginGuru';
import DashboardGuru from './pages/DashboardGuru';
import VerifikasiPPDB from './pages/VerifikasiPPDB';
import DataSiswa from './pages/DataSiswa';
import DataSiswaNonaktif from './pages/DataSiswaNonaktif';
import DataPegawai from './pages/DataPegawai';
import DataPegawaiNonaktif from './pages/DataPegawaiNonaktif';
import DataKelas from './pages/DataKelas';
import DataJabatan from './pages/DataJabatan';
import DataLembaga from './pages/DataLembaga';
import DataRuang from './pages/DataRuang';
import MataPelajaran from './pages/MataPelajaran';
import DataSurat from './pages/DataSurat';
import JadwalGuru from './pages/JadwalGuru';
import PresensiGuru from './pages/PresensiGuru';
import PresensiSiswa from './pages/PresensiSiswa';
import InputNilai from './pages/InputNilai';
import RaporGuru from './pages/RaporGuru';
import CatatanWali from './pages/CatatanWali';
import TagihanSiswa from './pages/TagihanSiswa';
import RekapBayar from './pages/RekapBayar';
import SuratKepsek from './pages/SuratKepsek';
import SuratKesiswaan from './pages/SuratKesiswaan';
import CmsBeranda from './pages/CmsBeranda';
import CmsGaleri from './pages/CmsGaleri';
import CmsPengumuman from './pages/CmsPengumuman';
import Prestasi from './pages/Prestasi';
import Ekstrakurikuler from './pages/Ekstrakurikuler';
import Kokurikuler from './pages/Kokurikuler';
import GaleriPage from './pages/GaleriPage';
import PendaftaranSiswa from './pages/PendaftaranSiswa';
import PendaftaranGuru from './pages/PendaftaranGuru';
import AdminPendaftaranSPMB from './pages/AdminPendaftaranSPMB';
import KartuSiswa from './pages/KartuSiswa';
import TujuanPembelajaran from './pages/TujuanPembelajaran';
import KelasMengaji from './pages/KelasMengaji';
import InputBiayaPengembanganMutu from './pages/InputBiayaPengembanganMutu';
import InputPemasukanLainnya from './pages/InputPemasukanLainnya';
import ProfilGuru from './pages/ProfilGuru';

// Portal Siswa
import SiswaLayout from './layouts/SiswaLayout';
import LoginSiswa from './pages/LoginSiswa';
import DashboardSiswa from './pages/DashboardSiswa';
import ProfilSiswa from './pages/ProfilSiswa';
import JadwalPelajaranSiswa from './pages/JadwalPelajaranSiswa';
import PresensiSaya from './pages/PresensiSaya';
import MengajiSiswa from './pages/MengajiSiswa';
import NilaiSiswa from './pages/NilaiSiswa';
import RaporSiswa from './pages/RaporSiswa';
import KeuanganSiswa from './pages/KeuanganSiswa';
import PrestasiEkskulSiswa from './pages/PrestasiEkskulSiswa';

// Global
import UnderConstruction from './pages/UnderConstruction';
import DataPeriodik from './pages/DataPeriodik';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Rute Utama & Login */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/galeri" element={<GaleriPage />} />
        <Route path="/pendaftaran-siswa" element={<PendaftaranSiswa />} />
        <Route path="/pendaftaran-guru" element={<PendaftaranGuru />} />
        <Route path="/login-guru" element={<LoginGuru />} />
        <Route path="/login-siswa" element={<LoginSiswa />} />

        {/* Rute Utama dengan MainLayout (Untuk Pegawai/Guru/Admin) */}
        <Route element={<MainLayout />}>
          <Route path="/" element={<DashboardGuru />} />
          <Route path="/profil-guru" element={<ProfilGuru />} />
          <Route path="/dashboard-guru" element={<DashboardGuru />} />
          <Route path="/verifikasi-ppdb" element={<VerifikasiPPDB />} />
          <Route path="/admin/pendaftaran-spmb" element={<AdminPendaftaranSPMB />} />
          <Route path="/data-siswa" element={<DataSiswa />} />
          <Route path="/siswa-nonaktif" element={<DataSiswaNonaktif />} />
          <Route path="/data-pegawai" element={<DataPegawai />} />
          <Route path="/pegawai-nonaktif" element={<DataPegawaiNonaktif />} />
          <Route path="/data-jabatan" element={<DataJabatan />} />
          <Route path="/data-lembaga" element={<DataLembaga />} />
          <Route path="/data-ruang" element={<DataRuang />} />
          <Route path="/data-kelas" element={<DataKelas />} />
          <Route path="/mata-pelajaran" element={<MataPelajaran />} />
          <Route path="/data-surat" element={<DataSurat />} />
          <Route path="/jadwal-guru" element={<JadwalGuru />} />
          <Route path="/presensi-guru" element={<PresensiGuru />} />
          <Route path="/input-nilai" element={<InputNilai />} />
          <Route path="/catatan-wali" element={<CatatanWali />} />
          <Route path="/rapor-guru" element={<RaporGuru />} />
          <Route path="/tagihan-siswa" element={<TagihanSiswa />} />
          <Route path="/rekap-bayar" element={<RekapBayar />} />
          <Route path="/pemasukan-lainnya" element={<InputPemasukanLainnya />} />
          <Route path="/surat-kepsek" element={<UnderConstruction />} />
          <Route path="/surat-kesiswaan" element={<SuratKesiswaan />} />
          <Route path="/input-biaya-pengembangan-mutu" element={<InputBiayaPengembanganMutu />} />
          
          {/* CMS & Publikasi */}
          <Route path="/cms-beranda" element={<CmsBeranda />} />
          <Route path="/cms-galeri" element={<CmsGaleri />} />
          <Route path="/cms-pengumuman" element={<CmsPengumuman />} />
          
          {/* Menu Tambahan (Pengembangan) */}
          <Route path="/data-periodik-siswa" element={<DataPeriodik />} />
          <Route path="/tujuan-pembelajaran" element={<TujuanPembelajaran />} />
          <Route path="/ekstrakurikuler" element={<Ekstrakurikuler />} />
          <Route path="/kokurikuler" element={<Kokurikuler />} />
          <Route path="/kelas-mengaji" element={<KelasMengaji />} />
          <Route path="/presensi-mengaji" element={<UnderConstruction />} />
          <Route path="/presensi-siswa" element={<PresensiSiswa />} />
          <Route path="/prestasi" element={<Prestasi />} />
          <Route path="/kartu-siswa" element={<KartuSiswa />} />
        </Route>

        {/* Rute Utama dengan SiswaLayout (Untuk Siswa) */}
        <Route element={<SiswaLayout />}>
          <Route path="/dashboard-siswa" element={<DashboardSiswa />} />
          <Route path="/profil-siswa" element={<ProfilSiswa />} />
          <Route path="/jadwal-pelajaran-siswa" element={<JadwalPelajaranSiswa />} />
          <Route path="/presensi-saya" element={<PresensiSaya />} />
          <Route path="/mengaji-siswa" element={<MengajiSiswa />} />
          <Route path="/nilai-siswa" element={<NilaiSiswa />} />
          <Route path="/rapor-siswa" element={<RaporSiswa />} />
          <Route path="/tagihan-saya" element={<KeuanganSiswa />} />
          <Route path="/prestasi-ekskul-siswa" element={<PrestasiEkskulSiswa />} />
          {/* Tambahkan rute siswa lainnya jika ada (misal dsb) */}
          <Route path="*" element={<UnderConstruction />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
