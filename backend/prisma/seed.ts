import { PrismaClient, UserRole } from '@prisma/client';
import env from '../src/config/env';
import { hashPassword } from '../src/utils/password.util';

const prisma = new PrismaClient();

async function main() {
  if (!env.MASTER_INITIAL_PASSWORD) {
    throw new Error(
      'MASTER_INITIAL_PASSWORD não definido. Configure a variável para criar o usuário master inicial.'
    );
  }

  const tenant = await prisma.tenant.upsert({
    where: { slug: env.TENANT_DEFAULT_SLUG },
    update: {
      nome: 'Seja Viva Saúde',
      ativo: true,
    },
    create: {
      nome: 'Seja Viva Saúde',
      slug: env.TENANT_DEFAULT_SLUG,
      ativo: true,
    },
  });

  const senhaHash = await hashPassword(env.MASTER_INITIAL_PASSWORD);

  const master = await prisma.usuarioMaster.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: env.MASTER_INITIAL_EMAIL.toLowerCase(),
      },
    },
    update: {
      nome: env.MASTER_INITIAL_NAME,
      senhaHash,
      ativo: true,
      role: UserRole.MASTER,
    },
    create: {
      tenantId: tenant.id,
      nome: env.MASTER_INITIAL_NAME,
      email: env.MASTER_INITIAL_EMAIL.toLowerCase(),
      senhaHash,
      role: UserRole.MASTER,
      ativo: true,
    },
  });

  console.log('Seed executado com sucesso');
  console.log(`Tenant: ${tenant.slug} (${tenant.id})`);
  console.log(`Master: ${master.email} (${master.id})`);
}

main()
  .catch((error) => {
    console.error('Erro no seed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
