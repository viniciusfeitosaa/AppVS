import { useEffect, useRef, useState } from 'react';

const LADO_MAX = 960;

type Props = {
  value: File | null;
  onChange: (file: File | null) => void;
};

/** Selfie pela câmera frontal (sem galeria). A câmera só liga no clique — exigência do Safari/iOS. */
export const SelfieCaptura = ({ value, onChange }: Props) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ligada, setLigada] = useState(false);
  const [pronta, setPronta] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const parar = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setLigada(false);
    setPronta(false);
  };

  useEffect(() => parar, []);

  useEffect(() => {
    if (!value) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(value);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  useEffect(() => {
    const el = videoRef.current;
    if (ligada && el && streamRef.current) {
      el.srcObject = streamRef.current;
      void el.play().catch(() => {});
    }
  }, [ligada]);

  const ligar = async () => {
    setErro(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'user' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      onChange(null);
      setLigada(true);
    } catch {
      setErro('Não foi possível abrir a câmera. Verifique a permissão do navegador ou pule esta etapa.');
    }
  };

  const capturar = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const escala = Math.min(1, LADO_MAX / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * escala);
    canvas.height = Math.round(video.videoHeight * escala);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onChange(new File([blob], 'selfie.jpg', { type: 'image/jpeg' }));
        parar();
      },
      'image/jpeg',
      0.88
    );
  };

  return (
    <div className="space-y-3">
      <div className="mx-auto w-full max-w-[240px] aspect-[3/4] rounded-2xl overflow-hidden bg-zinc-900 relative flex items-center justify-center">
        {ligada ? (
          <>
            <video
              ref={videoRef}
              className="w-full h-full object-cover [transform:scaleX(-1)]"
              playsInline
              muted
              autoPlay
              onPlaying={(e) => e.currentTarget.videoWidth > 0 && setPronta(true)}
            />
            <div className="pointer-events-none absolute inset-[14%_18%] rounded-[50%] border-2 border-white/70" />
          </>
        ) : preview ? (
          <img src={preview} alt="Selfie capturada" className="w-full h-full object-cover" />
        ) : (
          <span className="text-[13px] text-zinc-300 px-4 text-center">Câmera desligada</span>
        )}
      </div>
      {erro && <p className="text-[13px] text-red-600/95 text-center">{erro}</p>}
      <div className="flex flex-wrap justify-center gap-2">
        {ligada ? (
          <>
            <button type="button" className="btn btn-primary text-sm" onClick={capturar} disabled={!pronta}>
              Tirar foto
            </button>
            <button type="button" className="btn text-sm border border-zinc-300 bg-white text-zinc-700" onClick={parar}>
              Cancelar
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-primary text-sm" onClick={() => void ligar()}>
              {value ? 'Tirar outra' : 'Abrir câmera'}
            </button>
            {value && (
              <button
                type="button"
                className="btn text-sm border border-zinc-300 bg-white text-zinc-700"
                onClick={() => onChange(null)}
              >
                Remover
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
