const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const content = fs.readFileSync('Web-App/src/services/supabaseClient.js', 'utf8');
const urlMatch = content.match(/const supabaseUrl = ['"]([^'"]+)['"]/);
const keyMatch = content.match(/const supabaseAnonKey = ['"]([^'"]+)['"]/);

const supabase = createClient(urlMatch[1], keyMatch[1]);

async function check() {
  const { data: jadwal } = await supabase.from('cbt_jadwal_ujian').select('id, judul, nama_ujian, kelas_id, data_kelas(nama_kelas), mode_ruang').eq('id', 11);
  console.log('JADWAL 11:', JSON.stringify(jadwal, null, 2));

  const { data: pr11, count: c11 } = await supabase.from('cbt_peserta_ruang').select('*', { count: 'exact' }).eq('jadwal_id', 11);
  console.log('cbt_peserta_ruang for jadwal 11 count:', c11);
  if (pr11 && pr11.length > 0) {
    const byRuang = {};
    pr11.forEach(p => byRuang[p.ruang_id] = (byRuang[p.ruang_id] || 0) + 1);
    console.log('PR11 by ruang:', byRuang);
  }

  const { data: allPR } = await supabase.from('cbt_peserta_ruang').select('jadwal_id, ruang_id, siswa_id');
  console.log('Total cbt_peserta_ruang rows:', allPR ? allPR.length : 0);
  const jMap = {};
  (allPR || []).forEach(p => {
    jMap[p.jadwal_id] = (jMap[p.jadwal_id] || 0) + 1;
  });
  console.log('Counts per jadwal_id in cbt_peserta_ruang:', jMap);

  const { data: ruangList } = await supabase.from('data_ruang').select('id, nama_ruang');
  console.log('Ruang list:', ruangList);
}

check();
