import 'dotenv/config';
import { createApp } from './app';
import env from './config/env';
import { disconnectDatabase } from './config/database';

const PORT = parseInt(env.PORT) || 3001;

// Inicializar servidor
async function startServer() {
  try {
    const app = await createApp();

    const server = app.listen(PORT, () => {
      console.log(`🚀 Servidor rodando na porta ${PORT}`);
      console.log(`📝 Ambiente: ${env.NODE_ENV}`);
      console.log(`🌐 Health check: http://localhost:${PORT}/health`);
    });

    // Graceful shutdown
    const shutdown = async () => {
      console.log('\n🛑 Encerrando servidor...');

      server.close(async () => {
        console.log('✅ Servidor HTTP encerrado');

        await disconnectDatabase();
        process.exit(0);
      });

      // Forçar encerramento após 10 segundos
      setTimeout(() => {
        console.error('❌ Forçando encerramento...');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    console.error('❌ Erro ao iniciar servidor:', error);
    process.exit(1);
  }
}

// Iniciar servidor
startServer();
