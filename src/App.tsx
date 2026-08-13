import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import {
  Baby,
  Bell,
  Calendar as CalendarIcon,
  Check,
  ChevronDown,
  LayoutGrid,
  List,
  Settings,
  ShoppingCart,
  Wallet,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Avatar from './components/Avatar';
import Logo from './components/Logo';
import type { LogoVariant } from './components/Logo';
import SplashScreen from './components/SplashScreen';
import CalendarGridView from './components/CalendarGridView';
import CalendarListView from './components/CalendarListView';
import SettingsView from './components/SettingsView';
import ShoppingView from './components/ShoppingView';
import ChildCommitmentsView from './components/ChildCommitmentsView';
import GastosView from './components/GastosView';
import UserSwitcherSheet from './components/UserSwitcherSheet';
import { initialEvents, initialShoppingItems, initialUsers } from './data/initialData';
import type {
  Aviso,
  ChildCommitment,
  EvolutionConfig,
  FamilyEvent,
  Gasto,
  MetodoLembrete,
  ShoppingItem,
  Toast,
  ToastType,
  User,
} from './types';
import { isImageAvatar, timeAgo } from './utils';
import {
  getMetodosLembrete as getMetodosLocal,
  scheduleEventReminders,
  setMetodosLembrete as persistMetodosLocal,
} from './utils/push';
import {
  deleteChildCommitments,
  deleteEvents,
  deleteGastos,
  deleteItems,
  deleteUsers,
  loadAvisos,
  loadFromSupabase,
  loadMetodosLembrete,
  loadPresenca,
  markAllAvisosLidas,
  markAvisoLida,
  markAvisosPorRef,
  saveAviso,
  saveMetodosLembrete,
  sendPushNotification,
  setPresenca,
  syncChildCommitments,
  syncEvents,
  syncGastos,
  syncItems,
  syncUsers,
} from './lib/db';
import { newId } from './lib/db';
import type { FamilyData } from './lib/db';
import { getSupabase as getSupabaseClient, isSupabaseConfigured } from './lib/supabase';

type Tab = 'calendar' | 'shopping' | 'child' | 'gastos' | 'settings';

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'calendar', label: 'Agenda', icon: CalendarIcon },
  { id: 'shopping', label: 'Mercado', icon: ShoppingCart },
  { id: 'child', label: 'Filho', icon: Baby },
  { id: 'gastos', label: 'Gastos', icon: Wallet },
  { id: 'settings', label: 'Configurações', icon: Settings },
];

const App = () => {
  // Começa vazio quando há Supabase (os dados reais carregam em seguida — evita piscar
  // os dados de exemplo); sem conexão, mantém os dados demo para demonstração local.
  const [users, setUsers] = useState<User[]>(() => (isSupabaseConfigured() ? [] : initialUsers));
  const [currentUserId, setCurrentUserId] = useState<string>(initialUsers[0].id);
  // Derivado do id para que cor/foto editadas nas Configurações reflitam na hora
  const currentUser: User = users.find((u) => u.id === currentUserId) ?? users[0] ?? initialUsers[0];
  const [activeTab, setActiveTab] = useState<Tab>('calendar');
  const [isUserSheetOpen, setIsUserSheetOpen] = useState(false);
  const [notifications, setNotifications] = useState<Toast[]>([]);
  const [splashVisible, setSplashVisible] = useState(true);
  const [splashFading, setSplashFading] = useState(false);
  const splashShownAtRef = useRef(Date.now());

  // Teto de segurança do splash: nunca passa de ~6s, mesmo se a carga demorar
  useEffect(() => {
    const fade = window.setTimeout(() => setSplashFading(true), 6000);
    const hide = window.setTimeout(() => setSplashVisible(false), 6350);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(hide);
    };
  }, []);

  const skipSplash = () => {
    setSplashFading(true);
    setTimeout(() => setSplashVisible(false), 400);
  };

  const [calendarView, setCalendarView] = useState<'list' | 'grid'>('list');
  const [evolutionConfig, setEvolutionConfig] = useState<EvolutionConfig>({
    url: '',
    instance: '',
    apiKey: '',
    number: '',
  });
  const [pushGranted, setPushGranted] = useState<boolean>(
    typeof Notification !== 'undefined' ? Notification.permission === 'granted' : false,
  );

  // Modelo de logo escolhido (guardado no navegador)
  const LOGO_KEY = 'familiaapp:logo';
  const [logoVariant, setLogoVariantState] = useState<LogoVariant>(
    () => (localStorage.getItem(LOGO_KEY) as LogoVariant) || 'f',
  );
  const setLogoVariant = (v: LogoVariant) => {
    localStorage.setItem(LOGO_KEY, v);
    setLogoVariantState(v);
  };

  const [events, setEvents] = useState<FamilyEvent[]>(() => (isSupabaseConfigured() ? [] : initialEvents));
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>(() => (isSupabaseConfigured() ? [] : initialShoppingItems));
  const [childCommitments, setChildCommitments] = useState<ChildCommitment[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);

  // Espelhos do estado (para usar em callbacks sem closures antigos)
  const eventsRef = useRef(events);
  const usersRef = useRef(users);
  const itemsRef = useRef(shoppingItems);
  const childRef = useRef(childCommitments);
  const gastosRef = useRef(gastos);
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);
  useEffect(() => {
    usersRef.current = users;
  }, [users]);
  useEffect(() => {
    itemsRef.current = shoppingItems;
  }, [shoppingItems]);
  useEffect(() => {
    childRef.current = childCommitments;
  }, [childCommitments]);
  useEffect(() => {
    gastosRef.current = gastos;
  }, [gastos]);

  // Métodos de lembrete ("quantas vezes / quanto tempo antes"): salvos no
  // navegador E no banco — o cron do servidor usa a mesma configuração.
  const [metodosLembrete, setMetodosLembreteState] = useState<MetodoLembrete[]>(getMetodosLocal);
  const setMetodosLembrete = (metodos: MetodoLembrete[]) => {
    setMetodosLembreteState(metodos);
    persistMetodosLocal(metodos);
    void saveMetodosLembrete(metodos);
  };

  // Avisos entre membros (lido/não lido) + central de avisos
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [isAvisosOpen, setIsAvisosOpen] = useState(false);

  // Presença online/offline: quem está com o app aberto agora (multi-aparelho)
  const [presence, setPresence] = useState<Record<string, boolean>>({});
  const presenceAnnouncedRef = useRef(false);

  // Espelho dos avisos (para re-notificar compromissos importantes sem closures antigos)
  const avisosRef = useRef(avisos);
  useEffect(() => {
    avisosRef.current = avisos;
  }, [avisos]);

  // Só avisos não lidos aparecem: ao marcar como lido, some da lista
  const visibleAvisos = avisos.filter(
    (a) => (a.paraId === 'all' || a.paraId === currentUser.id) && !a.lida,
  );
  const unreadCount = visibleAvisos.length;

  const addAviso = async (
    titulo: string,
    mensagem: string,
    tipo: Aviso['tipo'],
    paraId = 'all',
    refId?: string,
  ): Promise<void> => {
    const aviso: Aviso = {
      id: newId(),
      titulo,
      mensagem,
      deId: currentUser.id,
      paraId,
      tipo,
      refId,
      lida: false,
      criadoEm: new Date().toISOString(),
    };
    setAvisos((prev) => [aviso, ...prev]);
    await saveAviso(aviso);
  };

  const marcarAvisoLida = (id: string) => {
    setAvisos((prev) => prev.filter((a) => a.id !== id));
    void markAvisoLida(id);
  };

  const marcarTodosLidos = () => {
    setAvisos((prev) => prev.filter((a) => a.paraId !== 'all' && a.paraId !== currentUser.id));
    void markAllAvisosLidas();
  };

  // Parceiro visualizou o compromisso → avisos dele somem da lista e param de notificar
  const visualizarCompromisso = (eventId: string) => {
    setAvisos((prev) => prev.filter((a) => a.refId !== eventId));
    void markAvisosPorRef(eventId);
  };

  // Envia um aviso manual direcionado ("Toda a família" ou um membro específico).
  // O aviso fica na central da pessoa até ela marcar como lida (paraId filtra quem vê).
  const enviarAvisoManual = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const mensagem = String(fd.get('mensagem') ?? '').trim();
    const paraId = String(fd.get('paraId') ?? 'all');
    if (!mensagem) return;
    simulatePushAndWhatsapp('Aviso da família', mensagem, paraId, 'aviso');
    e.currentTarget.reset();
  };

  // Reagenda os lembretes sempre que os eventos, o mercado ou os métodos mudarem
  useEffect(() => {
    void scheduleEventReminders(events, shoppingItems);
  }, [events, shoppingItems, metodosLembrete]);

  // Carrega avisos + configuração de lembretes do banco (outros aparelhos)
  useEffect(() => {
    let alive = true;
    const boot = async () => {
      const [dbAvisos, dbMetodos] = await Promise.all([loadAvisos(), loadMetodosLembrete()]);
      if (!alive) return;
      if (dbAvisos.length > 0) setAvisos(dbAvisos);
      if (dbMetodos.length > 0 && !localStorage.getItem('familiapp:metodos-lembrete')) {
        setMetodosLembreteState(dbMetodos);
        persistMetodosLocal(dbMetodos);
      }
    };
    void boot();
    return () => {
      alive = false;
    };
  }, []);

  // Entrega instantânea de avisos entre aparelhos (Supabase Realtime)
  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const channel = supabase
      .channel('avisos-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'avisos' },
        (payload) => {
          const novo = payload.new as Aviso;
          if (!novo?.id) return;
          setAvisos((prev) => (prev.some((a) => a.id === novo.id) ? prev : [novo, ...prev]));
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  // ——— Supabase: conexão, carga e sincronização ———
  // Estado da conexão com o banco (mostra aviso claro se algo não estiver salvando)
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'unconfigured' | 'error'>(
    () => (isSupabaseConfigured() ? 'connecting' : 'unconfigured'),
  );
  // Incrementa para recarregar os dados quando a conexão mudar (ex.: usuário conectou nas Configurações)
  const [connSetup, setConnSetup] = useState(0);

  // Esconde o splash assim que a primeira carga de dados termina (não pisca o visual antigo)
  useEffect(() => {
    if (connectionState === 'connecting') return;
    const elapsed = Date.now() - splashShownAtRef.current;
    const delay = Math.max(0, 1600 - elapsed);
    const fade = window.setTimeout(() => setSplashFading(true), delay);
    const hide = window.setTimeout(() => setSplashVisible(false), delay + 350);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(hide);
    };
  }, [connectionState]);

  // ——— Presença online: marca quem abriu o app, avisa a família e mostra online ———
  useEffect(() => {
    if (connectionState !== 'connected') return;

    const report = (online: boolean) => void setPresenca(currentUserId, online);

    // Avisa (aviso + push) que este usuário entrou no app — uma vez por sessão
    const shouldAnnounce = !presenceAnnouncedRef.current;
    presenceAnnouncedRef.current = true;
    report(true);
    if (shouldAnnounce) {
      const action = `${currentUser.name} está online`;
      const details = `${currentUser.name} abriu o app agora.`;
      void addAviso(action, details, 'presenca', 'all');
      void sendPushNotification(`FamíliaApp: ${action}`, details, '/', 'familiapp-presenca');
      if (pushGranted && typeof Notification !== 'undefined') {
        try {
          new Notification(`FamíliaApp: ${action}`, {
            body: details,
            icon: currentUser.avatar,
            tag: 'familiapp-presenca',
          });
        } catch (err) {
          console.error('Erro no Push Nativo:', err);
        }
      }
    }

    // Heartbeat a cada 30s enquanto o app estiver visível
    const heartbeat = window.setInterval(() => {
      if (document.visibilityState === 'visible') report(true);
    }, 30_000);

    // Saiu da aba / fechou o app -> offline
    const onVisibility = () => {
      report(document.visibilityState === 'visible');
    };
    const onUnload = () => report(false);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeunload', onUnload);

    return () => {
      window.clearInterval(heartbeat);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', onUnload);
      report(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionState, currentUserId]);

  // Compromissos "Alertar": re-notifica a cada 15 min (e ao abrir) até o parceiro visualizar
  useEffect(() => {
    if (connectionState !== 'connected') return;
    const renotify = () => {
      // Agenda (compromissos com "Alertar o parceiro")
      for (const ev of eventsRef.current) {
        if (!ev.alertar || ev.concluido) continue;
        const aviso = avisosRef.current.find((a) => a.refId === ev.id);
        if (!aviso || aviso.lida) continue;
        const owner = usersRef.current.find((u) => u.id === ev.userId);
        const body = `Compromisso de ${owner?.name ?? 'alguém'} às ${ev.time}. Toque para visualizar.`;
        void sendPushNotification(`⚠️ Importante: ${ev.title}`, body, '/', `familiapp-importante-${ev.id}`);
        if (pushGranted && typeof Notification !== 'undefined') {
          try {
            new Notification(`⚠️ Importante: ${ev.title}`, {
              body,
              icon: owner?.avatar ?? currentUser.avatar,
              tag: `familiapp-importante-${ev.id}`,
            });
          } catch (err) {
            console.error('Erro no Push Nativo:', err);
          }
        }
      }
      // Compromissos do Filho com "Alertar"
      for (const c of childRef.current) {
        if (!c.alertar || c.concluido) continue;
        const aviso = avisosRef.current.find((a) => a.refId === c.id);
        if (!aviso || aviso.lida) continue;
        const body = `Compromisso do Filho: "${c.title}". Toque para visualizar.`;
        void sendPushNotification(`⚠️ Filho: ${c.title}`, body, '/', `familiapp-filho-${c.id}`);
        if (pushGranted && typeof Notification !== 'undefined') {
          try {
            new Notification(`⚠️ Filho: ${c.title}`, {
              body,
              icon: currentUser.avatar,
              tag: `familiapp-filho-${c.id}`,
            });
          } catch (err) {
            console.error('Erro no Push Nativo:', err);
          }
        }
      }
    };
    const first = window.setTimeout(renotify, 8000); // depois da carga inicial
    const interval = window.setInterval(renotify, 15 * 60 * 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionState]);

  // Carrega quem está online e escuta mudanças em tempo real (multi-aparelho)
  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    let alive = true;

    const refresh = async () => {
      const map = await loadPresenca();
      if (alive) setPresence(map);
    };
    void refresh();
    const interval = window.setInterval(refresh, 30_000);

    const channel = supabase
      .channel('presenca-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'presenca' },
        (payload) => {
          if (!alive) return;
          const row = (payload.new ?? payload.old) as
            | { membro_id?: string; online?: boolean; atualizado_em?: string }
            | undefined;
          const id = row?.membro_id ? String(row.membro_id) : null;
          if (!id || !row) return;
          if (payload.eventType === 'DELETE') {
            setPresence((prev) => {
              if (!(id in prev)) return prev;
              const next = { ...prev };
              delete next[id];
              return next;
            });
            return;
          }
          const updated = new Date(String(row.atualizado_em ?? '')).getTime();
          const online = Boolean(row.online) && !Number.isNaN(updated) && Date.now() - updated < 90_000;
          setPresence((prev) => (prev[id] === online ? prev : { ...prev, [id]: online }));
        },
      )
      .subscribe();

    return () => {
      alive = false;
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [connectionState]);

  // Último estado já confirmado no banco (para detectar mudanças locais pendentes)
  const lastEventsRef = useRef<FamilyEvent[]>(isSupabaseConfigured() ? [] : initialEvents);
  const lastUsersRef = useRef<User[]>(isSupabaseConfigured() ? [] : initialUsers);
  const lastItemsRef = useRef<ShoppingItem[]>(isSupabaseConfigured() ? [] : initialShoppingItems);
  const lastChildRef = useRef<ChildCommitment[]>([]);
  const lastGastosRef = useRef<Gasto[]>([]);

  // Aplica os dados vindos do servidor sem apagar mudanças locais ainda não sincronizadas
  const applyServerData = (data: FamilyData) => {
    const hasLocalPending =
      lastEventsRef.current !== eventsRef.current ||
      lastUsersRef.current !== usersRef.current ||
      lastItemsRef.current !== itemsRef.current ||
      lastChildRef.current !== childRef.current ||
      lastGastosRef.current !== gastosRef.current;
    if (hasLocalPending) return;
    lastEventsRef.current = data.events;
    lastUsersRef.current = data.users;
    lastItemsRef.current = data.items;
    lastChildRef.current = data.child;
    lastGastosRef.current = data.gastos;
    setEvents(data.events);
    setUsers(data.users);
    setShoppingItems(data.items);
    setChildCommitments(data.child);
    setGastos(data.gastos);
    setCurrentUserId((cur) => (data.users.some((u) => u.id === cur) ? cur : data.users[0]?.id ?? cur));
    setConnectionState('connected');
  };

  // Carga inicial + recarrega quando a aba volta a ficar visível (multi-dispositivo)
  useEffect(() => {
    let alive = true;
    let attempts = 0;
    let timer: number | undefined;

    const load = async () => {
      if (document.visibilityState === 'hidden') return;
      const data = await loadFromSupabase();
      if (!alive) return;
      if (data) {
        attempts = 0;
        applyServerData(data);
      } else {
        setConnectionState(isSupabaseConfigured() ? 'error' : 'unconfigured');
        // Tenta reconectar sozinho (até 5 vezes, a cada 5s)
        if (attempts < 5) {
          attempts += 1;
          timer = window.setTimeout(load, 5000);
        }
      }
    };

    void load();
    window.addEventListener('focus', load);
    document.addEventListener('visibilitychange', load);
    return () => {
      alive = false;
      if (timer) window.clearTimeout(timer);
      window.removeEventListener('focus', load);
      document.removeEventListener('visibilitychange', load);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connSetup]);

  // Sincroniza automaticamente cada mudança com o Supabase (com aviso se falhar)
  useEffect(() => {
    const prev = lastEventsRef.current;
    if (prev === events) return;
    lastEventsRef.current = events;
    const removed = prev.filter((e) => !events.some((n) => n.id === e.id)).map((e) => e.id);
    void syncEvents(events).then((ok) => {
      if (!ok && isSupabaseConfigured()) {
        showNotification('Erro ao salvar', 'Não foi possível salvar os compromissos. Verifique a conexão.', 'error');
      }
    });
    if (removed.length > 0) void deleteEvents(removed);
  }, [events]);

  useEffect(() => {
    const prev = lastUsersRef.current;
    if (prev === users) return;
    lastUsersRef.current = users;
    const removed = prev.filter((u) => !users.some((n) => n.id === u.id)).map((u) => u.id);
    void syncUsers(users).then((ok) => {
      if (!ok && isSupabaseConfigured()) {
        showNotification('Erro ao salvar', 'Não foi possível salvar os membros da família. Verifique a conexão.', 'error');
      }
    });
    if (removed.length > 0) void deleteUsers(removed);
  }, [users]);

  useEffect(() => {
    const prev = lastItemsRef.current;
    if (prev === shoppingItems) return;
    lastItemsRef.current = shoppingItems;
    const removed = prev.filter((i) => !shoppingItems.some((n) => n.id === i.id)).map((i) => i.id);
    void syncItems(shoppingItems).then((ok) => {
      if (!ok && isSupabaseConfigured()) {
        showNotification('Erro ao salvar', 'Não foi possível salvar o mercado. Verifique a conexão.', 'error');
      }
    });
    // Exclusão real no banco (senão o item voltava ao recarregar)
    if (removed.length > 0) void deleteItems(removed);
  }, [shoppingItems]);

  useEffect(() => {
    const prev = lastChildRef.current;
    if (prev === childCommitments) return;
    lastChildRef.current = childCommitments;
    const removed = prev.filter((c) => !childCommitments.some((n) => n.id === c.id)).map((c) => c.id);
    void syncChildCommitments(childCommitments).then((ok) => {
      if (!ok && isSupabaseConfigured()) {
        showNotification(
          'Erro ao salvar',
          'Não foi possível salvar os compromissos do Filho. Verifique a conexão.',
          'error',
        );
      }
    });
    if (removed.length > 0) void deleteChildCommitments(removed);
  }, [childCommitments]);

  useEffect(() => {
    const prev = lastGastosRef.current;
    if (prev === gastos) return;
    lastGastosRef.current = gastos;
    const removed = prev.filter((g) => !gastos.some((n) => n.id === g.id)).map((g) => g.id);
    void syncGastos(gastos).then((ok) => {
      if (!ok && isSupabaseConfigured()) {
        showNotification('Erro ao salvar', 'Não foi possível salvar os gastos. Verifique a conexão.', 'error');
      }
    });
    if (removed.length > 0) void deleteGastos(removed);
  }, [gastos]);

  // Gasto vira "quitado" automaticamente quando todas as parcelas são concluídas
  // (as parcelas pagas saem do calendário, como no quitado manual)
  useEffect(() => {
    const fechados = gastos
      .filter((g) => !g.quitado)
      .filter((g) => {
        const evs = events.filter((e) => e.gastoId === g.id);
        return evs.length > 0 && evs.every((e) => e.concluido);
      });
    if (fechados.length === 0) return;
    const ids = new Set(fechados.map((g) => g.id));
    setGastos((prev) => prev.map((g) => (ids.has(g.id) ? { ...g, quitado: true } : g)));
    setEvents((prev) => prev.filter((e) => !e.gastoId || !ids.has(e.gastoId)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  // Setters usados pelas views (a sincronização acontece nos efeitos acima)
  const setEventsSynced: React.Dispatch<React.SetStateAction<FamilyEvent[]>> = (value) => setEvents(value);
  const setUsersSynced: React.Dispatch<React.SetStateAction<User[]>> = (value) => setUsers(value);
  const setShoppingItemsSynced: React.Dispatch<React.SetStateAction<ShoppingItem[]>> = (value) => setShoppingItems(value);
  const setChildCommitmentsSynced: React.Dispatch<React.SetStateAction<ChildCommitment[]>> = (value) =>
    setChildCommitments(value);
  const setGastosSynced: React.Dispatch<React.SetStateAction<Gasto[]>> = (value) => setGastos(value);

  // Gastos → calendário: substitui os compromissos de parcela de um gasto pelos novos
  const syncGastoEvents = (gastoId: string, eventos: FamilyEvent[]) => {
    setEvents((prev) => [...prev.filter((e) => e.gastoId !== gastoId), ...eventos]);
  };

  const showNotification = (title: string, message: string, type: ToastType = 'info') => {
    const id = Date.now();
    setNotifications((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 5000);
  };

  const simulatePushAndWhatsapp = (
    action: string,
    details: string,
    paraId = 'all',
    tipo: Aviso['tipo'] = 'aviso',
    refId?: string,
  ) => {
    showNotification('Aviso Processado', `"${action}" foi registrado.`, 'success');

    // Aviso persistente (lido/não lido, com foto do remetente)
    void addAviso(action, details, tipo, paraId, refId);

    // Web Push real: avisa todos os aparelhos da família, mesmo com o app fechado
    // ou instalado como PWA (a tag igual evita notificação duplicada neste aparelho).
    void sendPushNotification(`FamíliaApp: ${action}`, details, '/', 'familiapp-notify');

    if (pushGranted && typeof Notification !== 'undefined') {
      try {
        new Notification(`FamíliaApp: ${action}`, {
          body: details,
          icon: currentUser.avatar,
          tag: 'familiapp-notify',
        });
      } catch (e) {
        console.error('Erro no Push Nativo:', e);
      }
    }

    if (evolutionConfig.url && evolutionConfig.instance && evolutionConfig.apiKey && evolutionConfig.number) {
      const sendWhatsApp = async () => {
        const endpoint = `${evolutionConfig.url}/message/sendText/${evolutionConfig.instance}`;
        try {
          console.log(`[EVOLUTION API] Disparando requisição real para: ${endpoint}`);

          /* CÓDIGO DE PRODUÇÃO (Descomente se estiver rodando localmente sem bloqueio CORS)
          const payload = {
            number: evolutionConfig.number,
            options: { delay: 1200, presence: 'composing' },
            textMessage: {
              text: `*FamíliaApp - ${action}*\n${details}\n\n_Enviado por: ${currentUser.name}_`,
            },
          };

          await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: evolutionConfig.apiKey,
            },
            body: JSON.stringify(payload),
          });
          */
        } catch (error) {
          console.error('[EVOLUTION API] Erro na requisição:', error);
        }
      };
      sendWhatsApp();
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen supports-[height:100dvh]:h-dvh bg-[#09090b] text-white font-sans overflow-hidden selection:bg-pink-500/30">
      {/* Efeito de abertura (splash) */}
      {splashVisible && <SplashScreen fading={splashFading} onSkip={skipSplash} variant={logoVariant} />}

      {/* Header mobile */}
      <div className="md:hidden flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 bg-[#121214] border-b border-zinc-800 shrink-0 z-20 relative">
        <Logo size="sm" variant={logoVariant} />
        <div className="flex items-center gap-2">
          {/* Sino de avisos com badge de não lidos */}
          <button
            onClick={() => setIsAvisosOpen(true)}
            className="relative p-2 text-zinc-300 hover:text-white transition-colors"
            aria-label="Avisos"
          >
            <Bell className="w-6 h-6" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-pink-500 text-white text-[10px] font-bold flex items-center justify-center aviso-badge-pop">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
          {/* Entrar como: toque aqui para selecionar quem está usando o app (sem senha) */}
          <button
            onClick={() => setIsUserSheetOpen(true)}
            className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full bg-zinc-800/70 border border-zinc-700/70 active:ring-2 active:ring-pink-500/60 transition-all"
            aria-label="Entrar como outro usuário"
          >
            <span className="relative shrink-0">
              <Avatar
                user={currentUser}
                className="w-7 h-7 rounded-full text-sm shadow-inner border border-zinc-700/50"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#121214]" />
            </span>
            <span className="text-xs font-bold text-white max-w-[72px] truncate">
              {currentUser.name}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          </button>
        </div>
      </div>

      {/* Sidebar (desktop) */}
      <div className="hidden md:flex flex-col w-64 bg-[#121214] border-r border-zinc-800 shrink-0">
        <div className="p-6 items-center gap-3 shrink-0 flex">
          <Logo size="md" variant={logoVariant} />
        </div>

        <div className="flex-1 py-4 px-4 space-y-2 overflow-y-auto custom-scrollbar">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all font-medium ${
                activeTab === tab.id
                  ? 'bg-pink-500 text-white shadow-md shadow-pink-500/20'
                  : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
              }`}
            >
              <tab.icon className="w-5 h-5" /> {tab.label}
            </button>
          ))}
        </div>

        <div className="p-4 border-t border-zinc-800 shrink-0 bg-[#121214]">
          <button
            onClick={() => setIsAvisosOpen(true)}
            className="w-full flex items-center gap-3 p-3 rounded-xl text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200 transition-all font-medium mb-2"
          >
            <Bell className="w-5 h-5" />
            <span className="flex-1 text-left">Avisos</span>
            {unreadCount > 0 && (
              <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-pink-500 text-white text-[10px] font-bold flex items-center justify-center aviso-badge-pop">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 px-2">
            Logado como:
          </div>
          <div className="flex items-center gap-3 bg-[#09090b] border border-zinc-800 rounded-xl p-2">
            <span className="relative shrink-0">
              <Avatar
                user={currentUser}
                className="w-10 h-10 rounded-full text-xl shadow-inner border border-zinc-700/50 shrink-0"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#09090b]" />
            </span>
            <select
              value={currentUser.id}
              onChange={(e) => setCurrentUserId(e.target.value)}
              className="flex-1 bg-transparent text-white text-sm outline-none appearance-none cursor-pointer font-medium min-w-0"
              style={{ borderLeftWidth: '4px', borderLeftColor: currentUser.color, paddingLeft: '8px' }}
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {isImageAvatar(u.avatar) ? u.name : `${u.avatar} ${u.name}`}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Área de conteúdo principal */}
      <div className="flex-1 overflow-hidden flex flex-col relative z-0">
        {/* Aviso de conexão com o banco (nunca falha em silêncio) */}
        {(connectionState === 'error' || connectionState === 'unconfigured') && (
          <div className="shrink-0 px-4 py-2.5 bg-amber-500/15 border-b border-amber-500/30 text-amber-300 text-xs font-medium flex items-center gap-2 z-30 relative">
            <span aria-hidden>⚠️</span>
            <span className="flex-1">
              {connectionState === 'unconfigured'
                ? 'Sem conexão com o banco de dados: as alterações não serão salvas entre dispositivos.'
                : 'Sem conexão com o servidor de dados — tentando reconectar. As alterações podem não ser salvas.'}
            </span>
            {connectionState === 'unconfigured' && (
              <button
                onClick={() => setActiveTab('settings')}
                className="shrink-0 px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 font-bold transition-colors"
              >
                Configurar
              </button>
            )}
          </div>
        )}
        {/* Toggle de visualização da agenda */}
        {activeTab === 'calendar' && (
          <div className="px-4 pt-4 md:px-10 flex justify-end shrink-0 bg-[#09090b] z-10">
            <div className="bg-[#121214] p-1 rounded-xl border border-zinc-800 flex gap-1 shadow-sm">
              <button
                onClick={() => setCalendarView('list')}
                className={`p-2 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium ${
                  calendarView === 'list' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <List className="w-4 h-4" /> <span className="hidden sm:inline">Lista</span>
              </button>
              <button
                onClick={() => setCalendarView('grid')}
                className={`p-2 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium ${
                  calendarView === 'grid' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <LayoutGrid className="w-4 h-4" /> <span className="hidden sm:inline">Mês</span>
              </button>
            </div>
          </div>
        )}

        {/* Renderização das views */}
        {activeTab === 'calendar' && calendarView === 'list' && (
          <CalendarListView
            events={events}
            setEvents={setEventsSynced}
            users={users}
            currentUser={currentUser}
            simulateNotifications={simulatePushAndWhatsapp}
            onVisualizarCompromisso={visualizarCompromisso}
          />
        )}
        {activeTab === 'calendar' && calendarView === 'grid' && (
          <CalendarGridView
            events={events}
            setEvents={setEventsSynced}
            users={users}
            currentUser={currentUser}
            simulateNotifications={simulatePushAndWhatsapp}
            onVisualizarCompromisso={visualizarCompromisso}
          />
        )}
        {activeTab === 'shopping' && (
          <ShoppingView
            items={shoppingItems}
            setItems={setShoppingItemsSynced}
            currentUser={currentUser}
            users={users}
            simulateNotifications={simulatePushAndWhatsapp}
          />
        )}
        {activeTab === 'child' && (
          <ChildCommitmentsView
            commitments={childCommitments}
            setCommitments={setChildCommitmentsSynced}
            currentUser={currentUser}
            simulateNotifications={simulatePushAndWhatsapp}
            onVisualizarCompromisso={visualizarCompromisso}
          />
        )}
        {activeTab === 'gastos' && (
          <GastosView
            gastos={gastos}
            setGastos={setGastosSynced}
            events={events}
            currentUser={currentUser}
            users={users}
            simulateNotifications={simulatePushAndWhatsapp}
            onSyncCalendarEvents={syncGastoEvents}
          />
        )}
        {activeTab === 'settings' && (
          <SettingsView
            users={users}
            setUsers={setUsersSynced}
            evolutionConfig={evolutionConfig}
            setEvolutionConfig={setEvolutionConfig}
            setPushGranted={setPushGranted}
            metodosLembrete={metodosLembrete}
            setMetodosLembrete={setMetodosLembrete}
            presence={presence}
            showNotification={showNotification}
            logoVariant={logoVariant}
            setLogoVariant={setLogoVariant}
            connectionState={connectionState}
            onConnectionSaved={() => setConnSetup((n) => n + 1)}
          />
        )}
      </div>

      {/* Navegação inferior (mobile, estilo app nativo) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#121214]/95 backdrop-blur border-t border-zinc-800 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-stretch">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center gap-1 pt-3 pb-2 text-[10px] font-semibold transition-colors ${
                activeTab === tab.id ? 'text-pink-500' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Bottom sheet de troca de usuário (mobile) */}
      {isUserSheetOpen && (
        <UserSwitcherSheet
          users={users}
          currentUser={currentUser}
          presence={presence}
          onSelect={(id) => {
            setCurrentUserId(id);
            setIsUserSheetOpen(false);
          }}
          onManageProfiles={() => {
            setActiveTab('settings');
            setIsUserSheetOpen(false);
          }}
          onClose={() => setIsUserSheetOpen(false)}
        />
      )}

      {/* Central de avisos (lido/não lido, com foto do remetente) */}
      {isAvisosOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in"
            onClick={() => setIsAvisosOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 md:inset-auto md:top-20 md:right-4 md:w-96 md:max-h-[70vh] bg-[#121214] border-t md:border border-zinc-800 md:rounded-3xl rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom-5 md:slide-in-from-top-5 duration-200 flex flex-col">
            <div className="flex items-center justify-between gap-2 p-4 border-b border-zinc-800 shrink-0">
              <h3 className="text-lg font-bold text-white flex items-center gap-2 min-w-0">
                <Bell className="w-5 h-5 text-pink-500 shrink-0" />
                <span className="truncate">Avisos</span>
                {unreadCount > 0 && (
                  <span className="text-xs bg-pink-500/20 text-pink-400 px-2 py-0.5 rounded-full font-bold shrink-0">
                    {unreadCount} não lidos
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={marcarTodosLidos}
                  className="text-xs text-zinc-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                >
                  Marcar todos
                </button>
                <button
                  onClick={() => setIsAvisosOpen(false)}
                  className="p-2 bg-zinc-800/50 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-full transition-colors"
                  aria-label="Fechar avisos"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            {/* Enviar aviso: direciona para um membro e fica lá até ser lido */}
            <form onSubmit={enviarAvisoManual} className="p-4 border-b border-zinc-800 shrink-0 space-y-3">
              <label htmlFor="aviso-mensagem" className="block text-xs font-medium text-zinc-400">
                Enviar aviso para a família
              </label>
              <textarea
                id="aviso-mensagem"
                name="mensagem"
                required
                rows={2}
                placeholder='Ex.: "Cheguei em casa", "Lembra do compromisso..."'
                className="w-full p-3 bg-[#09090b] border border-zinc-800 text-white rounded-xl focus:ring-2 focus:ring-pink-500 outline-none transition-all placeholder-zinc-700 text-sm resize-none"
              />
              <div className="flex gap-2">
                <select
                  name="paraId"
                  defaultValue="all"
                  className="flex-1 min-w-0 p-2.5 bg-[#09090b] border border-zinc-800 text-white rounded-xl focus:ring-2 focus:ring-pink-500 outline-none transition-all appearance-none text-sm"
                >
                  <option value="all">Toda a família</option>
                  {users
                    .filter((u) => u.id !== currentUser.id)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        Apenas {u.name}
                      </option>
                    ))}
                </select>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-pink-500 hover:bg-pink-400 text-white text-sm font-bold rounded-xl transition-colors shrink-0"
                >
                  Enviar
                </button>
              </div>
            </form>
            <div className="overflow-y-auto custom-scrollbar flex-1 max-h-[62dvh] md:max-h-[55vh]">
              {visibleAvisos.length === 0 ? (
                <div className="text-center text-zinc-500 text-sm py-12 px-4">
                  Nenhum aviso pendente. Quando alguém marcar um compromisso ou avisar a família, aparece aqui —
                  e some quando você marcar como lido.
                </div>
              ) : (
                <div className="divide-y divide-zinc-800/70">
                  {visibleAvisos.map((a) => {
                    const sender = users.find((u) => u.id === a.deId);
                    return (
                      <div key={a.id} className="flex items-start gap-3 p-4 bg-pink-500/[0.04]">
                        <span className="relative shrink-0">
                          <Avatar
                            user={sender ?? currentUser}
                            className="w-10 h-10 rounded-full text-lg shrink-0 aviso-avatar-unread"
                            style={
                              sender
                                ? { boxShadow: `0 0 0 2px ${sender.color}` }
                                : undefined
                            }
                          />
                          {sender && presence[sender.id] && (
                            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#121214]" />
                          )}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-bold text-white truncate">{a.titulo}</p>
                            <span className="text-[10px] text-zinc-500 shrink-0">{timeAgo(a.criadoEm)}</span>
                          </div>
                          <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{a.mensagem}</p>
                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            <span
                              className="text-[10px] font-bold uppercase tracking-wider"
                              style={{ color: sender?.color ?? '#a855f7' }}
                            >
                              {sender?.name ?? 'Família'}
                            </span>
                            <button
                              onClick={() => marcarAvisoLida(a.id)}
                              className="text-[10px] text-pink-400 font-semibold hover:text-pink-300 flex items-center gap-1"
                            >
                              <Check className="w-3 h-3" /> Marcar como lida
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toaster de notificações */}
      <div className="fixed bottom-20 md:bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none">
        {notifications.map((n) => (
          <div
            key={n.id}
            className="bg-zinc-800 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-5 fade-in border border-zinc-700 pointer-events-auto"
          >
            {n.type === 'success' ? (
              <Check className="w-5 h-5 text-emerald-400" />
            ) : (
              <Bell className="w-5 h-5 text-blue-400" />
            )}
            <div>
              <p className="font-bold text-sm">{n.title}</p>
              <p className="text-xs text-zinc-300">{n.message}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;
