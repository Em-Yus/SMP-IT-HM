/**
 * Helper Slip Honorarium Guru untuk Mobile App
 * Format cetak presisi sesuai spesifikasi resmi (Gambar 1 & Gambar 2)
 * Revisi:
 * - Setiap slip penomoran No selalu diulang mulai dari 1 lagi.
 * - Baris yang kosong / tidak ada nominalnya tidak dicantumkan.
 */

export function terbilang(n: number | string): string {
  const angka = Math.floor(Math.abs(Number(n) || 0));
  if (angka === 0) return 'Nol Rupiah';

  const satuan = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];

  function convert(x: number): string {
    if (x < 12) return satuan[x];
    if (x < 20) return convert(x - 10) + ' Belas';
    if (x < 100) return convert(Math.floor(x / 10)) + ' Puluh' + (x % 10 > 0 ? ' ' + convert(x % 10) : '');
    if (x < 200) return 'Seratus' + (x % 100 > 0 ? ' ' + convert(x % 100) : '');
    if (x < 1000) return convert(Math.floor(x / 100)) + ' Ratus' + (x % 100 > 0 ? ' ' + convert(x % 100) : '');
    if (x < 2000) return 'Seribu' + (x % 1000 > 0 ? ' ' + convert(x % 1000) : '');
    if (x < 1000000) return convert(Math.floor(x / 1000)) + ' Ribu' + (x % 1000 > 0 ? ' ' + convert(x % 1000) : '');
    if (x < 1000000000) return convert(Math.floor(x / 1000000)) + ' Juta' + (x % 1000000 > 0 ? ' ' + convert(x % 1000000) : '');
    if (x < 1000000000000) return convert(Math.floor(x / 1000000000)) + ' Miliar' + (x % 1000000000 > 0 ? ' ' + convert(x % 1000000000) : '');
    return convert(Math.floor(x / 1000000000000)) + ' Triliun' + (x % 1000000000000 > 0 ? ' ' + convert(x % 1000000000000) : '');
  }

  return convert(angka).trim() + ' Rupiah';
}

export const bulanNames: string[] = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export function formatPeriodeBulan(bulanList: number[], tahun?: number): string {
  if (!bulanList || bulanList.length === 0) return 'September <sup>s</sup>/<sub>d</sub> September';
  const sorted = [...bulanList].map(Number).sort((a, b) => a - b);
  if (sorted.length === 1) {
    const bName = bulanNames[sorted[0] - 1];
    return `${bName} <sup>s</sup>/<sub>d</sub> ${bName}`;
  }
  const first = bulanNames[sorted[0] - 1];
  const last = bulanNames[sorted[sorted.length - 1] - 1];
  return `${first} <sup>s</sup>/<sub>d</sub> ${last}`;
}

export function getCompactKopSuratHTML(dataLembaga: any): string {
  if (!dataLembaga) {
    return `
      <div style="width: 100%; margin-bottom: 6px; font-family: 'Times New Roman', serif; text-align: center;">
        <div style="font-size: 15px; font-weight: 900; text-transform: uppercase;">SMP IT HIDAYATUL MUBTADI-IEN</div>
        <div style="border-top: 2px solid #000; width: 100%; margin-top: 4px;"></div>
        <div style="border-top: 1px solid #000; width: 100%; margin-top: 1.5px;"></div>
      </div>
    `;
  }
  const logo = dataLembaga.logo_url || '';
  const yayasan = (dataLembaga.nama_yayasan || 'YAYASAN HIDAYATUL MUBTADI-IEN').toUpperCase();
  const nama = (dataLembaga.nama_lembaga || 'SMP IT HIDAYATUL MUBTADI-IEN').toUpperCase();
  const alamat = dataLembaga.alamat || 'Dusun Sukaseneng RT 025 RW 010 Desa Compreng Kec. Compreng Kab. Subang';
  const kodePos = dataLembaga.kode_pos ? `Kode Pos ${dataLembaga.kode_pos}` : '';
  const alamatLengkap = [alamat, kodePos].filter(Boolean).join(' - ');
  const telepon = dataLembaga.telepon ? `Telp: ${dataLembaga.telepon}` : '';
  const email = dataLembaga.email ? `Email: ${dataLembaga.email}` : '';
  const cleanWebsite = (dataLembaga.website || '').replace(/^https?:\/\//i, '').replace(/\/$/, '');
  const website = cleanWebsite ? `Website: ${cleanWebsite}` : '';
  const contactLine = [telepon, email, website].filter(Boolean).join(' • ');

  return `
    <div style="width: 100%; margin-bottom: 6px; font-family: 'Times New Roman', serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
        <tr>
          <td width="55" align="center" valign="middle">
            ${logo ? `<img src="${logo}" style="width: 48px; height: 48px; object-fit: contain; display: block;" />` : ''}
          </td>
          <td align="center" valign="middle" style="padding: 0 8px; line-height: 1.15;">
            <div style="font-size: 10px; font-weight: bold; text-transform: uppercase; color: #111; letter-spacing: 0.5px; white-space: nowrap;">${yayasan}</div>
            <div style="font-size: 15px; font-weight: 900; text-transform: uppercase; color: #000; letter-spacing: 0.5px; margin: 1px 0; white-space: nowrap;">${nama}</div>
            <div style="font-size: 8.5px; color: #333; margin-top: 1px; white-space: nowrap;">${alamatLengkap}</div>
            ${contactLine ? `<div style="font-size: 7.5px; color: #444; margin-top: 1px; white-space: nowrap;">${contactLine}</div>` : ''}
          </td>
          <td width="55">&nbsp;</td>
        </tr>
      </table>
      <div style="border-top: 2px solid #000; width: 100%; margin-top: 4px;"></div>
      <div style="border-top: 1px solid #000; width: 100%; margin-top: 1.5px;"></div>
    </div>
  `;
}

export interface SingleSlipRowData {
  vol?: string | number;
  satuan?: string;
  nominal?: string | number;
  jumlah?: string | number;
  keterangan?: string;
}

export interface SingleSlipData {
  guruNama: string;
  rowJabatan?: SingleSlipRowData;
  rowMapel?: SingleSlipRowData;
  rowNgaji?: SingleSlipRowData;
  rowKehadiran?: SingleSlipRowData;
  rowWali?: SingleSlipRowData;
  rowApresiasi?: SingleSlipRowData;
  totalHonor: number;
}

/**
 * Format satu slip honorarium guru sesuai revisi:
 * - Nomor diulang dari 1 untuk setiap slip
 * - Baris yang kosong / tanpa nominal tidak dicantumkan
 */
export function generateSingleSlipHtml(slipData: SingleSlipData, dataLembaga: any, periodeText: string): string {
  const {
    guruNama,
    rowJabatan = {},
    rowMapel = {},
    rowNgaji = {},
    rowKehadiran = {},
    rowWali = {},
    rowApresiasi = {},
    totalHonor = 0
  } = slipData;

  const terbilangText = terbilang(totalHonor);

  // Buat kandidat baris secara berurutan
  const allCandidates: Array<{ uraian: string } & SingleSlipRowData> = [
    { uraian: 'Tunjangan Jabatan', ...rowJabatan },
    { uraian: 'Guru Mapel', ...rowMapel },
    { uraian: 'Guru Ngaji', ...rowNgaji },
    { uraian: 'Kehadiran', ...rowKehadiran },
    { uraian: 'Wali Kelas', ...rowWali },
    { uraian: 'Apresiasi Kinerja', ...rowApresiasi },
  ];

  // Hanya tampilkan baris yang memiliki nominal / jumlah > 0
  const activeRows = allCandidates.filter((r) => {
    const numJml = Number(r.jumlah) || 0;
    const numNom = Number(r.nominal) || 0;
    return numJml > 0 || numNom > 0;
  });

  const rowsHtml = activeRows.length > 0 ? activeRows.map((row, idx) => `
    <tr>
      <td style="border: 1px solid #000; padding: 3px 2px; text-align: center;">${idx + 1}.</td>
      <td style="border: 1px solid #000; padding: 3px 6px;">${row.uraian}</td>
      <td style="border: 1px solid #000; padding: 3px 2px; text-align: center;">${row.vol || ''}</td>
      <td style="border: 1px solid #000; padding: 3px 4px;">${row.satuan || ''}</td>
      <td style="border: 1px solid #000; padding: 3px 4px; text-align: right; font-family: monospace;">${row.nominal ? `Rp. ${Number(row.nominal).toLocaleString('id-ID')}` : ''}</td>
      <td style="border: 1px solid #000; padding: 3px 4px; text-align: right; font-family: monospace;">${row.jumlah ? `Rp. ${Number(row.jumlah).toLocaleString('id-ID')}` : ''}</td>
      <td style="border: 1px solid #000; padding: 3px 6px; line-height: 1.35; white-space: pre-line;">${row.keterangan || ''}</td>
    </tr>
  `).join('') : `
    <tr>
      <td colspan="7" style="border: 1px solid #000; padding: 6px; text-align: center; color: #666;">Tidak ada komponen honorarium</td>
    </tr>
  `;

  return `
    <div class="slip-wrapper" style="page-break-inside: avoid; break-inside: avoid; margin-bottom: 22px; font-family: Arial, Helvetica, sans-serif; color: #000; width: 100%;">
      ${getCompactKopSuratHTML(dataLembaga)}

      <div style="text-align: center; font-size: 12px; font-weight: 900; text-transform: uppercase; margin: 5px 0 7px 0; letter-spacing: 0.5px;">
        SLIP HONORARIUM GURU
      </div>

      <!-- Kotak Info Nama & Bulan -->
      <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #000; margin-bottom: 5px; font-size: 10.5px;">
        <tr>
          <td style="padding: 4px 8px; border-right: 1.5px solid #000; font-weight: bold; width: 50%;">
            Nama : ${guruNama}
          </td>
          <td style="padding: 4px 8px; text-align: right; font-weight: bold; width: 50%;">
            Bulan ${periodeText}
          </td>
        </tr>
      </table>

      <!-- Tabel 7 Kolom Rincian Honor -->
      <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #000; font-size: 10.5px;">
        <thead>
          <tr style="border-bottom: 1.5px solid #000; background-color: #fcfcfc;">
            <th style="border: 1px solid #000; padding: 4px 2px; text-align: center; width: 34px; font-weight: bold;">No</th>
            <th style="border: 1px solid #000; padding: 4px 6px; text-align: center; width: 130px; font-weight: bold;">Uraian</th>
            <th style="border: 1px solid #000; padding: 4px 2px; text-align: center; width: 38px; font-weight: bold;">Vol</th>
            <th style="border: 1px solid #000; padding: 4px 4px; text-align: center; width: 85px; font-weight: bold;">Satuan</th>
            <th style="border: 1px solid #000; padding: 4px 4px; text-align: center; width: 95px; font-weight: bold; line-height: 1.2;">Nominal<br/>Honor</th>
            <th style="border: 1px solid #000; padding: 4px 4px; text-align: center; width: 95px; font-weight: bold;">Jumlah</th>
            <th style="border: 1px solid #000; padding: 4px 6px; text-align: center; font-weight: bold;">Keterangan</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
        <tfoot>
          <!-- Baris Total & Terbilang -->
          <tr style="border-top: 1.5px solid #000;">
            <td colspan="6" style="border: 1px solid #000; border-top: 1.5px solid #000; padding: 4px 8px; font-weight: bold;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border: none;">
                <tr>
                  <td style="border: none; font-weight: bold; width: 60px;">Total:</td>
                  <td style="border: none; font-weight: bold; text-align: right; font-family: monospace;">Rp. ${Number(totalHonor).toLocaleString('id-ID')}</td>
                </tr>
              </table>
            </td>
            <td style="border: 1px solid #000; border-top: 1.5px solid #000; padding: 4px 8px; font-style: italic;">
              Terbilang : ${terbilangText}
            </td>
          </tr>
        </tfoot>
      </table>

      <!-- Pembatas Potong Kertas (Garis Putus-Putus) -->
      <table class="slip-cut-line" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 15px; border-collapse: collapse;">
        <tr>
          <td style="border-top: 1.5px dashed #000; width: 100%; font-size: 1px; line-height: 1px;">&nbsp;</td>
        </tr>
      </table>
    </div>
  `;
}

/**
 * Format halaman cetak lengkap (A4 portrait) yang menampung multiple slip guru secara bersambung
 */
export function generateCompletePrintPage(slipsHtmlContent: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Slip Honorarium Guru</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 10mm 12mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          body {
            margin: 0;
            padding: 0;
            background: #fff;
            color: #000;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 10.5px;
          }
          .slip-wrapper {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin-bottom: 16px;
            padding-bottom: 4px;
          }
          .slip-cut-line {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          @media print {
            body {
              width: 100%;
            }
            .slip-wrapper {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            .slip-cut-line {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
          }
        </style>
      </head>
      <body>
        ${slipsHtmlContent}
      </body>
    </html>
  `;
}
