interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
  className?: string;
}

const SIZES = {
  sm: { icon: 'w-9 h-9 rounded-xl text-xl', name: 'text-base', gap: 'gap-2' },
  md: { icon: 'w-11 h-11 rounded-2xl text-2xl', name: 'text-lg', gap: 'gap-2.5' },
  lg: { icon: 'w-24 h-24 rounded-[1.6rem] text-5xl', name: 'text-3xl', gap: 'gap-4' },
};

/** Logo do app: "F" com gradiente animado estilo Instagram e nome discreto. */
const Logo = ({ size = 'md', showName = true, className = '' }: LogoProps) => {
  const s = SIZES[size];
  return (
    <div className={`flex items-center ${s.gap} ${className}`}>
      <div
        className={`relative overflow-hidden flex items-center justify-center font-black text-white shadow-lg shadow-pink-500/30 select-none shrink-0 ${s.icon} logo-gradient`}
      >
        <span className="relative z-10">F</span>
        <span className="logo-shimmer pointer-events-none" />
      </div>
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
