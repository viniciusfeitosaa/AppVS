# Memória total (Obsidian no Windows)

Use esta nota quando o vault principal tiver a pasta **`memoria total`**.

## Estrutura no Obsidian (após o script)

```
SeuVault/
└── memoria total/
    └── Viva-Saude/          ← atalho (junction) para o Git: AppVS/contexto/
        ├── Home.md
        ├── 01-produto-e-visao.md
        ├── journal/
        └── ...
```

Edite em **`memoria total/Viva-Saude/`** — salva direto no repositório.

## Comando no PC

Na pasta do repo (PowerShell):

```powershell
git pull
.\rodar-memoria-total.ps1
```

### Vault configurado (vinic)

```
C:\Users\vinic\Documents\COFRE - MEMORIA
```

Atalho na raiz do repo:

```powershell
.\rodar-cofre-memoria.ps1
```

Na primeira vez em outro PC, informe o caminho do **vault** (pasta pai da `memoria total`).

## Notas pessoais na mesma pasta

Você pode criar outros `.md` **ao lado** de `Viva-Saude/` dentro de `memoria total/` (ex.: ideias gerais).  
Só o conteúdo dentro de **`Viva-Saude/`** vai para o Git do AppVS.

## Sincronização

| Ação | Comando |
|------|---------|
| Ver o que o agente fez | `git pull` no repo |
| Enviar suas anotações | `git add contexto` → `commit` → `push` |

Ver também: [[SETUP-OBSIDIAN]]
