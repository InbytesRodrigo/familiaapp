import { useState } from 'react';
import { Archive, Calendar as CalendarIcon, Check, DollarSign, Plus, ShoppingCart } from 'lucide-react';
import type { FormEvent } from 'react';
import Modal from './Modal';
import { newId } from '../lib/db';
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
  const [isFormOpen, setIsFormOpen] = useState(false);

  const activeItems = items.filter((i) => !i.archived);
  const archivedItems = items.filter((i) => i.archived);

  const totalActive = activeItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const totalArchived = archivedItems.reduce((acc, item) => acc + item.price * item.quantity, 0);

  const handleAddItem = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    // Reativa o item se ele já existir no histórico
    const existingArchived = items.find(
      (i) => i.name.toLowerCase() === newItemName.trim().toLowerCase() && i.archived,
    );

    if (existingArchived) {
      setItems(
        items.map((i) =>
          i.id === existingArchived.id
            ? {
                ...i,
                archived: false,
                quantity: newItemQuantity,
                price: parseFloat(newItemPrice) || i.price,
                userId: currentUser.id,
                date: newItemDate || i.date,
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
        name: newItemName.trim(),
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

    setNewItemName('');
    setNewItemQuantity(1);
    setNewItemPrice('');
    setNewItemDate('');
    setIsFormOpen(false);
  };

  const toggleArchive = (id: string, name: string, isArchiving: boolean) => {
    setItems(items.map((i) => (i.id === id ? { ...i, archived: isArchiving } : i)));
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

  return (
    <div className="flex-1 flex flex-col h-full bg-[#09090b] relative">
      <div className="px-4 py-6 md:px-10 max-w-4xl mx-auto w-full flex-1 overflow-y-auto custom-scrollbar pb-24">
        {/* Resumo financeiro */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-[#121214] p-5 rounded-3xl border border-zinc-800 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-zinc-400">
              <ShoppingCart className="w-4 h-4" /> <span className="text-sm font-medium">A Comprar</span>
            </div>
            <span className="text-2xl md:text-3xl font-bold text-white">R$ {totalActive.toFixed(2)}</span>
          </div>
          <div className="bg-pink-500/10 p-5 rounded-3xl border border-pink-500/20 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-pink-400">
              <DollarSign className="w-4 h-4" /> <span className="text-sm font-medium">Gasto Realizado</span>
            </div>
            <span className="text-2xl md:text-3xl font-bold text-pink-500">R$ {totalArchived.toFixed(2)}</span>
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
                className="bg-[#121214] border border-zinc-800 p-4 rounded-2xl flex items-center justify-between gap-4 group hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-center gap-4 flex-1 overflow-hidden">
                  <button
                    onClick={() => toggleArchive(item.id, item.name, true)}
                    className="w-6 h-6 rounded-md border-2 border-zinc-600 flex items-center justify-center hover:border-pink-500 hover:bg-pink-500/10 transition-colors shrink-0"
                  >
                    <Check className="w-4 h-4 text-transparent group-hover:text-pink-500" />
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
                <div className="font-bold text-white shrink-0">
                  R$ {(item.price * item.quantity).toFixed(2)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Histórico de compras */}
        <div>
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
                      onClick={() => toggleArchive(item.id, item.name, false)}
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
                  <div className="font-bold text-zinc-500 line-through">
                    R$ {(item.price * item.quantity).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Botão flutuante (FAB) */}
      <button
        onClick={() => setIsFormOpen(true)}
        className="absolute bottom-24 md:bottom-8 right-8 w-16 h-16 bg-pink-500 hover:bg-pink-400 text-white rounded-full shadow-[0_0_20px_rgba(236,72,153,0.4)] flex items-center justify-center transition-transform hover:scale-105 z-10"
      >
        <Plus className="w-8 h-8" />
      </button>

      {/* Modal de novo item */}
      {isFormOpen && (
        <Modal
          onClose={() => setIsFormOpen(false)}
          title="Novo Item"
          footer={
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="flex-1 px-4 py-3 border border-zinc-700 text-zinc-300 rounded-xl hover:bg-zinc-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="shopping-item-form"
                className="flex-1 px-4 py-3 bg-pink-500 text-white font-medium rounded-xl hover:bg-pink-400 transition-colors"
              >
                Adicionar
              </button>
            </div>
          }
        >
          <form id="shopping-item-form" onSubmit={handleAddItem} className="space-y-5">
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
