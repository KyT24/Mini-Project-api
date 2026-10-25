import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { AppError } from '../errors/app.error';

// Pakai service role key (hanya di server) agar bisa menulis ke bucket
const getClient = () => {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)
    throw new AppError(500, 'file storage is not configured');

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
};

export class Storage {
  // Unggah file lalu kembalikan URL publiknya
  static async upload(path: string, file: Express.Multer.File) {
    const bucket = process.env.SUPABASE_BUCKET || 'payment-proofs';
    const storage = getClient().storage.from(bucket);

    const { error } = await storage.upload(path, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });
    if (error) throw new AppError(502, `failed to upload file: ${error.message}`);

    return storage.getPublicUrl(path).data.publicUrl;
  }
}
