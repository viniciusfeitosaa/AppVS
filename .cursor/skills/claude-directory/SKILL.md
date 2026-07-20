---
name: claude-directory
description: Navega e materializa recursos do Claude Directory (tmcpa/claudedirectory, claudedirectory.org) — prompts CLAUDE.md, MCP servers, hooks, skills, plugins, agents e how-to para Claude Code, com adaptação para Cursor. Use quando o usuário mencionar claude directory, claudedirectory.org, Claude Code configs, slash commands, MCP setups, hooks PreToolUse/PostToolUse, ou pedir para portar recursos do ecossistema Claude Code para Cursor.
disable-model-invocation: true
---

# Claude Directory

**Upstream:** [github.com/tmcpa/claudedirectory](https://github.com/tmcpa/claudedirectory) · **Site:** [claudedirectory.org](https://claudedirectory.org)

Diretório comunitário (inspirado no cursor.directory) de configurações para **Claude Code**. No Cursor, quase tudo exige **adaptação** — ver tabela abaixo.

## Primeira ação

1. Classifique o pedido: prompt, MCP, hook, skill, plugin, agent, how-to ou use case.
2. **Busque no upstream** (site, raw GitHub ou clone) — não invente config.
3. Leia [reference.md](reference.md) para slugs, schemas e comandos de busca.

## Categorias

| Categoria | Pasta upstream | Conteúdo útil |
|-----------|----------------|---------------|
| Prompts | `src/data/prompts/` | Templates `CLAUDE.md` por stack |
| MCP Servers | `src/data/mcp-servers/` + `_ingested/` | JSON `config`, `installCommand` |
| Hooks | `src/data/hooks/` | Scripts + `event` / `matcher` |
| Skills | `src/data/skills/` | Workflows e slash commands |
| Plugins | `src/data/plugins/` | `installCommand`, `commands[]` |
| Agents | `src/data/agents/` | Personas por `category` |
| How-To | `src/data/how-to/` | Tutoriais (`difficulty`, `timeToComplete`) |
| Use cases | `src/data/use-cases.ts` | Agrupamento por cenário |

Cada item: arquivo `.ts` exportado no `index.ts` da pasta. Campos: `slug`, `title`, `description`, `tags`, `content`/`config`/`script`, `repoUrl?`, `relatedItems?`, `featured?`.

MCPs ingeridos em massa: metadados em `src/data/github-metadata.json` (não baixar inteiro — buscar no repo ou no site).

## Descoberta

### Por URL do site

`https://claudedirectory.org/{tipo}/{slug}` — tipos: `skills`, `mcp-servers`, `prompts`, `hooks`, `plugins`, `agents`, `how-to`, `use-cases`.

### Por use case

Slugs: `code-review`, `testing`, `security`, `git-workflows`, `documentation`, `debugging`, `performance`, `deployment`, `databases`, `api-development`, `refactoring`, `frontend`, `codebase-onboarding`, `ai-agent-development`, `mobile`, `observability` — detalhes em [reference.md](reference.md).

### Sem clone (raw GitHub)

```
https://raw.githubusercontent.com/tmcpa/claudedirectory/main/src/data/skills/index.ts
https://raw.githubusercontent.com/tmcpa/claudedirectory/main/src/data/skills/{arquivo}.ts
```

Buscar slug: `rg 'slug: "commit"'` no repo clonado ou WebFetch + grep mental no `index.ts`.

### Com clone (offline)

```bash
git clone --depth 1 https://github.com/tmcpa/claudedirectory.git
cd claudedirectory && npm install && npm run dev
```

## Adaptar para Cursor

| Claude Directory | Cursor |
|------------------|--------|
| Skill `content` | `.cursor/skills/{nome}/SKILL.md` (`name`, `description`, `disable-model-invocation: true`) |
| Prompt / CLAUDE.md | `.cursor/rules/*.mdc`, `AGENTS.md` |
| MCP `config` | `.cursor/mcp.json` (mesmo formato MCP) |
| Hook `script` | `.cursor/hooks.json` + `.cursor/hooks/` (mapear eventos — ver skill `create-hook`) |
| Plugin | **Não portável** — extrair commands/skills do `repoUrl` |
| Agent `content` | Skill Cursor ou prompt de subagente (`Task`) |
| How-To | Seguir passos; citar fonte |

Regras:

- Slash commands (`/commit`) → workflow executável pelo agente, sem depender do slash.
- Hooks Claude (`PreToolUse`, `PostToolUse`) → eventos Cursor (`beforeShellExecution`, `afterFileEdit`, etc.).
- Plugins (`/plugin install …`) **não rodam** no Cursor — abrir `repoUrl` / `relatedItems`.

## Materializar no projeto

1. **MCP:** merge de `config` em `.cursor/mcp.json`; reiniciar MCP.
2. **Skill:** pasta `.cursor/skills/{slug}/`, corpo <500 linhas.
3. **Prompt:** regra com `globs` adequados; evitar duplicar regras existentes.
4. **Hook:** portar script + registrar hooks Cursor.

Materialize **só** o que o usuário pediu — não copiar o catálogo inteiro.

## Contribuir ao upstream

Ver [CONTRIBUTING.md](https://github.com/tmcpa/claudedirectory/blob/main/CONTRIBUTING.md): arquivo em `src/data/{categoria}/`, export no `index.ts`, `npm run build`, PR. Schemas em `src/lib/types.ts`.

## Resposta ao usuário

Ao recomendar um item:

1. **Nome + slug** + link `https://claudedirectory.org/...`
2. **Por que encaixa** (1–2 frases)
3. **Passos no Cursor** no projeto atual
4. **`repoUrl`** se houver

## Skills curated (atalho)

`commit`, `pr`, `review`, `security-audit`, `mcp-builder`, `playwright-skill`, `test-gen`, `refactor`, `deps-audit`, `sql-optimizer`, `skill-creator`, `pdf`, `docx`, `xlsx`, `pptx`.

MCPs curated: `github`, `postgres`, `supabase`, `sentry`, `datadog`, `playwright`, `figma`, `notion`, `linear`, `filesystem`, `fetch`, `context7`.

Mais detalhes: **[reference.md](reference.md)**.
