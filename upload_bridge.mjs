import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const SUPABASE_URL = 'https://rzyppdqawepbsjmtjvuo.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6eXBwZHFhd2VwYnNqbXRqdnVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NDYzOTksImV4cCI6MjA4OTUyMjM5OX0.RYcyWC6t3Vwt0408TZ0bnM_x_w8J5LFLX-cieDi8GfM'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function uploadFile() {
  const filePath = path.resolve('RibbonBridge_v15_6.zip')
  const fileBuffer = fs.readFileSync(filePath)
  
  console.log('Uploading RibbonBridge_v15_6.zip to assets bucket...')
  
  const { data, error } = await supabase.storage
    .from('assets')
    .upload('RibbonBridge_v15_6.zip', fileBuffer, {
      contentType: 'application/zip',
      upsert: true
    })

  if (error) {
    console.error('Upload Error:', error.message)
    process.exit(1)
  }
  
  console.log('Upload successful! Path:', data.path)
}

uploadFile()
