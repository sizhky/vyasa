Vyasa renders D2 code blocks with zoom, pan, reset, and fullscreen controls.

## Basic usage

:::tabs
::tab{title="Rendered"}
```d2
---
title: Basic Request Flow
width: 70vw
height: 40vh
---
direction: right
user: {
  label: User
  icon: "https://api.iconify.design/material-symbols:person.svg"
}
api: {
  label: API
  icon: "https://api.iconify.design/mdi:api.svg"
}
db: {
  label: Database
  icon: "https://api.iconify.design/mdi:database.svg"
}

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
- `layout` (`elk` or `dagre`, default: `elk`)
- `theme_id`, `dark_theme_id`
- `sketch`
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
height: 70vh
layout: elk
---
direction: right
start: {
  label: Start
  icon: "https://api.iconify.design/mdi:play-circle.svg"
}
form: {
  label: Fill form
  icon: "https://api.iconify.design/mdi:form-select.svg"
}
validate: {
  label: Validate
  icon: "https://api.iconify.design/mdi:check-decagram.svg"
}
exists: {
  label: Account exists?
  icon: "https://api.iconify.design/mdi:account-question.svg"
}
create: {
  label: Create account
  icon: "https://api.iconify.design/mdi:account-plus.svg"
}
verify: {
  label: Verify email
  icon: "https://api.iconify.design/mdi:email-check.svg"
}
login: {
  label: Login
  icon: "https://api.iconify.design/mdi:login.svg"
}

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
  web: {
    label: Web App
    icon: "https://api.iconify.design/mdi:web.svg"
  }
  mobile: {
    label: Mobile App
    icon: "https://api.iconify.design/mdi:cellphone.svg"
  }
}

edge: {
  gateway: {
    label: API Gateway
    icon: "https://api.iconify.design/mdi:router-network.svg"
  }
  auth: {
    label: Auth Service
    icon: "https://api.iconify.design/mdi:shield-lock.svg"
  }
}

core: {
  orders: {
    label: Orders Service
    icon: "https://api.iconify.design/mdi:cart-outline.svg"
  }
  payments: {
    label: Payments Service
    icon: "https://api.iconify.design/mdi:credit-card-outline.svg"
  }
  catalog: {
    label: Catalog Service
    icon: "https://api.iconify.design/mdi:view-grid-outline.svg"
  }
}

data: {
  postgres: {
    label: Postgres
    icon: "https://api.iconify.design/logos:postgresql.svg"
  }
  redis: {
    label: Redis
    icon: "https://api.iconify.design/logos:redis.svg"
  }
  queue: {
    label: Event Queue
    icon: "https://api.iconify.design/mdi:queue.svg"
  }
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
  icon: "https://api.iconify.design/mdi:account-group.svg"
  id: int {constraint: primary_key}
  email: string {constraint: unique}
  created_at: timestamp
}

orders: {
  shape: sql_table
  icon: "https://api.iconify.design/mdi:receipt-text-outline.svg"
  id: int {constraint: primary_key}
  user_id: int {constraint: foreign_key}
  total: decimal
  status: string
}

order_items: {
  shape: sql_table
  icon: "https://api.iconify.design/mdi:package-variant-closed.svg"
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
  client: {
    shape: person
    icon: "https://api.iconify.design/material-symbols:person.svg"
  }
  api: {
    shape: rectangle
    icon: "https://api.iconify.design/mdi:api.svg"
  }
  auth: {
    shape: rectangle
    icon: "https://api.iconify.design/mdi:shield-lock.svg"
  }

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
width: 60vw
height: 55vh
layout: elk
---
direction: right
dev: {
  local: {
    label: Local Code
    icon: "https://api.iconify.design/mdi:laptop.svg"
  }
  git: {
    label: Git Repo
    icon: "https://api.iconify.design/logos:github-icon.svg"
  }
}

ci: {
  build: {
    label: Build Job
    icon: "https://api.iconify.design/mdi:hammer-wrench.svg"
  }
  test: {
    label: Test Job
    icon: "https://api.iconify.design/mdi:test-tube.svg"
  }
  scan: {
    label: Security Scan
    icon: "https://api.iconify.design/mdi:shield-search.svg"
  }
}

release: {
  registry: {
    label: Image Registry
    icon: "https://api.iconify.design/mdi:docker.svg"
  }
  deploy: {
    label: Deploy Job
    icon: "https://api.iconify.design/mdi:rocket-launch-outline.svg"
  }
}

runtime: {
  k8s: {
    label: Kubernetes
    icon: "https://api.iconify.design/logos:kubernetes.svg"
  }
  monitor: {
    label: Monitoring
    icon: "https://api.iconify.design/mdi:monitor-dashboard.svg"
  }
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
internet: {
  label: Internet
  icon: "https://api.iconify.design/mdi:cloud-outline.svg"
}

vpc: {
  public: {
    alb: {
      label: ALB
      icon: "https://api.iconify.design/simple-icons:amazonaws.svg"
    }
    bastion: {
      label: Bastion
      icon: "https://api.iconify.design/mdi:shield-home.svg"
    }
  }
  private: {
    app1: {
      label: App Node 1
      icon: "https://api.iconify.design/mdi:application-braces-outline.svg"
    }
    app2: {
      label: App Node 2
      icon: "https://api.iconify.design/mdi:application-braces-outline.svg"
    }
    worker: {
      label: Worker
      icon: "https://api.iconify.design/mdi:cog-outline.svg"
    }
  }
  data: {
    db: {
      label: Postgres
      icon: "https://api.iconify.design/logos:postgresql.svg"
    }
    cache: {
      label: Redis
      icon: "https://api.iconify.design/logos:redis.svg"
    }
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
  checkout: {
    label: Checkout Service
    icon: "https://api.iconify.design/mdi:cart-outline.svg"
  }
  billing: {
    label: Billing Service
    icon: "https://api.iconify.design/mdi:credit-card-outline.svg"
  }
  support: {
    label: Support Service
    icon: "https://api.iconify.design/mdi:headset.svg"
  }
}

broker: {
  kafka: {
    label: Event Bus
    icon: "https://api.iconify.design/logos:kafka-icon.svg"
  }
}

consumers: {
  fraud: {
    label: Fraud Detector
    icon: "https://api.iconify.design/mdi:shield-alert-outline.svg"
  }
  analytics: {
    label: Analytics
    icon: "https://api.iconify.design/mdi:chart-line.svg"
  }
  notifier: {
    label: Notification Service
    icon: "https://api.iconify.design/mdi:bell-outline.svg"
  }
}

stores: {
  lake: {
    label: Data Lake
    icon: "https://api.iconify.design/mdi:database-outline.svg"
  }
  redis: {
    label: Materialized View Cache
    icon: "https://api.iconify.design/logos:redis.svg"
  }
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
  gateway: {
    label: API Gateway
    icon: "https://api.iconify.design/mdi:router-network.svg"
  }
  auth: {
    label: Auth
    icon: "https://api.iconify.design/mdi:shield-lock.svg"
  }
  observability: {
    label: Logging/Tracing
    icon: "https://api.iconify.design/mdi:timeline-text-outline.svg"
  }
}

product: {
  checkout: {
    label: Checkout
    icon: "https://api.iconify.design/mdi:cart-outline.svg"
  }
  catalog: {
    label: Catalog
    icon: "https://api.iconify.design/mdi:view-grid-outline.svg"
  }
  search: {
    label: Search
    icon: "https://api.iconify.design/mdi:magnify.svg"
  }
}

data: {
  warehouse: {
    label: Warehouse
    icon: "https://api.iconify.design/mdi:warehouse.svg"
  }
  db: {
    label: OLTP DB
    icon: "https://api.iconify.design/mdi:database.svg"
  }
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
  ingress: {
    label: Ingress
    icon: "https://api.iconify.design/logos:kubernetes.svg"
  }
  ns_app: {
    api: {
      label: API Deployment
      icon: "https://api.iconify.design/mdi:api.svg"
    }
    web: {
      label: Web Deployment
      icon: "https://api.iconify.design/mdi:web.svg"
    }
    worker: {
      label: Worker Deployment
      icon: "https://api.iconify.design/mdi:cog-outline.svg"
    }
  }
  ns_data: {
    postgres: {
      label: StatefulSet Postgres
      icon: "https://api.iconify.design/logos:postgresql.svg"
    }
    redis: {
      label: Redis
      icon: "https://api.iconify.design/logos:redis.svg"
    }
  }
  ns_ops: {
    prometheus: {
      label: Prometheus
      icon: "https://api.iconify.design/logos:prometheus.svg"
    }
    grafana: {
      label: Grafana
      icon: "https://api.iconify.design/logos:grafana.svg"
    }
    loki: {
      label: Loki
      icon: "https://api.iconify.design/mdi:file-document-outline.svg"
    }
  }
}

ingress_client: {
  label: Internet Clients
  icon: "https://api.iconify.design/mdi:account-group-outline.svg"
}
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

oncall: {
  label: On-call Engineer
  icon: "https://api.iconify.design/material-symbols:person.svg"
}
alerts: {
  label: Alert Stream
  icon: "https://api.iconify.design/mdi:bell-alert-outline.svg"
}
service: {
  label: Production Service
  icon: "https://api.iconify.design/mdi:server-network.svg"
}
runbook: {
  label: Runbook
  icon: "https://api.iconify.design/mdi:book-open-page-variant-outline.svg"
}
status: {
  label: Status Page
  icon: "https://api.iconify.design/mdi:web-check.svg"
}

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
  icon: "https://api.iconify.design/mdi:white-balance-sunny.svg"
  style.fill: "#fde68a"
  style.stroke: "#f59e0b"
}
clouds: {
  shape: cloud
  icon: "https://api.iconify.design/mdi:weather-cloudy.svg"
}
ocean: {
  icon: "https://api.iconify.design/mdi:waves.svg"
  style.fill: "#bfdbfe"
}
land: {
  icon: "https://api.iconify.design/mdi:terrain.svg"
  style.fill: "#bbf7d0"
}
groundwater: {
  shape: cylinder
  icon: "https://api.iconify.design/mdi:water-outline.svg"
}

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
- For icons, use D2's `icon: "<svg-url>"` support with SVG URLs.
- Good sources:
  - D2 icon tour: `https://github.com/terrastruct/d2-docs/blob/master/docs/tour/icons.md`
  - Terrastruct icon catalog (official D2 examples): `https://icons.terrastruct.com/`
  - Iconify API (large icon library used in examples above): `https://api.iconify.design/`
