import { supabase } from './supabaseClient';

/**
 * Mengirim sekumpulan pesan push notification ke Expo Push API.
 * Mengembalikan hasil respons JSON dari Expo.
 */
const sendExpoChunk = async (messages) => {
  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });
    return await res.json();
  } catch (err) {
    // Fallback jika direct request terhalang (misal proxy lokal)
    const fallbackRes = await fetch('/api/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });
    return await fallbackRes.json();
  }
};

/**
 * Mengirim pesan dengan penanganan otomatis jika terdapat multi-project/Experience ID
 * (Error PUSH_TOO_MANY_EXPERIENCE_IDS dari Expo).
 */
const sendMessagesWithProjectHandling = async (messages) => {
  if (!messages || messages.length === 0) {
    return { successCount: 0, failedCount: 0, errors: [] };
  }

  // 1. Coba kirim batch
  const initialResult = await sendExpoChunk(messages);

  // 2. Cek apakah Expo mengembalikan error PUSH_TOO_MANY_EXPERIENCE_IDS
  const tooManyExpError = initialResult.errors?.find(
    (e) => e.code === 'PUSH_TOO_MANY_EXPERIENCE_IDS'
  );

  if (tooManyExpError && tooManyExpError.details) {
    console.warn(
      '⚠️ Terdeteksi beberapa Expo Experience ID berbeda dalam token perangkat. Memecah pengiriman per project...'
    );

    const details = tooManyExpError.details; // { "@smpithm/mobile-app": [tokens...], ... }
    const messageByToken = new Map();
    messages.forEach((m) => messageByToken.set(m.to, m));

    let totalSuccess = 0;
    let totalFailed = 0;
    const errors = [];

    for (const [project, tokens] of Object.entries(details)) {
      const projectMessages = tokens
        .map((tok) => messageByToken.get(tok))
        .filter(Boolean);

      // Kirim per project dalam chunk maksimal 100
      const chunkSize = 100;
      for (let i = 0; i < projectMessages.length; i += chunkSize) {
        const chunk = projectMessages.slice(i, i + chunkSize);
        try {
          const res = await sendExpoChunk(chunk);
          if (res.data) {
            res.data.forEach((ticket) => {
              if (ticket.status === 'ok') {
                totalSuccess++;
              } else {
                totalFailed++;
                if (ticket.message && !errors.includes(ticket.message)) {
                  errors.push(`[${project}] ${ticket.message}`);
                }
              }
            });
          } else if (res.errors) {
            totalFailed += chunk.length;
            res.errors.forEach((err) => {
              if (!errors.includes(err.message)) {
                errors.push(`[${project}] ${err.message}`);
              }
            });
          }
        } catch (err) {
          totalFailed += chunk.length;
          errors.push(`[${project}] ${err.message}`);
        }
      }
    }

    return { successCount: totalSuccess, failedCount: totalFailed, errors };
  }

  // 3. Jika tidak ada error multiple experience IDs, evaluasi tiket
  let totalSuccess = 0;
  let totalFailed = 0;
  const errors = [];

  if (initialResult.data) {
    initialResult.data.forEach((ticket) => {
      if (ticket.status === 'ok') {
        totalSuccess++;
      } else {
        totalFailed++;
        if (ticket.message && !errors.includes(ticket.message)) {
          errors.push(ticket.message);
        }
      }
    });
  } else if (initialResult.errors) {
    totalFailed = messages.length;
    initialResult.errors.forEach((err) => errors.push(err.message));
  }

  return { successCount: totalSuccess, failedCount: totalFailed, errors };
};

/**
 * Mengirim push notification pengumuman ke seluruh perangkat terdaftar
 * sesuai dengan target audiens (Semua, Guru, atau Siswa).
 */
export const sendAnnouncementPushNotification = async ({ judul, isi, target = 'Semua' }) => {
  try {
    // 1. Ambil token sesuai target audiens
    let query = supabase.from('user_push_tokens').select('nipd, expo_push_token');

    if (target === 'Guru') {
      query = query.like('nipd', 'GURU_%');
    } else if (target === 'Siswa') {
      query = query.not('nipd', 'like', 'GURU_%');
    }

    const { data: tokensData, error } = await query;
    if (error) throw error;

    if (!tokensData || tokensData.length === 0) {
      console.log('Tidak ada token perangkat untuk target:', target);
      return { success: true, sentCount: 0, failedCount: 0 };
    }

    // Filter token Expo yang valid
    const validTokens = tokensData.filter(
      (t) => t.expo_push_token && t.expo_push_token.startsWith('ExponentPushToken')
    );

    if (validTokens.length === 0) {
      console.log('Tidak ada token Expo yang valid.');
      return { success: true, sentCount: 0, failedCount: 0 };
    }

    // 2. Susun payload pesan untuk setiap perangkat
    const messages = validTokens.map((t) => {
      const isGuru = String(t.nipd).startsWith('GURU_');
      return {
        to: t.expo_push_token,
        sound: 'default',
        title: '📢 ' + judul,
        body: isi.length > 120 ? isi.substring(0, 120) + '...' : isi,
        data: {
          route: isGuru ? '/pengumuman' : '/(tabs)/pengumuman',
          type: 'pengumuman',
        },
        channelId: 'pengumuman-channel',
        priority: 'high',
        _displayInForeground: true,
      };
    });

    // 3. Kirim pesan dengan penanganan auto-split per project & verifikasi tiket
    const { successCount, failedCount, errors } = await sendMessagesWithProjectHandling(messages);

    console.log(
      `Push Notification Result: ${successCount} berhasil, ${failedCount} gagal dari total ${messages.length} perangkat.`
    );
    if (errors.length > 0) {
      console.warn('Push Notification Issues:', errors);
    }

    return {
      success: successCount > 0,
      sentCount: successCount,
      failedCount,
      totalCount: messages.length,
      errors,
    };
  } catch (err) {
    console.error('❌ Gagal mengirim push notification:', err);
    return { success: false, sentCount: 0, failedCount: 0, error: err.message };
  }
};
