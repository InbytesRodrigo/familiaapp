import { X } from 'lucide-react';
import type { ReactNode } from 'react';

interface ModalProps {
  children: ReactNode;
  onClose: () => void;
  title: string;
  /** Rodapé fixo (ex.: botões Salvar/Cancelar) — fica sempre visível, sem rolar. */
  footer?: ReactNode;
}

// No celular o painel fica ACIMA da barra de navegação inferior — os botões ficam sempre visíveis
const Modal = ({ children, onClose, title, footer }: ModalProps) => (
  <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-end md:items-center p-4 pb-[calc(4.75rem+env(safe-area-inset-bottom))] md:pb-4">
    {/* max-h com vh como fallback (alguns navegadores não suportam dvh) — os botões do rodapé nunca somem */}
    <div className="bg-[#121214] border border-zinc-800 w-full max-w-md rounded-3xl shadow-2xl flex flex-col modal-box animate-in fade-in zoom-in duration-200 max-h-[90vh] supports-[height:100dvh]:max-h-[90dvh] md:max-h-[85vh] supports-[height:85dvh]:md:max-h-[85dvh]">
      <div className="flex justify-between items-center p-5 border-b border-zinc-800 shrink-0">
        <h3 className="text-xl font-bold text-white">{title}</h3>
        <button
          onClick={onClose}
          className="p-2 bg-zinc-800/50 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      {/* min-h-0 + flex-1: quando o conteúdo é longo, rola por dentro e o rodapé fica sempre visível */}
      <div className="p-5 overflow-y-auto custom-scrollbar flex-1 min-h-0">{children}</div>
      {footer && (
        <div className="p-4 pt-3 border-t border-zinc-800 shrink-0 bg-[#121214] rounded-b-3xl pb-[max(1rem,env(safe-area-inset-bottom))]">
          {footer}
        </div>
      )}
    </div>
  </div>
);

export default Modal;
