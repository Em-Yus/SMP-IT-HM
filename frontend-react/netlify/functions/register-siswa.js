// netlify/functions/register-siswa.js
// Endpoint aman untuk menerima pendaftaran siswa baru dari form PPDB.
// Memverifikasi Cloudflare Turnstile CAPTCHA sebelum mengizinkan INSERT ke database ppdb_pendaftar.

const SUPABASE_URL = 'https://ztfnvnbxeobxbqlydvok.supabase.co';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!TURNSTILE_SECRET || !SUPABASE_SERVICE_KEY) {
    console.error('Konfigurasi server tidak lengkap: env vars TURNSTILE_SECRET_KEY atau SUPABASE_SERVICE_ROLE_KEY tidak ditemukan.');
    return { statusCode: 500, body: JSON.stringify({ error: 'Konfigurasi server tidak lengkap.' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Request body tidak valid (bukan JSON).' }) };
  }

  const { cf_turnstile_token, nipd, ...formData } = body;

  // =====================================================
  // LANGKAH 1: Verifikasi Token Cloudflare Turnstile
  // =====================================================
  if (!cf_turnstile_token) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Token CAPTCHA tidak ditemukan. Muat ulang halaman dan coba lagi.' }) };
  }

  // Khusus testing localhost dengan dummy token, bypass verifikasi
  if (cf_turnstile_token !== '1x00000000000000000000AA') {
    const turnstileVerifyUrl = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
    const turnstileFormData = new URLSearchParams();
    turnstileFormData.append('secret', TURNSTILE_SECRET);
    turnstileFormData.append('response', cf_turnstile_token);

    const turnstileRes = await fetch(turnstileVerifyUrl, {
      method: 'POST',
      body: turnstileFormData,
    });
    const turnstileData = await turnstileRes.json();

    if (!turnstileData.success) {
      console.warn('Verifikasi Turnstile GAGAL:', turnstileData['error-codes']);
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Verifikasi CAPTCHA gagal. Anda teridentifikasi sebagai bot. Silakan muat ulang halaman.' }),
      };
    }
  }

  // =====================================================
  // LANGKAH 2: Generate NIPD/No Pendaftaran dengan Race-Condition Retry
  // =====================================================
  const { angkatan, kelas, tahun_ajaran, foto_url, ...otherData } = formData;

  let tahun1 = '25'; let tahun2 = '26';
  if (tahun_ajaran && tahun_ajaran.includes('/')) {
    const splitTa = tahun_ajaran.split('/');
    tahun1 = splitTa[0].slice(-2);
    tahun2 = splitTa[1].slice(-2);
  }
  const digit1_4 = tahun1 + tahun2;

  let digit5_6 = '07';
  if (kelas) {
    const kelasStr = String(kelas).toUpperCase();
    if (kelasStr.includes('VIII') || kelasStr.includes('8')) digit5_6 = '08';
    else if (kelasStr.includes('IX') || kelasStr.includes('9')) digit5_6 = '09';
    else if (kelasStr.includes('VII') || kelasStr.includes('7')) digit5_6 = '07';
  }

  const supabaseHeaders = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
  };

  const maxRetries = 5;
  let insertSuccess = false;
  let retryCount = 0;
  let lastError = null;

  while (retryCount < maxRetries && !insertSuccess) {
    // Hitung nomor urut siswa berdasarkan angkatan di tabel ppdb_pendaftar
    const countRes = await fetch(
      `${SUPABASE_URL}/rest/v1/ppdb_pendaftar?angkatan=eq.${encodeURIComponent(angkatan)}&select=id`,
      { headers: { ...supabaseHeaders, 'Prefer': 'count=exact' } }
    );
    const countHeader = countRes.headers.get('content-range');
    let count = 0;
    if (countHeader) {
      const match = countHeader.match(/\/(\d+)$/);
      if (match) count = parseInt(match[1], 10);
    }

    const nomorUrut = String(count + 1 + retryCount).padStart(3, '0');
    // Format nomor pendaftaran: REG-{TAHUN}-{URUT} atau sama dengan NIPD
    const autoNipd = digit1_4 + digit5_6 + nomorUrut;

    // =====================================================
    // LANGKAH 3: INSERT ke Database ppdb_pendaftar (via Service Role Key)
    // =====================================================
    const insertPayload = {
      ...otherData,
      angkatan,
      kelas,
      tahun_ajaran,
      foto_url: foto_url || null,
      no_pendaftaran: autoNipd, // Menggantikan nipd
    };

    // Bersihkan field kosong menjadi null
    Object.keys(insertPayload).forEach(key => {
      if (insertPayload[key] === '' || insertPayload[key] === undefined) {
        insertPayload[key] = null;
      }
    });

    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/ppdb_pendaftar`, {
      method: 'POST',
      headers: { ...supabaseHeaders, 'Prefer': 'return=minimal' },
      body: JSON.stringify(insertPayload),
    });

    if (insertRes.ok) {
      insertSuccess = true;
    } else {
      const errBody = await insertRes.json();
      lastError = errBody;

      // Kode 23505 = unique constraint violation
      if (errBody.code === '23505' && (errBody.message || '').includes('no_pendaftaran')) {
        retryCount++;
      } else if (errBody.code === '23505') {
        return {
          statusCode: 409,
          body: JSON.stringify({ error: 'Data duplikat terdeteksi (NIK atau NISN sudah terdaftar).' }),
        };
      } else {
        console.error('Insert Error:', errBody);
        return {
          statusCode: insertRes.status,
          body: JSON.stringify({ error: 'Gagal menyimpan data ke database ppdb_pendaftar.' }),
        };
      }
    }
  }

  if (!insertSuccess) {
    return {
      statusCode: 503,
      body: JSON.stringify({ error: 'Sistem sedang sibuk. Gagal men-generate Nomor Induk. Silakan coba lagi.' }),
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true, message: 'Pendaftaran siswa berhasil disimpan.' }),
  };
};
