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

    // SaaS 비용 절감을 위해 로컬(PC/파일) 폰트는 클라우드(Supabase Storage)에 업로드하지 않습니다.
    // 대신 브라우저의 IndexedDB(로컬)에만 저장되어 해당 PC에서 계속 사용할 수 있습니다.
    if (font.source === 'local') {
      console.log('Local font saved to IndexedDB only (Cloud sync disabled to save storage costs).');
      return; // 로컬 폰트는 여기서 종료 (DB 저장 안 함)
    }

    // 웹 폰트(웹 URL)의 경우 용량을 차지하지 않으므로(단순 텍스트) 메타데이터만 DB에 저장합니다.
    const { error: dbError } = await supabase.from('custom_fonts').insert([{
      id: font.id.includes('font-custom-') ? undefined : font.id, // let db generate UUID if it's new
      user_id: user.id,
      font_family: font.fontFamily || font.name,
      source: font.source,
      web_url: font.webUrl,
      storage_path: null // 스토리지 업로드를 안하므로 null
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

