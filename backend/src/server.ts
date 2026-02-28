import 'dotenv/config';
import { createApp } from './app';
import env from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';

const PORT = parseInt(env.PORT) || 3001;

// Conecta ao banco em background (não bloqueia o listen; Render precisa da porta aberta logo)
function connectDatabaseInBackground() {
  connectDatabase().catch((err) => {
    console.error('❌ Conexão ao banco em background falhou:', err?.message ?? err);
    console.log('⏳ O servidor está no ar; novas tentativas a cada 30s...');
    setTimeout(connectDatabaseInBackground, 30000);
  });
}

// Inicializar servidor
function startServer() {
  try {
    const app = createApp();

    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Servidor rodando na porta ${PORT}`);
      console.log(`📝 Ambiente: ${env.NODE_ENV}`);
      console.log(`🌐 Escutando em 0.0.0.0 (necessário para Render)`);
      connectDatabaseInBackground();
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
