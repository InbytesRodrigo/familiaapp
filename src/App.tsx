import { useEffect, useState } from 'react';
import {
  Bell,
  Calendar as CalendarIcon,
  Check,
  LayoutGrid,
  List,
  Settings,
  ShoppingCart,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Avatar from './components/Avatar';
import Logo from './components/Logo';
import SplashScreen from './components/SplashScreen';
import CalendarGridView from './components/CalendarGridView';
import CalendarListView from './components/CalendarListView';
import SettingsView from './components/SettingsView';
import ShoppingView from './components/ShoppingView';
import UserSwitcherSheet from './components/UserSwitcherSheet';
import { initialEvents, initialShoppingItems, initialUsers } from './data/initialData';
import type { EvolutionConfig, FamilyEvent, ShoppingItem, Toast, ToastType, User } from './types';
import { isImageAvatar } from './utils';
import { getReminderOffset, scheduleEventReminders, setReminderOffset as persistReminderOffset } from './utils/push';
import type { ReminderOffset } from './utils/push';

type Tab = 'calendar' | 'shopping' | 'settings';

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'calendar', label: 'Agenda', icon: CalendarIcon },
  { id: 'shopping', label: 'Mercado', icon: ShoppingCart },
  { id: 'settings', label: 'Configurações', icon: Settings },
];

const App = () => {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [currentUserId, setCurrentUserId] = useState<string>(initialUsers[0].id);
  // Derivado do id para que cor/foto editadas nas Configurações reflitam na hora
  const currentUser: User = users.find((u) => u.id === currentUserId) ?? users[0];
  const [activeTab, setActiveTab] = useState<Tab>('calendar');
  const [isUserSheetOpen, setIsUserSheetOpen] = useState(false);
  const [notifications, setNotifications] = useState<Toast[]>([]);
  const [splashVisible, setSplashVisible] = useState(true);
  const [splashFading, setSplashFading] = useState(false);

  // Efeito de abertura estilo app: mostra a logo e some sozinho
  useEffect(() => {
    const t1 = setTimeout(() => setSplashFading(true), 1900);
    const t2 = setTimeout(() => setSplashVisible(false), 2350);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
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

  const [events, setEvents] = useState<FamilyEvent[]>(initialEvents);
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>(initialShoppingItems);

  // Lembretes de compromissos (Notification Triggers): funcionam com o app fechado
  const [reminderOffset, setReminderOffsetState] = useState<ReminderOffset>(getReminderOffset);
  const setReminderOffset = (value: ReminderOffset) => {
    persistReminderOffset(value);
    setReminderOffsetState(value);
  };

  // Reagenda os lembretes sempre que os eventos ou a preferência mudarem
  useEffect(() => {
    scheduleEventReminders(events);
  }, [events, reminderOffset]);

  const showNotification = (title: string, message: string, type: ToastType = 'info') => {
    const id = Date.now();
    setNotifications((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 5000);
  };

  const simulatePushAndWhatsapp = (action: string, details: string) => {
    showNotification('Aviso Processado', `"${action}" foi registrado.`, 'success');

    if (pushGranted && typeof Notification !== 'undefined') {
      try {
        new Notification(`FamíliaApp: ${action}`, { body: details, icon: currentUser.avatar });
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
      {splashVisible && <SplashScreen fading={splashFading} onSkip={skipSplash} />}

      {/* Header mobile */}
      <div className="md:hidden flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 bg-[#121214] border-b border-zinc-800 shrink-0 z-20 relative">
        <Logo size="sm" />
        {/* Toque no avatar para trocar de usuário */}
        <button
          onClick={() => setIsUserSheetOpen(true)}
          className="rounded-full ring-2 ring-zinc-700 active:ring-pink-500 transition-all"
          aria-label="Trocar de usuário"
        >
          <Avatar
            user={currentUser}
            className="w-9 h-9 rounded-full text-lg shadow-inner border border-zinc-700/50"
          />
        </button>
      </div>

      {/* Sidebar (desktop) */}
      <div className="hidden md:flex flex-col w-64 bg-[#121214] border-r border-zinc-800 shrink-0">
        <div className="p-6 items-center gap-3 shrink-0 flex">
          <Logo size="md" />
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
          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 px-2">
            Logado como:
          </div>
          <div className="flex items-center gap-3 bg-[#09090b] border border-zinc-800 rounded-xl p-2">
            <Avatar
              user={currentUser}
              className="w-10 h-10 rounded-full text-xl shadow-inner border border-zinc-700/50 shrink-0"
            />
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
            setEvents={setEvents}
            users={users}
            currentUser={currentUser}
            simulateNotifications={simulatePushAndWhatsapp}
          />
        )}
        {activeTab === 'calendar' && calendarView === 'grid' && (
          <CalendarGridView
            events={events}
            setEvents={setEvents}
            users={users}
            currentUser={currentUser}
            simulateNotifications={simulatePushAndWhatsapp}
          />
        )}
        {activeTab === 'shopping' && (
          <ShoppingView
            items={shoppingItems}
            setItems={setShoppingItems}
            currentUser={currentUser}
            users={users}
            simulateNotifications={simulatePushAndWhatsapp}
          />
        )}
        {activeTab === 'settings' && (
          <SettingsView
            users={users}
            setUsers={setUsers}
            evolutionConfig={evolutionConfig}
            setEvolutionConfig={setEvolutionConfig}
            pushGranted={pushGranted}
            setPushGranted={setPushGranted}
            reminderOffset={reminderOffset}
            setReminderOffset={setReminderOffset}
            showNotification={showNotification}
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
