import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import KopSurat from '../KopSurat';
import Swal from 'sweetalert2';
import { Printer, ArrowLeft, Save, CheckCircle2 } from 'lucide-react';

export default function CbtBeritaAcaraPrint() {
  const { jadwalId } = useParams();
  const navigate = useNavigate();

  const [jadwal, setJadwal] = useState(null);
  const [dataLembaga, setDataLembaga] = useState(null);
  const [panitiaData, setPanitiaData] = useState(null);
  const [sopData, setSopData] = useState(null);
  const [beritaAcara, setBeritaAcara] = useState(null);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    jumlah_terdaftar: 0,
    jumlah_hadir: 0,
    jumlah_tidak_hadir: 0,
    catatan_pelaksanaan: 'Ujian CBT berlangsung tertib, lancar, dan terkendali dengan pengawasan proctoring Edge AI.',
    tanda_tangan_pengawas: '',
  });

  useEffect(() => {
    fetchBeritaAcaraData();
  }, [jadwalId]);

  const fetchBeritaAcaraData = async () => {
    try {
      setLoading(true);
      const [jRes, lembagaRes, baRes, panitiaRes, sesiRes] = await Promise.all([
        supabase
          .from('cbt_jadwal_ujian')
          .select(`
            *,
            data_kelas(id, nama_kelas),
            data_mapel(nama_mapel),
            data_ruang(nama_ruang),
            pengawas:data_guru!cbt_jadwal_ujian_pengawas_guru_id_fkey(nama, nip)
          `)
          .eq('id', jadwalId)
          .single(),
        supabase.from('data_lembaga').select('*').limit(1).maybeSingle(),
        supabase
          .from('cbt_berita_acara')
          .select('*')
          .eq('jadwal_id', jadwalId)
          .maybeSingle(),
        supabase
          .from('jabatan_guru')
          .select('guru_id, jabatan_utama, jabatan_lain_1, jabatan_lain_2, jabatan_lain_3, guru:guru_id(id, nama, nip)'),
        supabase
          .from('cbt_sesi_siswa')
          .select('id, status')
          .eq('jadwal_id', jadwalId),
      ]);

      setJadwal(jRes.data);
      setDataLembaga(lembagaRes.data);

      const listGuruJabatan = panitiaRes.data || [];
      const foundKetua = listGuruJabatan.find(jg => {
        const jRoles = [jg.jabatan_utama, jg.jabatan_lain_1, jg.jabatan_lain_2, jg.jabatan_lain_3];
        return jRoles.some(r => (r || '').toLowerCase().includes('ketua panitia'));
      });
      if (foundKetua) {
        setPanitiaData({ ketua: foundKetua.guru });
      }

      const { data: sop } = await supabase
        .from('cbt_sop_persetujuan')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setSopData(sop);

      // Hitung kehadiran dari data siswa di kelas
      let totalSiswaKelas = 0;
      if (jRes.data?.kelas_id) {
        const { count } = await supabase
          .from('data_siswa')
          .select('id', { count: 'exact', head: true })
          .eq('kelas_id', jRes.data.kelas_id);
        totalSiswaKelas = count || 0;
      }

      const sesiHadir = (sesiRes.data || []).filter(s => s.status === 'selesai' || s.status === 'mengerjakan').length;
      const tdkHadir = Math.max(0, totalSiswaKelas - sesiHadir);

      if (baRes.data) {
        setBeritaAcara(baRes.data);
        setFormData({
          jumlah_terdaftar: baRes.data.jumlah_terdaftar || totalSiswaKelas,
          jumlah_hadir: baRes.data.jumlah_hadir || sesiHadir,
          jumlah_tidak_hadir: baRes.data.jumlah_tidak_hadir || tdkHadir,
          catatan_pelaksanaan: baRes.data.catatan_pelaksanaan || formData.catatan_pelaksanaan,
          tanda_tangan_pengawas: baRes.data.tanda_tangan_pengawas || '',
        });
      } else {
        setFormData((prev) => ({
          ...prev,
          jumlah_terdaftar: totalSiswaKelas,
          jumlah_hadir: sesiHadir,
          jumlah_tidak_hadir: tdkHadir,
        }));
      }
    } catch (err) {
      console.error('Error fetching berita acara data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBeritaAcara = async () => {
    try {
      const titimangsa = `${dataLembaga?.kecamatan || 'Compreng'}, ${new Intl.DateTimeFormat(
        'id-ID',
        { day: 'numeric', month: 'long', year: 'numeric' }
      ).format(new Date())}`;

      const { error } = await supabase.from('cbt_berita_acara').upsert(
        {
          jadwal_id: jadwalId,
          ruang_id: jadwal?.ruang_id || null,
          pengawas_guru_id: jadwal?.pengawas_guru_id || null,
          jumlah_terdaftar: formData.jumlah_terdaftar,
          jumlah_hadir: formData.jumlah_hadir,
          jumlah_tidak_hadir: formData.jumlah_tidak_hadir,
          catatan_pelaksanaan: formData.catatan_pelaksanaan,
          titimangsa,
        },
        { onConflict: 'jadwal_id, ruang_id' }
      );

      if (error) throw error;
      Swal.fire({
        icon: 'success',
        title: 'Berita Acara Tersimpan',
        text: 'Data berita acara ujian CBT berhasil diperbarui.',
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire('Gagal Menyimpan', err.message, 'error');
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

  if (loading) {
    return <div className="p-8 text-center text-gray-500 font-medium">Menyiapkan Berita Acara Ujian Resmi...</div>;
  }

  return (
    <div className="bg-gray-100 min-h-screen py-6 print:py-0 print:bg-white text-gray-900 font-serif leading-relaxed">
      {/* Floating Action Bar */}
      <div className="max-w-4xl mx-auto mb-4 px-4 flex justify-between items-center print:hidden font-sans">
        <button
          onClick={() => navigate('/cbt/jadwal')}
          className="flex items-center gap-1.5 px-4 py-2 bg-white text-gray-700 font-bold text-xs rounded-xl shadow border hover:bg-gray-50 transition"
        >
          <ArrowLeft size={16} /> Kembali ke Jadwal
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSaveBeritaAcara}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition"
          >
            <Save size={16} /> Simpan Catatan
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-5 py-2 bg-primary hover:bg-blue-900 text-white font-bold text-xs rounded-xl shadow-md transition"
          >
            <Printer size={16} /> Cetak / Unduh (PDF)
          </button>
        </div>
      </div>

      {/* Dokumen Standar A4 Cetak */}
      <div className="max-w-4xl mx-auto bg-white p-10 sm:p-14 shadow-lg rounded-2xl print:shadow-none print:rounded-none print:p-0 print:max-w-none">
        {/* Kop Surat Sekolah Resmi */}
        <KopSurat dataLembaga={dataLembaga} />

        {/* Judul Berita Acara */}
        <div className="text-center my-6 space-y-1">
          <h2 className="text-base font-black text-gray-900 uppercase tracking-wide underline">
            BERITA ACARA PELAKSANAAN UJIAN CBT
          </h2>
          <p className="text-xs font-bold text-gray-700 uppercase">
            PENILAIAN {jenisUjianStr} TAHUN AJARAN {panitiaData?.tahun_ajaran || '2025/2026'}
          </p>
        </div>

        {/* Pernyataan Pembuka */}
        <div className="space-y-4 text-xs font-sans text-justify text-gray-800 leading-relaxed">
          <p>
            Pada hari ini <strong>{jadwal?.hari || 'Senin'}</strong>, tanggal{' '}
            <strong>{formattedDate}</strong>, telah diselenggarakan Penilaian Berbasis Komputer ({jenisUjianStr}) untuk mata pelajaran yang tertera di bawah ini:
          </p>

          <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-200 print:bg-transparent print:p-0 print:border-none space-y-1.5 font-medium">
            <div className="flex">
              <span className="w-48 font-bold">Mata Pelajaran</span>
              <span>: {jadwal?.data_mapel?.nama_mapel}</span>
            </div>
            <div className="flex">
              <span className="w-48 font-bold">Kelas / Rombel</span>
              <span>: {jadwal?.data_kelas?.nama_kelas}</span>
            </div>
            <div className="flex">
              <span className="w-48 font-bold">Ruang Pelaksanaan</span>
              <span>: {jadwal?.data_ruang?.nama_ruang || 'Lab Komputer CBT'}</span>
            </div>
            <div className="flex">
              <span className="w-48 font-bold">Alokasi Waktu Ujian</span>
              <span>
                : {jadwal?.jam_mulai?.slice(0, 5)} s/d {jadwal?.jam_selesai?.slice(0, 5)} WIB ({jadwal?.durasi_menit} Menit)
              </span>
            </div>
            <div className="flex">
              <span className="w-48 font-bold">Pengawas Ruang</span>
              <span>: {jadwal?.pengawas?.nama || jadwal?.pengawas?.nama_guru || '-'}</span>
            </div>
          </div>

          <p className="pt-2 font-bold">Statistik Kehadiran Peserta Didik:</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-gray-50 border rounded-xl text-center">
              <span className="text-[10px] text-gray-600 block uppercase font-bold">
                Jumlah Terdaftar
              </span>
              <span className="text-base font-black text-gray-900">
                {formData.jumlah_terdaftar} Siswa
              </span>
            </div>
            <div className="p-3 bg-gray-50 border rounded-xl text-center">
              <span className="text-[10px] text-gray-600 block uppercase font-bold">
                Jumlah Hadir
              </span>
              <span className="text-base font-black text-emerald-700">
                {formData.jumlah_hadir} Siswa
              </span>
            </div>
            <div className="p-3 bg-gray-50 border rounded-xl text-center">
              <span className="text-[10px] text-gray-600 block uppercase font-bold">
                Tidak Hadir
              </span>
              <span className="text-base font-black text-rose-700">
                {formData.jumlah_tidak_hadir} Siswa
              </span>
            </div>
          </div>

          {/* Catatan Pelaksanaan */}
          <div className="pt-2 space-y-1">
            <label className="font-bold block">
              Catatan Pelaksanaan Ujian (Insiden Khusus, Kendala Perangkat, Anomali AI Proctoring):
            </label>
            <textarea
              rows={3}
              value={formData.catatan_pelaksanaan}
              onChange={(e) => setFormData({ ...formData, catatan_pelaksanaan: e.target.value })}
              className="w-full text-xs border rounded-xl p-3 bg-gray-50/50 print:bg-transparent print:border-none print:p-0 print:resize-none outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <p className="pt-2">
            Demikian Berita Acara Pelaksanaan Ujian ini dibuat dengan sesungguhnya dan ditandatangani oleh Pengawas Ruang bersama Ketua Panitia Ujian untuk dipergunakan sebagaimana mestinya.
          </p>
        </div>

        {/* Titimangsa & Tanda Tangan Resmi */}
        <div className="mt-12 flex justify-between items-start text-xs text-gray-900 font-sans break-inside-avoid">
          {/* Bawah Kiri: Pengawas Ruang Ujian */}
          <div className="text-center min-w-[200px]">
            <p className="font-bold">Pengawas Ruang Ujian,</p>
            <div className="h-20 flex items-center justify-center">
              <div className="border border-dashed border-gray-200 rounded p-2 text-[10px] text-gray-400">
                (Tanda Tangan Pengawas)
              </div>
            </div>
            <p className="font-bold underline uppercase">
              {jadwal?.pengawas?.nama || jadwal?.pengawas?.nama_guru || '( ............................................ )'}
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
              Mengetahui,<br />Ketua Panitia Ujian CBT,
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
              {panitiaData?.ketua?.nama || '( ............................................ )'}
            </p>
            <p className="text-[11px] text-gray-600">
              {panitiaData?.ketua?.nip ? `NIP. ${panitiaData.ketua.nip}` : 'NIP. -'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
