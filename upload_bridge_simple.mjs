import https from 'https'
import fs from 'fs'

const SUPABASE_URL = 'https://rzyppdqawepbsjmtjvuo.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6eXBwZHFhd2VwYnNqbXRqdnVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NDYzOTksImV4cCI6MjA4OTUyMjM5OX0.RYcyWC6t3Vwt0408TZ0bnM_x_w8J5LFLX-cieDi8GfM'

const fileBuffer = fs.readFileSync('RibbonBridge_Setup_v15.7.exe')

const options = {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/x-msdownload',
    'x-upsert': 'true'
  }
}

console.log('Uploading Setup EXE to Supabase Storage guides/ folder via raw https...')

const req = https.request(`${SUPABASE_URL}/storage/v1/object/assets/guides/RibbonBridge_Setup_v15_7_1.exe`, options, (res) => {
  let body = ''
  res.on('data', (chunk) => body += chunk)
  res.on('end', () => {
    console.log('Response Status:', res.statusCode)
    console.log('Response Body:', body)
  })
})

req.on('error', (e) => console.error(e))
req.write(fileBuffer)
req.end()
