export const capitalize = (str: string): string =>
  str.charAt(0).toUpperCase() + str.slice(1);

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
