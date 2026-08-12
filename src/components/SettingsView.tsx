import { useEffect, useState } from 'react';
import { Camera, MessageSquare, Pencil, Plus, Smartphone, X } from 'lucide-react';
import type { ChangeEvent, FormEvent } from 'react';
import Avatar from './Avatar';
import Logo from './Logo';
import type { LogoVariant } from './Logo';
import Modal from './Modal';
import type { EvolutionConfig, MetodoLembrete, ToastType, User } from '../types';
import { isImageAvatar } from '../utils';
import { newId } from '../lib/db';
import {
  clearSupabaseConnection,
  getConnectionConfig,
  setSupabaseConnection,
} from '../lib/supabase';
import { deletePushSubscription, getVapidPublicKey, savePushSubscription } from '../lib/db';
import {
  clearStoredSubscription,
  getMetodoOptions,
  getServiceWorker,
  getStoredSubscription,
  isScheduledSupported,
  requestPushPermission,
  sendScheduledTest,
  sendTestNotification,
  subscribeToPush,
} from '../utils/push';

interface SettingsViewProps {
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  evolutionConfig: EvolutionConfig;
  setEvolutionConfig: React.Dispatch<React.SetStateAction<EvolutionConfig>>;
  setPushGranted: React.Dispatch<React.SetStateAction<boolean>>;
  metodosLembrete: MetodoLembrete[];
  setMetodosLembrete: (metodos: MetodoLembrete[]) => void;
  showNotification: (title: string, message: string, type?: ToastType) => void;
  logoVariant: LogoVariant;
  setLogoVariant: (value: LogoVariant) => void;
  connectionState: 'connecting' | 'connected' | 'unconfigured' | 'error';
  onConnectionSaved: () => void;
}

const MAX_PHOTO_SIZE = 2 * 1024 * 1024; // 2MB

const SettingsView = ({
  users,
  setUsers,
  evolutionConfig,
  setEvolutionConfig,
  setPushGranted,
  metodosLembrete,
  setMetodosLembrete,
  showNotification,
  logoVariant,
  setLogoVariant,
  connectionState,
  onConnectionSaved,
}: SettingsViewProps) => {
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [isEvolutionOpen, setIsEvolutionOpen] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(() => !!getStoredSubscription());
  const [pushBusy, setPushBusy] = useState(false);
  const [scheduledSupported, setScheduledSupported] = useState<boolean | null>(null);

  // Conexão com o banco (Supabase) configurável em tempo de execução
  const initialConn = getConnectionConfig();
  const [connUrl, setConnUrl] = useState(initialConn.url);
  const [connAnonKey, setConnAnonKey] = useState(initialConn.anonKey);

  const handleSaveConnection = () => {
    const saved = setSupabaseConnection(connUrl, connAnonKey);
    if (!saved) {
      showNotification('Erro', 'Preencha a URL e a chave anon do seu Supabase.', 'error');
      return;
    }
    showNotification('Conectado!', 'Banco de dados conectado. Carregando seus dados...', 'success');
    onConnectionSaved();
  };

  const handleDisconnect = () => {
    clearSupabaseConnection();
    setConnUrl('');
    setConnAnonKey('');
    showNotification('Desconectado', 'Conexão manual removida. Usando a configuração do site (se houver).', 'info');
    onConnectionSaved();
  };

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
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      showNotification(
        'Erro',
        'Seu navegador não suporta push. Use o Chrome/Edge no celular ou no computador, ou instale o app na tela inicial.',
        'error',
      );
      return;
    }
    setPushBusy(true);
    try {
      const granted = await requestPushPermission();
      setPushGranted(granted);
      if (!granted) {
        showNotification('Aviso', 'Permissão para notificações negada.', 'error');
        return;
      }

      // Busca a chave pública VAPID do servidor de push (Edge Function)
      const vapidKey = await getVapidPublicKey();
      if (!vapidKey) {
        showNotification(
          'Erro',
          'Não foi possível buscar a chave do servidor de push. Tente de novo em instantes.',
          'error',
        );
        return;
      }

      // Cria a assinatura deste aparelho e salva no banco
      const sub = await subscribeToPush(vapidKey);
      if (!sub) {
        showNotification('Erro', 'Não foi possível criar a assinatura de push.', 'error');
        return;
      }

      const saved = await savePushSubscription(sub);
      setIsSubscribed(true);
      showNotification(
        saved ? 'Sucesso' : 'Aviso',
        saved
          ? 'Push ativado! Você receberá os avisos da família mesmo com o app fechado.'
          : 'Assinatura criada neste aparelho, mas ainda não foi salva no banco.',
        saved ? 'success' : 'error',
      );
    } finally {
      setPushBusy(false);
    }
  };

  const handleDisablePush = async () => {
    try {
      const sw = await getServiceWorker();
      const sub = sw ? await sw.pushManager.getSubscription() : null;
      if (sub) {
        await deletePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
    } catch {
      /* segue mesmo se a desinscrição falhar */
    }
    clearStoredSubscription();
    setIsSubscribed(false);
    setPushGranted(false);
    showNotification('Push desativado', 'Este aparelho não receberá mais notificações.', 'info');
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
        {/* Seção: Logo do app */}
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Logo do App</h2>
          <p className="text-sm text-zinc-500 mb-4">
            Escolha o modelo que prefere — vale na tela de abertura, no topo e na barra lateral.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => setLogoVariant('f')}
              className={`p-5 rounded-3xl border-2 bg-[#121214] flex flex-col items-start gap-3 text-left transition-all ${
                logoVariant === 'f' ? 'border-pink-500' : 'border-zinc-800 hover:border-zinc-600'
              }`}
            >
              <Logo size="md" variant="f" />
              <span className="text-sm font-bold text-white">Letra F — gradiente animado</span>
              <span className="text-xs text-zinc-500 leading-relaxed">
                Estilo Instagram, com brilho varrendo o ícone.
              </span>
              {logoVariant === 'f' && (
                <span className="text-[10px] text-pink-500 font-bold uppercase tracking-wider">Em uso</span>
              )}
            </button>
            <button
              onClick={() => setLogoVariant('casa')}
              className={`p-5 rounded-3xl border-2 bg-[#121214] flex flex-col items-start gap-3 text-left transition-all ${
                logoVariant === 'casa' ? 'border-pink-500' : 'border-zinc-800 hover:border-zinc-600'
              }`}
            >
              <Logo size="md" variant="casa" />
              <span className="text-sm font-bold text-white">Casa & Coração — novo</span>
              <span className="text-xs text-zinc-500 leading-relaxed">
                Símbolo de família em anel com gradiente, para comparar.
              </span>
              {logoVariant === 'casa' && (
                <span className="text-[10px] text-pink-500 font-bold uppercase tracking-wider">Em uso</span>
              )}
            </button>
          </div>
        </div>

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

        {/* Seção: Banco de Dados */}
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Banco de Dados</h2>
          <p className="text-sm text-zinc-500 mb-4">
            Conexão com o Supabase onde a agenda, o mercado e a família ficam salvos. Funciona em qualquer
            hospedagem (Netlify, GitHub Pages etc.) — é só colar as chaves uma vez em cada navegador.
          </p>
          <div className="bg-[#121214] p-5 rounded-3xl border border-zinc-800">
            <div className="flex items-center gap-2 mb-4">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  connectionState === 'connected' ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
              <span className="text-sm font-bold text-white">
                {connectionState === 'connected'
                  ? 'Conectado ao banco de dados'
                  : 'Sem conexão com o banco de dados'}
              </span>
              {initialConn.fromEnv && connectionState === 'connected' && (
                <span className="text-[10px] text-zinc-500 font-medium">(configurado pelo site)</span>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">Project URL</label>
                <input
                  type="url"
                  value={connUrl}
                  onChange={(e) => setConnUrl(e.target.value)}
                  placeholder="https://xxxx.supabase.co"
                  className="w-full p-3 bg-[#09090b] border border-zinc-800 text-white rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all placeholder-zinc-700 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">Chave anon / public</label>
                <input
                  type="password"
                  value={connAnonKey}
                  onChange={(e) => setConnAnonKey(e.target.value)}
                  placeholder="eyJhbGciOi..."
                  className="w-full p-3 bg-[#09090b] border border-zinc-800 text-white rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all placeholder-zinc-700 text-sm"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={handleSaveConnection}
                  className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-xl transition-colors"
                >
                  Conectar / Salvar
                </button>
                <button
                  onClick={handleDisconnect}
                  className="px-4 py-3 border border-zinc-700 text-zinc-300 text-sm rounded-xl hover:bg-zinc-800 transition-colors"
                >
                  Desconectar
                </button>
              </div>
              <p className="text-[10px] text-zinc-500 leading-relaxed">
                Onde achar: Supabase → Project Settings → API. A chave anon é pública por design (segura para
                ficar no app); quem protege os dados são as políticas de segurança do banco.
              </p>
            </div>
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
                      isSubscribed
                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                        : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                    }`}
                  >
                    {isSubscribed ? 'Ativo' : 'Inativo'}
                  </div>
                </div>
              </div>

              {!isSubscribed ? (
                <button
                  onClick={handleEnablePush}
                  disabled={pushBusy}
                  className="mt-2 w-full py-2.5 bg-blue-500 hover:bg-blue-400 disabled:opacity-60 text-white text-sm font-medium rounded-xl transition-colors"
                >
                  {pushBusy ? 'Ativando...' : 'Ativar push neste aparelho'}
                </button>
              ) : (
                <p className="mt-2 text-[11px] text-emerald-400/90 flex items-center gap-1.5">
                  <span aria-hidden>✓</span> Ativo neste aparelho — você recebe os avisos da família mesmo
                  com o app fechado ou instalado como PWA.
                </p>
              )}

              {/* Métodos de lembrete (admin): quando e quantas vezes avisar — sempre visível */}
              <div className="w-full">
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Métodos de lembrete — quando avisar
                </label>
                <div className="space-y-2">
                  {metodosLembrete.length === 0 && (
                    <p className="text-[10px] text-zinc-500">Nenhum lembrete configurado.</p>
                  )}
                  {metodosLembrete.map((m) => (
                    <div key={m.id} className="flex items-center gap-2">
                      <select
                        value={m.minutosAntes}
                        onChange={(e) =>
                          setMetodosLembrete(
                            metodosLembrete.map((x) =>
                              x.id === m.id
                                ? { ...x, minutosAntes: Number(e.target.value) }
                                : x,
                            ),
                          )
                        }
                        className="flex-1 p-2.5 bg-[#09090b] border border-zinc-800 text-white rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none text-xs"
                      >
                        {getMetodoOptions().map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() =>
                          setMetodosLembrete(metodosLembrete.filter((x) => x.id !== m.id))
                        }
                        className="p-2 text-red-400 hover:bg-red-500/10 rounded-xl transition-colors shrink-0"
                        title="Remover este lembrete"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() =>
                      setMetodosLembrete([...metodosLembrete, { id: newId(), minutosAntes: 60 }])
                    }
                    className="w-full py-2.5 border border-dashed border-zinc-700 text-zinc-400 hover:text-white hover:border-pink-500/50 text-xs font-medium rounded-xl transition-colors"
                  >
                    + Adicionar outro aviso
                  </button>
                </div>
                <p className="text-[10px] text-zinc-500 mt-1.5 leading-relaxed">
                  Cada linha avisa uma vez no horário escolhido. Vale para todos os compromissos e para
                  itens do mercado com data — a notificação chega mesmo com o app fechado.
                </p>
                {scheduledSupported === false && (
                  <p className="text-[10px] text-amber-500/80 mt-1 leading-relaxed">
                    Neste navegador os lembretes com o app fechado dependem do push de servidor. No Chrome do
                    Android eles também funcionam direto no aparelho.
                  </p>
                )}
              </div>

              {/* Testes */}
              <div className="grid grid-cols-2 gap-2 w-full">
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

              {isSubscribed && (
                <button
                  onClick={handleDisablePush}
                  className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-sm font-medium rounded-xl transition-colors"
                >
                  Desativar push neste aparelho
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Modal: Configurar Evolution API */}
        {isEvolutionOpen && (
          <Modal
            onClose={() => setIsEvolutionOpen(false)}
            title="Configurar Evolution API"
            footer={
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsEvolutionOpen(false)}
                  className="flex-1 px-4 py-3 border border-zinc-700 text-zinc-300 rounded-xl hover:bg-zinc-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  form="evolution-form"
                  className="flex-1 px-4 py-3 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-500 transition-colors"
                >
                  Salvar
                </button>
              </div>
            }
          >
            <form id="evolution-form" onSubmit={handleSaveEvolution} className="space-y-4">
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

            </form>
          </Modal>
        )}

        {/* Modal: Novo/Editar membro familiar */}
        {isUserModalOpen && (
          <Modal
            onClose={closeUserModal}
            title={editingUser ? 'Editar Membro' : 'Novo Membro Familiar'}
            footer={
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeUserModal}
                  className="flex-1 px-4 py-3 border border-zinc-700 text-zinc-300 rounded-xl hover:bg-zinc-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  form="member-form"
                  className="flex-1 px-4 py-3 bg-pink-500 text-white font-medium rounded-xl hover:bg-pink-400 transition-colors"
                >
                  {editingUser ? 'Salvar' : 'Cadastrar'}
                </button>
              </div>
            }
          >
            <form id="member-form" onSubmit={handleSaveUser} className="space-y-4">
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

            </form>
          </Modal>
        )}
      </div>
    </div>
  );
};

export default SettingsView;
