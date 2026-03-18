import { useState, useEffect } from 'react';
import { storageService } from '../services/storageService';

export function useSignedUrl(filePath: string | undefined | null) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    if (!filePath) {
      setSignedUrl(null);
      return;
    }

    // If it's already a full URL (e.g. from old implementation), just use it
    if (filePath.startsWith('http')) {
      setSignedUrl(filePath);
      return;
    }

    const fetchSignedUrl = async () => {
      setLoading(true);
      try {
        const url = await storageService.getSignedUrl(filePath);
        setSignedUrl(url);
      } catch (err) {
        console.error('Error getting signed URL:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchSignedUrl();
  }, [filePath]);

  return { signedUrl, loading, error };
}
