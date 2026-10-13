const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ztfnvnbxeobxbqlydvok.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0Zm52bmJ4ZW9ieGJxbHlkdm9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NTcxMTksImV4cCI6MjA5MzEzMzExOX0.8Ppyvj9xE7dd5cd0STGjwT7A51_jfkw__cxj20hHTM4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: pRuangData, error: pErr } = await supabase
    .from('cbt_peserta_ruang')
    .select(`
      id,
      jadwal_id,
      siswa_id,
      ruang_id,
      nomor_meja,
      data_ruang(id, nama_ruang)
    `)
    .eq('jadwal_id', 11);
  console.log('pErr:', pErr);
  console.log('pRuangData length:', pRuangData?.length);
}

check();
