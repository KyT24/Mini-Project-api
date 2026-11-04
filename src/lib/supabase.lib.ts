import 'dotenv/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../errors/app.error';

let cachedAdminToken: string | null = null;
let tokenExpiresAt = 0;
let tokenPromise: Promise<string> | null = null;

async function getOrFetchAdminToken(): Promise<string> {
  const now = Date.now();
  if (cachedAdminToken && tokenExpiresAt > now + 60000) {
    return cachedAdminToken;
  }

  if (!tokenPromise) {
    tokenPromise = (async () => {
      try {
        const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
        const anonKey =
          process.env.SUPABASE_ANON_KEY ||
          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
          process.env.SUPABASE_KEY;

        if (!url || !anonKey) return '';

        const authClient = createClient(url, anonKey, { auth: { persistSession: false } });
        const email = process.env.ADMIN_SEED_EMAIL || 'admin@klinik.test';
        const password = process.env.ADMIN_SEED_PASSWORD || 'Admin123!';

        const { data, error } = await authClient.auth.signInWithPassword({
          email,
          password,
        });

        if (!error && data?.session?.access_token) {
          cachedAdminToken = data.session.access_token;
          tokenExpiresAt = Date.now() + (data.session.expires_in || 3600) * 1000;
          return cachedAdminToken;
        }
      } catch (e) {
        console.error('Failed to authenticate Supabase admin session for backend queries:', e);
      } finally {
        tokenPromise = null;
      }
      return '';
    })();
  }

  return tokenPromise;
}

let cachedClient: SupabaseClient | null = null;

// Mengembalikan Supabase client yang dapat mengakses data secara penuh (admin role / service role)
export const getSupabaseClient = (): SupabaseClient => {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || (!serviceKey && !anonKey)) {
    throw new AppError(500, 'Supabase URL or Key is not configured');
  }

  // Jika service key adalah JWT service role yang valid (dimulai dengan 'eyJ')
  if (serviceKey && serviceKey.startsWith('eyJ')) {
    cachedClient = createClient(url, serviceKey, {
      auth: { persistSession: false },
    });
    return cachedClient;
  }

  // Jika hanya memiliki anon/publishable key, attach bearer token admin agar RLS mengizinkan query
  const keyToUse = serviceKey || anonKey!;
  const customFetch: typeof fetch = async (input, init) => {
    const token = await getOrFetchAdminToken();
    if (token) {
      const headers = new Headers(init?.headers);
      // Pasang authorization bearer admin jika belum ditentukan secara spesifik
      if (!headers.has('Authorization') || headers.get('Authorization')?.includes(keyToUse)) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return fetch(input, { ...init, headers });
    }
    return fetch(input, init);
  };

  cachedClient = createClient(url, keyToUse, {
    auth: { persistSession: false },
    global: { fetch: customFetch },
  });

  return cachedClient;
};

const userTokenCache = new Map<string, { token: string; expiresAt: number }>();

export function cacheUserToken(userId: string, token: string, expiresInSeconds: number = 3600) {
  userTokenCache.set(userId, {
    token,
    expiresAt: Date.now() + expiresInSeconds * 1000,
  });
}

export async function getUserToken(userId: string): Promise<string> {
  const cached = userTokenCache.get(userId);
  if (cached && cached.expiresAt > Date.now() + 60000) {
    return cached.token;
  }

  // Jika pasien demo
  if (userId === 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb') {
    try {
      const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey =
        process.env.SUPABASE_ANON_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.SUPABASE_KEY;

      const authClient = createClient(url!, anonKey!, { auth: { persistSession: false } });
      const { data } = await authClient.auth.signInWithPassword({
        email: 'pasien@klinik.test',
        password: 'Pasien123!',
      });
      if (data?.session?.access_token) {
        cacheUserToken(userId, data.session.access_token, data.session.expires_in || 3600);
        return data.session.access_token;
      }
    } catch {
      // Fallback ke admin token
    }
  }

  return getOrFetchAdminToken();
}

// Client yang terikat dengan sesi pengguna tertentu (misal pasien yang sedang login)
export const getSupabaseUserClient = async (userId: string): Promise<SupabaseClient> => {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const token = await getUserToken(userId);
  return createClient(url!, anonKey!, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
};

const getClient = getSupabaseClient;

export class Storage {
  static getDoctorPhotosBucket(): string {
    return process.env.SUPABASE_BUCKET_DOCTOR_PHOTOS || 'doctor-photos';
  }

  static getPaymentProofsBucket(): string {
    return process.env.SUPABASE_BUCKET_PAYMENT_PROOFS || 'payment-proofs';
  }

  // Unggah buffer lalu kembalikan URL publiknya
  static async uploadBuffer(
    path: string,
    buffer: Buffer,
    contentType: string,
    bucketName?: string,
    client?: SupabaseClient
  ) {
    const bucket = bucketName || this.getDoctorPhotosBucket();
    const supabase = client || getClient();
    const storage = supabase.storage.from(bucket);

    const { error } = await storage.upload(path, buffer, {
      contentType,
      upsert: true,
    });
    if (error) throw new AppError(502, `failed to upload file: ${error.message}`);

    return storage.getPublicUrl(path).data.publicUrl;
  }

  // Unggah file (Multer)
  static async upload(
    path: string,
    file: Express.Multer.File,
    bucketName?: string,
    client?: SupabaseClient
  ) {
    return this.uploadBuffer(path, file.buffer, file.mimetype, bucketName, client);
  }

  // Unggah string Base64 Data URL
  static async uploadBase64(
    path: string,
    base64String: string,
    bucketName?: string,
    client?: SupabaseClient
  ) {
    const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      throw new AppError(422, 'Format gambar Base64 tidak valid');
    }
    const contentType = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    return this.uploadBuffer(path, buffer, contentType, bucketName, client);
  }
}
