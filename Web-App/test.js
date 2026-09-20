const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data: siswa } = await supabase.from('data_siswa').select('kelas').limit(5);
  const { data: kelas } = await supabase.from('data_kelas').select('*').limit(5);
  console.log("Siswa:", siswa);
  console.log("Kelas:", kelas);
}
run();
