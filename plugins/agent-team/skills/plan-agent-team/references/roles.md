# Role catalogue

Candidate roles, grouped by discipline. Include a role only with evidence from
the audit. "Signals" are what to look for in the repository and its history;
"Owns" is what the role typically writes; everything else it only reads or
reviews.

## Engineering

| Role | Signals | Owns | Typical capabilities |
| --- | --- | --- | --- |
| Frontend engineer | UI frameworks, components, styles, client state | Components, pages, client logic, styles | Edit, run tests, run the app |
| Backend engineer | Route handlers, services, business logic | Server code, APIs | Edit, run tests |
| API designer | Public or partner APIs, schemas, SDKs | API contracts, schemas, versioning notes | Edit specs, review |
| Database engineer | Schemas, migrations, query code | Migrations, schema, data access layer | Edit, run migrations locally |
| Platform / DevOps engineer | CI workflows, deploy scripts, infrastructure as code | CI, build and deploy config, infrastructure | Edit, run CI locally; no production access by default |
| Site reliability engineer | Monitoring, alerting, incidents, SLOs | Runbooks, alerts, dashboards as code | Read logs and metrics, edit config |
| Mobile engineer | iOS, Android, cross-platform apps | App code, store builds | Edit, build, test |
| Extension / plugin engineer | Browser extensions, editor plugins | Extension code and manifests | Edit, build, test |
| Library / SDK engineer | Published packages | Package source, public API | Edit, run tests, build |
| ML / data engineer | Pipelines, models, datasets | Pipelines, training and evaluation code | Edit, run jobs |

## Security

| Role | Signals | Owns | Typical capabilities |
| --- | --- | --- | --- |
| Application security reviewer | Auth, input handling, user data, secrets | Security review comments, threat models | Read, run scanners; no edit by default |
| Supply-chain security | Many dependencies, lockfiles, publishing | Dependency policy, audit reports | Read, run audits, propose updates |
| Infrastructure security | Cloud config, IAM, network rules | Hardening proposals | Read config |
| Privacy reviewer | Personal data, analytics, retention | Data-flow notes, privacy review | Read |
| Threat intelligence / domain research | Products that detect or respond to external threats | Research notes with sources | Read, web research |

## Quality

| Role | Signals | Owns | Typical capabilities |
| --- | --- | --- | --- |
| Test engineer | Unit and integration suites, coverage gaps | Tests, fixtures | Edit tests, run tests |
| End-to-end tester | Browser or device test suites | E2E specs | Edit, run a browser |
| Performance engineer | Budgets, benchmarks, slow paths | Benchmarks, profiles | Run, measure, propose |
| Accessibility tester | UI, public sites, legal requirements | Accessibility audits, fixes proposed to owners | Run checkers, read |
| Code reviewer | Any shared codebase | Review comments | Read only |

## Design

| Role | Signals | Owns | Typical capabilities |
| --- | --- | --- | --- |
| UX researcher | User feedback, analytics, support issues | Research findings, personas, journey maps | Read, summarise |
| Product / UX designer | Flows, new features, onboarding | Flows, wireframes, interaction specs | Write specs, produce mock-ups |
| UI / visual designer | Styling, layout, imagery | Visual specs, mock-ups | Produce mock-ups, edit styles if granted |
| Interaction / motion designer | Animations, transitions, gestures | Motion specs | Write specs, prototype |
| Design-system designer | Tokens, shared components, theming | Tokens, component guidelines | Edit tokens and docs |
| Content designer / UX writer | Interface copy, string bundles, error messages | Copy in string bundles, voice and tone guide | Edit copy |
| Accessibility designer | Contrast, focus, screen-reader flows | Accessibility requirements in specs | Write specs, review |
| Information architect | Navigation, many pages, docs structure | Site maps, navigation specs | Write specs |
| Brand designer | Logos, icons, marketing assets | Brand guidelines, asset specs | Produce assets if tools allow |

## Product and business

| Role | Signals | Owns | Typical capabilities |
| --- | --- | --- | --- |
| Product manager | Roadmaps, feature requests, priorities | Specs, acceptance criteria, issue triage | Read, write issues |
| Analytics | Metrics, dashboards, experiments | Metric definitions, reports | Query data if granted |
| Growth / marketing | Landing pages, store listings, campaigns | Listing copy, announcements | Edit marketing copy |
| Support / triage | Bug reports, user questions | Labels, reproductions, routing | Read, write issues |
| Legal and compliance | Licences, policies, regulated data | Licence and policy reviews | Read; proposals only |

## Docs and operations

| Role | Signals | Owns | Typical capabilities |
| --- | --- | --- | --- |
| Technical writer | READMEs, guides, API docs | Docs | Edit docs |
| Developer advocate | Public SDKs, examples, community | Examples, tutorials | Edit examples |
| Release manager | Versions, changelogs, publishing | Release PRs, notes | Read; ships only through the release flow |
| Localisation | Several locales, string bundles | Translations | Edit translations |
| Dependency maintainer | Frequent dependency updates | Dependency update PRs | Edit manifests and lockfiles via the package manager |

## Coordination roles

| Role | When | Does |
| --- | --- | --- |
| Lead / orchestrator | More than three roles, or work that spans several | Breaks requests into tasks, assigns owners, tracks handoffs, assembles results |
| Explorer | Large codebases | Read-only search and summarising, so other roles keep their context for their own work |
| Critic | High-stakes output (security, public copy, migrations) | Challenges a plan or result before it reaches a person |
