# Plugin Document Skills (Cursor)

Plugin do Cursor para documentar e usar Skills com o agente.

## Instalação

No Cursor, use o comando de instalação do plugin:

```
/plugin install document-skills@anthropic-agent-skills
```

- **document-skills** – nome do plugin.
- **anthropic-agent-skills** – pacote/origem do plugin.

Após a instalação, o plugin fica disponível para documentar e referenciar skills no projeto.

## Relação com esta pasta

A pasta **`Skills/`** deste repositório contém a documentação em Markdown (deploy, Supabase, CORS, etc.). O plugin **document-skills** pode ser usado para que o agente do Cursor leia e aplique essas práticas automaticamente quando relevante.

## Quando usar

- Ao configurar o Cursor em uma máquina nova ou para um novo dev no projeto.
- Se o agente não estiver seguindo as práticas documentadas em `Skills/`, verificar se o plugin está instalado e ativo.
