---
name: llm-council
description: Run any question, idea, or decision through a council of 5 AI advisors who independently analyze it, peer-review each other anonymously, and synthesize a final verdict. Based on Karpathy's LLM Council methodology. MANDATORY TRIGGERS: 'council this', 'run the council', 'war room this', 'pressure-test this', 'stress-test this', 'debate this'. STRONG TRIGGERS (use when combined with a real decision or tradeoff): 'should I X or Y', 'which option', 'what would you do', 'is this the right move', 'validate this', 'get multiple perspectives', 'I can't decide', 'I'm torn between'. Do NOT trigger on simple yes/no questions, factual lookups, or casual 'should I' without a meaningful tradeoff. DO trigger when the user presents a genuine decision with stakes, multiple options, and context that suggests they want it pressure-tested from multiple angles.
---

# LLM Council

Upstream: [aiwithremy/claude-skills-llm-council](https://github.com/aiwithremy/claude-skills-llm-council). Methodology from Andrej Karpathy's [LLM Council](https://github.com/karpathy/llm-council).

One AI → one answer. The council runs **5 independent advisors**, **anonymous peer review**, then a **chairman verdict** with agreement, clashes, blind spots, and one next step.

## When to run

**Good:** pricing/positioning pivots, launch decisions, hire vs automate, copy critique with stakes, "should I X or Y" with real tradeoffs.

**Bad:** factual lookups, pure creation ("write a tweet"), summarization, trivial yes/no.

## The five advisors

| Advisor | Angle |
|---------|--------|
| **Contrarian** | Find fatal flaws, missing risks, what will fail |
| **First Principles Thinker** | Strip assumptions; ask if it's the wrong question |
| **Expansionist** | Upside, adjacencies, what if this works bigger |
| **Outsider** | Zero context; fresh eyes; curse of knowledge |
| **Executor** | Can it be done? Fastest path? First step Monday |

Tensions: Contrarian ↔ Expansionist, First Principles ↔ Executor; Outsider keeps everyone honest.

## Session workflow

### Step 1 — Frame the question

Before convening:

**A. Enrich context** (~30s max). Scan with Glob/Read:

- `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/`
- `memory/`, `docs/`, `.planning/`
- Files the user attached or referenced
- Prior transcripts in `.cursor/skills/llm-council/transcripts/`

**B. Frame** a neutral prompt for all advisors:

1. Core decision/question  
2. User context  
3. Workspace context (stage, audience, constraints, numbers)  
4. What's at stake  

No steering. If too vague ("council this: my business"), ask **one** clarifying question, then proceed.

Save the framed question for the transcript.

### Step 2 — Convene (5 parallel subagents)

Launch **5 Task subagents** (`subagent_type: generalPurpose`) **in one message**, in parallel. Each gets identity + framed question +:

> Respond independently. Do not hedge. Lean fully into your angle. 150–300 words. No preamble.

Template:

```
You are [Advisor Name] on an LLM Council.

Your thinking style: [description from table above]

A user has brought this question to the council:

---
[framed question]
---

Respond from your perspective. Be direct and specific. Don't hedge or try to be balanced.
Keep your response between 150-300 words. No preamble.
```

### Step 3 — Peer review (5 parallel subagents)

Collect all 5 responses. **Anonymize** as Response A–E (randomize mapping).

Launch **5 reviewers in parallel**. Each sees all anonymized responses and answers:

1. Which response is strongest and why? (pick one letter)  
2. Which has the biggest blind spot?  
3. What did ALL responses miss?

Under 200 words each. Template in [reference.md](reference.md).

### Step 4 — Chairman synthesis

One agent (parent or single Task) receives: framed question, all 5 named responses, all 5 peer reviews.

Produce verdict with **exact sections**:

1. **Where the council agrees**  
2. **Where the council clashes** (don't smooth over)  
3. **Blind spots the council caught**  
4. **The recommendation** (clear, not "it depends")  
5. **The one thing you should do first** (single step)

Chairman may disagree with the majority if reasoning supports it. Full chairman template: [reference.md](reference.md).

### Step 5 — Present in chat

Output markdown only. **Do not** generate HTML or extra report files unless the user asks.

```markdown
## Council Verdict: {short topic}

### Where the Council Agrees
...

### Where the Council Clashes
...

### Blind Spots the Council Caught
...

### The Recommendation
...

### The One Thing to Do First
...
```

Use bullets. Keep scannable.

### Step 6 — Transcript (optional)

Save only if the user asks or the decision is worth revisiting:

`.cursor/skills/llm-council/transcripts/council-transcript-YYYY-MM-DD-HHmm.md`

Include: framed question, advisor responses, peer reviews, verdict.

## Cursor implementation rules

- **Always** spawn all 5 advisors in parallel; same for peer review.  
- **Always** anonymize before peer review.  
- **Never** council trivial questions — answer directly instead.  
- Chairman synthesis can run in the parent turn after subagents return (no extra file artifacts).  
- Do not let earlier advisor outputs leak into later spawns beyond the framed question.

## Quick example

**User:** "Council this: $297 Claude course for non-technical solopreneurs — right move?"

**Contrarian:** Market flooded; support/refund risk at that price…  
**First Principles:** What outcome — revenue, authority, or pipeline?  
**Expansionist:** Beginner solopreneurs underserved; could be bigger…  
**Outsider:** "Claude Code" means nothing to the buyer…  
**Executor:** Workshop at $97 to 50 people before building the course…

**Verdict:** Validate with a lower-commitment offer; reframe outcome not tool; first step: $97 live workshop without "Claude" in the title.

More detail and full prompt templates: [reference.md](reference.md).
