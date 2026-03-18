import { UserCircle } from 'lucide-react';
import { useSignedUrl } from '../hooks/useSignedUrl';

interface AvatarImageProps {
  avatarUrl?: string | null;
  fullName?: string;
  className?: string;
  iconClassName?: string;
}

export function AvatarImage({ avatarUrl, fullName, className = "h-full w-full object-cover", iconClassName = "h-6 w-6 text-white" }: AvatarImageProps) {
  const { signedUrl, loading } = useSignedUrl(avatarUrl);

  if (loading) {
    return <div className={`animate-pulse bg-slate-200 ${className}`} />;
  }

  if (signedUrl) {
    return <img src={signedUrl} alt={fullName || 'User'} className={className} />;
  }

  return (
    <div className="h-full w-full flex items-center justify-center bg-slate-100">
      <UserCircle className={iconClassName} />
    </div>
  );
}
