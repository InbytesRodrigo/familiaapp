import { X } from 'lucide-react';
import type { ReactNode } from 'react';

interface ModalProps {
  children: ReactNode;
  onClose: () => void;
  title: string;
}

const Modal = ({ children, onClose, title }: ModalProps) => (
  <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-end sm:items-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
    <div className="bg-[#121214] border border-zinc-800 w-full max-w-md rounded-3xl shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
      <div className="flex justify-between items-center p-5 border-b border-zinc-800 shrink-0">
        <h3 className="text-xl font-bold text-white">{title}</h3>
        <button
          onClick={onClose}
          className="p-2 bg-zinc-800/50 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="p-5 overflow-y-auto custom-scrollbar flex-1">{children}</div>
    </div>
  </div>
);

export default Modal;
