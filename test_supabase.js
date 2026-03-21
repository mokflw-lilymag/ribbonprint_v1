import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rzyppdqawepbsjmtjvuo.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6eXBwZHFhd2VwYnNqbXRqdnVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NDYzOTksImV4cCI6MjA4OTUyMjM5OX0.RYcyWC6t3Vwt0408TZ0bnM_x_w8J5LFLX-cieDi8GfM';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  console.log('Testing Supabase connection...');
  const { data, error } = await supabase.from('saved_configs').select('*').limit(1);
  if (error) {
    console.error('Supabase ERROR:', error.message);
  } else {
    console.log('Supabase SUCCESS! Found data:', data);
  }
}

test();
