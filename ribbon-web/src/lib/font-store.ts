import { supabase } from './supabase';

export interface CustomFontInfo {
  id: string; // matches CSS class name or serial ID
  name: string;
  source: 'web' | 'local';
  webUrl?: string; 
  fontFamily?: string; 
  blob?: Blob | File; // For local fonts
  storagePath?: string; // Supabase Storage path
}

// IndexedDB setup
const DB_NAME = 'RibbonFontsDB';
const STORE_NAME = 'localFonts';

export const initDB = () => {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2); // Increased version for schema updates if needed
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// --- Cloud Sync ---

export const saveCustomFontToDB = async (font: CustomFontInfo) => {
  // 1. Save to IndexedDB (Local Cache)
  const db = await initDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(font);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  // 2. Sync to Supabase (Cloud Storage & Metadata)
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let storagePath = '';
    if (font.source === 'local' && font.blob) {
      const fileName = `${user.id}/${font.id}_${font.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.ttf`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('user-assets')
        .upload(fileName, font.blob, { upsert: true });
      
      if (uploadError) throw uploadError;
      storagePath = uploadData.path;
    }

    const { error: dbError } = await supabase.from('custom_fonts').insert([{
      id: font.id.includes('font-custom-') ? undefined : font.id, // let db generate UUID if it's new
      user_id: user.id,
      font_family: font.fontFamily || font.name,
      source: font.source,
      web_url: font.webUrl,
      storage_path: storagePath
    }]);

    if (dbError) throw dbError;
  } catch (err) {
    console.error('SaaS Sync Error (Font):', err);
    // Continue anyway as it's saved locally
  }
};

export const getAllCustomFonts = async (): Promise<CustomFontInfo[]> => {
  // 1. Load from IndexedDB first (Fast)
  const db = await initDB();
  let localFonts: CustomFontInfo[] = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  // 2. Fetch from Cloud and Merge/Cache
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: cloudFonts } = await supabase
        .from('custom_fonts')
        .select('*')
        .eq('user_id', user.id);

      if (cloudFonts && cloudFonts.length > 0) {
        // Find fonts in cloud not in local cache
        for (const cf of cloudFonts) {
          if (!localFonts.find(lf => lf.id === cf.id)) {
             // Download if local file
             let blob: Blob | undefined = undefined;
             if (cf.source === 'local' && cf.storage_path) {
                const { data } = await supabase.storage.from('user-assets').download(cf.storage_path);
                if (data) blob = data;
             }

             const newFont: CustomFontInfo = {
               id: cf.id,
               name: cf.font_family,
               source: cf.source,
               webUrl: cf.web_url,
               fontFamily: cf.font_family,
               blob,
               storagePath: cf.storage_path
             };

             // Cache it locally
             const tx = db.transaction(STORE_NAME, 'readwrite');
             tx.objectStore(STORE_NAME).put(newFont);
             localFonts.push(newFont);
          }
        }
      }
    }
  } catch (err) {
    console.error('Cloud load error:', err);
  }

  return localFonts;
};

export const deleteCustomFontFromDB = async (id: string) => {
  // 1. Delete from local
  const db = await initDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  // 2. Delete from Cloud
  try {
    // We should also delete from storage if it exists, 
    // but typically we'll rely on the DB cascade or just leave the file for now.
    await supabase.from('custom_fonts').delete().eq('id', id);
  } catch (err) {
    console.error('Delete cloud error:', err);
  }
};

export const getHiddenFonts = (): string[] => {
  try {
    const hidden = localStorage.getItem('hiddenFonts');
    if (hidden) return JSON.parse(hidden);
  } catch (e) {
    console.error(e);
  }
  return [];
};

export const setHiddenFonts = (ids: string[]) => {
  localStorage.setItem('hiddenFonts', JSON.stringify(ids));
};

