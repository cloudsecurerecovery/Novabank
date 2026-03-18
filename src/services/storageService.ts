import { supabase } from '../supabaseClient';

const BUCKET_NAME = 'app-files';

export const storageService = {
  /**
   * Uploads a file to Supabase Storage.
   * Path format: ${userId}/${featureName}/${itemId}/${uuid}.${extension}
   */
  async uploadFile(
    userId: string,
    featureName: string,
    itemId: string,
    file: File
  ): Promise<string> {
    if (!userId || !featureName || !itemId || !file) {
      throw new Error('Missing required arguments for file upload');
    }

    const fileExt = file.name.split('.').pop();
    const uuid = crypto.randomUUID();
    const filePath = `${userId}/${featureName}/${itemId}/${uuid}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw uploadError;
    }

    return filePath;
  },

  /**
   * Generates a signed URL for a file path.
   */
  async getSignedUrl(filePath: string, expiresIn: number = 3600): Promise<string> {
    if (!filePath) return '';
    
    // If it's already a full URL, return it
    if (filePath.startsWith('http')) return filePath;

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(filePath, expiresIn);

    if (error) {
      console.error('Error generating signed URL:', error);
      throw error;
    }

    return data.signedUrl;
  },

  /**
   * Deletes a file from Supabase Storage.
   */
  async deleteFile(filePath: string): Promise<void> {
    if (!filePath || filePath.startsWith('http')) return;

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filePath]);

    if (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }
};
