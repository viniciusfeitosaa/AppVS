import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Em produção, a URL deve vir de VITE_API_URL (configurar no Netlify e redeployar)
if (import.meta.env.PROD && (API_URL.includes('localhost') || !import.meta.env.VITE_API_URL)) {
  console.error(
    '[API] Em produção a URL da API está incorreta. No Netlify: Site configuration → Environment variables → adicione VITE_API_URL = https://SEU-BACKEND.onrender.com/api e faça um novo deploy.'
  );
}

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Accept': 'application/json; charset=utf-8',
  },
});

// Interceptor para adicionar token nas requisições
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para tratar erros de resposta
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUrl = error.config?.url || '';
    const isAuthRoute =
      requestUrl.includes('/auth/login') ||
      requestUrl.includes('/auth/login-medico') ||
      requestUrl.includes('/auth/login-master');

    if (error.response?.status === 401 && !isAuthRoute) {
      // Token expirado ou inválido: limpar user também para evitar loop login → dashboard → 401
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    if (error.response?.status === 403 && !requestUrl.includes('/acesso-negado')) {
      window.location.href = '/acesso-negado';
    }
    return Promise.reject(error);
  }
);

export default api;
