const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ztfnvnbxeobxbqlydvok.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0Zm52bmJ4ZW9ieGJxbHlkdm9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NTcxMTksImV4cCI6MjA5MzEzMzExOX0.8Ppyvj9xE7dd5cd0STGjwT7A51_jfkw__cxj20hHTM4'
);

function parseTimeToMinutes(t) {
  if (!t) return 0;
  const parts = t.split(':').map(Number);
  return parts[0] * 60 + (parts[1] || 0);
}

function formatMinutes(m) {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

async function run() {
  const { data: guruList } = await supabase.from('data_guru').select('id, nama').limit(3);
  console.log('Testing with gurus:', guruList?.map(g => g.nama));

  const targetGuru = guruList[0];
  console.log(`\nAnalyzing schedule for ${targetGuru.nama} (ID: ${targetGuru.id}):`);

  // Fetch all schedules for this guru
  const { data: schedules } = await supabase
    .from('jadwal_pelajaran')
    .select('*, master_jam(*), data_kelas(nama_kelas), data_mapel(nama_mapel)')
    .eq('guru_id', targetGuru.id);

  console.log(`Total slots: ${schedules?.length}`);

  const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  for (const hari of days) {
    const daySchedules = (schedules || [])
      .filter(s => s.hari === hari && !s.is_istirahat && !s.master_jam?.is_istirahat)
      .sort((a, b) => {
        const uA = a.master_jam?.urutan || 999;
        const uB = b.master_jam?.urutan || 999;
        return uA - uB;
      });

    if (daySchedules.length === 0) continue;

    console.log(`\n--- HARI ${hari.toUpperCase()} ---`);
    console.log('Raw slots:');
    daySchedules.forEach(s => {
      const start = s.master_jam?.waktu_mulai?.substring(0, 5) || s.waktu?.split('-')[0]?.trim();
      const end = s.master_jam?.waktu_selesai?.substring(0, 5) || s.waktu?.split('-')[1]?.trim();
      console.log(`  Jam ${s.master_jam?.nama_jam || s.jam_ke} (${start} - ${end}): ${s.data_mapel?.nama_mapel} di ${s.data_kelas?.nama_kelas}`);
    });

    // Grouping into blocks
    const blocks = [];
    for (const slot of daySchedules) {
      const startStr = (slot.master_jam?.waktu_mulai?.substring(0, 5) || slot.waktu?.split('-')[0]?.trim() || '00:00');
      const endStr = (slot.master_jam?.waktu_selesai?.substring(0, 5) || slot.waktu?.split('-')[1]?.trim() || '00:00');
      const startMin = parseTimeToMinutes(startStr);
      const endMin = parseTimeToMinutes(endStr);
      const kelasId = slot.kelas_id;
      const namaKelas = slot.data_kelas?.nama_kelas || `Kelas ${kelasId}`;
      const namaMapel = slot.data_mapel?.nama_mapel || 'Pelajaran';

      const prevBlock = blocks[blocks.length - 1];
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
        prevBlock.slots.push(slot);
      } else {
        blocks.push({
          kelas_id: kelasId,
          nama_kelas: namaKelas,
          mapelNames: [namaMapel],
          startMin,
          endMin,
          startStr,
          endStr,
          slots: [slot]
        });
      }
    }

    console.log('\nGrouped Teaching Blocks & Reminders:');
    blocks.forEach((b, idx) => {
      const mapelDisplay = b.mapelNames.join(' & ');
      const masukNotifMin = b.startMin - 5;
      const keluarNotifMin = b.endMin - 10;
      console.log(`  Blok #${idx + 1}: ${mapelDisplay} (${b.nama_kelas}) [${b.startStr} - ${b.endStr}]`);
      console.log(`    -> [5 mnt sblm MASUK]:  ${formatMinutes(masukNotifMin)} ("🔔 Masuk ${b.nama_kelas}: ${mapelDisplay} mulai pukul ${b.startStr}")`);
      console.log(`    -> [10 mnt sblm KELUAR]: ${formatMinutes(keluarNotifMin)} ("⏳ Selesai ${b.nama_kelas}: ${mapelDisplay} selesai pukul ${b.endStr}")`);
    });
  }

  // Check Istirahat slots
  console.log('\n--- ISTIRAHAT SLOTS (Global) ---');
  const { data: masterJam } = await supabase.from('master_jam').select('*').order('urutan');
  const istirahatList = (masterJam || []).filter(m => m.is_istirahat);
  istirahatList.forEach(m => {
    const sStr = m.waktu_mulai.substring(0, 5);
    const eStr = m.waktu_selesai.substring(0, 5);
    const sMin = parseTimeToMinutes(sStr);
    const eMin = parseTimeToMinutes(eStr);
    console.log(`  ${m.nama_jam} (${sStr} - ${eStr})`);
    console.log(`    -> [5 mnt sblm ISTIRAHAT]:   ${formatMinutes(sMin - 5)} ("☕ ${m.nama_jam} dimulai pukul ${sStr}")`);
    console.log(`    -> [5 mnt terakhir ISTIRAHAT]: ${formatMinutes(eMin - 5)} ("⏰ ${m.nama_jam} berakhir pukul ${eStr}, persiapan kembali ke kelas")`);
  });
}

run();
