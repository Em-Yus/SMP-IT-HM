import { createClient } from '@supabase/supabase-js';

// Pastikan untuk mengganti URL dan KEY dengan yang ada di supabase-config.js lama
// Sebaiknya ini diletakkan di .env sebagai VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ztfnvnbxeobxbqlydvok.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0Zm52bmJ4ZW9ieGJxbHlkdm9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NTcxMTksImV4cCI6MjA5MzEzMzExOX0.8Ppyvj9xE7dd5cd0STGjwT7A51_jfkw__cxj20hHTM4';

export const supabase = createClient(supabaseUrl, supabaseKey);
