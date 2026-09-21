import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import KopSurat from '../KopSurat';
import { Printer, ArrowLeft, ShieldAlert, CheckCircle2 } from 'lucide-react';
import Swal from 'sweetalert2';

export default function CbtDaftarHadirPrint({ type = 'peserta' }) {
  const { jadwalId } = useParams();
  const navigate = useNavigate();

  const [jadwal, setJadwal] = useState(null);
  const [allJadwalList, setAllJadwalList] = useState([]);
  const [siswaList, setSiswaList] = useState([]);
  const [dataLembaga, setDataLembaga] = useState(null);
  const [panitiaData, setPanitiaData] = useState(null);
  const [sopData, setSopData] = useState(null);
  const [kepsekData, setKepsekData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPrintData();
  }, [jadwalId, type]);

  const fetchPrintData = async () => {
    try {
      setLoading(true);
      const [jRes, lembagaRes, panitiaRes, allJadwalRes] = await Promise.all([
        supabase
          .from('cbt_jadwal_ujian')
          .select(`
            *,
            data_kelas(nama_kelas),
            data_mapel(nama_mapel),
            data_ruang(nama_ruang),
            pengawas:data_guru!cbt_jadwal_ujian_pengawas_guru_id_fkey(id, nama, nip),
            guru_pengampu:data_guru!cbt_jadwal_ujian_guru_id_fkey(id, nama, nip)
          `)
          .eq('id', jadwalId)
          .single(),
        supabase.from('data_lembaga').select('*').limit(1).maybeSingle(),
        supabase
          .from('jabatan_guru')
          .select('guru_id, jabatan_utama, jabatan_lain_1, jabatan_lain_2, jabatan_lain_3, guru:guru_id(id, nama, nip)'),
        supabase
          .from('cbt_jadwal_ujian')
          .select(`
            *,
            data_kelas(nama_kelas),
            data_mapel(nama_mapel),
            data_ruang(nama_ruang),
            pengawas:data_guru!cbt_jadwal_ujian_pengawas_guru_id_fkey(id, nama, nip)
          `)
          .order('tanggal_ujian', { ascending: true })
          .order('jam_mulai', { ascending: true })
      ]);

      setJadwal(jRes.data);
      setDataLembaga(lembagaRes.data);
      setAllJadwalList(allJadwalRes.data || []);

      const listGuruJabatan = panitiaRes.data || [];
      const foundKetua = listGuruJabatan.find(jg => {
        const jRoles = [jg.jabatan_utama, jg.jabatan_lain_1, jg.jabatan_lain_2, jg.jabatan_lain_3];
        return jRoles.some(r => (r || '').toLowerCase().includes('ketua panitia'));
      });
      if (foundKetua) {
        setPanitiaData({ ketua: foundKetua.guru });
      }

      // Ambil SOP & TTD Ketua Panitia
      const { data: sop } = await supabase
        .from('cbt_sop_persetujuan')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setSopData(sop);

      // Ambil Data Kepala Sekolah
      const { data: kepsekJabatan } = await supabase
        .from('jabatan_guru')
        .select('*, guru:guru_id(id, nama, nip)')
        .ilike('jabatan_utama', '%kepala sekolah%')
        .limit(1)
        .maybeSingle();
      if (kepsekJabatan?.guru) {
        setKepsekData(kepsekJabatan.guru);
      }

      // Ambil Siswa Peserta Ujian: Prioritas dari cbt_peserta_ruang, fallback ke data_siswa
      const { data: pRuangData } = await supabase
        .from('cbt_peserta_ruang')
        .select(`
          id,
          siswa_id,
          ruang_id,
          nomor_meja,
          data_ruang(id, nama_ruang),
          data_siswa:siswa_id(id, nama, nisn, nipd, kelas, status_keaktifan)
        `)
        .eq('jadwal_id', jadwalId)
        .order('nomor_meja', { ascending: true, nullsFirst: false });

      if (pRuangData && pRuangData.length > 0) {
        const mapped = pRuangData
          .filter((p) => p.data_siswa && (!p.data_siswa.status_keaktifan || p.data_siswa.status_keaktifan === 'Aktif'))
          .map((p) => ({
            ...p.data_siswa,
            ruang_nama: p.data_ruang?.nama_ruang || jRes.data?.data_ruang?.nama_ruang || 'Lab CBT',
            nomor_meja: p.nomor_meja,
          }));
        setSiswaList(mapped);
      } else {
        // Fallback berdasarkan kelas jadwal
        let query = supabase
          .from('data_siswa')
          .select('id, nama, nisn, nipd, kelas, status_keaktifan')
          .eq('status_keaktifan', 'Aktif')
          .neq('kelas', 'Calon Siswa')
          .order('nama');
        if (jRes.data?.data_kelas?.nama_kelas) {
          query = query.eq('kelas', jRes.data.data_kelas.nama_kelas);
        }
        const { data: sData } = await query;
        setSiswaList(
          (sData || []).map((s) => ({
            ...s,
            ruang_nama: jRes.data?.data_ruang?.nama_ruang || 'Lab CBT',
            nomor_meja: null,
          }))
        );
      }
    } catch (err) {
      console.error('Error fetching print data:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDateIndonesia = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  const formattedDate = jadwal?.tanggal_ujian ? formatDateIndonesia(jadwal.tanggal_ujian) : '-';
  const jenisUjianStr = (jadwal?.jenis_ujian || sopData?.jenis_ujian || 'CBT').toUpperCase();
  const titimangsaTempat = sopData?.titimangsa_tempat || (dataLembaga?.kecamatan ? `Kec. ${dataLembaga.kecamatan}` : 'Compreng');
  const titimangsaTanggal = sopData?.titimangsa_tanggal || jadwal?.tanggal_ujian || new Date();

  // Validasi Hari Terakhir untuk Daftar Hadir Pengawas
  const isLastExamSession = () => {
    if (!allJadwalList || allJadwalList.length === 0) return true;
    const lastSession = allJadwalList[allJadwalList.length - 1];
    return String(lastSession.id) === String(jadwalId);
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500 font-medium">Menyiapkan format dokumen cetak resmi...</div>;
  }

  return (
    <div className="bg-gray-100 min-h-screen py-6 print:py-0 print:bg-white text-gray-900 font-serif">
      {/* Floating Action Bar (Hidden during print) */}
      <div className="max-w-4xl mx-auto mb-4 px-4 flex justify-between items-center print:hidden font-sans">
        <button
          onClick={() => navigate('/cbt/jadwal')}
          className="flex items-center gap-1.5 px-4 py-2 bg-white text-gray-700 font-bold text-xs rounded-xl shadow border hover:bg-gray-50 transition"
        >
          <ArrowLeft size={16} /> Kembali ke Jadwal
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-5 py-2 bg-primary hover:bg-blue-900 text-white font-bold text-xs rounded-xl shadow-md transition"
        >
          <Printer size={16} /> Cetak / Unduh Dokumen (PDF)
        </button>
      </div>

      {/* Dokumen Standar A4 Cetak */}
      <div className="max-w-4xl mx-auto bg-white p-10 sm:p-14 shadow-lg rounded-2xl print:shadow-none print:rounded-none print:p-0 print:max-w-none leading-relaxed">
        {/* Kop Surat Sekolah Resmi */}
        <KopSurat dataLembaga={dataLembaga} />

        {/* ========================================================
            DOKUMEN 1: DAFTAR HADIR PESERTA UJIAN
        ======================================================== */}
        {type === 'peserta' ? (
          <div>
            {/* Judul Dokumen */}
            <div className="text-center my-6 space-y-1">
              <h2 className="text-base font-black text-gray-900 uppercase tracking-wide underline">
                DAFTAR HADIR PESERTA {jenisUjianStr}
              </h2>
              <p className="text-xs font-bold text-gray-700 uppercase">
                TAHUN AJARAN {panitiaData?.tahun_ajaran || '2025/2026'}
              </p>
            </div>

            {/* Metadata Ujian */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-xs text-gray-800 font-sans font-medium mb-6 bg-gray-50/70 p-4 rounded-xl border border-gray-200 print:bg-transparent print:p-0 print:border-none">
              <div className="flex">
                <span className="w-32 font-bold">Mata Pelajaran</span>
                <span>: {jadwal?.data_mapel?.nama_mapel || '-'}</span>
              </div>
              <div className="flex">
                <span className="w-32 font-bold">Hari / Tanggal</span>
                <span>: {jadwal?.hari}, {formattedDate}</span>
              </div>
              <div className="flex">
                <span className="w-32 font-bold">Kelas</span>
                <span>: {jadwal?.data_kelas?.nama_kelas || '-'}</span>
              </div>
              <div className="flex">
                <span className="w-32 font-bold">Waktu Ujian</span>
                <span>: {jadwal?.jam_mulai?.slice(0, 5)} - {jadwal?.jam_selesai?.slice(0, 5)} WIB</span>
              </div>
              <div className="flex">
                <span className="w-32 font-bold">Ruang Ujian</span>
                <span>: {jadwal?.data_ruang?.nama_ruang || 'Lab CBT'}</span>
              </div>
              <div className="flex">
                <span className="w-32 font-bold">Pengawas Ruang</span>
                <span>: {jadwal?.pengawas?.nama || jadwal?.pengawas?.nama_guru || '-'}</span>
              </div>
            </div>

            {/* Tabel Kehadiran Peserta: No, NIPD, NISN, Nama Siswa, Ruang, TTD */}
            <table className="w-full border-collapse border border-black text-xs text-gray-900 font-sans">
              <thead>
                <tr className="bg-gray-100 print:bg-gray-100 text-center font-bold">
                  <th className="border border-black py-2 px-2 w-10">No</th>
                  <th className="border border-black py-2 px-3 w-24">NIPD</th>
                  <th className="border border-black py-2 px-3 w-28">NISN</th>
                  <th className="border border-black py-2 px-4 text-left">Nama Siswa</th>
                  <th className="border border-black py-2 px-3 w-24">Ruang</th>
                  <th className="border border-black py-2 px-3 w-40" colSpan={2}>
                    Tanda Tangan
                  </th>
                </tr>
              </thead>
              <tbody>
                {siswaList.map((siswa, idx) => (
                  <tr key={siswa.id} className="h-9">
                    <td className="border border-black text-center font-bold">{idx + 1}</td>
                    <td className="border border-black text-center font-mono">{siswa.nipd || '-'}</td>
                    <td className="border border-black text-center font-mono">{siswa.nisn || '-'}</td>
                    <td className="border border-black px-3 font-semibold">{siswa.nama || siswa.nama_lengkap}</td>
                    <td className="border border-black text-center">{siswa.ruang_nama || jadwal?.data_ruang?.nama_ruang || 'Lab CBT'}</td>
                    <td className="border border-black px-2 w-20 text-left align-top text-[10px] text-gray-500">
                      {idx % 2 === 0 ? `${idx + 1}. .........` : ''}
                    </td>
                    <td className="border border-black px-2 w-20 text-left align-top text-[10px] text-gray-500">
                      {idx % 2 !== 0 ? `${idx + 1}. .........` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pengesahan: Bawah Kiri TTD Pengawas; Bawah Kanan Titimangsa + TTD Ketua Panitia */}
            <div className="mt-10 flex justify-between items-start text-xs text-gray-900 font-sans break-inside-avoid">
              {/* Bawah Kiri: Pengawas Ruang */}
              <div className="text-center min-w-[200px]">
                <p className="font-bold">Pengawas Ruang Ujian,</p>
                <div className="h-20 flex items-center justify-center">
                  <div className="border border-dashed border-gray-200 rounded p-2 text-[10px] text-gray-400">
                    (Tanda Tangan Basah Pengawas)
                  </div>
                </div>
                <p className="font-bold underline uppercase">
                  {jadwal?.pengawas?.nama || jadwal?.pengawas?.nama_guru || '( ........................................... )'}
                </p>
                <p className="text-[11px] text-gray-600">
                  {jadwal?.pengawas?.nip ? `NIP. ${jadwal.pengawas.nip}` : 'NIP. -'}
                </p>
              </div>

              {/* Bawah Kanan: Titimangsa + Ketua Panitia */}
              <div className="text-center min-w-[220px]">
                <p>
                  {titimangsaTempat}, {formatDateIndonesia(titimangsaTanggal)}
                </p>
                <p className="font-bold mt-1">
                  Ketua Panitia {jenisUjianStr},
                </p>
                <div className="h-20 flex items-center justify-center my-1">
                  {sopData?.tanda_tangan_ketua ? (
                    <img 
                      src={sopData.tanda_tangan_ketua} 
                      alt="TTD Ketua Panitia" 
                      className="max-h-16 max-w-[170px] object-contain"
                    />
                  ) : (
                    <div className="h-16" />
                  )}
                </div>
                <p className="font-bold underline uppercase">
                  {panitiaData?.ketua?.nama || '( ........................................... )'}
                </p>
                <p className="text-[11px] text-gray-600">
                  {panitiaData?.ketua?.nip ? `NIP. ${panitiaData.ketua.nip}` : 'NIP. -'}
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* ========================================================
              DOKUMEN 2: DAFTAR HADIR PENGAWAS UJIAN
              (Muncul HANYA saat ujian mapel terakhir pada hari terakhir selesai)
          ======================================================== */
          <div>
            {/* Banner Peringatan jika bukan sesi terakhir */}
            {!isLastExamSession() && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2 print:hidden font-sans">
                <AlertTriangle size={16} />
                <span>
                  <strong>Informasi Dokumen:</strong> Sesuai SOP, Daftar Hadir Pengawas disahkan secara resmi pada akhir seluruh rangkaian ujian (sesi terakhir hari terakhir).
                </span>
              </div>
            )}

            {/* Judul Dokumen */}
            <div className="text-center my-6 space-y-1">
              <h2 className="text-base font-black text-gray-900 uppercase tracking-wide underline">
                DAFTAR HADIR PENGAWAS {jenisUjianStr}
              </h2>
              <p className="text-xs font-bold text-gray-700 uppercase">
                TAHUN AJARAN {panitiaData?.tahun_ajaran || '2025/2026'}
              </p>
            </div>

            {/* Tabel: No, Hari/Tanggal, Nama Pengawas, Ruang, Mapel, TTD */}
            <table className="w-full border-collapse border border-black text-xs text-gray-900 font-sans">
              <thead>
                <tr className="bg-gray-100 print:bg-gray-100 text-center font-bold">
                  <th className="border border-black py-2.5 px-2 w-10">No</th>
                  <th className="border border-black py-2.5 px-4 w-36 text-left">Hari / Tanggal</th>
                  <th className="border border-black py-2.5 px-4 text-left">Nama Pengawas</th>
                  <th className="border border-black py-2.5 px-3 w-28">Ruang</th>
                  <th className="border border-black py-2.5 px-4 text-left">Mata Pelajaran</th>
                  <th className="border border-black py-2.5 px-3 w-36">Tanda Tangan</th>
                </tr>
              </thead>
              <tbody>
                {allJadwalList.map((item, idx) => (
                  <tr key={item.id} className="h-10">
                    <td className="border border-black text-center font-bold">{idx + 1}</td>
                    <td className="border border-black px-3 font-medium">
                      {item.hari}, {formatDateIndonesia(item.tanggal_ujian)}
                    </td>
                    <td className="border border-black px-3 font-bold text-gray-900">
                      {item.pengawas?.nama || item.pengawas?.nama_guru || 'Guru Pengawas Ruang'}
                    </td>
                    <td className="border border-black text-center">
                      {item.data_ruang?.nama_ruang || 'Lab CBT'}
                    </td>
                    <td className="border border-black px-3 font-medium">
                      {item.data_mapel?.nama_mapel || '-'}
                    </td>
                    <td className="border border-black px-3 text-left align-middle text-[11px] text-gray-500">
                      {idx + 1}. ....................
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pengesahan: Bawah Kiri TTD Ketua Panitia; Bawah Kanan Titimangsa + TTD Kepala Sekolah */}
            <div className="mt-12 flex justify-between items-start text-xs text-gray-900 font-sans break-inside-avoid">
              {/* Bawah Kiri: Ketua Panitia */}
              <div className="text-center min-w-[220px]">
                <p className="font-bold">Ketua Panitia {jenisUjianStr},</p>
                <div className="h-20 flex items-center justify-center my-1">
                  {sopData?.tanda_tangan_ketua ? (
                    <img 
                      src={sopData.tanda_tangan_ketua} 
                      alt="TTD Ketua Panitia" 
                      className="max-h-16 max-w-[170px] object-contain"
                    />
                  ) : (
                    <div className="h-16" />
                  )}
                </div>
                <p className="font-bold underline uppercase">
                  {panitiaData?.ketua?.nama || '( ........................................... )'}
                </p>
                <p className="text-[11px] text-gray-600">
                  {panitiaData?.ketua?.nip ? `NIP. ${panitiaData.ketua.nip}` : 'NIP. -'}
                </p>
              </div>

              {/* Bawah Kanan: Titimangsa + Kepala Sekolah */}
              <div className="text-center min-w-[220px]">
                <p>
                  {titimangsaTempat}, {formatDateIndonesia(titimangsaTanggal)}
                </p>
                <p className="font-bold mt-1">
                  Kepala Sekolah SMP IT HM,
                </p>
                <div className="h-20 flex items-center justify-center my-1">
                  <div className="border border-dashed border-gray-200 rounded p-2 text-[10px] text-gray-400">
                    (Tanda Tangan & Cap Sekolah)
                  </div>
                </div>
                <p className="font-bold underline uppercase">
                  {kepsekData?.nama || kepsekData?.nama_guru || dataLembaga?.nama_kepala_madrasah || '( ........................................... )'}
                </p>
                <p className="text-[11px] text-gray-600">
                  {kepsekData?.nip ? `NIP. ${kepsekData.nip}` : 'NIP. -'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
