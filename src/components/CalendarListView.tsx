import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { FormEvent } from 'react';
import Modal from './Modal';
import Avatar from './Avatar';
import { isToday } from '../utils';
import type { FamilyEvent, Notify, User } from '../types';

interface CalendarListViewProps {
  events: FamilyEvent[];
  setEvents: React.Dispatch<React.SetStateAction<FamilyEvent[]>>;
  users: User[];
  currentUser: User;
  simulateNotifications: Notify;
}

const CalendarListView = ({
  events,
  setEvents,
  users,
  currentUser,
  simulateNotifications,
}: CalendarListViewProps) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

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
      'Novo Compromisso',
      `${currentUser.name} marcou "${newEvent.title}".`,
    );
  };

  // Agrupa eventos por data
  const groupedEvents = events.reduce<Record<string, { date: Date; events: FamilyEvent[] }>>(
    (acc, event) => {
      const dateStr = event.date.toDateString();
      if (!acc[dateStr]) acc[dateStr] = { date: event.date, events: [] };
      acc[dateStr].events.push(event);
      return acc;
    },
    {},
  );

  // Ordena as datas
  const sortedDates = Object.values(groupedEvents).sort((a, b) => a.date.getTime() - b.date.getTime());

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar bg-black text-white relative">
      <div className="max-w-3xl mx-auto p-4 md:p-8 pb-32">
        {/* Legenda de membros: cada cor pertence a um familiar */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-8">
          {users.map((u) => (
            <span
              key={u.id}
              className="flex items-center gap-1.5 text-xs font-semibold"
              style={{ color: u.color }}
            >
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: u.color }} />
              {u.name}
            </span>
          ))}
        </div>

        {sortedDates.map((group, index) => {
          const groupIsToday = isToday(group.date);
          const dayNumber = group.date.getDate();
          const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(group.date);
          const monthYear = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(group.date);

          return (
            <div key={index} className="mb-10">
              {/* Cabeçalho da data */}
              <div className="flex justify-between items-end mb-6 pb-2 border-b border-zinc-900">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl md:text-5xl font-bold tracking-tight">{dayNumber}</span>
                  {groupIsToday && (
                    <span className="text-pink-500 text-lg md:text-2xl tracking-widest font-semibold uppercase">
                      Today
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-sm md:text-base font-medium text-zinc-300">{dayName}</div>
                  <div className="text-xs md:text-sm text-zinc-500">{monthYear}</div>
                </div>
              </div>

              {/* Lista de eventos */}
              <div className="space-y-5">
                {[...group.events]
                  .sort((a, b) => a.time.localeCompare(b.time))
                  .map((event) => {
                    const eventUser = users.find((u) => u.id === event.userId) || currentUser;
                    return (
                      <div key={event.id} className="flex items-start gap-4 group">
                        {/* Barra colorida */}
                        <div
                          className="w-1.5 h-12 rounded-full shrink-0"
                          style={{ backgroundColor: eventUser.color }}
                        ></div>

                        <div className="flex-1 pt-0.5">
                          <h4 className="text-lg md:text-xl font-bold text-zinc-100 group-hover:text-white transition-colors">
                            {event.title}
                          </h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs md:text-sm font-medium text-zinc-500">
                              {event.time} {event.endTime ? `→ ${event.endTime}` : ''}
                            </span>
                            <span
                              className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border border-zinc-800 font-bold"
                              style={{
                                color: eventUser.color,
                                backgroundColor: `${eventUser.color}15`,
                              }}
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
                  })}
              </div>
            </div>
          );
        })}
        {sortedDates.length === 0 && (
          <div className="text-center text-zinc-500 mt-20">Nenhum compromisso agendado.</div>
        )}
      </div>

      {/* Botão flutuante (FAB) */}
      <button
        onClick={() => setIsAddModalOpen(true)}
        className="absolute bottom-24 md:bottom-8 right-8 w-16 h-16 bg-pink-500 hover:bg-pink-400 text-white rounded-full shadow-[0_0_20px_rgba(236,72,153,0.4)] flex items-center justify-center transition-transform hover:scale-105 z-10"
      >
        <Plus className="w-8 h-8" />
      </button>

      {/* Modal de novo compromisso */}
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
                defaultValue={new Date().toISOString().split('T')[0]}
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

export default CalendarListView;
