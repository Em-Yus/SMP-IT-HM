import React from 'react';

/**
 * Reusable Kop Surat Resmi Sekolah
 * Mengambil seluruh data dari tabel `data_lembaga` (nama yayasan, nama sekolah, NPSN, alamat, logo, dll)
 * Didesain presisi satu baris per komponen untuk format kertas resmi A4.
 */
export default function KopSurat({ dataLembaga, className = "" }) {
  if (!dataLembaga) return null;

  const logo = dataLembaga.logo_url || '';
  const yayasan = (dataLembaga.nama_yayasan || 'YAYASAN HIDAYATUL MUBTADI-IEN').toUpperCase();
  const nama = (dataLembaga.nama_lembaga || 'SMP IT HIDAYATUL MUBTADI-IEN').toUpperCase();
  const npsn = dataLembaga.npsn || '70004822';
  const alamat = dataLembaga.alamat || 'Dusun Sukaseneng RT 025 RW 010 Desa Compreng Kec. Compreng Kab. Subang';
  const kodePos = dataLembaga.kode_pos ? `Kode Pos ${dataLembaga.kode_pos}` : '';
  const alamatLengkap = [alamat, kodePos].filter(Boolean).join(' - ');

  const telepon = dataLembaga.telepon ? `Telp: ${dataLembaga.telepon}` : '';
  const email = dataLembaga.email ? `Email: ${dataLembaga.email}` : '';
  const cleanWebsite = (dataLembaga.website || '').replace(/^https?:\/\//i, '').replace(/\/$/, '');
  const website = cleanWebsite ? `Website: ${cleanWebsite}` : '';

  const contactLine = [telepon, email, website].filter(Boolean).join(' • ');

  return (
    <div className={`w-full mb-6 font-serif ${className}`}>
      <div className="flex items-center justify-between gap-2 sm:gap-3 text-center">
        {/* Logo Kiri */}
        <div className="w-16 sm:w-20 shrink-0 flex items-center justify-center">
          {logo ? (
            <img 
              src={logo} 
              alt="Logo Lembaga" 
              className="w-14 h-14 sm:w-16 sm:h-16 md:w-[72px] md:h-[72px] object-contain mx-auto" 
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          ) : (
            <div className="w-14 h-14 sm:w-16 sm:h-16" />
          )}
        </div>

        {/* Teks Kop Tengah (Semua elemen penting diatur satu baris) */}
        <div className="flex-1 text-center px-1 min-w-0">
          <h3 className="text-xs sm:text-[13px] font-bold uppercase tracking-wider text-gray-900 whitespace-nowrap leading-tight">
            {yayasan}
          </h3>
          <h2 className="text-base sm:text-lg md:text-[20px] font-black uppercase text-black tracking-normal leading-snug my-0.5 whitespace-nowrap">
            {nama}
          </h2>
          <p className="text-[11px] sm:text-[12px] font-bold text-gray-800 whitespace-nowrap leading-tight">
            NPSN: {npsn}
          </p>
          <p className="text-[9.5px] sm:text-[10.5px] text-gray-700 leading-tight mt-0.5 whitespace-nowrap">
            {alamatLengkap}
          </p>
          {contactLine && (
            <p className="text-[8.5px] sm:text-[9.5px] text-gray-600 mt-0.5 whitespace-nowrap leading-tight">
              {contactLine}
            </p>
          )}
        </div>

        {/* Spacer Kanan agar posisi judul tetap seimbang di tengah */}
        <div className="w-16 sm:w-20 shrink-0 pointer-events-none" style={{ visibility: 'hidden' }} />
      </div>

      {/* Garis Ganda Kop Surat Resmi (Tebal di atas 2.5px, tipis di bawah 1px) */}
      <div className="w-full mt-2.5">
        <div className="border-t-[2.5px] border-black w-full" />
        <div className="border-t-[1px] border-black w-full mt-[2px]" />
      </div>
    </div>
  );
}

/**
 * Helper untuk menghasilkan string HTML Kop Surat Resmi untuk cetak / WebView / window.print()
 */
export function getKopSuratHTML(dataLembaga) {
  if (!dataLembaga) return '';

  const logo = dataLembaga.logo_url || '';
  const yayasan = (dataLembaga.nama_yayasan || 'YAYASAN HIDAYATUL MUBTADI-IEN').toUpperCase();
  const nama = (dataLembaga.nama_lembaga || 'SMP IT HIDAYATUL MUBTADI-IEN').toUpperCase();
  const npsn = dataLembaga.npsn || '70004822';
  const alamat = dataLembaga.alamat || 'Dusun Sukaseneng RT 025 RW 010 Desa Compreng Kec. Compreng Kab. Subang';
  const kodePos = dataLembaga.kode_pos ? `Kode Pos ${dataLembaga.kode_pos}` : '';
  const alamatLengkap = [alamat, kodePos].filter(Boolean).join(' - ');

  const telepon = dataLembaga.telepon ? `Telp: ${dataLembaga.telepon}` : '';
  const email = dataLembaga.email ? `Email: ${dataLembaga.email}` : '';
  const cleanWebsite = (dataLembaga.website || '').replace(/^https?:\/\//i, '').replace(/\/$/, '');
  const website = cleanWebsite ? `Website: ${cleanWebsite}` : '';

  const contactLine = [telepon, email, website].filter(Boolean).join(' • ');

  return `
    <div style="width: 100%; margin-bottom: 20px; font-family: 'Times New Roman', serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
        <tr>
          <td width="75" align="center" valign="middle">
            ${logo ? `<img src="${logo}" style="width: 70px; height: 70px; object-fit: contain; display: block;" />` : ''}
          </td>
          <td align="center" valign="middle" style="padding: 0 10px; line-height: 1.25;">
            <div style="font-size: 13px; font-weight: bold; text-transform: uppercase; color: #111; letter-spacing: 0.5px; white-space: nowrap;">${yayasan}</div>
            <div style="font-size: 20px; font-weight: 900; text-transform: uppercase; color: #000; letter-spacing: 0.5px; margin: 3px 0; white-space: nowrap;">${nama}</div>
            <div style="font-size: 12px; font-weight: bold; color: #222; white-space: nowrap;">NPSN: ${npsn}</div>
            <div style="font-size: 11px; color: #333; margin-top: 2px; white-space: nowrap;">${alamatLengkap}</div>
            ${contactLine ? `<div style="font-size: 9.5px; color: #444; margin-top: 2px; white-space: nowrap;">${contactLine}</div>` : ''}
          </td>
          <td width="75">&nbsp;</td>
        </tr>
      </table>
      <div style="border-top: 2.5px solid #000; width: 100%; margin-top: 8px;"></div>
      <div style="border-top: 1px solid #000; width: 100%; margin-top: 2px;"></div>
    </div>
  `;
}
