Vyasa renders D2 code blocks with zoom, pan, reset, and fullscreen controls.

## Basic usage

:::tabs
::tab{title="Rendered"}
```d2
---
title: Basic Request Flow
width: 80vw
height: 420px
---
direction: right
user: User
api: API
db: Database

user -> api: request
api -> db: query
db -> api: rows
api -> user: response
```
::tab{title="Markdown Source" copy-from="Rendered"}
:::

## Frontmatter controls

You can add frontmatter at the top of any D2 code block:
````
```d2
---
width: 85vw
height: 70vh
title: Checkout System
layout: elk
theme_id: 3
dark_theme_id: 200
sketch: false
pad: 80
scale: 1
target: "*"
animate_interval: 1200
---
direction: right
...
```
````

Supported keys in Vyasa:
- `width` (default: `65vw`)
- `height` (default: `auto`)
- `title` (used for fullscreen title + small bottom caption)
- `layout` (`elk`, `dagre`, etc.)
- `theme_id`, `dark_theme_id`
- `sketch`
- `pad`, `scale`
- `target`
- `animate_interval` or `animate-interval`
- `animate` (boolean shorthand)

Animation notes:
- `animate_interval` enables composition animation.
- If animation is enabled and `target` is omitted, Vyasa auto-targets all boards (`*`).

## Interactions

- Zoom with mouse wheel or `+` / `−` buttons.
- Pan by dragging.
- Reset zoom with `Reset`.
- Fullscreen with `⛶`.
- Theme switch re-renders D2 diagrams.

## Flowchart with decisions

:::tabs
::tab{title="Rendered"}
```d2
---
title: Signup Flow
width: 85vw
height: 460px
---
direction: right
start: Start
form: Fill form
validate: Validate
exists: Account exists?
create: Create account
verify: Verify email
login: Login

start -> form
form -> validate
validate -> exists
exists -> create: no
exists -> login: yes
create -> verify
verify -> login
```
::tab{title="Markdown Source" copy-from="Rendered"}
:::

## Service architecture

:::tabs
::tab{title="Rendered"}
```d2
---
title: Service Architecture
width: 90vw
height: 520px
layout: elk
---
direction: right
clients: {
  web: Web App
  mobile: Mobile App
}

edge: {
  gateway: API Gateway
  auth: Auth Service
}

core: {
  orders: Orders Service
  payments: Payments Service
  catalog: Catalog Service
}

data: {
  postgres: Postgres
  redis: Redis
  queue: Event Queue
}

clients.web -> edge.gateway
clients.mobile -> edge.gateway
edge.gateway -> edge.auth
edge.gateway -> core.orders
edge.gateway -> core.payments
edge.gateway -> core.catalog

core.orders -> data.postgres
core.payments -> data.postgres
core.catalog -> data.redis
core.orders -> data.queue
```
::tab{title="Markdown Source" copy-from="Rendered"}
:::

## SQL tables and foreign keys

:::tabs
::tab{title="Rendered"}
```d2
---
title: Commerce Schema
width: 90vw
height: 560px
layout: elk
---
direction: right
users: {
  shape: sql_table
  id: int {constraint: primary_key}
  email: string {constraint: unique}
  created_at: timestamp
}

orders: {
  shape: sql_table
  id: int {constraint: primary_key}
  user_id: int {constraint: foreign_key}
  total: decimal
  status: string
}

order_items: {
  shape: sql_table
  id: int {constraint: primary_key}
  order_id: int {constraint: foreign_key}
  sku: string
  qty: int
  price: decimal
}

orders.user_id -> users.id
order_items.order_id -> orders.id
```
::tab{title="Markdown Source" copy-from="Rendered"}
:::

## Sequence-style diagram

:::tabs
::tab{title="Rendered"}
```d2
---
title: Auth Handshake
width: 90vw
height: 420px
---
direction: right
flow: {
  shape: sequence_diagram
  client: {shape: person}
  api: {shape: rectangle}
  auth: {shape: rectangle}

  client -> api: POST /login
  api -> auth: verify credentials
  auth -> api: jwt
  api -> client: 200 + token
}
```
::tab{title="Markdown Source" copy-from="Rendered"}
:::

## CI/CD pipeline

:::tabs
::tab{title="Rendered"}
```d2
---
title: CI/CD Pipeline
width: 90vw
height: 520px
layout: elk
---
direction: right
dev: {
  local: Local Code
  git: Git Repo
}

ci: {
  build: Build Job
  test: Test Job
  scan: Security Scan
}

release: {
  registry: Image Registry
  deploy: Deploy Job
}

runtime: {
  k8s: Kubernetes
  monitor: Monitoring
}

dev.local -> dev.git: push

dev.git -> ci.build: trigger
ci.build -> ci.test
ci.test -> ci.scan
ci.scan -> release.registry: publish image
release.registry -> release.deploy
release.deploy -> runtime.k8s
runtime.k8s -> runtime.monitor: metrics/events
```
::tab{title="Markdown Source" copy-from="Rendered"}
:::

## Cloud network topology

:::tabs
::tab{title="Rendered"}
```d2
---
title: VPC Topology
width: 90vw
height: 540px
layout: elk
---
direction: right
internet: Internet

vpc: {
  public: {
    alb: ALB
    bastion: Bastion
  }
  private: {
    app1: App Node 1
    app2: App Node 2
    worker: Worker
  }
  data: {
    db: Postgres
    cache: Redis
  }
}

internet -> vpc.public.alb: HTTPS
vpc.public.bastion -> vpc.private.app1: SSH
vpc.public.bastion -> vpc.private.app2: SSH
vpc.public.alb -> vpc.private.app1: HTTP
vpc.public.alb -> vpc.private.app2: HTTP
vpc.private.app1 -> vpc.data.db: SQL
vpc.private.app2 -> vpc.data.db: SQL
vpc.private.worker -> vpc.data.cache: read/write
```
::tab{title="Markdown Source" copy-from="Rendered"}
:::

## Event-driven architecture

:::tabs
::tab{title="Rendered"}
```d2
---
title: Event Pipeline
width: 88vw
height: 460px
layout: elk
---
direction: right
producers: {
  checkout: Checkout Service
  billing: Billing Service
  support: Support Service
}

broker: {
  kafka: Event Bus
}

consumers: {
  fraud: Fraud Detector
  analytics: Analytics
  notifier: Notification Service
}

stores: {
  lake: Data Lake
  redis: Materialized View Cache
}

producers.checkout -> broker.kafka: order.created
producers.billing -> broker.kafka: payment.captured
producers.support -> broker.kafka: ticket.opened

broker.kafka -> consumers.fraud
broker.kafka -> consumers.analytics
broker.kafka -> consumers.notifier

consumers.analytics -> stores.lake
consumers.fraud -> stores.redis
```
::tab{title="Markdown Source" copy-from="Rendered"}
:::

## Team ownership map

:::tabs
::tab{title="Rendered"}
```d2
---
title: Team Ownership
width: 88vw
height: 420px
---
direction: right
platform: {
  gateway: API Gateway
  auth: Auth
  observability: Logging/Tracing
}

product: {
  checkout: Checkout
  catalog: Catalog
  search: Search
}

data: {
  warehouse: Warehouse
  db: OLTP DB
}

platform.gateway -> product.checkout
platform.gateway -> product.catalog
platform.gateway -> product.search
product.checkout -> data.db
product.catalog -> data.db
product.search -> data.warehouse
```
::tab{title="Markdown Source" copy-from="Rendered"}
:::

## Kubernetes stack

:::tabs
::tab{title="Rendered"}
```d2
---
title: Kubernetes Runtime
width: 90vw
height: 540px
layout: elk
---
direction: right
cluster: {
  ingress: Ingress
  ns_app: {
    api: API Deployment
    web: Web Deployment
    worker: Worker Deployment
  }
  ns_data: {
    postgres: StatefulSet Postgres
    redis: Redis
  }
  ns_ops: {
    prometheus: Prometheus
    grafana: Grafana
    loki: Loki
  }
}

ingress_client: Internet Clients
ingress_client -> cluster.ingress
cluster.ingress -> cluster.ns_app.api
cluster.ingress -> cluster.ns_app.web
cluster.ns_app.api -> cluster.ns_data.postgres
cluster.ns_app.api -> cluster.ns_data.redis
cluster.ns_app.worker -> cluster.ns_data.postgres
cluster.ns_app.api -> cluster.ns_ops.prometheus: metrics
cluster.ns_ops.prometheus -> cluster.ns_ops.grafana
```
::tab{title="Markdown Source" copy-from="Rendered"}
:::

## D2 composition animation (scenarios)

:::tabs
::tab{title="Rendered"}
```d2
---
title: Incident Response (Animated)
width: 90vw
height: 70vh
layout: elk
animate_interval: 1300
---
direction: right

oncall: On-call Engineer
alerts: Alert Stream
service: Production Service
runbook: Runbook
status: Status Page

alerts -> oncall: page
oncall -> service: investigate
oncall -> runbook: open runbook
oncall -> status: update status

scenarios: {
  triage: {
    title.label: Triage
    (alerts -> oncall)[0].style.stroke: "#dc2626"
    (oncall -> service)[0].style.stroke: "#f59e0b"
  }
  mitigation: {
    title.label: Mitigation
    (oncall -> runbook)[0].style.stroke: "#2563eb"
    (oncall -> service)[0].style.stroke: "#16a34a"
  }
  recovery: {
    title.label: Recovery
    (oncall -> status)[0].style.stroke: "#16a34a"
    (alerts -> oncall)[0].style.opacity: 0.25
  }
}
```
::tab{title="Markdown Source" copy-from="Rendered"}
:::

## Animated water cycle

:::tabs
::tab{title="Rendered"}
```d2
---
title: Water Cycle (Animated)
width: 90vw
height: 70vh
layout: elk
animate_interval: 1400
---
direction: right

sun: {
  shape: circle
  style.fill: "#fde68a"
  style.stroke: "#f59e0b"
}
clouds: {shape: cloud}
ocean: {style.fill: "#bfdbfe"}
land: {style.fill: "#bbf7d0"}
groundwater: {shape: cylinder}

sun -> ocean: evaporation
ocean -> clouds: vapor
clouds -> land: precipitation
land -> groundwater: infiltration
groundwater -> ocean: runoff
land -> clouds: transpiration

scenarios: {
  storm: {
    title.label: Storm season
    (clouds -> land)[0].style.stroke-width: 5
    (ocean -> clouds)[0].style.stroke-width: 5
  }
  drought: {
    title.label: Drought season
    (clouds -> land)[0].style.opacity: 0.2
    (sun -> ocean)[0].style.stroke: "#dc2626"
  }
}
```
::tab{title="Markdown Source" copy-from="Rendered"}
:::

## Tips

- Use `layout: elk` for denser, more complex graphs.
- Use `width: 85vw` or `90vw` for large architecture diagrams.
- For animated compositions, prefer short labels and clear scenario deltas.
- If a diagram is too dense, split it into multiple diagrams and link them with headings.
