export type LogoVariant = 'f' | 'casa';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
  className?: string;
  variant?: LogoVariant;
}

const SIZES = {
  sm: { size: 'w-9 h-9', icon: 'rounded-xl text-xl', name: 'text-base', gap: 'gap-2' },
  md: { size: 'w-11 h-11', icon: 'rounded-2xl text-2xl', name: 'text-lg', gap: 'gap-2.5' },
  lg: { size: 'w-24 h-24', icon: 'rounded-[1.6rem] text-5xl', name: 'text-3xl', gap: 'gap-4' },
};

/** Casa com coração (símbolo de família), dentro de um anel com gradiente. */
const HouseLogo = ({ className }: { className: string }) => (
  <div
    className={`relative shrink-0 select-none rounded-full logo-ring-gradient p-[3px] shadow-lg shadow-pink-500/25 ${className}`}
  >
    <div className="w-full h-full rounded-full bg-[#121214] flex items-center justify-center overflow-hidden">
      <svg viewBox="0 0 24 24" className="w-[64%] h-[64%]" fill="none">
        {/* Telhado e corpo da casa */}
        <path
          d="M3 10.6 12 3l9 7.6"
          stroke="#fff"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M5.2 9.9v9.5a1.6 1.6 0 0 0 1.6 1.6h10.4a1.6 1.6 0 0 0 1.6-1.6V9.9"
          stroke="#fff"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Porta */}
        <path
          d="M9.4 21v-5.2a1 1 0 0 1 1-1h3.2a1 1 0 0 1 1 1V21"
          stroke="#fff"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Coração */}
        <path
          d="M12 11.2c-.9-1.2-2.6-1-2.6.7 0 1.1 1.6 2 2.6 3.1 1-1.1 2.6-2 2.6-3.1 0-1.7-1.7-1.9-2.6-.7z"
          fill="#d62976"
        />
      </svg>
    </div>
  </div>
);

/** Logo do app: dois modelos — "F" gradiente animado ou "Casa & Coração". */
const Logo = ({ size = 'md', showName = true, className = '', variant = 'f' }: LogoProps) => {
  const s = SIZES[size];
  return (
    <div className={`flex items-center ${s.gap} ${className}`}>
      {variant === 'casa' ? (
        <HouseLogo className={s.size} />
      ) : (
        <div
          className={`relative overflow-hidden flex items-center justify-center font-black text-white shadow-lg shadow-pink-500/30 select-none shrink-0 ${s.size} ${s.icon} logo-gradient`}
        >
          <span className="relative z-10">F</span>
          <span className="logo-shimmer pointer-events-none" />
        </div>
      )}
      {showName && (
        <span className={`font-bold tracking-tight whitespace-nowrap ${s.name}`}>
          <span className="text-white">Família</span>
          <span className="text-pink-500">App</span>
        </span>
      )}
    </div>
  );
};

export default Logo;
