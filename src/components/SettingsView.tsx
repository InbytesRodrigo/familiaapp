import { useEffect, useState } from 'react';
import { Camera, MessageSquare, Pencil, Plus, Smartphone, X } from 'lucide-react';
import type { ChangeEvent, FormEvent } from 'react';
import Avatar from './Avatar';
import Modal from './Modal';
import type { EvolutionConfig, ToastType, User } from '../types';
import { isImageAvatar } from '../utils';
import { newId } from '../lib/db';
import {
  getStoredSubscription,
  getVapidKey,
  isScheduledSupported,
  REMINDER_OPTIONS,
  requestPushPermission,
  sendScheduledTest,
  sendTestNotification,
  setVapidKey,
  subscribeToPush,
} from '../utils/push';
import type { ReminderOffset } from '../utils/push';

interface SettingsViewProps {
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  evolutionConfig: EvolutionConfig;
  setEvolutionConfig: React.Dispatch<React.SetStateAction<EvolutionConfig>>;
  pushGranted: boolean;
  setPushGranted: React.Dispatch<React.SetStateAction<boolean>>;
  reminderOffset: ReminderOffset;
  setReminderOffset: (value: ReminderOffset) => void;
  showNotification: (title: string, message: string, type?: ToastType) => void;
}

const MAX_PHOTO_SIZE = 2 * 1024 * 1024; // 2MB

const SettingsView = ({
  users,
  setUsers,
  evolutionConfig,
  setEvolutionConfig,
  pushGranted,
  setPushGranted,
  reminderOffset,
  setReminderOffset,
  showNotification,
}: SettingsViewProps) => {
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [isEvolutionOpen, setIsEvolutionOpen] = useState(false);
  const [vapidKeyInput, setVapidKeyInput] = useState(getVapidKey);
  const [isSubscribed, setIsSubscribed] = useState(() => !!getStoredSubscription());
  const [scheduledSupported, setScheduledSupported] = useState<boolean | null>(null);

  // Descobre (via service worker) se lembretes agendados com o app fechado são suportados
  useEffect(() => {
    let alive = true;
    isScheduledSupported().then((ok) => alive && setScheduledSupported(ok));
    return () => {
      alive = false;
    };
  }, []);

  const openAddUserModal = () => {
    setEditingUser(null);
    setAvatarPreview('');
    setIsUserModalOpen(true);
  };

  const openEditUserModal = (user: User) => {
    setEditingUser(user);
    setAvatarPreview('');
    setIsUserModalOpen(true);
  };

  const closeUserModal = () => {
    setIsUserModalOpen(false);
    setEditingUser(null);
    setAvatarPreview('');
  };

  const handleAvatarFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showNotification('Erro', 'O arquivo precisa ser uma imagem.', 'error');
      return;
    }
    if (file.size > MAX_PHOTO_SIZE) {
      showNotification('Erro', 'Imagem muito grande. Máximo de 2MB.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(String(reader.result));
    reader.readAsDataURL(file);
  };

  const handleSaveUser = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const name = String(formData.get('name') ?? '').trim();
    const role = String(formData.get('role') ?? '').trim();
    const color = String(formData.get('color') ?? '#a855f7');
    const emoji = String(formData.get('avatar') ?? '');

    // Foto enviada > emoji digitado > avatar atual (ao editar) > emoji padrão
    const avatar = avatarPreview || emoji || (editingUser?.avatar ?? '') || '👤';

    if (editingUser) {
      setUsers(
        users.map((u) => (u.id === editingUser.id ? { ...u, name, role, color, avatar } : u)),
      );
      showNotification('Sucesso', `Perfil de ${name} atualizado!`, 'success');
    } else {
      const newUser: User = {
        id: newId(),
        name,
        role,
        color,
        avatar,
      };
      setUsers([...users, newUser]);
    }
    closeUserModal();
  };

  const handleDeleteUser = (id: string) => {
    if (users.length <= 1) {
      alert('É necessário ter pelo menos um usuário.');
      return;
    }
    setUsers(users.filter((u) => u.id !== id));
  };

  const handleEnablePush = async () => {
    if (!('Notification' in window)) {
      showNotification('Erro', 'Seu navegador não suporta notificações Push.', 'error');
      return;
    }
    const granted = await requestPushPermission();
    setPushGranted(granted);
    if (granted) {
      new Notification('Tudo Certo!', { body: 'Notificações push ativadas com sucesso.' });
      showNotification('Sucesso', 'Push Notifications ativadas!', 'success');
    } else {
      showNotification('Aviso', 'Permissão para notificações negada.', 'error');
    }
  };

  const handleTestNow = async () => {
    const ok = await sendTestNotification();
    showNotification(
      ok ? 'Sucesso' : 'Aviso',
      ok
        ? 'Notificação de teste enviada! Confira o topo da tela.'
        : 'O service worker ainda não está pronto. Recarregue a página e tente de novo.',
      ok ? 'success' : 'error',
    );
  };

  const handleTestScheduled = async () => {
    const ok = await sendScheduledTest();
    showNotification(
      ok ? 'Lembrete agendado' : 'Aviso',
      ok
        ? 'Uma notificação será mostrada em 15 segundos — feche o app e aguarde.'
        : 'O service worker ainda não está pronto. Recarregue a página e tente de novo.',
      ok ? 'success' : 'error',
    );
  };

  const handleSubscribe = async () => {
    const sub = await subscribeToPush(vapidKeyInput);
    setVapidKey(vapidKeyInput);
    setIsSubscribed(!!sub || !!getStoredSubscription());
    showNotification(
      sub ? 'Sucesso' : 'Erro',
      sub
        ? 'Assinatura de push criada! Agora um servidor pode enviar mensagens para o app.'
        : 'Não foi possível assinar. Confira a chave VAPID e a permissão de notificação.',
      sub ? 'success' : 'error',
    );
  };

  const handleSaveEvolution = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setEvolutionConfig({
      url: String(formData.get('url') ?? ''),
      instance: String(formData.get('instance') ?? ''),
      apiKey: String(formData.get('apiKey') ?? ''),
      number: String(formData.get('number') ?? ''),
    });
    setIsEvolutionOpen(false);
    showNotification('Sucesso', 'Configurações do WhatsApp salvas!', 'success');
  };

  return (
    <div className="flex-1 bg-[#09090b] overflow-y-auto custom-scrollbar">
      <div className="max-w-4xl mx-auto space-y-8 p-4 md:p-8 pb-32">
        {/* Seção: Família */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white">Família (Usuários)</h2>
            <button
              onClick={openAddUserModal}
              className="flex items-center gap-2 text-sm text-pink-500 hover:text-pink-400 font-medium transition-colors"
            >
              <Plus className="w-4 h-4" /> Novo Membro
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {users.map((user) => (
              <div
                key={user.id}
                className="bg-[#121214] border border-zinc-800 p-4 rounded-2xl flex items-center justify-between group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar
                    user={user}
                    className="w-12 h-12 rounded-full text-2xl shadow-inner border border-zinc-700/50 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="font-bold text-white truncate">{user.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-zinc-500 truncate">{user.role}</span>
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: user.color }}></div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => openEditUserModal(user)}
                    className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors md:opacity-0 md:group-hover:opacity-100"
                    title="Editar cor e perfil"
                  >
                    <Pencil className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDeleteUser(user.id)}
                    className="p-2 text-red-400 hover:bg-red-500/10 rounded-xl transition-colors md:opacity-0 md:group-hover:opacity-100"
                    title="Remover membro"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Seção: Integrações de avisos */}
        <div className="pb-10">
          <h2 className="text-xl font-bold text-white mb-4">Integrações de Avisos</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* WhatsApp (Evolution) */}
            <div className="bg-[#121214] p-6 rounded-3xl border border-zinc-800 flex flex-col justify-between items-start gap-4">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl shrink-0">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-white">Evolution API (WhatsApp)</h4>
                  <p className="text-sm text-zinc-500 mt-1 leading-relaxed">
                    Conecte sua instância para disparar mensagens no grupo da família.
                  </p>
                  <div
                    className={`mt-3 text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full inline-block font-bold border ${
                      evolutionConfig.url
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                    }`}
                  >
                    {evolutionConfig.url ? 'Configurado' : 'Pendente'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsEvolutionOpen(true)}
                className="mt-4 w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium rounded-xl transition-colors"
              >
                Configurar Manualmente
              </button>
            </div>

            {/* Push Notifications */}
            <div className="bg-[#121214] p-6 rounded-3xl border border-zinc-800 flex flex-col justify-between items-start gap-4">
              <div className="flex items-start gap-4 w-full">
                <div className="p-3 bg-blue-500/20 text-blue-400 rounded-2xl shrink-0">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-white">Push Notifications</h4>
                  <p className="text-sm text-zinc-500 mt-1 leading-relaxed">
                    Alertas nativos no celular/navegador para eventos importantes.
                  </p>
                  <div
                    className={`mt-3 text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full inline-block font-bold border ${
                      pushGranted
                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                        : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                    }`}
                  >
                    {pushGranted ? 'Ativo' : 'Inativo'}
                  </div>
                </div>
              </div>

              {!pushGranted ? (
                <button
                  onClick={handleEnablePush}
                  className="mt-2 w-full py-2.5 bg-blue-500 hover:bg-blue-400 text-white text-sm font-medium rounded-xl transition-colors"
                >
                  Habilitar Push
                </button>
              ) : (
                <div className="w-full space-y-4">
                  {/* Lembretes de compromissos */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                      Lembretes de compromissos
                    </label>
                    <select
                      value={reminderOffset}
                      onChange={(e) => setReminderOffset(Number(e.target.value) as ReminderOffset)}
                      className="w-full p-3 bg-[#09090b] border border-zinc-800 text-white rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none"
                    >
                      {REMINDER_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    {scheduledSupported === false ? (
                      <p className="text-[10px] text-amber-500/80 mt-1 leading-relaxed">
                        Seu navegador não suporta lembretes com o app fechado. Use o Chrome no Android ou no
                        computador, ou instale o app na tela inicial.
                      </p>
                    ) : (
                      <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">
                        Disparam mesmo com o app fechado, em qualquer compromisso dos próximos 30 dias.
                      </p>
                    )}
                  </div>

                  {/* Testes */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleTestNow}
                      className="py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium rounded-xl transition-colors"
                    >
                      Testar agora
                    </button>
                    {scheduledSupported !== false && (
                      <button
                        onClick={handleTestScheduled}
                        className="py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium rounded-xl transition-colors"
                      >
                        Testar em 15s
                      </button>
                    )}
                  </div>

                  {/* Push real via servidor (avançado) */}
                  <details className="group">
                    <summary className="text-xs text-zinc-500 hover:text-zinc-300 cursor-pointer font-medium">
                      Push de servidor (avançado)
                    </summary>
                    <div className="mt-3 space-y-3">
                      <input
                        type="text"
                        value={vapidKeyInput}
                        onChange={(e) => setVapidKeyInput(e.target.value)}
                        placeholder="Chave pública VAPID (base64url)"
                        className="w-full p-3 bg-[#09090b] border border-zinc-800 text-white rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder-zinc-700 text-xs"
                      />
                      <button
                        onClick={handleSubscribe}
                        className="w-full py-2.5 bg-blue-500 hover:bg-blue-400 text-white text-sm font-medium rounded-xl transition-colors"
                      >
                        {isSubscribed ? 'Assinatura ativa ✓' : 'Assinar para push'}
                      </button>
                      <p className="text-[10px] text-zinc-500 leading-relaxed">
                        Para receber mensagens enviadas por um servidor (mesmo dias depois), gere um par de
                        chaves VAPID e configure um backend para enviar o push. O app já está pronto para receber.
                      </p>
                    </div>
                  </details>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal: Configurar Evolution API */}
        {isEvolutionOpen && (
          <Modal onClose={() => setIsEvolutionOpen(false)} title="Configurar Evolution API">
            <form onSubmit={handleSaveEvolution} className="space-y-4">
              <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20 mb-2">
                <p className="text-xs text-emerald-400 leading-relaxed">
                  Insira os dados da sua API Evolution para enviar alertas reais de agenda e mercado via
                  WhatsApp.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">URL da API (com http/https)</label>
                <input
                  type="url"
                  name="url"
                  defaultValue={evolutionConfig.url}
                  required
                  placeholder="Ex: https://sua-api.com"
                  className="w-full p-3 bg-[#09090b] border border-zinc-800 text-white rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all placeholder-zinc-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">Nome da Instância</label>
                <input
                  type="text"
                  name="instance"
                  defaultValue={evolutionConfig.instance}
                  required
                  placeholder="Ex: familiaApp"
                  className="w-full p-3 bg-[#09090b] border border-zinc-800 text-white rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all placeholder-zinc-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">API Key Global</label>
                <input
                  type="password"
                  name="apiKey"
                  defaultValue={evolutionConfig.apiKey}
                  required
                  placeholder="Sua chave secreta"
                  className="w-full p-3 bg-[#09090b] border border-zinc-800 text-white rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all placeholder-zinc-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">Número de Destino</label>
                <input
                  type="text"
                  name="number"
                  defaultValue={evolutionConfig.number}
                  required
                  placeholder="Ex: 5511999999999"
                  className="w-full p-3 bg-[#09090b] border border-zinc-800 text-white rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all placeholder-zinc-700"
                />
                <p className="text-[10px] text-zinc-500 mt-1">
                  Número com DDI e DDD (pode ser o JID de um grupo).
                </p>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsEvolutionOpen(false)}
                  className="flex-1 px-4 py-3 border border-zinc-700 text-zinc-300 rounded-xl hover:bg-zinc-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-500 transition-colors"
                >
                  Salvar
                </button>
              </div>
            </form>
          </Modal>
        )}

        {/* Modal: Novo/Editar membro familiar */}
        {isUserModalOpen && (
          <Modal
            onClose={closeUserModal}
            title={editingUser ? 'Editar Membro' : 'Novo Membro Familiar'}
          >
            <form onSubmit={handleSaveUser} className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-zinc-400 mb-1.5">Nome</label>
                  <input
                    type="text"
                    name="name"
                    required
                    defaultValue={editingUser?.name}
                    placeholder="Ex: Maria"
                    className="w-full p-3 bg-[#09090b] border border-zinc-800 text-white rounded-xl focus:ring-2 focus:ring-pink-500 outline-none transition-all"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-zinc-400 mb-1.5">Papel/Grau</label>
                  <input
                    type="text"
                    name="role"
                    required
                    defaultValue={editingUser?.role}
                    placeholder="Ex: Filha"
                    className="w-full p-3 bg-[#09090b] border border-zinc-800 text-white rounded-xl focus:ring-2 focus:ring-pink-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-zinc-400 mb-1.5">Cor de Identificação</label>
                  <input
                    type="color"
                    name="color"
                    defaultValue={editingUser?.color ?? '#a855f7'}
                    className="w-full h-12 p-1 bg-[#09090b] border border-zinc-800 rounded-xl cursor-pointer"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-zinc-400 mb-1.5">
                    Emoji/Avatar (se não usar foto)
                  </label>
                  <input
                    type="text"
                    name="avatar"
                    defaultValue={
                      editingUser && !isImageAvatar(editingUser.avatar) ? editingUser.avatar : '👧'
                    }
                    maxLength={2}
                    className="w-full p-3 bg-[#09090b] border border-zinc-800 text-white rounded-xl text-center text-xl focus:ring-2 focus:ring-pink-500 outline-none"
                  />
                </div>
              </div>

              {/* Foto de perfil */}
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">Foto de Perfil</label>
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full overflow-hidden bg-[#09090b] border border-zinc-800 flex items-center justify-center text-2xl shrink-0">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="Prévia" className="w-full h-full object-cover" />
                    ) : editingUser && isImageAvatar(editingUser.avatar) ? (
                      <img
                        src={editingUser.avatar}
                        alt={editingUser.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      '👤'
                    )}
                  </div>
                  <label className="flex-1 cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarFile}
                      className="hidden"
                    />
                    <span className="block text-center py-3 border border-zinc-700 text-zinc-300 rounded-xl hover:bg-zinc-800 transition-colors text-sm flex items-center justify-center gap-2">
                      <Camera className="w-4 h-4" /> Escolher foto
                    </span>
                  </label>
                  {avatarPreview && (
                    <button
                      type="button"
                      onClick={() => setAvatarPreview('')}
                      className="p-2 text-red-400 hover:bg-red-500/10 rounded-xl transition-colors shrink-0"
                      title="Remover foto"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-zinc-500 mt-1.5">
                  JPG ou PNG, até 2MB. A foto substitui o emoji no perfil.
                </p>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={closeUserModal}
                  className="flex-1 px-4 py-3 border border-zinc-700 text-zinc-300 rounded-xl hover:bg-zinc-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-pink-500 text-white font-medium rounded-xl hover:bg-pink-400 transition-colors"
                >
                  {editingUser ? 'Salvar' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </Modal>
        )}
      </div>
    </div>
  );
};

export default SettingsView;
