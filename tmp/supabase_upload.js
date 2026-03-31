
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://rzyppdqawepbsjmtjvuo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6eXBwZHFhd2VwYnNqbXRqdnVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NDYzOTksImV4cCI6MjA4OTUyMjM5OX0.RYcyWC6t3Vwt0408TZ0bnM_x_w8J5LFLX-cieDi8GfM';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function uploadFile() {
  const filePath = 'd:/mapp/ribboneprintnew/ribbon-web/public/RibbonBridge_Setup_v25_0.exe';
  const fileName = 'RibbonBridge_Setup_v25_0.exe';
  
  const fileBuffer = fs.readFileSync(filePath);
  
  console.log(`[Bucket] Checking for 'installers' bucket...`);
  const { data: buckets, error: bErr } = await supabase.storage.listBuckets();
  if (!buckets.find(b => b.name === 'installers')) {
    console.log('[Bucket] Creating "installers" bucket...');
    const { error: cErr } = await supabase.storage.createBucket('installers', {
        public: true
    });
    if (cErr) {
        console.error('[Error] Bucket creation failed:', cErr.message);
        // If it already exists or something else, try to proceed
    }
  }

  console.log(`[Upload] Uploading ${fileName} to 'installers' bucket...`);
  const { data, error } = await supabase.storage
    .from('installers')
    .upload(fileName, fileBuffer, {
      contentType: 'application/x-msdownload',
      upsert: true
    });
    
  if (error) {
    console.error('[Error] Upload failed:', error.message);
  } else {
    console.log('[Success] File uploaded successfully!', data);
    const { data: { publicUrl } } = supabase.storage
        .from('installers')
        .getPublicUrl(fileName);
    console.log('[URL] Download Link:', publicUrl);
  }
}

uploadFile();
