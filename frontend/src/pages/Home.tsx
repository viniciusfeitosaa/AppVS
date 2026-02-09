import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Home = () => {
  const navigate = useNavigate();
  const { setIntroPlayed } = useAuth();
  const [isMediaLoaded, setIsMediaLoaded] = useState(false);

  const handleComplete = () => {
    setIntroPlayed(true);
    navigate('/login');
  };

  useEffect(() => {
    // Redireciona automaticamente após 10 segundos (GIF fica em loop)
    const timer = setTimeout(handleComplete, 10000);
    return () => clearTimeout(timer);
  }, [navigate, setIntroPlayed]);

  return (
    <div
      className="min-h-screen bg-white flex flex-col items-center justify-center overflow-hidden cursor-pointer"
      onClick={handleComplete}
      onKeyDown={(e) => e.key === 'Enter' && handleComplete()}
      role="button"
      tabIndex={0}
      aria-label="Toque para continuar"
    >
      {/* Animação de carregamento (GIF) - leve e compatível com qualquer dispositivo */}
      <div 
        className={`relative w-full max-w-xs px-6 flex justify-center transition-opacity duration-[1500ms] ease-in-out ${
          isMediaLoaded ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <img
          src="/assets/intro.gif"
          alt="Viva Saúde"
          className="w-full h-auto rounded-xl pointer-events-none"
          onLoad={() => setIsMediaLoaded(true)}
        />
      </div>
    </div>
  );
};

export default Home;
