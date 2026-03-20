---
description: How to finalize Supabase SaaS setup
---

## 1. Create Storage Bucket
1. Go to [Supabase Dashboard](https://supabase.com).
2. Select your project.
3. Go to **Storage** menu.
4. Click **New Bucket**.
5. Name it `user-assets`.
6. Set to **Private** (recommended) or Public based on your needs.
7. Click **Create Bucket**.

## 2. Set Up Storage RLS Policies
To allow users to upload their own fonts and images, run this SQL in the **SQL Editor**:

```sql
-- Allow users to upload to their own folder
CREATE POLICY "Allow users to upload files to their own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'user-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow users to read their own files
CREATE POLICY "Allow users to read their own files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'user-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow users to delete their own files
CREATE POLICY "Allow users to delete their own files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'user-assets' AND (storage.foldername(name))[1] = auth.uid()::text);
```

## 3. Register First Admin
To access the **Admin Dashboard**, you need to set your account's role to `admin`:

1. Sign up/Login to the app once.
2. Go to **SQL Editor** in Supabase.
3. Run:
```sql
UPDATE profiles SET role = 'admin' WHERE email = 'your-email@example.com';
```
4. Refresh the app, and you will see the 🛡️ (Shield) icon in the sidebar.
