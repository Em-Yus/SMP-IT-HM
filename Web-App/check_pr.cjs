const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ztfnvnbxeobxbqlydvok.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0Zm52bmJ4ZW9ieGJxbHlkdm9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NTcxMTksImV4cCI6MjA5MzEzMzExOX0.8Ppyvj9xE7dd5cd0STGjwT7A51_jfkw__cxj20hHTM4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: jadwal, error: jErr } = await supabase.from('cbt_jadwal_ujian').select('*').eq('id', 11).single();
  console.log('JADWAL 11:', jadwal);
  console.log('jErr:', jErr);

  // Check students in cbt_peserta_ruang for jadwal 11 and ruang 1
  const { data: prRuang1 } = await supabase
    .from('cbt_peserta_ruang')
    .select('siswa_id, ruang_id, data_siswa:data_siswa(id, nama, kelas)')
    .eq('jadwal_id', 11)
    .eq('ruang_id', 1);
  console.log('Peserta di Ruang 1 (jadwal 11):', prRuang1?.length, prRuang1?.slice(0, 5));
}

check();
