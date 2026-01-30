import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Home = () => {
  const navigate = useNavigate();
  const { setIntroPlayed } = useAuth();
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);

  const handleComplete = () => {
    setIntroPlayed(true);
    navigate('/login');
  };

  useEffect(() => {
    // Redireciona automaticamente após 10 segundos como fallback
    const timer = setTimeout(handleComplete, 10000);
    return () => clearTimeout(timer);
  }, [navigate, setIntroPlayed]);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center overflow-hidden">
      {/* Container do Vídeo com Fade-in - Tamanho otimizado para mobile */}
      <div 
        className={`relative w-full max-w-xs px-6 flex justify-center transition-opacity duration-[1500ms] ease-in-out ${
          isVideoLoaded ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <video
          autoPlay
          muted
          playsInline
          onCanPlayThrough={() => setIsVideoLoaded(true)}
          className="w-full h-auto rounded-xl"
          onEnded={handleComplete}
        >
          <source src="/assets/intro.mp4" type="video/mp4" />
          Seu navegador não suporta vídeos.
        </video>
      </div>
    </div>
  );
};

export default Home;
