import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Baby,
  Calendar as CalendarIcon,
  Check,
  CheckCircle2,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import type { FormEvent } from 'react';
import Modal from './Modal';
import { newId } from '../lib/db';
import { toDateInput } from '../utils';
import type { ChildCommitment, Notify, User } from '../types';

/** YYYY-MM-DD → DD/MM */
const formatDateBR = (date: string): string => {
  const [, m, d] = date.split('-');
  return `${d}/${m}`;
};

interface ChildCommitmentsViewProps {
  commitments: ChildCommitment[];
  setCommitments: React.Dispatch<React.SetStateAction<ChildCommitment[]>>;
  currentUser: User;
  simulateNotifications: Notify;
  /** Marcado quando alguém visualiza/conclui — avisos somem e param de notificar. */
  onVisualizarCompromisso: (id: string) => void;
}

const ORANGE = '#f97316';
const COMPLETED_RETENTION_MS = 24 * 60 * 60 * 1000;

const ChildCommitmentsView = ({
  commitments,
  setCommitments,
  currentUser,
  simulateNotifications,
  onVisualizarCompromisso,
}: ChildCommitmentsViewProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<ChildCommitment | null>(null);
  // Exclusão com confirmação dentro do app (sem delay do diálogo do navegador)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const confirmTimerRef = useRef<number | undefined>(undefined);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const pending = commitments.filter((c) => !c.concluido);
  const done = commitments
    .filter((c) => c.concluido)
    .filter((c) => {
      const completedAt = c.concluidoEm ? new Date(c.concluidoEm).getTime() : 0;
      return completedAt > 0 && now - completedAt < COMPLETED_RETENTION_MS;
    });
  const sortedPending = [...pending].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  const sortedDone = [...done].sort(
    (a, b) => new Date(b.concluidoEm!).getTime() - new Date(a.concluidoEm!).getTime(),
  );

  const openAdd = () => {
    setEditing(null);
    setIsModalOpen(true);
  };

  const openEdit = (c: ChildCommitment) => {
    setEditing(c);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditing(null);
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const title = String(fd.get('title') ?? '').trim();
    const date = String(fd.get('date') ?? '') || undefined;
    const alertar = fd.get('alertar') === 'on';
    if (!title) return;

    const descricao = String(fd.get('descricao') ?? '').trim() || undefined;

    if (editing) {
      setCommitments((prev) => prev.map((c) => (c.id === editing.id ? { ...c, title, descricao, date, alertar } : c)));
      simulateNotifications(
        'Compromisso do Filho Atualizado',
        `${currentUser.name} atualizou "${title}".${alertar ? ' ⚠️ Importante — abra para visualizar.' : ''}`,
        'all',
        'filho',
        editing.id,
      );
    } else {
      const novo: ChildCommitment = {
        id: newId(),
        title,
        descricao,
        date,
        alertar,
        concluido: false,
      };
      setCommitments((prev) => [novo, ...prev]);
      simulateNotifications(
        alertar ? '⚠️ Compromisso do Filho' : 'Novo Compromisso do Filho',
        `${currentUser.name} cadastrou "${title}"${date ? ` para ${formatDateBR(date)}` : ''}.${alertar ? ' ⚠️ Importante — abra para visualizar.' : ''}`,
        'all',
        'filho',
        novo.id,
      );
    }
    closeModal();
  };

  const toggleConcluido = (c: ChildCommitment) => {
    const concluido = !c.concluido;
    setCommitments((prev) =>
      prev.map((x) =>
        x.id === c.id
          ? {
              ...x,
              concluido,
              dataConclusao: concluido ? toDateInput(new Date()) : undefined,
              concluidoEm: concluido ? new Date().toISOString() : undefined,
            }
          : x,
      ),
    );
    // Concluiu = visualizou: avisos somem e param de notificar
    if (concluido) onVisualizarCompromisso(c.id);
    simulateNotifications(
      concluido ? 'Compromisso Concluído ✅' : 'De volta aos pendentes',
      concluido
        ? `"${c.title}" foi concluído (${formatDateBR(toDateInput(new Date()))}).`
        : `"${c.title}" voltou para os pendentes.`,
      'all',
      'filho',
      c.id,
    );
  };

  const askDelete = (id: string) => {
    setConfirmDeleteId(id);
    window.clearTimeout(confirmTimerRef.current);
    confirmTimerRef.current = window.setTimeout(() => setConfirmDeleteId(null), 4000);
  };

  const cancelDelete = () => {
    window.clearTimeout(confirmTimerRef.current);
    setConfirmDeleteId(null);
  };

  const handleDelete = (c: ChildCommitment) => {
    window.clearTimeout(confirmTimerRef.current);
    setConfirmDeleteId(null);
    // Exclusão não dispara push/aviso; apenas limpa os avisos antigos
    onVisualizarCompromisso(c.id);
    setCommitments((prev) => prev.filter((x) => x.id !== c.id));
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#09090b] relative">
      <div className="px-4 py-6 md:px-10 max-w-3xl mx-auto w-full flex-1 overflow-y-auto custom-scrollbar pb-24">
        {/* Cabeçalho laranja */}
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 bg-orange-500/15 text-orange-400 rounded-2xl shrink-0">
            <Baby className="w-7 h-7" />
          </div>
          <div className="min-w-0">
            <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Compromissos do Filho</h2>
            <p className="text-xs md:text-sm text-zinc-500 mt-0.5 truncate">
              Acompanhe a lista e marque como concluído quando fizer.
            </p>
          </div>
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-orange-500/10 p-4 rounded-3xl border border-orange-500/25">
            <span className="text-[10px] uppercase tracking-wider text-orange-400 font-bold">Pendentes</span>
            <p className="text-3xl font-bold text-orange-400 mt-1">{pending.length}</p>
          </div>
          <div className="bg-[#121214] p-4 rounded-3xl border border-zinc-800">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Concluídos</span>
            <p className="text-3xl font-bold text-white mt-1">{done.length}</p>
          </div>
        </div>

        {/* Lista */}
        <div className="space-y-3">
          {sortedPending.length === 0 && (
            <div className="text-center text-zinc-600 text-sm italic py-16">
              Nenhum compromisso pendente. Toque em + para cadastrar.
            </div>
          )}
          {sortedPending.map((c) => (
            <div
              key={c.id}
              className={`bg-[#121214] border-l-4 rounded-2xl p-4 flex items-start gap-3 transition-opacity ${
                c.concluido ? 'opacity-60' : ''
              }`}
              style={{
                borderLeftColor: c.concluido ? '#22c55e' : ORANGE,
                backgroundColor: c.concluido ? undefined : 'rgba(249,115,22,0.04)',
              }}
            >
              {/* Marcar como concluído */}
              <button
                onClick={() => toggleConcluido(c)}
                title={c.concluido ? 'Desmarcar conclusão' : 'Marcar como concluído'}
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                  c.concluido
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : 'border-orange-500 text-transparent hover:bg-orange-500/10'
                }`}
              >
                <Check className="w-4 h-4" />
              </button>

              <div className="flex-1 min-w-0">
                <p className={`font-bold ${c.concluido ? 'line-through text-zinc-500' : 'text-white'}`}>
                  {c.title}
                </p>
                {c.descricao && (
                  <p className="text-sm text-zinc-400 leading-snug mt-1 line-clamp-2 whitespace-pre-line">
                    {c.descricao}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {c.date && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full border border-orange-500/30 bg-orange-500/10 text-orange-400 font-bold flex items-center gap-1">
                      <CalendarIcon className="w-3 h-3" /> {formatDateBR(c.date)}
                    </span>
                  )}
                  {c.dataConclusao && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Concluído em {formatDateBR(c.dataConclusao)}
                    </span>
                  )}
                  {c.alertar && !c.concluido && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full border border-red-500/30 bg-red-500/10 text-red-400 font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Alerta até visualizar
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {confirmDeleteId === c.id ? (
                  <>
                    <span className="text-[10px] font-bold text-red-400 mr-1">Excluir?</span>
                    <button
                      onClick={() => handleDelete(c)}
                      className="p-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-xl transition-colors"
                      title="Confirmar exclusão"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={cancelDelete}
                      className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors"
                      title="Cancelar"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => openEdit(c)}
                      className="p-2 text-zinc-500 hover:text-orange-400 hover:bg-orange-500/10 rounded-xl transition-colors"
                      title="Editar"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => askDelete(c.id)}
                      className="p-2 text-red-400/80 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {sortedDone.length > 0 && (
          <section className="mt-8 border-t border-zinc-800 pt-6">
            <div className="mb-3">
              <h3 className="text-sm font-bold text-emerald-400">Concluídos nas últimas 24 horas</h3>
              <p className="text-[11px] text-zinc-500 mt-0.5">Depois desse período, eles são removidos automaticamente.</p>
            </div>
            <div className="space-y-3">
              {sortedDone.map((c) => (
                <div key={c.id} className="bg-[#121214] border-l-4 border-emerald-500 rounded-2xl p-4 flex items-start gap-3 opacity-70">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold line-through text-zinc-500">{c.title}</p>
                    {c.dataConclusao && <p className="text-[10px] text-emerald-400 mt-1">Concluído em {formatDateBR(c.dataConclusao)}</p>}
                  </div>
                  <button onClick={() => askDelete(c.id)} className="p-2 text-red-400/80 hover:bg-red-500/10 rounded-xl" title="Excluir agora">
                    <Trash2 className="w-4 h-4" />
                  </button>
                  {confirmDeleteId === c.id && (
                    <button onClick={() => handleDelete(c)} className="p-2 bg-red-500/20 text-red-400 rounded-xl" title="Confirmar exclusão">
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Botão flutuante laranja */}
      <button
        onClick={openAdd}
        aria-label="Adicionar compromisso do Filho"
        className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] md:bottom-8 right-6 md:right-8 w-14 h-14 md:w-16 md:h-16 bg-orange-500 hover:bg-orange-400 text-white rounded-full shadow-[0_0_20px_rgba(249,115,22,0.4)] flex items-center justify-center transition-transform hover:scale-105 z-30"
      >
        <Plus className="w-8 h-8" />
      </button>

      {/* Modal de novo/editar */}
      {isModalOpen && (
        <Modal
          onClose={closeModal}
          title={editing ? 'Editar Compromisso do Filho' : 'Novo Compromisso do Filho'}
          footer={
            <div className="flex gap-3">
              <button
                type="button"
                onClick={closeModal}
                className="flex-1 px-4 py-3 border border-zinc-700 text-zinc-300 rounded-xl hover:bg-zinc-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="child-commitment-form"
                className="flex-1 px-4 py-3 bg-orange-500 hover:bg-orange-400 text-white font-medium rounded-xl transition-colors"
              >
                {editing ? 'Salvar' : 'Cadastrar'}
              </button>
            </div>
          }
        >
          <form id="child-commitment-form" onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">Título</label>
              <input
                type="text"
                name="title"
                required
                placeholder="Ex: Lição de casa, Reunião da escola..."
                defaultValue={editing?.title ?? ''}
                autoFocus
                className="w-full p-3 bg-[#09090b] border border-zinc-800 text-white rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all placeholder-zinc-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">
                Descrição <span className="text-zinc-600">(opcional)</span>
              </label>
              <textarea
                name="descricao"
                rows={3}
                placeholder="Ex.: o que estudar, material que precisa levar..."
                defaultValue={editing?.descricao ?? ''}
                className="w-full p-3 bg-[#09090b] border border-zinc-800 text-white rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all placeholder-zinc-700 text-sm resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">
                Data do compromisso <span className="text-zinc-600">(opcional)</span>
              </label>
              <input
                type="date"
                name="date"
                defaultValue={editing?.date ?? ''}
                className="w-full p-3 bg-[#09090b] border border-zinc-800 text-white rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
              />
            </div>
            {/* Alertar o parceiro */}
            <label className="flex items-start gap-3 p-3 bg-[#09090b] border border-zinc-800 rounded-xl cursor-pointer">
              <input
                type="checkbox"
                name="alertar"
                defaultChecked={editing?.alertar ?? false}
                className="w-4 h-4 mt-0.5 accent-orange-500"
              />
              <span className="text-sm text-zinc-300">
                <span className="font-bold text-white">Alertar o parceiro</span>
                <span className="block text-xs text-zinc-500 mt-0.5 leading-relaxed">
                  Importante: fica notificando até alguém visualizar o compromisso.
                </span>
              </span>
            </label>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default ChildCommitmentsView;
