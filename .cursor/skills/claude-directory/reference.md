# Claude Directory — Referência

Repositório: [tmcpa/claudedirectory](https://github.com/tmcpa/claudedirectory) · Site: [claudedirectory.org](https://claudedirectory.org)

## Estrutura `src/data/`

```
src/data/
├── prompts/           # ~25 stacks (CLAUDE.md)
├── mcp-servers/       # Curated MCP configs
├── _ingested/         # MCPs ingeridos (metadados em github-metadata.json)
├── hooks/
├── skills/
├── plugins/
├── agents/
├── how-to/
├── blog/              # Posts do site
├── use-cases.ts       # Cenários + tags
├── recently-added.ts  # Destaques recentes
├── comparisons.ts
└── github-metadata.json  # Grande — usar rg no clone, não fetch completo
```

Tipos: `src/lib/types.ts` · Matching use cases: `src/lib/use-cases.ts`

## URLs do site

| Tipo | Padrão |
|------|--------|
| Skill | `https://claudedirectory.org/skills/{slug}` |
| MCP | `https://claudedirectory.org/mcp-servers/{slug}` |
| Prompt | `https://claudedirectory.org/prompts/{slug}` |
| Hook | `https://claudedirectory.org/hooks/{slug}` |
| Plugin | `https://claudedirectory.org/plugins/{slug}` |
| Agent | `https://claudedirectory.org/agents/{slug}` |
| How-To | `https://claudedirectory.org/how-to/{slug}` |
| Use case | `https://claudedirectory.org/use-cases/{slug}` |

## Use cases e tags

| Slug | Tags principais |
|------|-----------------|
| `code-review` | code-review, review, quality, audit, pr |
| `testing` | testing, tdd, e2e, coverage, qa |
| `security` | security, audit, owasp, vulnerability, secrets |
| `git-workflows` | git, github, commit, branch, conventional-commits |
| `documentation` | documentation, changelog, api-docs |
| `debugging` | debugging, troubleshooting, errors |
| `performance` | performance, optimization, benchmarking, profiling |
| `deployment` | deployment, ci-cd, docker, kubernetes, release |
| `databases` | database, postgres, sql, migrations, redis, nosql |
| `api-development` | api, rest, graphql, openapi, swagger, sdk |
| `refactoring` | refactoring, migration, code-quality, monorepo, architecture |
| `frontend` | frontend, ui, design, components, react, accessibility |
| `codebase-onboarding` | onboarding, exploration, architecture, claude-md, memory |
| `ai-agent-development` | ai, llm, agent-sdk, mcp, prompt-engineering, agents, rag |
| `mobile` | mobile, ios, android, flutter, react-native, swift, kotlin |
| `observability` | observability, monitoring, sentry, datadog, grafana, pagerduty |

## Busca no repo clonado

```bash
rg 'slug: "' src/data/skills --glob '*.ts' -l
rg -i 'postgres' src/data/mcp-servers --glob '*.ts' -l
rg 'event: "PostToolUse"' src/data/hooks -l
rg 'featured: true' src/data -l
ls src/data/prompts/*.ts
```

## Schema resumido

| Tipo | Campos principais |
|------|-------------------|
| **Skill** | `slug`, `title`, `description`, `content`, `tags`, `author`, `repoUrl?` |
| **MCPServer** | `slug`, `title`, `description`, `config` (JSON string), `installCommand?`, `tags`, `stars?` |
| **Hook** | `slug`, `event`, `matcher?`, `script`, `tags` |
| **Prompt** | `slug`, `content` (markdown CLAUDE.md), `tags` |
| **Plugin** | `slug`, `installCommand`, `commands?[]`, `config?` |
| **Agent** | `slug`, `content`, `category`, `tags` |
| **HowTo** | `slug`, `content`, `difficulty`, `timeToComplete`, `tags` |

Opcionais em todos: `featured`, `repoUrl`, `relatedItems: [{ type, slug }]`.

## Mapeamento Claude Code → Cursor

### Skill → SKILL.md

```markdown
---
name: git-commit
description: Gera commits convencionais a partir do diff. Use quando o usuário pedir commit ou mensagem de commit.
disable-model-invocation: true
---

# Git Commit
1. git status + git diff
2. Mensagem convencional
3. Commitar só se o usuário pediu explicitamente
```

### MCP → mcp.json

Campo `config` do diretório → merge em `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres", "postgresql://..."]
    }
  }
}
```

### Hook → Cursor hooks

Claude: `PreToolUse` / `PostToolUse` + `matcher` regex.  
Cursor: `beforeShellExecution`, `afterFileEdit`, etc. — usar skill local `create-hook`.

### Prompt → Rules

`prompts/nextjs.ts` → `.cursor/rules/nextjs.mdc` com `globs: ["**/*.{tsx,ts}"]`.

### Agent → Subagent

`agent.content` → prompt do `Task` ou skill dedicada.

## Prompts (stacks)

`angular`, `astro`, `bun-hono`, `csharp-dotnet`, `django`, `elixir-phoenix`, `fastapi`, `flutter`, `go`, `haskell`, `java-spring`, `kotlin-android`, `laravel`, `nextjs`, `python`, `react-native`, `remix`, `ruby-rails`, `rust`, `sveltekit`, `swift`, `terraform`, `typescript`, `vue`

## Agent categories

`development`, `data-ai`, `infrastructure`, `quality-testing`, `security`, `business`, `specialization`

## Contribuição upstream (checklist)

- [ ] Arquivo em `src/data/{tipo}/meu-item.ts`
- [ ] Import + export no `index.ts` da pasta
- [ ] `slug` único, kebab-case
- [ ] `tags` alinhadas a use cases
- [ ] `npm run dev` + `npm run build`
- [ ] PR com descrição clara

Templates completos: [CONTRIBUTING.md](https://github.com/tmcpa/claudedirectory/blob/main/CONTRIBUTING.md)

## Ecossistema

- [Claude Code docs](https://code.claude.com/docs/en/overview)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [cursor.directory](https://cursor.directory)
- Skills Cursor locais: `create-skill`, `create-hook`
