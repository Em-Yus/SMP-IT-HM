const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ztfnvnbxeobxbqlydvok.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0Zm52bmJ4ZW9ieGJxbHlkdm9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NTcxMTksImV4cCI6MjA5MzEzMzExOX0.8Ppyvj9xE7dd5cd0STGjwT7A51_jfkw__cxj20hHTM4'
);

async function check() {
  const { data } = await supabase.from('data_pembelajaran').select('mapel_id').eq('guru_id', 6);
  console.log('Abdul Manaf mapel_id in data_pembelajaran:', data);
  
  // also check SBD dan Praka for Muhamad Nadiri
  const { data: mnData } = await supabase.from('data_pembelajaran').select('mapel_id').eq('guru_id', 9);
  console.log('Muhamad Nadiri mapel_id:', mnData);
}
check();
