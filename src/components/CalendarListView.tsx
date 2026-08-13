import { useState } from 'react';
import { Check, CheckCircle2, Pencil, Plus, Trash2 } from 'lucide-react';
import type { FormEvent } from 'react';
import Modal from './Modal';
import Avatar from './Avatar';
import { capitalize, isToday, toDateInput } from '../utils';
import { newId } from '../lib/db';
import type { FamilyEvent, Notify, User } from '../types';

/** Formata YYYY-MM-DD como DD/MM. */
const formatDateBR = (date: string): string => {
  const [, m, d] = date.split('-');
  return d && m ? `${d}/${m}` : date;
};

interface CalendarListViewProps {
  events: FamilyEvent[];
  setEvents: React.Dispatch<React.SetStateAction<FamilyEvent[]>>;
  users: User[];
  currentUser: User;
  simulateNotifications: Notify;
  /** Chamado quando o parceiro abre o compromisso (marca os avisos como lidos). */
  onVisualizarCompromisso: (eventId: string) => void;
}

const CalendarListView = ({
  events,
  setEvents,
  users,
  currentUser,
  simulateNotifications,
  onVisualizarCompromisso,
}: CalendarListViewProps) => {
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<FamilyEvent | null>(null);

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
      descricao: String(formData.get('descricao') ?? '').trim() || undefined,
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

  const openEventModal = (event: FamilyEvent | null) => {
    // Parceiro visualizou o compromisso → avisos ficam lidos e param de notificar
    if (event?.alertar) onVisualizarCompromisso(event.id);
    setEditingEvent(event);
    setIsEventModalOpen(true);
  };

  const toggleConcluido = (event: FamilyEvent) => {
    const concluido = !event.concluido;
    setEvents((prev) =>
      prev.map((ev) =>
        ev.id === event.id
          ? { ...ev, concluido, dataConclusao: concluido ? toDateInput(new Date()) : undefined }
          : ev,
      ),
    );
    // Concluiu = visualizou: avisos somem e param de notificar
    if (concluido) onVisualizarCompromisso(event.id);
    simulateNotifications(
      concluido ? 'Compromisso Concluído ✅' : 'De volta aos pendentes',
      concluido
        ? `"${event.title}" foi concluído (${formatDateBR(toDateInput(new Date()))}).`
        : `"${event.title}" voltou para os pendentes.`,
      'all',
      'evento',
      event.id,
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
      <div className="max-w-3xl mx-auto p-4 md:p-8 pb-36">
        {sortedDates.map((group, index) => {
          const groupIsToday = isToday(group.date);
          const dayNumber = group.date.getDate();
          // Dia da semana abreviado: SEG, TER, QUA... (cor da pessoa que está vendo)
          const dayShort = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'][group.date.getDay()];
          const monthYear = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(group.date);
          const viewColor = currentUser.color;

          return (
            <div key={index} className="mb-10">
              {/* Cabeçalho da data: chip com o número + dia/mês — destaque separado dos compromissos */}
              <div
                className="flex items-center gap-3 mb-6 rounded-2xl px-4 py-3"
                style={{ backgroundColor: `${viewColor}14`, border: `1px solid ${viewColor}33` }}
              >
                <span
                  className="w-12 h-12 md:w-14 md:h-14 rounded-xl flex items-center justify-center text-2xl md:text-3xl font-bold text-white shadow-lg shrink-0"
                  style={{ backgroundColor: viewColor }}
                >
                  {dayNumber}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-base md:text-xl font-bold tracking-widest" style={{ color: viewColor }}>
                    {dayShort}
                  </div>
                  <div className="text-xs md:text-sm text-zinc-400 font-medium capitalize">
                    {capitalize(monthYear)}
                  </div>
                </div>
                {groupIsToday && (
                  <span className="shrink-0 px-2.5 py-1 rounded-full bg-pink-500/15 border border-pink-500/30 text-pink-400 text-xs font-bold uppercase tracking-wider">
                    Hoje
                  </span>
                )}
              </div>

              {/* Lista de eventos */}
              <div className="space-y-5">
                {[...group.events]
                  .sort((a, b) => a.time.localeCompare(b.time))
                  .map((event) => {
                    const eventUser = users.find((u) => u.id === event.userId) || currentUser;
                    return (
                      <div
                        key={event.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => openEventModal(event)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openEventModal(event);
                          }
                        }}
                        title="Editar / excluir"
                        className="w-full flex items-start gap-3 group text-left border-l-4 border-transparent pl-2.5 rounded-lg py-1.5 transition-colors cursor-pointer"
                        style={{
                          borderLeftColor: event.concluido ? '#22c55e' : eventUser.color,
                          backgroundColor: `${eventUser.color}0a`,
                          opacity: event.concluido ? 0.75 : 1,
                        }}
                      >
                        {/* Foto de perfil do responsável, com anel na cor do membro (estilo rede social) */}
                        <Avatar
                          user={eventUser}
                          className="w-11 h-11 rounded-full text-xl shrink-0"
                          style={{ boxShadow: `0 0 0 2px ${eventUser.color}` }}
                        />

                        <div className="flex-1 pt-0.5 min-w-0">
                          <h4
                            className={`text-lg md:text-xl font-medium transition-colors group-hover:brightness-125 ${
                              event.concluido ? 'line-through text-zinc-500' : ''
                            }`}
                            style={{ color: event.concluido ? undefined : eventUser.color }}
                          >
                            {event.title}
                          </h4>
                          {event.descricao && (
                            <p className="text-sm text-zinc-400 leading-snug mt-1 line-clamp-2 whitespace-pre-line">
                              {event.descricao}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
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
                              {eventUser.name}
                            </span>
                            {event.concluido && event.dataConclusao && (
                              <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-bold">
                                <CheckCircle2 className="w-3 h-3" /> Concluído em {formatDateBR(event.dataConclusao)}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleConcluido(event);
                          }}
                          title={event.concluido ? 'Desmarcar conclusão' : 'Marcar como concluído'}
                          className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 self-center transition-all duration-200 ${
                            event.concluido
                              ? 'bg-emerald-500/90 border-emerald-500/90 text-white shadow-sm shadow-emerald-500/30'
                              : 'border-emerald-500/35 bg-emerald-500/[0.06] text-transparent hover:bg-emerald-500/10 hover:border-emerald-500/60'
                          }`}
                        >
                          <Check className="w-4 h-4" strokeWidth={2.5} />
                        </button>
                        <Pencil className="w-4 h-4 text-zinc-600 group-hover:text-pink-400 self-center shrink-0" />
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

      {/* Botão flutuante (FAB): fixo, sempre visível acima do menu (com safe-area) */}
      <button
        onClick={() => openEventModal(null)}
        aria-label="Adicionar compromisso"
        className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] md:bottom-8 right-6 w-14 h-14 md:w-16 md:h-16 bg-pink-500 hover:bg-pink-400 text-white rounded-full shadow-[0_0_20px_rgba(236,72,153,0.4)] flex items-center justify-center transition-transform hover:scale-105 z-30"
      >
        <Plus className="w-7 h-7 md:w-8 md:h-8" />
      </button>

      {/* Modal de novo/editar compromisso */}
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
                form="list-event-form"
                className="flex-1 px-4 py-3 bg-pink-500 text-white font-medium rounded-xl hover:bg-pink-400 transition-colors"
              >
                {editingEvent ? 'Salvar' : 'Criar'}
              </button>
            </div>
          }
        >
          <form id="list-event-form" onSubmit={handleSubmitEvent} className="space-y-5">
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
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">
                Descrição <span className="text-zinc-600">(opcional)</span>
              </label>
              <textarea
                name="descricao"
                rows={3}
                placeholder="Ex.: levar documento, valor a pagar, o que preparar..."
                defaultValue={editingEvent?.descricao ?? ''}
                className="w-full p-3 bg-[#09090b] border border-zinc-800 text-white rounded-xl focus:ring-2 focus:ring-pink-500 outline-none transition-all placeholder-zinc-700 text-sm resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">Data</label>
              <input
                type="date"
                name="date"
                required
                defaultValue={editingEvent ? toDateInput(editingEvent.date) : toDateInput(new Date())}
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

export default CalendarListView;
