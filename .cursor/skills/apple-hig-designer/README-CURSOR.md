# Apple HIG Designer — Cursor

Skill instalada a partir de [axiaoge2/Apple-Hig-Designer](https://github.com/axiaoge2/Apple-Hig-Designer).

## Localização

`~/.cursor/skills/apple-hig-designer/`

## Como usar

Mencione explicitamente ou peça interfaces no estilo Apple:

- "Use apple-hig-designer para..."
- "Design an Apple-style..."
- "Create a HIG-compliant..."
- "Interface estilo iOS/macOS"

## Arquivos

| Arquivo | Conteúdo |
|---------|----------|
| `SKILL.md` | Regras HIG, tokens, componentes, checklist |
| `REFERENCE.md` | Padrões detalhados e exemplos completos |
| `resources/design-tokens.css` | CSS custom properties |
| `resources/components.jsx` | Componentes React de referência |
| `resources/ui-patterns.md` | Páginas e padrões prontos |

## Atualizar da upstream

```bash
git clone --depth 1 https://github.com/axiaoge2/Apple-Hig-Designer.git /tmp/apple-hig
cp /tmp/apple-hig/SKILL.md /tmp/apple-hig/REFERENCE.md ~/.cursor/skills/apple-hig-designer/
cp -r /tmp/apple-hig/resources ~/.cursor/skills/apple-hig-designer/
```

Reaplique o cabeçalho Cursor em `SKILL.md` se necessário.
