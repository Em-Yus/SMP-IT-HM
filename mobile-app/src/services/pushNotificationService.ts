import { supabase } from '../../services/supabaseClient';

export interface SendAnnouncementPushParams {
  judul: string;
  isi: string;
  target?: 'Semua' | 'Guru' | 'Siswa' | string;
}

export interface PushResult {
  success: boolean;
  sentCount?: number;
  failedCount?: number;
  totalCount?: number;
  errors?: string[];
  error?: string;
}

const sendExpoChunk = async (messages: any[]): Promise<any> => {
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
};

const sendMessagesWithProjectHandling = async (messages: any[]) => {
  if (!messages || messages.length === 0) {
    return { successCount: 0, failedCount: 0, errors: [] as string[] };
  }

  // 1. Coba kirim batch
  const initialResult = await sendExpoChunk(messages);

  // 2. Cek apakah Expo mengembalikan error PUSH_TOO_MANY_EXPERIENCE_IDS
  const tooManyExpError = initialResult.errors?.find(
    (e: any) => e.code === 'PUSH_TOO_MANY_EXPERIENCE_IDS'
  );

  if (tooManyExpError && tooManyExpError.details) {
    console.warn('⚠️ Multi-experience IDs terdeteksi. Memecah pengiriman per project Expo...');
    const details = tooManyExpError.details as Record<string, string[]>;
    const messageByToken = new Map<string, any>();
    messages.forEach((m) => messageByToken.set(m.to, m));

    let totalSuccess = 0;
    let totalFailed = 0;
    const errors: string[] = [];

    for (const [project, tokens] of Object.entries(details)) {
      const projectMessages = tokens
        .map((tok) => messageByToken.get(tok))
        .filter(Boolean);

      const chunkSize = 100;
      for (let i = 0; i < projectMessages.length; i += chunkSize) {
        const chunk = projectMessages.slice(i, i + chunkSize);
        try {
          const res = await sendExpoChunk(chunk);
          if (res.data) {
            res.data.forEach((ticket: any) => {
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
            res.errors.forEach((err: any) => {
              if (!errors.includes(err.message)) {
                errors.push(`[${project}] ${err.message}`);
              }
            });
          }
        } catch (err: any) {
          totalFailed += chunk.length;
          errors.push(`[${project}] ${err?.message}`);
        }
      }
    }

    return { successCount: totalSuccess, failedCount: totalFailed, errors };
  }

  // 3. Evaluasi tiket jika berhasil diproses satu project
  let totalSuccess = 0;
  let totalFailed = 0;
  const errors: string[] = [];

  if (initialResult.data) {
    initialResult.data.forEach((ticket: any) => {
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
    initialResult.errors.forEach((err: any) => errors.push(err.message));
  }

  return { successCount: totalSuccess, failedCount: totalFailed, errors };
};

/**
 * Mengirim push notification pengumuman ke perangkat terdaftar
 * dengan filter target audiens (Semua, Guru, atau Siswa).
 */
export const sendAnnouncementPushNotification = async ({
  judul,
  isi,
  target = 'Semua',
}: SendAnnouncementPushParams): Promise<PushResult> => {
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
      (t: any) => t.expo_push_token && typeof t.expo_push_token === 'string' && t.expo_push_token.startsWith('ExponentPushToken')
    );

    if (validTokens.length === 0) {
      console.log('Tidak ada token Expo yang valid terdaftar.');
      return { success: true, sentCount: 0, failedCount: 0 };
    }

    // 2. Susun pesan push notification
    const messages = validTokens.map((t: any) => {
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

    // 3. Kirim dengan penanganan auto-split per project
    const { successCount, failedCount, errors } = await sendMessagesWithProjectHandling(messages);

    console.log(
      `Push Notification Result: ${successCount} berhasil, ${failedCount} gagal dari total ${messages.length} perangkat.`
    );

    return {
      success: successCount > 0,
      sentCount: successCount,
      failedCount,
      totalCount: messages.length,
      errors,
    };
  } catch (err: any) {
    console.error('❌ Gagal mengirim push notification pengumuman:', err);
    return { success: false, sentCount: 0, failedCount: 0, error: err?.message || 'Terjadi kesalahan' };
  }
};
