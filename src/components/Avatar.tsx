import type { User } from '../types';
import { isImageAvatar } from '../utils';

interface AvatarProps {
  user: User;
  className?: string;
}

/** Foto de perfil do usuário; usa o emoji como fallback quando não há imagem. */
const Avatar = ({ user, className = '' }: AvatarProps) => {
  if (isImageAvatar(user.avatar)) {
    return <img src={user.avatar} alt={user.name} className={`object-cover ${className}`} />;
  }
  return (
    <div
      className={`flex items-center justify-center ${className}`}
      style={{ backgroundColor: `${user.color}20` }}
    >
      {user.avatar}
    </div>
  );
};

export default Avatar;
