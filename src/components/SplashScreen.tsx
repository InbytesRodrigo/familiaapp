import Logo from './Logo';

interface SplashScreenProps {
  fading: boolean;
  onSkip: () => void;
}

/** Efeito de abertura estilo app nativo: logo animada em destaque. */
const SplashScreen = ({ fading, onSkip }: SplashScreenProps) => (
  <div
    onClick={onSkip}
    className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#09090b] transition-opacity duration-500 ${
      fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
    }`}
  >
    <div className="relative flex items-center justify-center">
      <span className="logo-pulse-ring absolute -inset-5 rounded-full pointer-events-none" />
      <Logo size="lg" showName={false} className="logo-pop" />
    </div>
    <div className="mt-6 flex flex-col items-center">
      <span className="text-3xl font-bold tracking-tight animate-in fade-in duration-500 delay-200">
        Família<span className="text-pink-500">App</span>
      </span>
      <span className="mt-1.5 text-[10px] uppercase tracking-[0.35em] text-zinc-500 animate-in fade-in duration-500 delay-500">
        Agenda familiar
      </span>
    </div>
  </div>
);

export default SplashScreen;
