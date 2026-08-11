import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import type { FormEvent } from 'react';
import Modal from './Modal';
import Avatar from './Avatar';
import { capitalize, isToday } from '../utils';
import type { FamilyEvent, Notify, User } from '../types';

interface CalendarGridViewProps {
  events: FamilyEvent[];
  setEvents: React.Dispatch<React.SetStateAction<FamilyEvent[]>>;
  users: User[];
  currentUser: User;
  simulateNotifications: Notify;
}

const CalendarGridView = ({
  events,
  setEvents,
  users,
  currentUser,
  simulateNotifications,
}: CalendarGridViewProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newEventDate, setNewEventDate] = useState('');

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const monthName = capitalize(
    new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(currentDate),
  );

  const handlePrevMonth = () =>
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const handleNextMonth = () =>
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const getEventsForDay = (day: number) => {
    const dateStr = new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toDateString();
    return events
      .filter((e) => e.date.toDateString() === dateStr)
      .sort((a, b) => a.time.localeCompare(b.time));
  };

  const handleDayClick = (day: number) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    setSelectedDate(date);
  };

  const openAddModalForDay = (date: Date) => {
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
      .toISOString()
      .split('T')[0];
    setNewEventDate(localDate);
    setSelectedDate(null);
    setIsAddModalOpen(true);
  };

  const handleAddEvent = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const dateParts = String(formData.get('date') ?? '').split('-');
    const eventDate = new Date(
      Number(dateParts[0]),
      Number(dateParts[1]) - 1,
      Number(dateParts[2]),
    );

    const newEvent: FamilyEvent = {
      id: Date.now().toString(),
      title: String(formData.get('title') ?? ''),
      date: eventDate,
      time: String(formData.get('time') ?? ''),
      endTime: String(formData.get('endTime') ?? '') || undefined,
      userId: String(formData.get('userId') ?? ''),
      createdBy: currentUser.id,
    };

    setEvents([...events, newEvent]);
    setIsAddModalOpen(false);
    simulateNotifications(
      'Novo Compromisso (Mês)',
      `${currentUser.name} marcou "${newEvent.title}".`,
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto custom-scrollbar px-4 pb-6 md:px-10 py-4 md:pb-24 bg-[#09090b]">
      <div className="flex justify-between items-center mb-4 md:mb-6 max-w-5xl mx-auto w-full">
        <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">{monthName}</h2>
        <div className="flex gap-2">
          <button
            onClick={handlePrevMonth}
            className="p-2 bg-[#18181b] border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={handleNextMonth}
            className="p-2 bg-[#18181b] border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Legenda de membros: cada cor pertence a um familiar */}
      <div className="max-w-5xl mx-auto w-full flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-4 md:mb-6">
        {users.map((u) => (
          <span
            key={u.id}
            className="flex items-center gap-1.5 text-[11px] md:text-xs font-semibold"
            style={{ color: u.color }}
          >
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: u.color }} />
            {u.name}
          </span>
        ))}
      </div>

      <div className="max-w-5xl mx-auto w-full flex-1 min-h-0 flex flex-col">
        <div className="grid grid-cols-7 gap-1 md:gap-4 mb-2 md:mb-4 shrink-0">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
            <div
              key={day}
              className="text-center text-[10px] md:text-xs font-bold text-zinc-500 uppercase tracking-wider"
            >
              {day}
            </div>
          ))}
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-7 gap-1 md:gap-4 auto-rows-fr md:auto-rows-auto content-start">
          {Array.from({ length: firstDayOfMonth }).map((_, i) => (
            <div key={`empty-${i}`} className="md:h-28 rounded-2xl bg-transparent"></div>
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dayEvents = getEventsForDay(day);
            const isTodayDate = isToday(new Date(currentDate.getFullYear(), currentDate.getMonth(), day));

            return (
              <button
                key={day}
                onClick={() => handleDayClick(day)}
                className={`md:h-28 rounded-xl md:rounded-2xl flex flex-col p-1.5 md:p-2 border transition-all ${
                  isTodayDate ? 'border-pink-500 bg-pink-500/10' : 'border-zinc-800 bg-[#121214] hover:border-zinc-600'
                } ${dayEvents.length > 0 ? 'cursor-pointer' : ''}`}
              >
                <span
                  className={`text-xs md:text-sm font-bold mb-1 ${
                    isTodayDate ? 'text-pink-500' : 'text-zinc-400'
                  } self-end md:self-start`}
                >
                  {day}
                </span>
                <div className="flex-1 flex flex-col gap-1 w-full overflow-hidden">
                  {dayEvents.slice(0, 3).map((event, idx) => {
                    const eventUser = users.find((u) => u.id === event.userId) || currentUser;
                    return (
                      <div
                        key={event.id}
                        title={`${eventUser.name} — ${event.time}${event.endTime ? ` → ${event.endTime}` : ''} — ${event.title}`}
                        className={`w-full rounded-md md:rounded truncate text-left font-semibold text-white/90 md:text-[10px] md:px-1.5 md:py-0.5 ${
                          idx > 1 ? 'hidden md:block' : ''
                        }`}
                        style={{ backgroundColor: eventUser.color }}
                      >
                        {/* Mobile: avatar + hora em destaque, título na linha de baixo */}
                        <span className="md:hidden block w-full px-1 py-0.5">
                          <span className="flex items-center gap-1 min-w-0">
                            <Avatar
                              user={eventUser}
                              className="w-3.5 h-3.5 rounded-full ring-1 ring-white/50 shrink-0 text-[8px]"
                            />
                            <span className="block text-[9px] leading-[11px] font-bold truncate min-w-0">
                              {event.time}
                            </span>
                          </span>
                          <span className="block text-[8px] leading-[10px] text-white/85 truncate">{event.title}</span>
                        </span>
                        {/* Desktop: avatar + hora · título na mesma linha */}
                        <span className="hidden md:flex items-center gap-1 min-w-0">
                          <Avatar
                            user={eventUser}
                            className="w-3 h-3 rounded-full ring-1 ring-white/50 shrink-0 text-[7px]"
                          />
                          <span className="truncate min-w-0">{event.time} · {event.title}</span>
                        </span>
                      </div>
                    );
                  })}
                  {dayEvents.length > 3 && (
                    <div className="text-[9px] md:text-[10px] text-zinc-500 text-left md:pl-1 font-bold">
                      <span className="md:hidden">+{dayEvents.length - 2}</span>
                      <span className="hidden md:inline">+{dayEvents.length - 3}</span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Modal de detalhes do dia */}
      {selectedDate && (
        <Modal
          onClose={() => setSelectedDate(null)}
          title={capitalize(
            new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' }).format(selectedDate),
          )}
        >
          <div className="space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
            {getEventsForDay(selectedDate.getDate()).length > 0 ? (
              getEventsForDay(selectedDate.getDate())
                .sort((a, b) => a.time.localeCompare(b.time))
                .map((event) => {
                  const eventUser = users.find((u) => u.id === event.userId) || currentUser;
                  return (
                    <div
                      key={event.id}
                      className="flex items-stretch gap-3 bg-[#09090b] p-3 rounded-xl border border-zinc-800"
                    >
                      <div
                        className="w-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: eventUser.color }}
                      ></div>
                      <div>
                        <p className="font-bold text-white md:text-lg">{event.title}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-zinc-400 text-xs md:text-sm">
                            {event.time} {event.endTime ? `→ ${event.endTime}` : ''}
                          </span>
                          <span
                            className="flex items-center gap-1 text-[10px] md:text-xs px-2 py-0.5 rounded-full border border-zinc-700 font-bold"
                            style={{ color: eventUser.color, backgroundColor: `${eventUser.color}15` }}
                          >
                            <Avatar
                              user={eventUser}
                              className="w-3.5 h-3.5 rounded-full ring-1 ring-white/30 shrink-0 text-[8px]"
                            />
                            {eventUser.name}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
            ) : (
              <p className="text-zinc-500 italic text-center py-6 text-sm">Sem compromissos neste dia.</p>
            )}
            <button
              onClick={() => openAddModalForDay(selectedDate)}
              className="w-full py-3 mt-4 border border-dashed border-pink-500/50 text-pink-500 hover:bg-pink-500/10 rounded-xl transition-colors font-medium flex items-center justify-center gap-2 text-sm"
            >
              <Plus className="w-4 h-4" /> Adicionar Compromisso
            </button>
          </div>
        </Modal>
      )}

      {/* Modal de novo compromisso (mês) */}
      {isAddModalOpen && (
        <Modal onClose={() => setIsAddModalOpen(false)} title="Novo Compromisso">
          <form onSubmit={handleAddEvent} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">Título</label>
              <input
                type="text"
                name="title"
                required
                placeholder="Ex: Médico, Escola..."
                autoFocus
                className="w-full p-3 bg-[#09090b] border border-zinc-800 text-white rounded-xl focus:ring-2 focus:ring-pink-500 outline-none transition-all placeholder-zinc-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">Data</label>
              <input
                type="date"
                name="date"
                required
                defaultValue={newEventDate}
                className="w-full p-3 bg-[#09090b] border border-zinc-800 text-white rounded-xl focus:ring-2 focus:ring-pink-500 outline-none transition-all"
              />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">Início</label>
                <input
                  type="time"
                  name="time"
                  required
                  className="w-full p-3 bg-[#09090b] border border-zinc-800 text-white rounded-xl focus:ring-2 focus:ring-pink-500 outline-none transition-all"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">Fim (Opcional)</label>
                <input
                  type="time"
                  name="endTime"
                  className="w-full p-3 bg-[#09090b] border border-zinc-800 text-white rounded-xl focus:ring-2 focus:ring-pink-500 outline-none transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">Membro Familiar</label>
              <select
                name="userId"
                defaultValue={currentUser.id}
                className="w-full p-3 bg-[#09090b] border border-zinc-800 text-white rounded-xl focus:ring-2 focus:ring-pink-500 outline-none transition-all appearance-none"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="pt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="flex-1 px-4 py-3 border border-zinc-700 text-zinc-300 rounded-xl hover:bg-zinc-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-3 bg-pink-500 text-white font-medium rounded-xl hover:bg-pink-400 transition-colors"
              >
                Salvar
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default CalendarGridView;
