import { Check, Settings } from 'lucide-react';
import Avatar from './Avatar';
import type { User } from '../types';

interface UserSwitcherSheetProps {
  users: User[];
  currentUser: User;
  /** Quem está online agora (id -> true). */
  presence: Record<string, boolean>;
  onSelect: (id: string) => void;
  onManageProfiles: () => void;
  onClose: () => void;
  required?: boolean;
}

/** Bottom sheet mobile: troca de usuário tocando no avatar do header. */
const UserSwitcherSheet = ({
  users,
  currentUser,
  presence,
  onSelect,
  onManageProfiles,
  onClose,
  required = false,
}: UserSwitcherSheetProps) => (
  <div className="fixed inset-0 z-[60]">
    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in" onClick={required ? undefined : onClose} />
    <div className="absolute bottom-0 inset-x-0 md:bottom-auto md:top-1/2 md:left-1/2 md:right-auto md:w-[420px] md:-translate-x-1/2 md:-translate-y-1/2 bg-[#121214] border-t md:border border-zinc-800 rounded-t-3xl md:rounded-3xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] animate-in slide-in-from-bottom-5 duration-200">
      <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto mb-4" />
      <h3 className="text-lg font-bold text-white">Entrar como</h3>
      <p className="text-xs text-zinc-500 mt-0.5 mb-4">
        Sem senha — toque no perfil que está usando o app.
      </p>
      <div className="space-y-2 mb-4">
        {users.map((u) => (
          <button
            key={u.id}
            onClick={() => onSelect(u.id)}
            className="w-full flex items-center gap-3 p-3 rounded-2xl bg-[#09090b] border border-zinc-800 text-left hover:border-zinc-600 transition-colors"
          >
            <span className="relative shrink-0">
              <Avatar user={u} className="w-10 h-10 rounded-full text-lg shrink-0" />
              {presence[u.id] && (
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#121214]" />
              )}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white truncate flex items-center gap-2">
                {u.name}
                {presence[u.id] && (
                  <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400">online</span>
                )}
              </p>
              <p className="text-xs text-zinc-500">{u.role}</p>
            </div>
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: u.color }} />
            {!required && u.id === currentUser.id && <Check className="w-5 h-5 text-pink-500 shrink-0" />}
          </button>
        ))}
      </div>
      {!required && (
        <button
          onClick={onManageProfiles}
          className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium rounded-xl flex items-center justify-center gap-2 transition-colors"
        >
          <Settings className="w-4 h-4" /> Gerenciar perfis
        </button>
      )}
    </div>
  </div>
);

export default UserSwitcherSheet;
