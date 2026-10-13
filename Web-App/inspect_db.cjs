const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ztfnvnbxeobxbqlydvok.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0Zm52bmJ4ZW9ieGJxbHlkdm9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NTcxMTksImV4cCI6MjA5MzEzMzExOX0.8Ppyvj9xE7dd5cd0STGjwT7A51_jfkw__cxj20hHTM4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  const { data: cols } = await supabase.from('cbt_peserta_ruang').select('*').limit(1);
  console.log('Sample row cbt_peserta_ruang:', cols);

  // Check all jadwals
  const { data: jadwals } = await supabase.from('cbt_jadwal_ujian').select('id, nama_ujian, kelas_id, mode_ruang');
  console.log('All jadwals:', jadwals);
}

inspect();
