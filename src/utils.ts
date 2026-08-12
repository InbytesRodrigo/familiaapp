export const capitalize = (str: string): string =>
  str.charAt(0).toUpperCase() + str.slice(1);

/** "há 5 min", "há 2 h", "ontem", etc. — usado nos avisos. */
export const timeAgo = (iso: string): string => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'ontem';
  return `há ${days} dias`;
};

/** Formata a data no padrão YYYY-MM-DD (usado em inputs date e no banco). */
export const toDateInput = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const isToday = (date: Date): boolean => {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
};

/** Verifica se o avatar é uma imagem (upload/data URL ou URL externa) em vez de um emoji. */
export const isImageAvatar = (avatar: string): boolean =>
  avatar.startsWith('data:image') || avatar.startsWith('http://') || avatar.startsWith('https://');
