import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';

interface AuthImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  fallback?: React.ReactNode;
}

export default function AuthImage({ src, alt, className, style, fallback }: AuthImageProps) {
  const { accessToken } = useAuthStore();
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!src) { setObjectUrl(null); return; }
    let revoke: string | null = null;
    fetch(src, { headers: { Authorization: `Bearer ${accessToken ?? ''}` } })
      .then((r) => r.blob())
      .then((b) => {
        const url = URL.createObjectURL(b);
        revoke = url;
        setObjectUrl(url);
      })
      .catch(() => setObjectUrl(null));
    return () => { if (revoke) URL.revokeObjectURL(revoke); };
  }, [src, accessToken]);

  if (!objectUrl) return <>{fallback ?? null}</>;
  return <img src={objectUrl} alt={alt} className={className} style={style} />;
}
