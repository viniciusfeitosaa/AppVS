export type EmailJobPayload =
  | {
      type: 'cadastro-pos';
      to: string;
      nomeCompleto: string;
      versaoTermos: string;
    }
  | {
      type: 'cadastro-aprovado';
      to: string;
      nomeCompleto: string;
      nomeInstituicao?: string | null;
    }
  | {
      type: 'cadastro-documento-solicitado';
      to: string;
      nomeCompleto: string;
      nomeDocumento: string;
      mensagem: string;
      nomeInstituicao?: string | null;
    }
  | {
      type: 'reset-password';
      to: string;
      resetLink: string;
    };
