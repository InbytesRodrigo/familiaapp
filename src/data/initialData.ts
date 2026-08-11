import type { FamilyEvent, ShoppingItem, User } from '../types';

export const initialUsers: User[] = [
  { id: '1', name: 'Marido', role: 'Pai', color: '#3b82f6', avatar: '👨' }, // Azul
  { id: '2', name: 'Mulher', role: 'Mãe', color: '#ec4899', avatar: '👩' }, // Rosa
  { id: '3', name: 'Filho', role: 'Filho', color: '#10b981', avatar: '👦' }, // Verde
];

export const initialEvents: FamilyEvent[] = [
  { id: 'e1', title: 'Dentista', date: new Date(), time: '14:00', endTime: '15:00', userId: '2', createdBy: '2' },
  { id: 'e2', title: 'Futebol', date: new Date(), time: '19:00', endTime: '20:30', userId: '3', createdBy: '1' },
  { id: 'e3', title: 'Reunião Escolar', date: new Date(new Date().setDate(new Date().getDate() + 1)), time: '10:00', endTime: '11:00', userId: '1', createdBy: '2' },
];

export const initialShoppingItems: ShoppingItem[] = [
  { id: 's1', name: 'Leite', quantity: 2, price: 4.5, archived: false, userId: '2' },
  { id: 's2', name: 'Pão', quantity: 1, price: 6.0, archived: false, userId: '1' },
  { id: 's3', name: 'Sabão em Pó', quantity: 1, price: 25.9, archived: true, userId: '2' },
];
