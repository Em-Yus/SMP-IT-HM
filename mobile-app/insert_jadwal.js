const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ztfnvnbxeobxbqlydvok.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0Zm52bmJ4ZW9ieGJxbHlkdm9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NTcxMTksImV4cCI6MjA5MzEzMzExOX0.8Ppyvj9xE7dd5cd0STGjwT7A51_jfkw__cxj20hHTM4'
);

async function run() {
  const { data: guruData } = await supabase.from('data_guru').select('id, nama');
  const findGuru = (namePrefix) => {
    const f = guruData.find(g => g.nama.toLowerCase().includes(namePrefix.toLowerCase()));
    return f ? f.id : null;
  };

  const guruIds = {
    'Asep Gunawan': findGuru('Asep'),
    'Muhamad Yusuf': findGuru('Yusuf'),
    'Muhammad Yusuf': findGuru('Yusuf'),
    'Nayirotul Mila': findGuru('Nayiro') || findGuru('Mila') || null, // Will log if null
    'Fadlullah': findGuru('Fadlullah'),
    'Syafiatun Nabila': findGuru('Syafiatun'),
    'Arina Maqsurotin Fil Qiam': findGuru('Arina'),
    'Arina M. F.': findGuru('Arina'),
    'Iftiyah': findGuru('Iftiyah'),
    'Abdul Manaf': findGuru('Manaf'),
    'Muhamad Nadiri': findGuru('Nadiri'),
  };
  console.log('Guru IDs:', guruIds);

  const { data: masterJam } = await supabase.from('master_jam_presensi').select('*') || { data: [] };
  // Actually, jadwal_pelajaran uses 'jam_ke'. Wait, 'master_jam_id' might refer to 'master_jam' table, but there is no master_jam. It's 'master_jam_presensi'. Let's just set jam_ke and waktu based on the image!
  // In the image, time slots are:
  const times = {
    1: '08.00 - 08.40',
    2: '08.40 - 09.20',
    3: '09.20 - 10.00',
    4: '10.30 - 11.10',
    5: '11.10 - 11.50',
    6: '11.50 - 12.30',
    7: '12.30 - 13.00'
  };

  const { data: existingJadwal } = await supabase.from('jadwal_pelajaran').select('*').in('hari', ['Rabu', 'Kamis', 'Jumat']);
  if (existingJadwal && existingJadwal.length > 0) {
    console.log('Deleting existing Wednesday-Friday jadwal:', existingJadwal.length);
    await supabase.from('jadwal_pelajaran').delete().in('hari', ['Rabu', 'Kamis', 'Jumat']);
  }

  const mapelIds = {
    'Bahasa Inggris': 9, 'Nahwu 7': 4, 'Akhlaq 7': 2, 'PJOK 7': 14, 'Informatika': 10, 'Matematika': 6, 'IPS': 8, 'SM': 1, // Tahsin
    'PKn': 11, 'Nahwu 8': 4, 'PJOK 8': 14, 'IPA': 7, 'Akhlaq 8': 2,
    'Fiqih': 3, 'SBD dan Praka': 12, 'B. Indonesia': 5, 'PJOK 9a': 14, 'Akhlaq 9a': 2,
    'Nahwu 9b': 4, 'Akhlaq 9b': 2, 'Fiqih 9b': 3, 'PJOK 9b': 14, 'Bahasa Indonesia': 5
  };

  // Helper to construct row
  const makeRow = (hari, kelas_id, jam_ke, mapelName, guruName) => {
    return {
      hari,
      kelas_id,
      jam_ke,
      waktu: times[jam_ke],
      is_istirahat: false,
      mapel_id: mapelIds[mapelName] || null,
      guru_id: guruIds[guruName] || null,
    };
  };

  const payload = [
    // KELAS 7 (id: 2)
    // Rabu
    makeRow('Rabu', 2, 1, 'Bahasa Inggris', 'Asep Gunawan'),
    makeRow('Rabu', 2, 2, 'Bahasa Inggris', 'Asep Gunawan'),
    makeRow('Rabu', 2, 3, 'Bahasa Inggris', 'Asep Gunawan'),
    makeRow('Rabu', 2, 4, 'Nahwu 7', 'Muhamad Yusuf'),
    makeRow('Rabu', 2, 5, 'Nahwu 7', 'Muhamad Yusuf'),
    makeRow('Rabu', 2, 6, 'Akhlaq 7', 'Nayirotul Mila'),
    makeRow('Rabu', 2, 7, 'Akhlaq 7', 'Nayirotul Mila'),
    // Kamis
    makeRow('Kamis', 2, 1, 'PJOK 7', 'Iftiyah'),
    makeRow('Kamis', 2, 2, 'PJOK 7', 'Iftiyah'),
    makeRow('Kamis', 2, 3, 'Informatika', 'Muhamad Yusuf'),
    makeRow('Kamis', 2, 4, 'Informatika', 'Muhamad Yusuf'),
    makeRow('Kamis', 2, 5, 'Informatika', 'Muhamad Yusuf'),
    makeRow('Kamis', 2, 6, 'Matematika', 'Fadlullah'),
    makeRow('Kamis', 2, 7, 'Matematika', 'Fadlullah'),
    // Jumat
    makeRow('Jumat', 2, 1, 'IPS', 'Nayirotul Mila'),
    makeRow('Jumat', 2, 2, 'IPS', 'Nayirotul Mila'),
    makeRow('Jumat', 2, 3, 'SM', 'Abdul Manaf'),
    makeRow('Jumat', 2, 4, 'SM', 'Abdul Manaf'),

    // KELAS 8 (id: 3)
    // Rabu
    makeRow('Rabu', 3, 1, 'IPS', 'Nayirotul Mila'),
    makeRow('Rabu', 3, 2, 'IPS', 'Nayirotul Mila'),
    makeRow('Rabu', 3, 3, 'PKn', 'Syafiatun Nabila'),
    makeRow('Rabu', 3, 4, 'PKn', 'Syafiatun Nabila'),
    makeRow('Rabu', 3, 5, 'Bahasa Inggris', 'Asep Gunawan'),
    makeRow('Rabu', 3, 6, 'Bahasa Inggris', 'Asep Gunawan'),
    makeRow('Rabu', 3, 7, 'Bahasa Inggris', 'Asep Gunawan'),
    // Kamis
    makeRow('Kamis', 3, 1, 'PJOK 8', 'Iftiyah'),
    makeRow('Kamis', 3, 2, 'PJOK 8', 'Iftiyah'),
    makeRow('Kamis', 3, 3, 'Matematika', 'Fadlullah'),
    makeRow('Kamis', 3, 4, 'Matematika', 'Fadlullah'),
    makeRow('Kamis', 3, 5, 'IPA', 'Iftiyah'),
    makeRow('Kamis', 3, 6, 'IPA', 'Iftiyah'),
    makeRow('Kamis', 3, 7, 'IPA', 'Iftiyah'),
    // Jumat
    makeRow('Jumat', 3, 1, 'Nahwu 8', 'Muhamad Yusuf'),
    makeRow('Jumat', 3, 2, 'Nahwu 8', 'Muhamad Yusuf'),
    makeRow('Jumat', 3, 3, 'SM', 'Abdul Manaf'),
    makeRow('Jumat', 3, 4, 'SM', 'Abdul Manaf'),

    // KELAS 9A (id: 10)
    // Rabu
    makeRow('Rabu', 10, 1, 'Informatika', 'Muhamad Yusuf'),
    makeRow('Rabu', 10, 2, 'Informatika', 'Muhamad Yusuf'),
    makeRow('Rabu', 10, 3, 'Informatika', 'Muhamad Yusuf'),
    makeRow('Rabu', 10, 4, 'Fiqih', 'Fadlullah'),
    makeRow('Rabu', 10, 5, 'Fiqih', 'Fadlullah'),
    makeRow('Rabu', 10, 6, 'SBD dan Praka', 'Muhamad Nadiri'),
    makeRow('Rabu', 10, 7, 'SBD dan Praka', 'Muhamad Nadiri'),
    // Kamis
    makeRow('Kamis', 10, 1, 'Matematika', 'Fadlullah'),
    makeRow('Kamis', 10, 2, 'Matematika', 'Fadlullah'),
    makeRow('Kamis', 10, 3, 'IPS', 'Nayirotul Mila'),
    makeRow('Kamis', 10, 4, 'IPS', 'Nayirotul Mila'),
    makeRow('Kamis', 10, 5, 'B. Indonesia', 'Arina Maqsurotin Fil Qiam'),
    makeRow('Kamis', 10, 6, 'B. Indonesia', 'Arina Maqsurotin Fil Qiam'),
    makeRow('Kamis', 10, 7, 'B. Indonesia', 'Arina Maqsurotin Fil Qiam'),
    // Jumat
    makeRow('Jumat', 10, 1, 'PJOK 9a', 'Asep Gunawan'),
    makeRow('Jumat', 10, 2, 'PJOK 9a', 'Asep Gunawan'),
    makeRow('Jumat', 10, 3, 'SM', 'Abdul Manaf'),
    makeRow('Jumat', 10, 4, 'SM', 'Abdul Manaf'),

    // KELAS 9B (id: 11)
    // Rabu
    makeRow('Rabu', 11, 1, 'IPA', 'Iftiyah'),
    makeRow('Rabu', 11, 2, 'IPA', 'Iftiyah'),
    makeRow('Rabu', 11, 3, 'IPA', 'Iftiyah'),
    makeRow('Rabu', 11, 4, 'IPS', 'Nayirotul Mila'),
    makeRow('Rabu', 11, 5, 'IPS', 'Nayirotul Mila'),
    makeRow('Rabu', 11, 6, 'Matematika', 'Fadlullah'),
    makeRow('Rabu', 11, 7, 'Matematika', 'Fadlullah'),
    // Kamis
    makeRow('Kamis', 11, 1, 'B. Indonesia', 'Arina Maqsurotin Fil Qiam'),
    makeRow('Kamis', 11, 2, 'B. Indonesia', 'Arina Maqsurotin Fil Qiam'),
    makeRow('Kamis', 11, 3, 'B. Indonesia', 'Arina Maqsurotin Fil Qiam'),
    makeRow('Kamis', 11, 4, 'SBD dan Praka', 'Muhamad Nadiri'),
    makeRow('Kamis', 11, 5, 'SBD dan Praka', 'Muhamad Nadiri'),
    makeRow('Kamis', 11, 6, 'Nahwu 9b', 'Muhamad Nadiri'), // Wait, is it Muhamad Nadiri? Let me check the image again. Yes, Muhamad Nadiri for Nahwu 9b on Kamis 6 & 7.
    makeRow('Kamis', 11, 7, 'Nahwu 9b', 'Muhamad Nadiri'),
    // Jumat
    makeRow('Jumat', 11, 1, 'PJOK 9a', 'Asep Gunawan'),
    makeRow('Jumat', 11, 2, 'PJOK 9a', 'Asep Gunawan'),
    makeRow('Jumat', 11, 3, 'SM', 'Abdul Manaf'),
    makeRow('Jumat', 11, 4, 'SM', 'Abdul Manaf'),
  ];

  const { error } = await supabase.from('jadwal_pelajaran').insert(payload);
  console.log('Insert error:', error);
  if (!error) console.log('Successfully inserted schedules!');
}
run();
