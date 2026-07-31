import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

type LocalQrCodeProps = {
  value: string;
  size?: number;
  alt?: string;
  className?: string;
};

/** QR gerado no cliente — o token não vai para serviços externos. */
export function LocalQrCode({ value, size = 160, alt = 'QR Code', className }: LocalQrCodeProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const url = await QRCode.toDataURL(value, {
          width: size,
          margin: 1,
          errorCorrectionLevel: 'M',
        });
        if (!cancelled) setDataUrl(url);
      } catch {
        if (!cancelled) setDataUrl(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (!dataUrl) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl border border-viva-200 bg-viva-50 text-xs text-viva-600 ${className || ''}`}
        style={{ width: size, height: size }}
      >
        Gerando QR…
      </div>
    );
  }

  return <img src={dataUrl} alt={alt} width={size} height={size} className={className} />;
}
