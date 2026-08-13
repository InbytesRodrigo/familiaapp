import { useState } from 'react';
import { BarChart3, ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
import type { FormEvent } from 'react';
import Modal from './Modal';
import Avatar from './Avatar';
import { capitalize, isToday, toDateInput } from '../utils';
import { newId } from '../lib/db';
import type { FamilyEvent, Notify, User } from '../types';

interface CalendarGridViewProps {
  events: FamilyEvent[];
  setEvents: React.Dispatch<React.SetStateAction<FamilyEvent[]>>;
  users: User[];
  currentUser: User;
  simulateNotifications: Notify;
  /** Chamado quando o parceiro abre o compromisso (marca os avisos como lidos). */
  onVisualizarCompromisso: (eventId: string) => void;
}

const CalendarGridView = ({
  events,
  setEvents,
  users,
  currentUser,
  simulateNotifications,
  onVisualizarCompromisso,
}: CalendarGridViewProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [newEventDate, setNewEventDate] = useState('');
  const [editingEvent, setEditingEvent] = useState<FamilyEvent | null>(null);

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const monthName = capitalize(
    new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(currentDate),
  );

  // ——— Resumo do mês ———
  const monthEvents = events.filter(
    (e) =>
      e.date.getFullYear() === currentDate.getFullYear() &&
      e.date.getMonth() === currentDate.getMonth(),
  );
  const totalEvents = monthEvents.length;

  const countsByUser = users.map((user) => ({
    user,
    count: monthEvents.filter((e) => e.userId === user.id).length,
  }));

  const dayCounts = Array.from({ length: daysInMonth }, (_, i) => ({
    day: i + 1,
    count: monthEvents.filter((e) => e.date.getDate() === i + 1).length,
  }));
  const minDayCount = dayCounts.reduce((min, d) => Math.min(min, d.count), Infinity);
  const bestDays = dayCounts.filter((d) => d.count === minDayCount).slice(0, 6);

  // Faixas de 1h ocupadas por compromissos no mês
  const occupiedHours = new Set<number>();
  monthEvents.forEach((e) => {
    const [sh] = e.time.split(':').map(Number);
    const [ehRaw] = (e.endTime ?? '').split(':').map(Number);
    const endHour = e.endTime && !Number.isNaN(ehRaw) && ehRaw > sh ? ehRaw : sh + 1;
    for (let h = sh; h < endHour; h++) occupiedHours.add(h);
  });
  // Horas livres entre 07h e 20h
  const freeHours = Array.from({ length: 14 }, (_, i) => i + 7)
    .filter((h) => !occupiedHours.has(h))
    .slice(0, 4);

  const weekdayShort = (day: number) =>
    new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(
      new Date(currentDate.getFullYear(), currentDate.getMonth(), day),
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
    setEditingEvent(null);
    setIsEventModalOpen(true);
  };

  const openEditModal = (event: FamilyEvent) => {
    // Parceiro visualizou o compromisso → avisos ficam lidos e param de notificar
    if (event.alertar) onVisualizarCompromisso(event.id);
    setEditingEvent(event);
    setIsEventModalOpen(true);
  };

  const handleSubmitEvent = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const dateParts = String(formData.get('date') ?? '').split('-');
    const eventDate = new Date(
      Number(dateParts[0]),
      Number(dateParts[1]) - 1,
      Number(dateParts[2]),
    );

    const data = {
      title: String(formData.get('title') ?? ''),
      date: eventDate,
      time: String(formData.get('time') ?? ''),
      endTime: String(formData.get('endTime') ?? '') || undefined,
      userId: String(formData.get('userId') ?? ''),
      alertar: formData.get('alertar') === 'on',
    };
    const notifyParaId = String(formData.get('notifyParaId') ?? 'all');

    if (editingEvent) {
      setEvents((prev) => prev.map((ev) => (ev.id === editingEvent.id ? { ...ev, ...data } : ev)));
      simulateNotifications(
        data.alertar ? '⚠️ Compromisso Importante' : 'Compromisso Atualizado',
        `${currentUser.name} atualizou "${data.title}".${data.alertar ? ' ⚠️ Importante — abra para visualizar.' : ''}`,
        notifyParaId,
        'evento',
        editingEvent.id,
      );
    } else {
      const newEvent: FamilyEvent = { id: newId(), ...data, createdBy: currentUser.id };
      setEvents((prev) => [...prev, newEvent]);
      simulateNotifications(
        newEvent.alertar ? '⚠️ Compromisso Importante' : 'Novo Compromisso',
        `${currentUser.name} marcou "${newEvent.title}".${newEvent.alertar ? ' ⚠️ Importante — abra para visualizar.' : ''}`,
        notifyParaId,
        'evento',
        newEvent.id,
      );
    }

    setIsEventModalOpen(false);
    setEditingEvent(null);
  };

  const handleDeleteEvent = () => {
    if (!editingEvent) return;
    if (!window.confirm(`Excluir o compromisso "${editingEvent.title}"?`)) return;
    const deletedId = editingEvent.id;
    setEvents((prev) => prev.filter((ev) => ev.id !== deletedId));
    // Exclusão não dispara push/aviso; apenas limpa os avisos antigos do compromisso
    onVisualizarCompromisso(deletedId);
    setIsEventModalOpen(false);
    setEditingEvent(null);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto custom-scrollbar px-4 pb-32 md:px-10 py-4 md:pb-24 bg-[#09090b]">
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

      {/* Legenda de membros: foto de perfil de cada familiar, estilo rede social */}
      <div className="max-w-5xl mx-auto w-full flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-4 md:mb-6">
        {users.map((u) => (
          <span
            key={u.id}
            className="flex items-center gap-2 text-[11px] md:text-xs font-semibold"
            style={{ color: u.color }}
          >
            <Avatar
              user={u}
              className="w-6 h-6 rounded-full text-xs shrink-0"
              style={{ boxShadow: `0 0 0 2px ${u.color}` }}
            />
            {u.name}
          </span>
        ))}
      </div>

      <div className="max-w-5xl mx-auto w-full flex flex-col">
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

        <div className="grid grid-cols-7 gap-1 md:gap-4 auto-rows-[minmax(64px,1fr)] md:auto-rows-auto content-start">
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
                        {/* Mobile: avatar + título na 1ª linha, hora completa na 2ª (cabe em telas estreitas) */}
                        <span className="md:hidden block w-full px-1 py-0.5">
                          <span className="flex items-center gap-1 min-w-0">
                            <Avatar
                              user={eventUser}
                              className="w-3.5 h-3.5 rounded-full ring-1 ring-white/50 shrink-0 text-[8px]"
                            />
                            <span className="block text-[9px] leading-[11px] font-bold truncate min-w-0">
                              {event.title}
                            </span>
                          </span>
                          <span className="block text-[8px] leading-[10px] text-white/80 truncate">{event.time}</span>
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

      {/* Resumo do mês: contagem por membro, melhores dias e horários */}
      <div className="max-w-5xl mx-auto w-full mt-4 md:mt-6 bg-[#121214] border border-zinc-800 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-pink-500" /> Resumo do mês
          </h3>
          <span className="text-xs font-semibold text-zinc-400">
            {totalEvents} {totalEvents === 1 ? 'compromisso' : 'compromissos'}
          </span>
        </div>

        {/* Contagem por membro */}
        <div className="flex flex-wrap gap-2 mb-3">
          {countsByUser.map(({ user, count }) => (
            <span
              key={user.id}
              className="flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-full border"
              style={{
                color: user.color,
                borderColor: `${user.color}40`,
                backgroundColor: `${user.color}12`,
              }}
            >
              <Avatar user={user} className="w-4 h-4 rounded-full text-[9px] shrink-0" />
              {user.name}: {count}
            </span>
          ))}
        </div>

        {/* Melhores dias para marcar */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs mb-1.5">
          <span className="font-bold text-zinc-300 mr-0.5">Melhores dias:</span>
          {bestDays.map((d) => (
            <button
              key={d.day}
              onClick={() => handleDayClick(d.day)}
              title="Ver este dia"
              className="px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 font-medium hover:border-pink-500 hover:text-white transition-colors"
            >
              {d.day} {weekdayShort(d.day)}
            </button>
          ))}
          <span className="text-zinc-500">
            {minDayCount === 0 ? '(sem compromissos)' : '(dias com menos compromissos)'}
          </span>
        </div>

        {/* Melhores horários */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="font-bold text-zinc-300 mr-0.5">Melhores horários:</span>
          {freeHours.length > 0 ? (
            freeHours.map((h) => (
              <span
                key={h}
                className="px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 font-medium"
              >
                {String(h).padStart(2, '0')}h
              </span>
            ))
          ) : (
            <span className="text-zinc-500">—</span>
          )}
          <span className="text-zinc-500">(livres no mês)</span>
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
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => openEditModal(event)}
                      title="Editar / excluir"
                      className="w-full flex items-start gap-3 bg-[#09090b] p-3 rounded-xl border border-zinc-800 hover:border-zinc-600 transition-colors text-left group"
                    >
                      <Avatar
                        user={eventUser}
                        className="w-10 h-10 rounded-full text-lg shrink-0"
                        style={{ boxShadow: `0 0 0 2px ${eventUser.color}` }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-white md:text-lg">{event.title}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-zinc-400 text-xs md:text-sm">
                            {event.time} {event.endTime ? `→ ${event.endTime}` : ''}
                          </span>
                          <span
                            className="text-[10px] md:text-xs px-2 py-0.5 rounded-full border border-zinc-700 font-bold"
                            style={{ color: eventUser.color, backgroundColor: `${eventUser.color}15` }}
                          >
                            {eventUser.name}
                          </span>
                        </div>
                      </div>
                      <Pencil className="w-4 h-4 text-zinc-600 group-hover:text-pink-400 self-center shrink-0" />
                    </button>
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

      {/* Modal de novo/editar compromisso (mês) */}
      {isEventModalOpen && (
        <Modal
          key={editingEvent?.id ?? 'new'}
          onClose={() => {
            setIsEventModalOpen(false);
            setEditingEvent(null);
          }}
          title={editingEvent ? 'Editar Compromisso' : 'Novo Compromisso'}
          footer={
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsEventModalOpen(false);
                  setEditingEvent(null);
                }}
                className="flex-1 px-4 py-3 border border-zinc-700 text-zinc-300 rounded-xl hover:bg-zinc-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="grid-event-form"
                className="flex-1 px-4 py-3 bg-pink-500 text-white font-medium rounded-xl hover:bg-pink-400 transition-colors"
              >
                {editingEvent ? 'Salvar' : 'Criar'}
              </button>
            </div>
          }
        >
          <form id="grid-event-form" onSubmit={handleSubmitEvent} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">Título</label>
              <input
                type="text"
                name="title"
                required
                placeholder="Ex: Médico, Escola..."
                defaultValue={editingEvent?.title ?? ''}
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
                defaultValue={editingEvent ? toDateInput(editingEvent.date) : newEventDate}
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
                  defaultValue={editingEvent?.time ?? ''}
                  className="w-full p-3 bg-[#09090b] border border-zinc-800 text-white rounded-xl focus:ring-2 focus:ring-pink-500 outline-none transition-all"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">Fim (Opcional)</label>
                <input
                  type="time"
                  name="endTime"
                  defaultValue={editingEvent?.endTime ?? ''}
                  className="w-full p-3 bg-[#09090b] border border-zinc-800 text-white rounded-xl focus:ring-2 focus:ring-pink-500 outline-none transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">Membro Familiar</label>
              <select
                name="userId"
                defaultValue={editingEvent?.userId ?? currentUser.id}
                className="w-full p-3 bg-[#09090b] border border-zinc-800 text-white rounded-xl focus:ring-2 focus:ring-pink-500 outline-none transition-all appearance-none"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            {/* Alertar o parceiro: importante → notifica até visualizar */}
            <label className="flex items-start gap-3 p-3 bg-[#09090b] border border-zinc-800 rounded-xl cursor-pointer">
              <input
                type="checkbox"
                name="alertar"
                defaultChecked={editingEvent?.alertar ?? false}
                className="w-4 h-4 mt-0.5 accent-pink-500"
              />
              <span className="text-sm text-zinc-300">
                <span className="font-bold text-white">Alertar o parceiro</span>
                <span className="block text-xs text-zinc-500 mt-0.5 leading-relaxed">
                  Importante: fica notificando até a pessoa visualizar o compromisso.
                </span>
              </span>
            </label>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">
                Notificar <span className="text-zinc-600">(quem recebe o aviso)</span>
              </label>
              <select
                name="notifyParaId"
                defaultValue="all"
                className="w-full p-3 bg-[#09090b] border border-zinc-800 text-white rounded-xl focus:ring-2 focus:ring-pink-500 outline-none transition-all appearance-none"
              >
                <option value="all">Toda a família</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    Apenas {u.name}
                  </option>
                ))}
              </select>
            </div>
            {editingEvent && (
              <button
                type="button"
                onClick={handleDeleteEvent}
                className="w-full py-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl hover:bg-red-500/20 transition-colors font-medium flex items-center justify-center gap-2 text-sm"
              >
                <Trash2 className="w-4 h-4" /> Excluir Compromisso
              </button>
            )}
          </form>
        </Modal>
      )}
    </div>
  );
};

export default CalendarGridView;
