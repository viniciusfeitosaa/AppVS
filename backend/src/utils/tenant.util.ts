import env from '../config/env';
import { prisma } from '../config/database';

export const getDefaultTenant = async () => {
  const tenant = await prisma.tenant.findFirst({
    where: {
      slug: env.TENANT_DEFAULT_SLUG,
      ativo: true,
    },
  });

  if (!tenant) {
    throw {
      statusCode: 500,
      message:
        'Banco não configurado. No terminal, na pasta backend, rode: npx prisma db push e depois npm run prisma:seed',
    };
  }

  return tenant;
};
