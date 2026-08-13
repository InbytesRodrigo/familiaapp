import { useRef, useState } from 'react';
import {
  BadgeCheck,
  BarChart3,
  Calendar as CalendarIcon,
  Check,
  ChevronUp,
  CreditCard,
  Pencil,
  Plus,
  Receipt,
  Trash2,
  UserCircle2,
  Wallet,
  X,
} from 'lucide-react';
import type { FormEvent } from 'react';
import Modal from './Modal';
import { newId } from '../lib/db';
import { capitalize, toDateInput } from '../utils';
import type { FamilyEvent, Gasto, Notify, User } from '../types';

const GREEN = '#10b981';

const METODOS = ['Pix', 'Cartão de crédito', 'Cartão de débito', 'Dinheiro', 'Boleto', 'Transferência', 'Outro'];

/** YYYY-MM-DD → DD/MM (rótulo). */
const formatDateBR = (date: string): string => {
  const [, m, d] = date.split('-');
  return `${d}/${m}`;
};

/** Data da parcela i (0-based): mesmo dia da compra, mês a mês (ajusta fim de mês). */
const installmentDate = (compra: Date, index: number): Date => {
  const mes = new Date(compra.getFullYear(), compra.getMonth() + index, 1);
  const ultimoDia = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
  mes.setDate(Math.min(compra.getDate(), ultimoDia));
  return mes;
};

/** Gera os compromissos de parcela que entram no calendário automaticamente. */
const buildGastoEvents = (gasto: Gasto, userId: string): FamilyEvent[] => {
  if (gasto.quitado || !gasto.data) return [];
  const [y, m, d] = gasto.data.split('-').map(Number);
  if (!y || !m || !d) return [];
  const compra = new Date(y, m - 1, d);
  const parcelas = Math.max(1, Math.floor(gasto.parcelas) || 1);
  const valorParcela = gasto.valor / parcelas;
  const eventos: FamilyEvent[] = [];
  for (let i = 1; i <= parcelas; i++) {
    const dia = installmentDate(compra, i - 1);
    eventos.push({
      id: newId(),
      title: `Parcela ${i}/${parcelas} — ${gasto.titulo}`,
      descricao: `${gasto.metodo} • R$ ${valorParcela.toFixed(2)}${gasto.observacao ? `\n${gasto.observacao}` : ''}`,
      date: dia,
      time: '12:00',
      userId,
      createdBy: userId,
      gastoId: gasto.id,
    });
  }
  return eventos;
};

interface GastosViewProps {
  gastos: Gasto[];
  setGastos: React.Dispatch<React.SetStateAction<Gasto[]>>;
  /** Compromissos (inclui as parcelas dos gastos) — usado para o progresso de pagamento. */
  events: FamilyEvent[];
  currentUser: User;
  users: User[];
  simulateNotifications: Notify;
  /** Sincroniza os compromissos de parcela no calendário (events). */
  onSyncCalendarEvents: (gastoId: string, eventos: FamilyEvent[]) => void;
}

const GastosView = ({
  gastos,
  setGastos,
  events,
  currentUser,
  users,
  simulateNotifications,
  onSyncCalendarEvents,
}: GastosViewProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Gasto | null>(null);
  // Formulário (controlado)
  const [titulo, setTitulo] = useState('');
  const [valor, setValor] = useState('');
  const [data, setData] = useState('');
  const [parcelas, setParcelas] = useState(1);
  const [metodo, setMetodo] = useState(METODOS[0]);
  const [cartao, setCartao] = useState('');
  const [observacao, setObservacao] = useState('');
  // Exclusão com confirmação dentro do app (sem delay do diálogo do navegador)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const confirmTimerRef = useRef<number | undefined>(undefined);
  // Gastos por mês: oculto no final da página (recolhido por padrão)
  const [showMonths, setShowMonths] = useState(false);

  const emAberto = gastos.filter((g) => !g.quitado);
  const quitados = gastos.filter((g) => g.quitado);
  const totalEmAberto = emAberto.reduce((acc, g) => acc + g.valor, 0);
  const totalQuitado = quitados.reduce((acc, g) => acc + g.valor, 0);

  // Em aberto primeiro (pela data), quitados depois (pela data)
  const sorted = [...gastos].sort((a, b) => {
    if (a.quitado !== b.quitado) return a.quitado ? 1 : -1;
    return (a.data ?? '').localeCompare(b.data ?? '');
  });

  // Resumo por mês (mês da compra): total, quitado (abate) e em aberto
  const now = new Date();
  const monthStats = Array.from({ length: 12 }, (_, i) => {
    const mes = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const doMes = gastos.filter((g) => {
      const [y, m] = (g.data ?? '').split('-').map(Number);
      return y === mes.getFullYear() && m === mes.getMonth() + 1;
    });
    const total = doMes.reduce((acc, g) => acc + g.valor, 0);
    const quitado = doMes.filter((g) => g.quitado).reduce((acc, g) => acc + g.valor, 0);
    return {
      mes,
      label: capitalize(
        new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(mes),
      ),
      total,
      quitado,
      aberto: total - quitado,
      count: doMes.length,
    };
  })
    .filter((m) => m.count > 0)
    .slice(0, 6);

  const openAdd = () => {
    setEditing(null);
    setTitulo('');
    setValor('');
    setData(toDateInput(new Date()));
    setParcelas(1);
    setMetodo(METODOS[0]);
    setCartao('');
    setObservacao('');
    setIsModalOpen(true);
  };

  const openEdit = (g: Gasto) => {
    setEditing(g);
    setTitulo(g.titulo);
    setValor(String(g.valor));
    setData(g.data);
    setParcelas(g.parcelas);
    setMetodo(g.metodo);
    setCartao(g.cartao ?? '');
    setObservacao(g.observacao ?? '');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditing(null);
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const nome = titulo.trim();
    const valorNum = parseFloat(valor) || 0;
    const parcelasNum = Math.max(1, Math.floor(parcelas) || 1);
    if (!nome || valorNum <= 0) return;

    if (editing) {
      const atualizado: Gasto = {
        ...editing,
        titulo: nome,
        valor: valorNum,
        data,
        parcelas: parcelasNum,
        metodo,
        cartao: cartao.trim() || undefined,
        observacao: observacao.trim() || undefined,
      };
      setGastos((prev) => prev.map((g) => (g.id === editing.id ? atualizado : g)));
      // Recalcula as parcelas no calendário
      onSyncCalendarEvents(editing.id, buildGastoEvents(atualizado, currentUser.id));
      simulateNotifications(
        'Gasto Atualizado',
        `${currentUser.name} atualizou "${nome}" (R$ ${valorNum.toFixed(2)}).`,
        'all',
        'gasto',
        editing.id,
      );
    } else {
      const novo: Gasto = {
        id: newId(),
        titulo: nome,
        valor: valorNum,
        data,
        parcelas: parcelasNum,
        metodo,
        cartao: cartao.trim() || undefined,
        observacao: observacao.trim() || undefined,
        quitado: false,
        criadoPor: currentUser.id,
      };
      setGastos((prev) => [novo, ...prev]);
      onSyncCalendarEvents(novo.id, buildGastoEvents(novo, currentUser.id));
      simulateNotifications(
        'Novo Gasto',
        `${currentUser.name} registrou "${nome}" — R$ ${valorNum.toFixed(2)}${
          parcelasNum > 1 ? ` em ${parcelasNum}x` : ' à vista'
        } via ${metodo}. As parcelas entraram no calendário.`,
        'all',
        'gasto',
        novo.id,
      );
    }
    closeModal();
  };

  const toggleQuitado = (g: Gasto) => {
    const quitado = !g.quitado;
    setGastos((prev) => prev.map((x) => (x.id === g.id ? { ...x, quitado } : x)));
    // Quitou → tira as parcelas do calendário; reabriu → recria
    onSyncCalendarEvents(g.id, quitado ? [] : buildGastoEvents({ ...g, quitado: false }, currentUser.id));
    // Sem push/aviso (mudança de status, não adição)
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

  const handleDelete = (g: Gasto) => {
    window.clearTimeout(confirmTimerRef.current);
    setConfirmDeleteId(null);
    // Exclusão não dispara push/aviso; só remove as parcelas do calendário
    onSyncCalendarEvents(g.id, []);
    setGastos((prev) => prev.filter((x) => x.id !== g.id));
  };

  const valorParcela = (g: Gasto): string => (g.valor / Math.max(1, g.parcelas)).toFixed(2);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#09090b] relative">
      <div className="px-4 py-6 md:px-10 max-w-3xl mx-auto w-full flex-1 overflow-y-auto custom-scrollbar pb-24">
        {/* Cabeçalho verde */}
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 bg-emerald-500/15 text-emerald-400 rounded-2xl shrink-0">
            <Wallet className="w-7 h-7" />
          </div>
          <div className="min-w-0">
            <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Gastos Compartilhados</h2>
            <p className="text-xs md:text-sm text-zinc-500 mt-0.5 truncate">
              Registre a compra: as parcelas entram sozinhas no calendário.
            </p>
          </div>
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-emerald-500/10 p-4 rounded-3xl border border-emerald-500/25">
            <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold">Em aberto</span>
            <p className="text-2xl md:text-3xl font-bold text-emerald-400 mt-1">R$ {totalEmAberto.toFixed(2)}</p>
          </div>
          <div className="bg-[#121214] p-4 rounded-3xl border border-zinc-800">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Quitado</span>
            <p className="text-2xl md:text-3xl font-bold text-white mt-1">R$ {totalQuitado.toFixed(2)}</p>
          </div>
        </div>

        {/* Lista */}
        <div className="space-y-3">
          {sorted.length === 0 && (
            <div className="text-center text-zinc-600 text-sm italic py-16">
              Nenhum gasto registrado ainda. Toque em + para cadastrar.
            </div>
          )}
          {sorted.map((g) => (
            <div
              key={g.id}
              className={`bg-[#121214] border-l-4 rounded-2xl p-4 flex items-start gap-3 transition-opacity ${
                g.quitado ? 'opacity-60' : ''
              }`}
              style={{ borderLeftColor: g.quitado ? '#22c55e' : GREEN, backgroundColor: g.quitado ? undefined : 'rgba(16,185,129,0.04)' }}
            >
              {/* Quitado: toggle */}
              <button
                onClick={() => toggleQuitado(g)}
                title={g.quitado ? 'Reabrir gasto' : 'Marcar como quitado'}
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                  g.quitado
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : 'border-emerald-500 text-transparent hover:bg-emerald-500/10'
                }`}
              >
                <Check className="w-4 h-4" />
              </button>

              <div className="flex-1 min-w-0">
                <p className={`font-bold ${g.quitado ? 'line-through text-zinc-500' : 'text-white'}`}>{g.titulo}</p>
                {g.observacao && (
                  <p className="text-sm text-zinc-400 leading-snug mt-1 line-clamp-2 whitespace-pre-line">{g.observacao}</p>
                )}
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="text-xs font-bold text-white">
                    R$ {g.valor.toFixed(2)}
                    {g.parcelas > 1 && <span className="text-zinc-400 font-medium"> • {g.parcelas}x de R$ {valorParcela(g)}</span>}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-bold flex items-center gap-1">
                    <CalendarIcon className="w-3 h-3" /> Compra {formatDateBR(g.data)}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full border border-zinc-800 bg-zinc-800/50 text-zinc-300 font-bold flex items-center gap-1">
                    <CreditCard className="w-3 h-3" /> {g.metodo}
                    {g.cartao && <span className="text-white">• {g.cartao}</span>}
                  </span>
                  {g.quitado && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-bold flex items-center gap-1">
                      <BadgeCheck className="w-3 h-3" /> Quitado
                    </span>
                  )}
                </div>
                {/* Progresso de pagamento: cada parcela concluída no calendário abate */}
                {!g.quitado && g.parcelas > 1 && (
                  (() => {
                    const pagas = events.filter((e) => e.gastoId === g.id && e.concluido).length;
                    const vp = Number(valorParcela(g));
                    const faltam = Math.max(0, g.parcelas - pagas);
                    const pct = Math.round((pagas / g.parcelas) * 100);
                    return (
                      <div className="mt-2">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[11px] font-bold text-emerald-400">
                            {pagas > 0 ? `✓ ${pagas}/${g.parcelas} parcelas pagas` : `${pagas}/${g.parcelas} parcelas pagas`}
                          </span>
                          {pagas > 0 && (
                            <span className="text-[11px] font-semibold text-zinc-400">
                              Falta R$ {(faltam * vp).toFixed(2)}
                            </span>
                          )}
                        </div>
                        <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 transition-all duration-500"
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                        {pagas === 0 && (
                          <p className="text-[10px] text-zinc-500 mt-1">
                            Conclua as parcelas no calendário para abater aqui.
                          </p>
                        )}
                      </div>
                    );
                  })()
                )}
                <div className="flex items-center gap-1.5 mt-2 text-[11px] text-zinc-500">
                  <UserCircle2 className="w-3.5 h-3.5" />
                  <span>
                    Registrado por{' '}
                    <span
                      className="font-bold"
                      style={{ color: (users.find((u) => u.id === g.criadoPor) ?? currentUser).color }}
                    >
                      {(users.find((u) => u.id === g.criadoPor) ?? currentUser).name}
                    </span>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {confirmDeleteId === g.id ? (
                  <>
                    <span className="text-[10px] font-bold text-red-400 mr-1">Excluir?</span>
                    <button
                      onClick={() => handleDelete(g)}
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
                      onClick={() => openEdit(g)}
                      className="p-2 text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-xl transition-colors"
                      title="Editar"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => askDelete(g.id)}
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

        {/* Gastos por mês: oculto no final da página (recolhido por padrão) */}
        {monthStats.length > 0 && (
          <div className="mt-8">
            <button
              onClick={() => setShowMonths((s) => !s)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors text-sm font-medium"
            >
              {showMonths ? <ChevronUp className="w-4 h-4" /> : <BarChart3 className="w-4 h-4" />}
              {showMonths ? 'Ocultar Gastos por Mês' : 'Ver Gastos por Mês'}
            </button>
            {showMonths && (
              <div className="mt-4 bg-[#121214] border border-zinc-800 rounded-3xl p-4">
                <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-emerald-500" /> Gastos por mês
                </h3>
                <p className="text-xs text-zinc-500 mb-4">
                  Ao concluir as parcelas (ou marcar quitado), o valor abate do mês da compra.
                </p>
                <div className="space-y-3">
                  {monthStats.map(({ mes, label, total, quitado, aberto, count }) => {
                    const pct = total > 0 ? Math.round((quitado / total) * 100) : 0;
                    return (
                      <div key={mes.getTime()} className="rounded-2xl border border-zinc-800 p-3">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-sm font-bold text-zinc-200 capitalize">{label}</span>
                          <span className="text-sm font-bold text-white">R$ {total.toFixed(2)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden mb-2">
                          <div
                            className="h-full bg-emerald-500 transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between gap-2 text-[11px] font-semibold">
                          <span className="text-emerald-400">
                            Quitado R$ {quitado.toFixed(2)}
                            {count > 0 && ` • ${count} gasto${count > 1 ? 's' : ''}`}
                          </span>
                          <span className="text-zinc-500">Em aberto R$ {aberto.toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Botão flutuante verde */}
      <button
        onClick={openAdd}
        className="absolute bottom-24 md:bottom-8 right-8 w-16 h-16 bg-emerald-500 hover:bg-emerald-400 text-white rounded-full shadow-[0_0_20px_rgba(16,185,129,0.4)] flex items-center justify-center transition-transform hover:scale-105 z-10"
      >
        <Plus className="w-8 h-8" />
      </button>

      {/* Modal de novo/editar gasto */}
      {isModalOpen && (
        <Modal
          onClose={closeModal}
          title={editing ? 'Editar Gasto' : 'Novo Gasto'}
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
                form="gasto-form"
                className="flex-1 px-4 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-medium rounded-xl transition-colors"
              >
                {editing ? 'Salvar' : 'Cadastrar'}
              </button>
            </div>
          }
        >
          <form id="gasto-form" onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">Gasto / Compromisso</label>
              <input
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                required
                placeholder="Ex: Geladeira nova, Curso do filho..."
                autoFocus
                className="w-full p-3 bg-[#09090b] border border-zinc-800 text-white rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all placeholder-zinc-700"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">Valor (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  required
                  placeholder="0.00"
                  className="w-full p-3 bg-[#09090b] border border-zinc-800 text-white rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">Data da compra</label>
                <input
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  required
                  className="w-full p-3 bg-[#09090b] border border-zinc-800 text-white rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">
                Parcelas <span className="text-zinc-600">(1 = à vista)</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  max="48"
                  value={parcelas}
                  onChange={(e) => setParcelas(Number(e.target.value))}
                  required
                  className="w-24 p-3 bg-[#09090b] border border-zinc-800 text-white rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-center"
                />
                <div className="flex-1 flex items-center px-3 bg-[#09090b] border border-zinc-800 rounded-xl text-sm text-zinc-400">
                  {(() => {
                    const v = parseFloat(valor) || 0;
                    const p = Math.max(1, Math.floor(parcelas) || 1);
                    return p === 1
                      ? v > 0
                        ? 'À vista — R$ ' + v.toFixed(2)
                        : 'À vista'
                      : v > 0
                        ? `${p}x de R$ ${(v / p).toFixed(2)} — entra no calendário`
                        : `${p}x de R$ 0,00`;
                  })()}
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">Método de pagamento</label>
              <select
                value={metodo}
                onChange={(e) => setMetodo(e.target.value)}
                className="w-full p-3 bg-[#09090b] border border-zinc-800 text-white rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none"
              >
                {METODOS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            {(metodo === 'Cartão de crédito' || metodo === 'Cartão de débito') && (
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">
                  Nome do cartão <span className="text-zinc-600">(opcional — ex.: Nubank, Itaú)</span>
                </label>
                <input
                  type="text"
                  value={cartao}
                  onChange={(e) => setCartao(e.target.value)}
                  placeholder="Ex.: Nubank"
                  className="w-full p-3 bg-[#09090b] border border-zinc-800 text-white rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all placeholder-zinc-700"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">
                Observação <span className="text-zinc-600">(opcional)</span>
              </label>
              <textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                rows={3}
                placeholder="Ex.: loja, garantia, quem ficou responsável..."
                className="w-full p-3 bg-[#09090b] border border-zinc-800 text-white rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all placeholder-zinc-700 text-sm resize-none"
              />
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed flex items-start gap-2">
              <Receipt className="w-4 h-4 shrink-0 mt-0.5" />
              Cada parcela vira um compromisso no calendário na mesma data da compra (mês a mês). Ao marcar como
              quitado, as parcelas somem do calendário.
            </p>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default GastosView;
