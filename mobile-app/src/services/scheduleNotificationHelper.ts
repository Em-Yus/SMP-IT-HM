import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '../../services/supabaseClient';

export const JADWAL_CHANNEL_ID = 'jadwal-kbm-channel';
export const PENGUMUMAN_CHANNEL_ID = 'pengumuman-channel';

const HARI_LIST = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] as const;

/**
 * Konfigurasi Notification Handler agar notifikasi selalu muncul
 * dalam bentuk banner/alert dan bersuara meskipun aplikasi sedang aktif (foreground).
 */
export const configureForegroundNotificationHandler = () => {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch (e) {
    console.warn('Gagal mengatur notification handler:', e);
  }
};

/**
 * Inisialisasi Android Notification Channel untuk pengingat jadwal KBM, Istirahat, dan Pengumuman.
 * Wajib diset di Android 8.0+ (API 26+) dengan importance MAX agar banner & suara muncul.
 */
export const initNotificationChannel = async (): Promise<void> => {
  if (Platform.OS === 'android') {
    try {
      // 1. Channel Pengingat Jadwal
      await Notifications.setNotificationChannelAsync(JADWAL_CHANNEL_ID, {
        name: 'Pengingat Jadwal KBM & Istirahat',
        description: 'Notifikasi otomatis 5 menit sebelum masuk kelas, 10 menit sebelum keluar, dan pengingat waktu istirahat.',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 300, 200, 300],
        lightColor: '#2a2c87',
        sound: 'default',
        enableVibrate: true,
        enableLights: true,
      });

      // 2. Channel Pengumuman Sekolah
      await Notifications.setNotificationChannelAsync(PENGUMUMAN_CHANNEL_ID, {
        name: 'Pengumuman Sekolah',
        description: 'Broadcast pengumuman resmi dan informasi penting dari sekolah.',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#85c226',
        sound: 'default',
        enableVibrate: true,
        enableLights: true,
      });

      console.log('✅ Android Notification Channels initialized:', JADWAL_CHANNEL_ID, PENGUMUMAN_CHANNEL_ID);
    } catch (err) {
      console.warn('Gagal inisialisasi channel notifikasi Android:', err);
    }
  }
};

/**
 * Meminta izin notifikasi kepada pengguna (terutama Android 13+).
 */
export const requestNotificationPermissions = async (): Promise<boolean> => {
  try {
    await initNotificationChannel();
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    const isGranted = finalStatus === 'granted';
    console.log('🔔 Status Izin Notifikasi:', finalStatus);
    return isGranted;
  } catch (err) {
    console.warn('Error saat meminta izin notifikasi:', err);
    return false;
  }
};

/**
 * Helper mengonversi string format 'HH:MM' ke total menit dari tengah malam.
 */
function parseTimeToMinutes(timeStr?: string | null): number {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(':').map(Number);
  return (parts[0] || 0) * 60 + (parts[1] || 0);
}

interface TeachingBlock {
  hari: string;
  kelas_id: number;
  nama_kelas: string;
  mapelNames: string[];
  startMin: number;
  endMin: number;
  startStr: string;
  endStr: string;
}

interface IstirahatSlot {
  nama_jam: string;
  startMin: number;
  endMin: number;
  startStr: string;
  endStr: string;
  isDzuhurOrSholat: boolean;
}

/**
 * Batalkan semua notifikasi pengingat jadwal yang sebelumnya telah dijadwalkan
 * agar tidak terjadi duplikasi notifikasi.
 */
export const cancelExistingScheduleNotifications = async (): Promise<void> => {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notif of scheduled) {
      const data = notif.content.data as any;
      if (data?.type === 'jadwal_reminder') {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
      }
    }
  } catch (e) {
    console.warn('Gagal membatalkan notifikasi jadwal lama:', e);
  }
};

/**
 * Menjadwalkan pengingat KBM & Istirahat untuk Guru:
 * 1. 5 menit sebelum masuk kelas (untuk setiap awal blok pembelajaran).
 * 2. 10 menit sebelum keluar kelas (untuk setiap akhir blok pembelajaran).
 * 3. 5 menit sebelum istirahat dimulai.
 * 4. 5 menit terakhir sebelum istirahat berakhir.
 *
 * Dijadwalkan untuk 7 hari ke depan (Senin - Sabtu).
 */
export const scheduleGuruReminders = async (guruId: number | string): Promise<number> => {
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.warn('Izin notifikasi tidak diberikan oleh pengguna.');
      return 0;
    }

    // 1. Ambil data jadwal mengajar guru
    const { data: scheduleData, error: errSch } = await supabase
      .from('jadwal_pelajaran')
      .select('*, master_jam(*), data_kelas(nama_kelas), data_mapel(nama_mapel)')
      .eq('guru_id', guruId);

    if (errSch) throw errSch;

    // 2. Ambil master jam untuk slot istirahat
    const { data: masterJamData } = await supabase
      .from('master_jam')
      .select('*')
      .order('urutan', { ascending: true });

    // Filter slot istirahat (Istirahat, Sholat Dzuhur)
    const istirahatSlots: IstirahatSlot[] = (masterJamData || [])
      .filter((m: any) => {
        if (!m.is_istirahat) return false;
        const lower = (m.nama_jam || '').toLowerCase();
        return lower.includes('istirahat') || lower.includes('dzuhur') || lower.includes('dhuhur') || lower.includes('sholat');
      })
      .map((m: any) => {
        const sStr = (m.waktu_mulai || '').substring(0, 5);
        const eStr = (m.waktu_selesai || '').substring(0, 5);
        const lower = (m.nama_jam || '').toLowerCase();
        return {
          nama_jam: m.nama_jam || 'Istirahat',
          startMin: parseTimeToMinutes(sStr),
          endMin: parseTimeToMinutes(eStr),
          startStr: sStr,
          endStr: eStr,
          isDzuhurOrSholat: lower.includes('dzuhur') || lower.includes('dhuhur') || lower.includes('sholat'),
        };
      });

    // 3. Batalkan notifikasi jadwal sebelumnya
    await cancelExistingScheduleNotifications();

    const now = new Date();
    let scheduledCount = 0;

    // 4. Jadwalkan untuk rentang 7 hari ke depan
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset);
      const dayIndex = targetDate.getDay();
      const dayName = HARI_LIST[dayIndex];

      // Lewati hari Minggu
      if (dayName === 'Minggu') continue;

      // Filter jadwal mengajar guru pada hari ini yang bukan istirahat
      const daySchedules = (scheduleData || [])
        .filter((s: any) => s.hari === dayName && !s.is_istirahat && !s.master_jam?.is_istirahat)
        .sort((a: any, b: any) => {
          const uA = Number(a.master_jam?.urutan) || Number(a.jam_ke) || 999;
          const uB = Number(b.master_jam?.urutan) || Number(b.jam_ke) || 999;
          return uA - uB;
        });

      // Kelompokkan JP yang berurutan di kelas yang sama menjadi "Blok Pembelajaran"
      const blocks: TeachingBlock[] = [];
      for (const slot of daySchedules) {
        const startStr = (slot.master_jam?.waktu_mulai?.substring(0, 5) || slot.waktu?.split('-')[0]?.trim() || '00:00');
        const endStr = (slot.master_jam?.waktu_selesai?.substring(0, 5) || slot.waktu?.split('-')[1]?.trim() || '00:00');
        const startMin = parseTimeToMinutes(startStr);
        const endMin = parseTimeToMinutes(endStr);
        const kelasId = slot.kelas_id;
        const namaKelas = slot.data_kelas?.nama_kelas || `Kelas ${kelasId}`;
        const namaMapel = slot.data_mapel?.nama_mapel || 'Pelajaran';

        const prevBlock = blocks[blocks.length - 1];
        // Jika kelas sama dan jam selesai blok sebelumnya persis menyambung ke jam mulai slot ini
        if (
          prevBlock &&
          prevBlock.kelas_id === kelasId &&
          prevBlock.endMin === startMin
        ) {
          prevBlock.endMin = endMin;
          prevBlock.endStr = endStr;
          if (!prevBlock.mapelNames.includes(namaMapel)) {
            prevBlock.mapelNames.push(namaMapel);
          }
        } else {
          blocks.push({
            hari: dayName,
            kelas_id: kelasId,
            nama_kelas: namaKelas,
            mapelNames: [namaMapel],
            startMin,
            endMin,
            startStr,
            endStr,
          });
        }
      }

      // A. Jadwalkan Pengingat Blok Pembelajaran (Masuk & Keluar)
      for (const block of blocks) {
        const mapelLabel = block.mapelNames.join(' & ');

        // 1. Notifikasi 5 menit sebelum MASUK kelas
        const masukTriggerDate = new Date(
          targetDate.getFullYear(),
          targetDate.getMonth(),
          targetDate.getDate(),
          Math.floor((block.startMin - 5) / 60),
          (block.startMin - 5) % 60,
          0
        );

        if (masukTriggerDate.getTime() > now.getTime()) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: `🔔 Masuk Kelas: ${mapelLabel}`,
              body: `Pembelajaran di ${block.nama_kelas} akan dimulai 5 menit lagi (pukul ${block.startStr}). Silakan bersiap menuju kelas.`,
              sound: 'default',
              priority: Notifications.AndroidNotificationPriority.MAX,
              data: { type: 'jadwal_reminder', route: '/(guru-tabs)/jadwal', blockType: 'masuk' },
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: masukTriggerDate.getTime(),
              channelId: JADWAL_CHANNEL_ID,
            } as any,
          });
          scheduledCount++;
        }

        // 2. Notifikasi 10 menit sebelum KELUAR kelas
        const keluarTriggerDate = new Date(
          targetDate.getFullYear(),
          targetDate.getMonth(),
          targetDate.getDate(),
          Math.floor((block.endMin - 10) / 60),
          (block.endMin - 10) % 60,
          0
        );

        // Hanya jadwalkan jika waktu keluar notifikasi di masa depan dan setelah waktu mulai
        if (keluarTriggerDate.getTime() > now.getTime() && block.endMin - 10 > block.startMin) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: `⏳ Waktu Mengajar: ${block.nama_kelas}`,
              body: `Pembelajaran ${mapelLabel} tersisa 10 menit (selesai pukul ${block.endStr}). Persiapan mengakhiri sesi kelas.`,
              sound: 'default',
              priority: Notifications.AndroidNotificationPriority.MAX,
              data: { type: 'jadwal_reminder', route: '/(guru-tabs)/jadwal', blockType: 'keluar' },
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: keluarTriggerDate.getTime(),
              channelId: JADWAL_CHANNEL_ID,
            } as any,
          });
          scheduledCount++;
        }
      }

      // B. Jadwalkan Pengingat Istirahat & Sholat
      for (const slot of istirahatSlots) {
        const icon = slot.isDzuhurOrSholat ? '🕌' : '☕';

        // 1. Notifikasi 5 menit sebelum istirahat dimulai
        const istirahatStartTrigger = new Date(
          targetDate.getFullYear(),
          targetDate.getMonth(),
          targetDate.getDate(),
          Math.floor((slot.startMin - 5) / 60),
          (slot.startMin - 5) % 60,
          0
        );

        if (istirahatStartTrigger.getTime() > now.getTime()) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: `${icon} Pengingat: ${slot.nama_jam}`,
              body: `Waktu ${slot.nama_jam} akan dimulai dalam 5 menit (pukul ${slot.startStr}).`,
              sound: 'default',
              priority: Notifications.AndroidNotificationPriority.MAX,
              data: { type: 'jadwal_reminder', route: '/(guru-tabs)/jadwal', blockType: 'istirahat_awal' },
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: istirahatStartTrigger.getTime(),
              channelId: JADWAL_CHANNEL_ID,
            } as any,
          });
          scheduledCount++;
        }

        // 2. Notifikasi 5 menit terakhir sebelum istirahat berakhir
        const istirahatEndTrigger = new Date(
          targetDate.getFullYear(),
          targetDate.getMonth(),
          targetDate.getDate(),
          Math.floor((slot.endMin - 5) / 60),
          (slot.endMin - 5) % 60,
          0
        );

        if (istirahatEndTrigger.getTime() > now.getTime()) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: `⏰ Pengingat: ${slot.nama_jam} Segera Berakhir`,
              body: `Waktu ${slot.nama_jam} tersisa 5 menit (selesai pukul ${slot.endStr}). Silakan bersiap untuk kembali ke ruang kelas.`,
              sound: 'default',
              priority: Notifications.AndroidNotificationPriority.MAX,
              data: { type: 'jadwal_reminder', route: '/(guru-tabs)/jadwal', blockType: 'istirahat_akhir' },
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: istirahatEndTrigger.getTime(),
              channelId: JADWAL_CHANNEL_ID,
            } as any,
          });
          scheduledCount++;
        }
      }
    }

    console.log(`✅ Berhasil menjadwalkan ${scheduledCount} pengingat KBM & Istirahat untuk Guru ID ${guruId}.`);
    return scheduledCount;
  } catch (err) {
    console.error('❌ Gagal menjadwalkan pengingat guru:', err);
    return 0;
  }
};

/**
 * Menjadwalkan pengingat KBM & Istirahat untuk Siswa (berdasarkan kelas_id).
 */
export const scheduleSiswaReminders = async (kelasId: number | string): Promise<number> => {
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return 0;

    const { data: scheduleData, error: errSch } = await supabase
      .from('jadwal_pelajaran')
      .select('*, master_jam(*), data_kelas(nama_kelas), data_mapel(nama_mapel)')
      .eq('kelas_id', kelasId);

    if (errSch) throw errSch;

    const { data: masterJamData } = await supabase
      .from('master_jam')
      .select('*')
      .order('urutan', { ascending: true });

    const istirahatSlots: IstirahatSlot[] = (masterJamData || [])
      .filter((m: any) => {
        if (!m.is_istirahat) return false;
        const lower = (m.nama_jam || '').toLowerCase();
        return lower.includes('istirahat') || lower.includes('dzuhur') || lower.includes('dhuhur') || lower.includes('sholat');
      })
      .map((m: any) => {
        const sStr = (m.waktu_mulai || '').substring(0, 5);
        const eStr = (m.waktu_selesai || '').substring(0, 5);
        const lower = (m.nama_jam || '').toLowerCase();
        return {
          nama_jam: m.nama_jam || 'Istirahat',
          startMin: parseTimeToMinutes(sStr),
          endMin: parseTimeToMinutes(eStr),
          startStr: sStr,
          endStr: eStr,
          isDzuhurOrSholat: lower.includes('dzuhur') || lower.includes('dhuhur') || lower.includes('sholat'),
        };
      });

    await cancelExistingScheduleNotifications();

    const now = new Date();
    let scheduledCount = 0;

    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset);
      const dayIndex = targetDate.getDay();
      const dayName = HARI_LIST[dayIndex];

      if (dayName === 'Minggu') continue;

      const daySchedules = (scheduleData || [])
        .filter((s: any) => s.hari === dayName && !s.is_istirahat && !s.master_jam?.is_istirahat)
        .sort((a: any, b: any) => {
          const uA = Number(a.master_jam?.urutan) || Number(a.jam_ke) || 999;
          const uB = Number(b.master_jam?.urutan) || Number(b.jam_ke) || 999;
          return uA - uB;
        });

      const blocks: TeachingBlock[] = [];
      for (const slot of daySchedules) {
        const startStr = (slot.master_jam?.waktu_mulai?.substring(0, 5) || slot.waktu?.split('-')[0]?.trim() || '00:00');
        const endStr = (slot.master_jam?.waktu_selesai?.substring(0, 5) || slot.waktu?.split('-')[1]?.trim() || '00:00');
        const startMin = parseTimeToMinutes(startStr);
        const endMin = parseTimeToMinutes(endStr);
        const namaKelas = slot.data_kelas?.nama_kelas || `Kelas`;
        const namaMapel = slot.data_mapel?.nama_mapel || 'Pelajaran';

        const prevBlock = blocks[blocks.length - 1];
        if (
          prevBlock &&
          prevBlock.mapelNames[0] === namaMapel &&
          prevBlock.endMin === startMin
        ) {
          prevBlock.endMin = endMin;
          prevBlock.endStr = endStr;
        } else {
          blocks.push({
            hari: dayName,
            kelas_id: Number(kelasId),
            nama_kelas: namaKelas,
            mapelNames: [namaMapel],
            startMin,
            endMin,
            startStr,
            endStr,
          });
        }
      }

      // A. Blok Pembelajaran Siswa
      for (const block of blocks) {
        const mapelLabel = block.mapelNames.join(' & ');

        // 5 Menit Sebelum Pelajaran Dimulai
        const masukTriggerDate = new Date(
          targetDate.getFullYear(),
          targetDate.getMonth(),
          targetDate.getDate(),
          Math.floor((block.startMin - 5) / 60),
          (block.startMin - 5) % 60,
          0
        );

        if (masukTriggerDate.getTime() > now.getTime()) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: `🔔 Pelajaran Dimulai: ${mapelLabel}`,
              body: `Mata pelajaran ${mapelLabel} akan dimulai dalam 5 menit (pukul ${block.startStr}). Siapkan buku & perlengkapan Anda.`,
              sound: 'default',
              priority: Notifications.AndroidNotificationPriority.MAX,
              data: { type: 'jadwal_reminder', route: '/(tabs)/jadwal', blockType: 'masuk' },
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: masukTriggerDate.getTime(),
              channelId: JADWAL_CHANNEL_ID,
            } as any,
          });
          scheduledCount++;
        }

        // 10 Menit Sebelum Pelajaran Selesai
        const keluarTriggerDate = new Date(
          targetDate.getFullYear(),
          targetDate.getMonth(),
          targetDate.getDate(),
          Math.floor((block.endMin - 10) / 60),
          (block.endMin - 10) % 60,
          0
        );

        if (keluarTriggerDate.getTime() > now.getTime() && block.endMin - 10 > block.startMin) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: `⏳ Waktu Pelajaran: ${mapelLabel}`,
              body: `Pelajaran ${mapelLabel} tersisa 10 menit (selesai pukul ${block.endStr}).`,
              sound: 'default',
              priority: Notifications.AndroidNotificationPriority.MAX,
              data: { type: 'jadwal_reminder', route: '/(tabs)/jadwal', blockType: 'keluar' },
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: keluarTriggerDate.getTime(),
              channelId: JADWAL_CHANNEL_ID,
            } as any,
          });
          scheduledCount++;
        }
      }

      // B. Istirahat Siswa
      for (const slot of istirahatSlots) {
        const icon = slot.isDzuhurOrSholat ? '🕌' : '☕';

        const istirahatStartTrigger = new Date(
          targetDate.getFullYear(),
          targetDate.getMonth(),
          targetDate.getDate(),
          Math.floor((slot.startMin - 5) / 60),
          (slot.startMin - 5) % 60,
          0
        );

        if (istirahatStartTrigger.getTime() > now.getTime()) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: `${icon} Pengingat: ${slot.nama_jam}`,
              body: `Waktu ${slot.nama_jam} akan dimulai dalam 5 menit (pukul ${slot.startStr}).`,
              sound: 'default',
              priority: Notifications.AndroidNotificationPriority.MAX,
              data: { type: 'jadwal_reminder', route: '/(tabs)/jadwal', blockType: 'istirahat_awal' },
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: istirahatStartTrigger.getTime(),
              channelId: JADWAL_CHANNEL_ID,
            } as any,
          });
          scheduledCount++;
        }

        const istirahatEndTrigger = new Date(
          targetDate.getFullYear(),
          targetDate.getMonth(),
          targetDate.getDate(),
          Math.floor((slot.endMin - 5) / 60),
          (slot.endMin - 5) % 60,
          0
        );

        if (istirahatEndTrigger.getTime() > now.getTime()) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: `⏰ Pengingat: ${slot.nama_jam} Segera Berakhir`,
              body: `Waktu ${slot.nama_jam} tersisa 5 menit (selesai pukul ${slot.endStr}). Silakan bersiap masuk ke ruang kelas.`,
              sound: 'default',
              priority: Notifications.AndroidNotificationPriority.MAX,
              data: { type: 'jadwal_reminder', route: '/(tabs)/jadwal', blockType: 'istirahat_akhir' },
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: istirahatEndTrigger.getTime(),
              channelId: JADWAL_CHANNEL_ID,
            } as any,
          });
          scheduledCount++;
        }
      }
    }

    console.log(`✅ Berhasil menjadwalkan ${scheduledCount} pengingat KBM & Istirahat untuk Siswa Kelas ID ${kelasId}.`);
    return scheduledCount;
  } catch (err) {
    console.error('❌ Gagal menjadwalkan pengingat siswa:', err);
    return 0;
  }
};
