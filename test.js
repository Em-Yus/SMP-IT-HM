const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ztfnvnbxeobxbqlydvok.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0Zm52bmJ4ZW9ieGJxbHlkdm9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NTcxMTksImV4cCI6MjA5MzEzMzExOX0.8Ppyvj9xE7dd5cd0STGjwT7A51_jfkw__cxj20hHTM4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.from('prestasi_siswa').select('*').limit(1);
  if (error) {
    console.log("Error prestasi_siswa:", error.message);
    const { data: d2, error: e2 } = await supabase.from('prestasi-siswa').select('*').limit(1);
    if (e2) {
      console.log("Error prestasi-siswa:", e2.message);
    } else {
      console.log("prestasi-siswa columns (if data exists):", Object.keys(d2[0] || {}));
      console.log(d2);
    }
  } else {
    console.log("prestasi_siswa columns (if data exists):", Object.keys(data[0] || {}));
    console.log(data);
  }
}

test();
