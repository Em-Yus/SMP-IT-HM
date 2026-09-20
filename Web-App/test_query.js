import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ztfnvnhxeobxbqlydvok.supabase.co';
// I need the anon key. Let me check the .env file in frontend-react.
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: 'c:/Users/Redmi/Desktop/jos/sekolah-sistem-4/frontend-react/.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  const { data, error } = await supabase
    .from('anggota_ekskul')
    .select('keterangan, ekskul_id, data_ekskul(nama_ekskul, pembina_nama, hari_pelaksanaan, jam_pelaksanaan, tahun_ajaran, semester)')
    .limit(1);
  console.log('Result:', error || data);
}

test();
