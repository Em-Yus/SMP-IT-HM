import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('data_kelas').select('*').limit(1);
  if (error) {
    console.error("Error fetching data_kelas:", error);
  } else {
    console.log("Columns in data_kelas:", data && data.length > 0 ? Object.keys(data[0]) : "Table is empty");
    console.log("Data:", data);
  }
}
check();
