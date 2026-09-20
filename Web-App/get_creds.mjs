import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ztfnvnbxeobxbqlydvok.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0Zm52bmJ4ZW9ieGJxbHlkdm9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NTcxMTksImV4cCI6MjA5MzEzMzExOX0.8Ppyvj9xE7dd5cd0STGjwT7A51_jfkw__cxj20hHTM4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function getCredentials() {
  const { data, error } = await supabase.from('data_guru').select('username, password').limit(1);
  if (error) {
    console.error('Error fetching data:', error);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

getCredentials();
