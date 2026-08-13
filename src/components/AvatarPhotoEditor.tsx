import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';

const OUTPUT_SIZE = 512; // tamanho da foto final (quadrada)

interface AvatarPhotoEditorProps {
  /** Arquivo recém-escolhido ou URL/dataURL de uma foto existente. */
  source: File | string;
  onConfirm: (dataUrl: string) => void;
  onCancel: () => void;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Ajuste manual da foto de perfil: arraste para enquadrar, use o controle
 * para dar zoom e confirme. O recorte sai quadrado, pronto para o avatar.
 */
const AvatarPhotoEditor = ({ source, onConfirm, onCancel }: AvatarPhotoEditorProps) => {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxSize, setBoxSize] = useState(0);
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);

  // Carrega a imagem (arquivo ou URL existente)
  useEffect(() => {
    let alive = true;
    let objectUrl: string | null = null;
    const load = async () => {
      try {
        const url = typeof source === 'string' ? source : URL.createObjectURL(source);
        if (typeof source !== 'string') objectUrl = url;
        if (alive) setPreviewUrl(url);
        const image = new Image();
        image.onload = () => {
          if (alive) {
            setImg(image);
            setZoom(1);
            setPan({ x: 0, y: 0 });
            setLoadError('');
          }
        };
        image.onerror = () => {
          if (alive) setLoadError('Não foi possível ler esta imagem. Tente outra.');
        };
        image.src = url;
      } catch {
        if (alive) setLoadError('Não foi possível ler esta imagem. Tente outra.');
      }
    };
    void load();
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [source]);

  // Mede a caixa de pré-visualização (quadrada) para o cálculo do recorte
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const update = () => setBoxSize(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Limites de arraste: a imagem nunca pode deixar buracos na moldura
  const limitsFor = useCallback(
    (z: number) => {
      if (!img || !boxSize) return { maxX: 0, maxY: 0 };
      const k = Math.max(boxSize / img.naturalWidth, boxSize / img.naturalHeight);
      const dispW = img.naturalWidth * k * z;
      const dispH = img.naturalHeight * k * z;
      return {
        maxX: Math.max(0, (dispW - boxSize) / 2),
        maxY: Math.max(0, (dispH - boxSize) / 2),
      };
    },
    [img, boxSize],
  );

  const handleZoom = (z: number) => {
    const { maxX, maxY } = limitsFor(z);
    setZoom(z);
    setPan((p) => ({ x: clamp(p.x, -maxX, maxX), y: clamp(p.y, -maxY, maxY) }));
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!img) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const { maxX, maxY } = limitsFor(zoom);
    setPan({
      x: clamp(d.panX + (e.clientX - d.startX), -maxX, maxX),
      y: clamp(d.panY + (e.clientY - d.startY), -maxY, maxY),
    });
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  // Gera a foto final (quadrada, 512x512) com o enquadramento escolhido
  const handleConfirm = () => {
    if (!img || !boxSize) return;
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const k = Math.max(boxSize / img.naturalWidth, boxSize / img.naturalHeight);
    const dispW = img.naturalWidth * k * zoom;
    const dispH = img.naturalHeight * k * zoom;
    const imgLeft = (boxSize - dispW) / 2 + pan.x;
    const imgTop = (boxSize - dispH) / 2 + pan.y;

    const sx = clamp(-imgLeft / (k * zoom), 0, img.naturalWidth);
    const sy = clamp(-imgTop / (k * zoom), 0, img.naturalHeight);
    const sw = Math.min(boxSize / (k * zoom), img.naturalWidth - sx);
    const sh = Math.min(boxSize / (k * zoom), img.naturalHeight - sy);

    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

    const isPng =
      (typeof source === 'string' && source.startsWith('data:image/png')) ||
      (typeof source !== 'string' && source.type === 'image/png');
    const dataUrl = canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', 0.85);
    onConfirm(dataUrl);
  };

  const dispW = img && boxSize ? img.naturalWidth * Math.max(boxSize / img.naturalWidth, boxSize / img.naturalHeight) * zoom : 0;
  const dispH = img && boxSize ? img.naturalHeight * Math.max(boxSize / img.naturalWidth, boxSize / img.naturalHeight) * zoom : 0;

  return (
    <div className="space-y-4">
      <p className="text-xs text-zinc-400 leading-relaxed">
        Arraste a foto para enquadrar e use o controle para dar zoom. O recorte fica
        quadrado e pronto para o perfil.
      </p>

      {loadError ? (
        <div className="text-center text-red-400 text-sm py-10 bg-[#09090b] rounded-2xl border border-zinc-800">
          {loadError}
        </div>
      ) : (
        <>
          {/* Moldura quadrada com a foto ajustável */}
          <div
            ref={boxRef}
            className="relative w-full max-w-[300px] aspect-square mx-auto rounded-2xl overflow-hidden bg-[#09090b] border border-zinc-800 touch-none select-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {!img ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-zinc-600 animate-spin" />
              </div>
            ) : (
              <img
                src={previewUrl ?? ''}
                alt="Foto a ajustar"
                draggable={false}
                className="absolute left-1/2 top-1/2 max-w-none pointer-events-none"
                style={{
                  width: dispW,
                  height: dispH,
                  transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px)`,
                }}
              />
            )}
          </div>

          {/* Zoom */}
          <div className="flex items-center gap-3 max-w-[300px] mx-auto">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Zoom</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => handleZoom(Number(e.target.value))}
              className="flex-1 accent-pink-500"
              aria-label="Zoom da foto"
            />
            <span className="text-xs text-zinc-400 w-8 text-right">{Math.round(zoom * 100)}%</span>
          </div>
        </>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2.5 border border-zinc-700 text-zinc-300 text-sm font-medium rounded-xl hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2"
        >
          <X className="w-4 h-4" /> Trocar
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!img}
          className="flex-1 py-2.5 bg-pink-500 disabled:opacity-50 hover:bg-pink-400 text-white text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <Check className="w-4 h-4" /> Usar foto
        </button>
      </div>
    </div>
  );
};

export default AvatarPhotoEditor;
