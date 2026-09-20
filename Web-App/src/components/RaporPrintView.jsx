import React from 'react';

const RaporPrintView = ({ data }) => {
  if (!data) return null;

  const {
    siswa, lembaga, kelas, waliKelas, kepalaSekolah,
    tahunAjaran, semester, mapelWajib, mapelPilihan,
    ekskul, kokurikuler, presensi, catatanWali
  } = data;

  // Render a single table row for Mapel
  const renderMapelRow = (m, index) => {
    return (
      <tr key={m.id}>
        <td className="border border-black px-2 py-1 text-center align-top">{index + 1}</td>
        <td className="border border-black px-2 py-1 align-top">{m.nama_mapel}</td>
        <td className="border border-black px-2 py-1 text-center align-top font-semibold">{m.nilai_akhir || '-'}</td>
        <td className="border border-black px-2 py-1 align-top text-justify text-sm">
          {m.capaian_kompetensi || '-'}
        </td>
      </tr>
    );
  };

  const today = new Date();
  const dateString = today.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const lokasi = lembaga?.alamat?.split('Kec.')[0]?.split('Desa ')[1]?.trim() || 'Subang';

  const renderFooter = (halaman) => (
    <div className="text-xs font-mono mt-auto pt-4 border-t-2 border-black flex justify-between w-full">
      <span>{kelas?.nama_kelas} | <span className="font-bold uppercase">{siswa?.nama}</span> | {siswa?.nipd}</span>
      <span>Halaman : {halaman}</span>
    </div>
  );

  return (
    <div className="w-full bg-white print-container text-black font-serif" style={{ fontSize: '11pt' }}>

      {/* Page 1: Nilai & Capaian */}
      <div className="print-page flex flex-col" style={{ minHeight: '270mm', pageBreakAfter: 'always' }}>
        <div className="flex-grow">
          <div className="mb-4">
            <table className="w-full text-sm">
              <tbody>
                <tr>
                  <td className="w-32 py-0.5">Nama Murid</td>
                  <td className="w-4 py-0.5">:</td>
                  <td className="py-0.5 uppercase font-semibold">{siswa?.nama}</td>

                  <td className="w-32 py-0.5 pl-4">Kelas</td>
                  <td className="w-4 py-0.5">:</td>
                  <td className="py-0.5">{kelas?.nama_kelas || '-'}</td>
                </tr>
                <tr>
                  <td className="py-0.5">NIS/NISN</td>
                  <td className="py-0.5">:</td>
                  <td className="py-0.5">{siswa?.nipd} / {siswa?.nisn}</td>

                  <td className="py-0.5 pl-4">Fase</td>
                  <td className="py-0.5">:</td>
                  <td className="py-0.5">D</td>
                </tr>
                <tr>
                  <td className="py-0.5">Sekolah</td>
                  <td className="py-0.5">:</td>
                  <td className="py-0.5">{lembaga?.nama_lembaga}</td>

                  <td className="py-0.5 pl-4">Semester</td>
                  <td className="py-0.5">:</td>
                  <td className="py-0.5">{semester === 'Ganjil' ? '1 (Ganjil)' : '2 (Genap)'}</td>
                </tr>
                <tr>
                  <td className="py-0.5 align-top">Alamat</td>
                  <td className="py-0.5 align-top">:</td>
                  <td className="py-0.5 capitalize">{lembaga?.alamat}</td>

                  <td className="py-0.5 pl-4 align-top">Tahun Ajaran</td>
                  <td className="py-0.5 align-top">:</td>
                  <td className="py-0.5 align-top">{tahunAjaran}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 className="text-center font-bold text-lg mb-4 mt-6">LAPORAN HASIL BELAJAR</h2>

          <table className="w-full border-collapse border border-black text-sm mb-4">
            <thead>
              <tr className="bg-gray-100 font-bold">
                <th className="border border-black py-2 w-10 text-center">No</th>
                <th className="border border-black py-2 w-48 text-center">Mata Pelajaran</th>
                <th className="border border-black py-2 w-20 text-center">Nilai Akhir</th>
                <th className="border border-black py-2 text-center">Capaian Kompetensi</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan="4" className="border border-black px-2 py-1 font-bold bg-gray-50">Mata Pelajaran Wajib</td>
              </tr>
              {mapelWajib?.length > 0 ? (
                mapelWajib.map((m, i) => renderMapelRow(m, i))
              ) : (
                <tr><td colSpan="4" className="border border-black px-2 py-1 text-center italic">Tidak ada data</td></tr>
              )}

              <tr>
                <td colSpan="4" className="border border-black px-2 py-1 font-bold bg-gray-50">Mata Pelajaran Pilihan</td>
              </tr>
              {mapelPilihan?.length > 0 ? (
                mapelPilihan.map((m, i) => renderMapelRow(m, i))
              ) : (
                <tr><td colSpan="4" className="border border-black px-2 py-1 text-center italic">Tidak ada data</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Page 1 */}
        {renderFooter(1)}
      </div>

      {/* Page 2: Kokurikuler, Ekskul, Absensi, TTD */}
      <div className="print-page flex flex-col pt-8" style={{ minHeight: '270mm', pageBreakAfter: 'always' }}>
        <div className="flex-grow">
          {/* KOKURIKULER */}
          <table className="w-full border-collapse border border-black text-sm mb-6">
            <thead>
              <tr className="bg-gray-100 font-bold">
                <th className="border border-black py-2 text-center">Kokurikuler</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-black px-4 py-4 min-h-[60px] align-top">
                  {kokurikuler?.length > 0 ? (
                    <ul className="list-disc pl-5">
                      {kokurikuler.map((k, i) => (
                        <li key={i} className="mb-1">{k.nama_kegiatan}</li>
                      ))}
                    </ul>
                  ) : (
                    <span className="italic text-gray-500">Tidak ada catatan kegiatan kokurikuler.</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>

          {/* EKSTRAKURIKULER */}
          <table className="w-full border-collapse border border-black text-sm mb-6">
            <thead>
              <tr className="bg-gray-100 font-bold">
                <th className="border border-black py-2 w-10 text-center">No</th>
                <th className="border border-black py-2 w-48 text-center">Ekstrakurikuler</th>
                <th className="border border-black py-2 text-center">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {ekskul?.length > 0 ? (
                ekskul.map((e, i) => (
                  <tr key={i}>
                    <td className="border border-black px-2 py-1 text-center">{i + 1}</td>
                    <td className="border border-black px-2 py-1">{e.nama_ekskul}</td>
                    <td className="border border-black px-2 py-1">{e.keterangan || 'Baik'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="border border-black px-2 py-1 text-center">1</td>
                  <td className="border border-black px-2 py-1">-</td>
                  <td className="border border-black px-2 py-1">-</td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="flex gap-4 mb-6">
            {/* KETIDAKHADIRAN */}
            <div className="w-1/3">
              <table className="w-full border-collapse border border-black text-sm">
                <thead>
                  <tr className="bg-gray-100 font-bold">
                    <th colSpan="3" className="border border-black py-2 text-center">Ketidakhadiran</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-black px-2 py-1">Sakit</td>
                    <td className="border border-black px-2 py-1 text-center w-6">:</td>
                    <td className="border border-black px-2 py-1 text-right">{presensi?.sakit || 0} hari</td>
                  </tr>
                  <tr>
                    <td className="border border-black px-2 py-1">Izin</td>
                    <td className="border border-black px-2 py-1 text-center">:</td>
                    <td className="border border-black px-2 py-1 text-right">{presensi?.izin || 0} hari</td>
                  </tr>
                  <tr>
                    <td className="border border-black px-2 py-1">Tanpa Keterangan</td>
                    <td className="border border-black px-2 py-1 text-center">:</td>
                    <td className="border border-black px-2 py-1 text-right">{presensi?.alpha || 0} hari</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* CATATAN WALI KELAS */}
            <div className="w-2/3">
              <table className="w-full border-collapse border border-black text-sm h-full">
                <thead>
                  <tr className="bg-gray-100 font-bold">
                    <th className="border border-black py-2 text-center">Catatan Wali Kelas</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-black px-3 py-2 align-top h-[76px]">
                      {catatanWali?.catatan || ''}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* KENAIKAN KELAS (HANYA GENAP) */}
          {semester === 'Genap' && (
            <div className="border border-black p-3 mb-6 text-center font-bold text-sm">
              Keterangan Kenaikan Kelas : {catatanWali?.kenaikan_kelas || '...........................................'}
            </div>
          )}

          {/* TANGGAPAN ORTU */}
          <table className="w-full border-collapse border border-black text-sm mb-12">
            <thead>
              <tr className="bg-gray-100 font-bold">
                <th className="border border-black py-2 text-center">Tanggapan Orang Tua/Wali Murid</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-black px-2 py-1 h-[80px]"></td>
              </tr>
            </tbody>
          </table>

          {/* TANDA TANGAN */}
          <div className="flex justify-between text-sm px-8 mb-4">
            <div className="text-center w-48">
              <p className="mb-20">Orang Tua Murid</p>
              <p className="border-b border-black inline-block w-full"></p>
            </div>
            <div className="text-center w-48">
              <p className="mb-20">{lokasi}, {dateString}<br />Wali Kelas</p>
              <p className="border-b border-black inline-block w-full font-bold">{waliKelas?.nama || ''}</p>
            </div>
          </div>

          <div className="flex justify-center text-sm px-8 mb-8">
            <div className="text-center w-64">
              <p className="mb-20">Mengetahui,<br />Kepala Sekolah</p>
              <p className="font-bold underline">{kepalaSekolah?.nama || lembaga?.kepala_sekolah || ''}</p>
              <p>NIP. {kepalaSekolah?.nip || lembaga?.nip_kepsek || '-'}</p>
            </div>
          </div>
        </div>

        {/* Footer Page 2 */}
        {renderFooter(2)}
      </div>
    </div>
  );
};

export default RaporPrintView;
