import { useRef, useState } from 'react';
import {
  Archive,
  BarChart3,
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Pencil,
  Plus,
  ShoppingCart,
  Trash2,
  X,
} from 'lucide-react';
import type { FormEvent } from 'react';
import Modal from './Modal';
import { newId } from '../lib/db';
import { capitalize, toDateInput } from '../utils';
import type { Notify, ShoppingItem, User } from '../types';

/** YYYY-MM-DD → DD/MM (rótulo do item com data). */
const formatDateBR = (date: string): string => {
  const [, m, d] = date.split('-');
  return `${d}/${m}`;
};

/** True se a data do item é hoje (destaca na lista). */
const isItemDateToday = (date: string): boolean => {
  const now = new Date();
  const [y, m, d] = date.split('-').map(Number);
  return now.getFullYear() === y && now.getMonth() === m - 1 && now.getDate() === d;
};

interface ShoppingViewProps {
  items: ShoppingItem[];
  setItems: React.Dispatch<React.SetStateAction<ShoppingItem[]>>;
  currentUser: User;
  users: User[];
  simulateNotifications: Notify;
}

const ShoppingView = ({
  items,
  setItems,
  currentUser,
  users,
  simulateNotifications,
}: ShoppingViewProps) => {
  const [newItemName, setNewItemName] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState(1);
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemDate, setNewItemDate] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  // Relatório de gastos por mês (oculto no final da página)
  const [showMonthReport, setShowMonthReport] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ShoppingItem | null>(null);
  // Mês selecionado no relatório de gastos
  const [reportMonth, setReportMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  // Exclusão com confirmação dentro do app (sem delay do diálogo do navegador)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const confirmTimerRef = useRef<number | undefined>(undefined);
  // Seleção: tocar no item só marca visualmente — comprar exige o botão "Concluir Compra"
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmComplete, setConfirmComplete] = useState(false);
  const confirmCompleteTimerRef = useRef<number | undefined>(undefined);
  // Guarda contra toques que deslizam (rolar a lista não deve marcar item)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const activeItems = items.filter((i) => !i.archived);
  const archivedItems = items.filter((i) => i.archived);

  const totalActive = activeItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const totalArchived = archivedItems.reduce((acc, item) => acc + item.price * item.quantity, 0);

  // Data usada no relatório: a da compra concluída; itens antigos usam a de criação
  const boughtOn = (item: ShoppingItem): string | undefined =>
    item.compradoEm ?? (item.criadoEm ? item.criadoEm.slice(0, 10) : undefined);

  // Gasto do mês selecionado no topo
  const monthTotal = archivedItems.reduce((acc, item) => {
    const d = boughtOn(item);
    if (!d) return acc;
    const [y, m] = d.split('-').map(Number);
    if (y === reportMonth.getFullYear() && m === reportMonth.getMonth() + 1) {
      acc += item.price * item.quantity;
    }
    return acc;
  }, 0);

  const monthLabel = capitalize(
    new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(reportMonth),
  );

  // Últimos 6 meses (a partir do selecionado) para o controle de gastos
  const monthStats = Array.from({ length: 6 }, (_, i) => {
    const month = new Date(reportMonth.getFullYear(), reportMonth.getMonth() - i, 1);
    const total = archivedItems.reduce((acc, item) => {
      const d = boughtOn(item);
      if (!d) return acc;
      const [y, m] = d.split('-').map(Number);
      if (y === month.getFullYear() && m === month.getMonth() + 1) acc += item.price * item.quantity;
      return acc;
    }, 0);
    return {
      month,
      label: capitalize(
        new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(month),
      ),
      total,
    };
  });

  const resetForm = () => {
    setNewItemName('');
    setNewItemQuantity(1);
    setNewItemPrice('');
    setNewItemDate('');
    setEditingItem(null);
    setIsFormOpen(false);
  };

  const openAddItem = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const openEditItem = (item: ShoppingItem) => {
    setEditingItem(item);
    setNewItemName(item.name);
    setNewItemQuantity(item.quantity);
    setNewItemPrice(item.price ? String(item.price) : '');
    setNewItemDate(item.date ?? '');
    setIsFormOpen(true);
  };

  const handleSubmitItem = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = newItemName.trim();
    if (!name) return;

    // Edição de item existente
    if (editingItem) {
      setItems(
        items.map((i) =>
          i.id === editingItem.id
            ? {
                ...i,
                name,
                quantity: newItemQuantity,
                price: parseFloat(newItemPrice) || i.price,
                date: newItemDate || undefined,
              }
            : i,
        ),
      );
      simulateNotifications(
        'Mercado Atualizado',
        `${currentUser.name} editou "${name}".`,
        'all',
        'mercado',
        editingItem.id,
      );
      resetForm();
      return;
    }

    // Reativa o item se ele já existir no histórico
    const existingArchived = items.find(
      (i) => i.name.toLowerCase() === name.toLowerCase() && i.archived,
    );

    if (existingArchived) {
      setItems(
        items.map((i) =>
          i.id === existingArchived.id              ? {
                  ...i,
                  archived: false,
                  quantity: newItemQuantity,
                  price: parseFloat(newItemPrice) || i.price,
                  userId: currentUser.id,
                  date: newItemDate || i.date,
                  compradoEm: undefined,
                }
            : i,
        ),
      );
      simulateNotifications(
        'Mercado Atualizado',
        `${currentUser.name} recolocou "${existingArchived.name}" na lista.`,
        'all',
        'mercado',
        existingArchived.id,
      );
    } else {
      const newItem: ShoppingItem = {
        id: newId(),
        name,
        quantity: newItemQuantity,
        price: parseFloat(newItemPrice) || 0,
        archived: false,
        userId: currentUser.id,
        date: newItemDate || undefined,
      };
      setItems([...items, newItem]);
      simulateNotifications(
        'Nova Compra',
        `${currentUser.name} adicionou "${newItem.name}" ao mercado${newItemDate ? ` (para ${formatDateBR(newItemDate)})` : ''}.`,
        'all',
        'mercado',
        newItem.id,
      );
    }

    resetForm();
  };

  const toggleArchive = (id: string, name: string, isArchiving: boolean) => {
    setItems(
      items.map((i) =>
        i.id === id
          ? {
              ...i,
              archived: isArchiving,
              // Concluiu a compra → grava a data (base do relatório do mês vigente)
              compradoEm: isArchiving ? toDateInput(new Date()) : undefined,
            }
          : i,
      ),
    );
    if (isArchiving) {
      simulateNotifications('Item Comprado', `${currentUser.name} comprou "${name}".`, 'all', 'mercado', id);
    } else {
      simulateNotifications(
        'De volta à lista',
        `${currentUser.name} recolocou "${name}" na lista de compras.`,
        'all',
        'mercado',
        id,
      );
    }
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

  const handleDeleteItem = (item: ShoppingItem) => {
    window.clearTimeout(confirmTimerRef.current);
    setConfirmDeleteId(null);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(item.id);
      return next;
    });
    // Exclusão não dispara push/aviso (só adicionar/editar avisa a família)
    setItems(items.filter((i) => i.id !== item.id));
  };

  // Registra onde o dedo encostou para distinguir toque de deslize
  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  };

  /** Só considera um toque como clique se o dedo não deslizou (evita ativar ao rolar). */
  const isTap = (e: React.MouseEvent): boolean => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return true; // clique de mouse
    return Math.hypot(e.clientX - start.x, e.clientY - start.y) < 10;
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    window.clearTimeout(confirmCompleteTimerRef.current);
    setConfirmComplete(false);
  };

  const clearSelection = () => {
    window.clearTimeout(confirmCompleteTimerRef.current);
    setSelectedIds(new Set());
    setConfirmComplete(false);
  };

  const cancelCompleteConfirm = () => {
    window.clearTimeout(confirmCompleteTimerRef.current);
    setConfirmComplete(false);
  };

  const armCompletePurchase = () => {
    setConfirmComplete(true);
    window.clearTimeout(confirmCompleteTimerRef.current);
    confirmCompleteTimerRef.current = window.setTimeout(() => setConfirmComplete(false), 5000);
  };

  const handleCompletePurchase = () => {
    window.clearTimeout(confirmCompleteTimerRef.current);
    setConfirmComplete(false);
    const selected = items.filter((i) => selectedIds.has(i.id));
    if (selected.length === 0) {
      setSelectedIds(new Set());
      return;
    }
    setItems(
      items.map((i) =>
        selectedIds.has(i.id)
          ? { ...i, archived: true, compradoEm: toDateInput(new Date()) }
          : i,
      ),
    );
    selected.forEach((item) => {
      simulateNotifications('Item Comprado', `${currentUser.name} comprou "${item.name}".`, 'all', 'mercado', item.id);
    });
    setSelectedIds(new Set());
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#09090b] relative">
      <div
        onTouchStart={handleTouchStart}
        className="px-4 py-6 md:px-10 max-w-4xl mx-auto w-full flex-1 overflow-y-auto custom-scrollbar pb-24"
      >
        {/* Resumo financeiro: a comprar + gasto do mês (com controle de mês) + total */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
          <div className="bg-[#121214] p-5 rounded-3xl border border-zinc-800 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-zinc-400">
              <ShoppingCart className="w-4 h-4" /> <span className="text-sm font-medium">A Comprar</span>
            </div>
            <span className="text-2xl md:text-3xl font-bold text-white">R$ {totalActive.toFixed(2)}</span>
          </div>
          <div className="bg-pink-500/10 p-5 rounded-3xl border border-pink-500/20 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-2 text-pink-400">
                <DollarSign className="w-4 h-4" /> <span className="text-sm font-medium">Gasto do Mês</span>
              </div>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => setReportMonth(new Date(reportMonth.getFullYear(), reportMonth.getMonth() - 1, 1))}
                  className="p-1 text-pink-400 hover:bg-pink-500/15 rounded-lg transition-colors"
                  aria-label="Mês anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setReportMonth(new Date(reportMonth.getFullYear(), reportMonth.getMonth() + 1, 1))}
                  className="p-1 text-pink-400 hover:bg-pink-500/15 rounded-lg transition-colors"
                  aria-label="Próximo mês"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
            <span className="text-xs font-semibold text-pink-300 capitalize truncate">{monthLabel}</span>
            <span className="text-2xl md:text-3xl font-bold text-pink-500">R$ {monthTotal.toFixed(2)}</span>
          </div>
          <div className="bg-[#121214] p-5 rounded-3xl border border-zinc-800 flex flex-col gap-2 col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 text-zinc-400">
              <BarChart3 className="w-4 h-4" /> <span className="text-sm font-medium">Gasto Total</span>
            </div>
            <span className="text-2xl md:text-3xl font-bold text-white">R$ {totalArchived.toFixed(2)}</span>
          </div>
        </div>

        {/* Lista ativa */}
        <div className="space-y-3 mb-8">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            Lista Ativa{' '}
            <span className="bg-zinc-800 text-xs px-2 py-0.5 rounded-full text-zinc-400">
              {activeItems.length}
            </span>
          </h3>
          {activeItems.length === 0 && <p className="text-zinc-600 text-sm italic">Lista vazia.</p>}
          {activeItems.map((item) => {
            const itemUser = users.find((u) => u.id === item.userId) || currentUser;
            return (
              <div
                key={item.id}
                onClick={(e) => {
                  if (isTap(e)) toggleSelect(item.id);
                }}
                className={`bg-[#121214] border p-4 rounded-2xl flex items-center justify-between gap-4 group cursor-pointer select-none transition-colors ${
                  selectedIds.has(item.id)
                    ? 'border-pink-500/60 bg-pink-500/5'
                    : 'border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center gap-4 flex-1 overflow-hidden">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isTap(e)) toggleSelect(item.id);
                    }}
                    className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                      selectedIds.has(item.id)
                        ? 'border-pink-500 bg-pink-500 text-white'
                        : 'border-zinc-600 hover:border-pink-500 hover:bg-pink-500/10'
                    }`}
                    aria-label={selectedIds.has(item.id) ? 'Remover seleção' : 'Selecionar item'}
                  >
                    {selectedIds.has(item.id) && <Check className="w-4 h-4" />}
                  </button>
                  <div className="flex-1 truncate">
                    <p className="font-bold text-white truncate">{item.name}</p>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="text-xs text-zinc-500">
                        {item.quantity}x • R$ {item.price.toFixed(2)}
                      </span>
                      {item.date && (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded border font-bold flex items-center gap-1 ${
                            isItemDateToday(item.date)
                              ? 'border-pink-500 bg-pink-500/15 text-pink-400'
                              : 'border-pink-500/40 text-pink-400/80'
                          }`}
                        >
                          <CalendarIcon className="w-3 h-3" /> {formatDateBR(item.date)}
                        </span>
                      )}
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded border border-zinc-800 font-bold"
                        style={{ color: itemUser.color, backgroundColor: `${itemUser.color}15` }}
                      >
                        {itemUser.name}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {confirmDeleteId === item.id ? (
                    <>
                      <span className="text-[10px] font-bold text-red-400 mr-1">Excluir?</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteItem(item);
                        }}
                        className="p-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-xl transition-colors"
                        title="Confirmar exclusão"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          cancelDelete();
                        }}
                        className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors"
                        title="Cancelar"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="font-bold text-white mr-2">
                        R$ {(item.price * item.quantity).toFixed(2)}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditItem(item);
                        }}
                        className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors"
                        title="Editar item"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          askDelete(item.id);
                        }}
                        className="p-2 text-red-400/80 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
                        title="Excluir item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Histórico de compras */}
        <div className="mb-8">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors mb-4 font-medium text-sm"
          >
            <Archive className="w-4 h-4" />{' '}
            {showArchived ? 'Ocultar Histórico' : 'Ver Histórico de Compras'} ({archivedItems.length})
          </button>

          {showArchived && (
            <div className="space-y-3 opacity-60">
              {archivedItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-[#121214] border border-zinc-800 p-4 rounded-2xl flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isTap(e)) toggleArchive(item.id, item.name, false);
                      }}
                      className="w-6 h-6 rounded-md bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <div className="flex-1 line-through text-zinc-500">
                      <p className="font-bold">{item.name}</p>
                      <span className="text-xs">
                        {item.quantity}x • R$ {item.price.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {confirmDeleteId === item.id ? (
                      <>
                        <span className="text-[10px] font-bold text-red-400 mr-1">Excluir?</span>
                        <button
                          onClick={() => handleDeleteItem(item)}
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
                        <span className="font-bold text-zinc-500 line-through mr-2">
                          R$ {(item.price * item.quantity).toFixed(2)}
                        </span>
                        <button
                          onClick={() => askDelete(item.id)}
                          className="p-2 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
                          title="Excluir do histórico"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Controle de gastos por mês (oculto no final, sem poluir o topo) */}
        <div className="mt-8 pt-6 border-t border-zinc-800">
          <button
            onClick={() => setShowMonthReport(!showMonthReport)}
            className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors mb-4 font-medium text-sm"
          >
            <BarChart3 className="w-4 h-4" />{' '}
            {showMonthReport ? 'Ocultar Gastos por Mês' : 'Ver Gastos por Mês'}
          </button>

          {showMonthReport && (
            <div className="bg-[#121214] border border-zinc-800 rounded-3xl p-4">
              <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-pink-500" /> Gastos por mês
              </h3>
              <div className="space-y-2">
                {monthStats.map(({ month, label, total }) => {
                  const selected = month.getTime() === reportMonth.getTime();
                  return (
                    <button
                      key={month.getTime()}
                      onClick={() => setReportMonth(month)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border transition-colors ${
                        selected ? 'border-pink-500/40 bg-pink-500/10' : 'border-zinc-800 hover:border-zinc-600'
                      }`}
                    >
                      <span className="text-sm font-medium text-zinc-300 capitalize">{label}</span>
                      <span className={`text-sm font-bold ${selected ? 'text-pink-400' : 'text-white'}`}>
                        R$ {total.toFixed(2)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Barra de ação: aparece quando há itens selecionados (só aqui conclui a compra) */}
      {selectedIds.size > 0 && (
        <div className="absolute bottom-24 md:bottom-8 left-4 right-4 z-20">
          <div className="bg-zinc-900/95 backdrop-blur border border-zinc-700 rounded-2xl p-3 shadow-2xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-sm font-bold text-white truncate">
                {selectedIds.size} {selectedIds.size === 1 ? 'item selecionado' : 'itens selecionados'}
              </span>
              <button
                onClick={clearSelection}
                className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors shrink-0"
                title="Limpar seleção"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {confirmComplete ? (
                <>
                  <span className="text-xs font-bold text-emerald-400 whitespace-nowrap">Confirmar?</span>
                  <button
                    onClick={handleCompletePurchase}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-bold rounded-xl transition-colors flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" /> Sim, comprar
                  </button>
                  <button
                    onClick={cancelCompleteConfirm}
                    className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors"
                    title="Cancelar"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <button
                  onClick={armCompletePurchase}
                  className="px-4 py-2.5 bg-pink-500 hover:bg-pink-400 text-white text-sm font-bold rounded-xl transition-colors flex items-center gap-2"
                >
                  <ShoppingCart className="w-4 h-4" /> Concluir Compra
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Botão flutuante (FAB) — some enquanto há itens selecionados */}
      {selectedIds.size === 0 && (
        <button
          onClick={openAddItem}
          className="absolute bottom-24 md:bottom-8 right-8 w-16 h-16 bg-pink-500 hover:bg-pink-400 text-white rounded-full shadow-[0_0_20px_rgba(236,72,153,0.4)] flex items-center justify-center transition-transform hover:scale-105 z-10"
        >
          <Plus className="w-8 h-8" />
        </button>
      )}

      {/* Modal de novo/editar item */}
      {isFormOpen && (
        <Modal
          onClose={resetForm}
          title={editingItem ? 'Editar Item' : 'Novo Item'}
          footer={
            <div className="flex gap-3">
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 px-4 py-3 border border-zinc-700 text-zinc-300 rounded-xl hover:bg-zinc-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="shopping-item-form"
                className="flex-1 px-4 py-3 bg-pink-500 text-white font-medium rounded-xl hover:bg-pink-400 transition-colors"
              >
                {editingItem ? 'Salvar' : 'Adicionar'}
              </button>
            </div>
          }
        >
          <form id="shopping-item-form" onSubmit={handleSubmitItem} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">Produto</label>
              <input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="Ex: Arroz 5kg"
                required
                autoFocus
                className="w-full p-3 bg-[#09090b] border border-zinc-800 text-white rounded-xl focus:ring-2 focus:ring-pink-500 outline-none transition-all placeholder-zinc-700"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">Quantidade</label>
                <input
                  type="number"
                  min="1"
                  value={newItemQuantity}
                  onChange={(e) => setNewItemQuantity(Number(e.target.value))}
                  required
                  className="w-full p-3 bg-[#09090b] border border-zinc-800 text-white rounded-xl focus:ring-2 focus:ring-pink-500 outline-none transition-all text-center"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">Preço Est. (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newItemPrice}
                  onChange={(e) => setNewItemPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full p-3 bg-[#09090b] border border-zinc-800 text-white rounded-xl focus:ring-2 focus:ring-pink-500 outline-none transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">
                Data (opcional) <span className="text-zinc-600">— precisa para este dia</span>
              </label>
              <input
                type="date"
                value={newItemDate}
                onChange={(e) => setNewItemDate(e.target.value)}
                className="w-full p-3 bg-[#09090b] border border-zinc-800 text-white rounded-xl focus:ring-2 focus:ring-pink-500 outline-none transition-all"
              />
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default ShoppingView;
