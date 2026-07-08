import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://ztfnvnbxeobxbqlydvok.supabase.co';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0Zm52bmJ4ZW9ieGJxbHlkdm9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NTcxMTksImV4cCI6MjA5MzEzMzExOX0.8Ppyvj9xE7dd5cd0STGjwT7A51_jfkw__cxj20hHTM4';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
