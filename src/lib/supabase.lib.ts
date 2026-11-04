import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { AppError } from '../errors/app.error';

// Pakai service role key atau anon/publishable key agar bisa membaca/menulis ke Supabase & bucket
export const getSupabaseClient = () => {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new AppError(500, 'Supabase URL or Key is not configured');
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
};

const getClient = getSupabaseClient;

export class Storage {
  // Unggah buffer lalu kembalikan URL publiknya
  static async uploadBuffer(path: string, buffer: Buffer, contentType: string) {
    const bucket = process.env.SUPABASE_BUCKET || 'payment-proofs';
    const storage = getClient().storage.from(bucket);

    const { error } = await storage.upload(path, buffer, {
      contentType,
      upsert: false,
    });
    if (error) throw new AppError(502, `failed to upload file: ${error.message}`);

    return storage.getPublicUrl(path).data.publicUrl;
  }

  // Unggah file (Multer)
  static async upload(path: string, file: Express.Multer.File) {
    return this.uploadBuffer(path, file.buffer, file.mimetype);
  }

  // Unggah string Base64 Data URL
  static async uploadBase64(path: string, base64String: string) {
    const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      throw new AppError(422, 'Format gambar Base64 tidak valid');
    }
    const contentType = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    return this.uploadBuffer(path, buffer, contentType);
  }
}
