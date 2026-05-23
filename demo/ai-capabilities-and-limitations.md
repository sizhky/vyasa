---
title: AI Capabilities and Limitations
---

> [!note]
> This story treats an LLM like a machine with four load-bearing properties, not a magic coworker. Read the arc first, then flip projections to see the same machine by failure mode, mitigation, and human response.

Generative AI starts as a next-token machine, gets shaped into an assistant by fine-tuning, and then meets the world through four stable constraints: what pattern is likely, what was in training, what still fits in context, and how far instructions can actually steer behavior. Most practical AI literacy is just learning where those constraints become visible, and changing your habits before the machine's fluent surface fools you.

```items
---
title: "AI Capabilities and Limitations"
default_open_depth: -1
width: 96vw
min_height: 80vh
node-card-width: 34rem
default_color_by: chapter
hover_attrs: [chapter, role, property, failure_family, mitigation_family, habit]
color_by:
  chapter:
    Premise: "#475569"
    Training: "#7c3aed"
    Fingerprints: "#db2777"
    Properties: "#2563eb"
    Failures: "#dc2626"
    Mitigations: "#0f766e"
    Practice: "#ca8a04"
  role:
    Definition: "#475569"
    Mechanism: "#2563eb"
    Constraint: "#dc2626"
    Mitigation: "#0f766e"
    Habit: "#ca8a04"
    Outcome: "#7c3aed"
  property:
    "Next Token Prediction": "#2563eb"
    Knowledge: "#16a34a"
    "Working Memory": "#ea580c"
    Steerability: "#7c3aed"
    Training: "#db2777"
    None: "#94a3b8"
  failure_family:
    Fabrication: "#dc2626"
    Staleness: "#b91c1c"
    Attention: "#f97316"
    Control: "#7c3aed"
    Character: "#db2777"
    Compound: "#111827"
    None: "#cbd5e1"
  mitigation_family:
    Grounding: "#0f766e"
    Retrieval: "#16a34a"
    Context: "#0891b2"
    Control: "#7c3aed"
    Verification: "#ca8a04"
    None: "#cbd5e1"
view_projections:
  - id: arc
    label: "Narrative Arc"
    groups_from: chapter
    caption: "The course as a machine story: definition, shaping, constraints, collisions, response."
    default_color_by: chapter
  - id: properties
    label: "Property Map"
    groups_from: [property, chapter]
    caption: "Same nodes regrouped by the property they mostly belong to. Read this when diagnosing a real task."
    default_color_by: property
  - id: failures
    label: "Failure Map"
    groups_from: [failure_family, chapter]
    caption: "Where the clean machine story breaks into practical disappointments."
    default_color_by: failure_family
  - id: mitigations
    label: "Mitigation Map"
    groups_from: [mitigation_family, chapter]
    caption: "The tools and habits that push each edge outward without pretending the edge vanished."
    default_color_by: mitigation_family
  - id: practice
    label: "Human Moves"
    groups_from: [habit, chapter]
    caption: "Machine properties only matter because they sharpen human habits: verify, supply context, state goals, and insert checkpoints."
    default_color_by: role
default_projection: arc
edge_color_by: relation
edge_color_palette:
  relation:
    defines: "#475569"
    becomes: "#7c3aed"
    leaves: "#db2777"
    powers: "#2563eb"
    fails_as: "#dc2626"
    mitigated_by: "#0f766e"
    requires: "#ca8a04"
    collides_with: "#111827"
    sharpens: "#0369a1"
edge_label_from: relation
aggregate_edges:
  when_collapsed: true
  by: relation
---
Premise:
  - generative-ai :: Generative AI | chapter: Premise | role: Definition | property: None | failure_family: None | mitigation_family: None | habit: "Locate the task" | description: Produces new content rather than merely sorting existing data. This course draws the line around transformer-style text generation.
  - classifier-ai :: Classification and prediction AI | chapter: Premise | role: Definition | property: None | failure_family: None | mitigation_family: None | habit: "Locate the task" | description: Spam filters, recommenders, fraud detectors. Useful contrast object: plenty of AI is not generative.
  - four-d :: 4D human side | chapter: Premise | role: Outcome | property: None | failure_family: None | mitigation_family: None | habit: "Calibrated trust" | description: Human competencies respond to machine properties. The framework matters because the user is the other half of the system.

Training:
  - pretraining :: Pretraining | chapter: Training | role: Mechanism | property: Training | failure_family: None | mitigation_family: None | habit: "Understand the machine" | description: Reads vast text and learns one thing: what token plausibly comes next.
  - doc-completer :: Document completer | chapter: Training | role: Outcome | property: "Next Token Prediction" | failure_family: None | mitigation_family: None | habit: "Calibrated trust" | description: The raw system after pretraining. Fluent continuation machine, not yet an assistant.
  - fine-tuning :: Fine-tuning | chapter: Training | role: Mechanism | property: Training | failure_family: None | mitigation_family: None | habit: "Understand the machine" | description: Human preference shaping turns completion into assistant behavior: answer helpfully, decline harmful asks, stay within norms.
  - assistant :: Helpful assistant | chapter: Training | role: Outcome | property: Steerability | failure_family: None | mitigation_family: None | habit: "State the goal" | description: The interaction layer people meet. Useful, polite, often cooperative, never free of the mechanism beneath it.

Fingerprints:
  - sycophancy :: Sycophancy | chapter: Fingerprints | role: Constraint | property: Training | failure_family: Character | mitigation_family: Control | habit: "Invite pushback" | description: The model leans toward validating the user's frame unless asked, or forced, to disagree.
  - verbosity :: Verbosity default | chapter: Fingerprints | role: Constraint | property: Training | failure_family: Character | mitigation_family: Control | habit: "Constrain format" | description: Left alone, the assistant often gives more than the task strictly needs.
  - over-caution :: Over-caution | chapter: Fingerprints | role: Constraint | property: Training | failure_family: Character | mitigation_family: Control | habit: "Right-size the risk" | description: Safety shaping can produce refusals or hedging that are broader than the true hazard.
  - loose-calibration :: Loose confidence calibration | chapter: Fingerprints | role: Constraint | property: Training | failure_family: Character | mitigation_family: Verification | habit: "Verify specifics" | description: Tone and truth are only loosely coupled. Smooth prose can wrap a guess.

Properties:
  - ntp :: Next Token Prediction | chapter: Properties | role: Mechanism | property: "Next Token Prediction" | failure_family: None | mitigation_family: Verification | habit: "Verify specifics" | description: The core generator. Fluency comes from it, and hallucination comes from it too.
  - well-worn :: Well-worn path | chapter: Properties | role: Outcome | property: "Next Token Prediction" | failure_family: None | mitigation_family: None | habit: "Use for common patterns" | description: Summaries, reformats, common explanations, code shapes the model has seen many times.
  - specificity :: Specificity zone | chapter: Properties | role: Constraint | property: "Next Token Prediction" | failure_family: Fabrication | mitigation_family: Verification | habit: "Check names, dates, numbers, quotes" | description: The danger band where fabrication concentrates: precise facts that can sound right without being right.
  - knowledge :: Knowledge | chapter: Properties | role: Mechanism | property: Knowledge | failure_family: None | mitigation_family: Retrieval | habit: "Ask what it would have read" | description: What the model absorbed during training and nothing beyond that without tools.
  - cutoff :: Knowledge cutoff | chapter: Properties | role: Constraint | property: Knowledge | failure_family: Staleness | mitigation_family: Retrieval | habit: "Check recency" | description: Training stopped at some point. After that date, default knowledge is frozen.
  - source-amnesia :: Source amnesia | chapter: Properties | role: Constraint | property: Knowledge | failure_family: Staleness | mitigation_family: Grounding | habit: "Prefer traceable sources" | description: The model may know a thing without knowing where it came from in a citeable way.
  - working-memory :: Working memory | chapter: Properties | role: Mechanism | property: "Working Memory" | failure_family: None | mitigation_family: Context | habit: "Curate context" | description: Fixed context window. The model only attends to what still fits inside the current workspace.
  - lost-middle :: Lost in the middle | chapter: Properties | role: Constraint | property: "Working Memory" | failure_family: Attention | mitigation_family: Context | habit: "Front-load and repeat what matters" | description: Attention is not uniform. Middle material gets weaker than edges.
  - blank-slate :: No persistent memory by default | chapter: Properties | role: Constraint | property: "Working Memory" | failure_family: Attention | mitigation_family: Context | habit: "Re-supply critical context" | description: Corrections do not retrain the model. New session, new blank slate.
  - steerability :: Steerability | chapter: Properties | role: Mechanism | property: Steerability | failure_family: None | mitigation_family: Control | habit: "State goal with instruction" | description: The system follows instructions through pattern matching, not deep semantic understanding.
  - tight-control :: Tight control zone | chapter: Properties | role: Outcome | property: Steerability | failure_family: None | mitigation_family: None | habit: "Use short verifiable asks" | description: Format, tone, role, and bounded structure are where steerability feels strongest.
  - letter-spirit :: Letter over spirit | chapter: Properties | role: Constraint | property: Steerability | failure_family: Control | mitigation_family: Control | habit: "Restate the actual goal" | description: The instruction can be satisfied literally while missing the reason the instruction existed.
  - reasoning-drift :: Reasoning drift | chapter: Properties | role: Constraint | property: Steerability | failure_family: Control | mitigation_family: Control | habit: "Insert checkpoints" | description: Long chains accumulate small errors. The final answer can preserve the early mistake faithfully.

Failures:
  - hallucinated-citations :: Hallucinated citations | chapter: Failures | role: Constraint | property: "Next Token Prediction" | failure_family: Compound | mitigation_family: Grounding | habit: "Verify specifics" | description: Citation-shaped output appears because plausible pattern outruns actual knowledge.
  - stale-answers :: Stale answers | chapter: Failures | role: Constraint | property: Knowledge | failure_family: Compound | mitigation_family: Retrieval | habit: "Use search for live facts" | description: True-then becomes false-now, yet the answer still arrives with composure.
  - long-chat-drift :: Long-conversation drift | chapter: Failures | role: Constraint | property: "Working Memory" | failure_family: Compound | mitigation_family: Context | habit: "Restart or summarize" | description: Good constraints dissolve as context grows and the important bits slide into the dead zone.
  - confidently-wrong-math :: Confidently wrong math | chapter: Failures | role: Constraint | property: Steerability | failure_family: Compound | mitigation_family: Control | habit: "Offload exactness to tools" | description: Fluent reasoning does not guarantee precise arithmetic or logic.
  - agreeable-bad-premise :: Agreeable bad premise | chapter: Failures | role: Constraint | property: Training | failure_family: Compound | mitigation_family: Control | habit: "Ask for disagreement" | description: The assistant inherits the user's false framing and decorates it instead of resisting it.

Mitigations:
  - citations :: Citations and source grounding | chapter: Mitigations | role: Mitigation | property: "Next Token Prediction" | failure_family: None | mitigation_family: Grounding | habit: "Trace claims" | description: Makes the generator show what is backed by an external source and what is merely fluent synthesis.
  - search :: Web search and retrieval | chapter: Mitigations | role: Mitigation | property: Knowledge | failure_family: None | mitigation_family: Retrieval | habit: "Patch the cutoff" | description: Pulls in information the base model never had or had too unevenly.
  - projects :: Projects, memory, and standing context | chapter: Mitigations | role: Mitigation | property: "Working Memory" | failure_family: None | mitigation_family: Context | habit: "Keep reusable context nearby" | description: Moves recurring facts and constraints closer to the active window so the user stops repeating themselves.
  - checkpoints :: Mid-process checkpoints | chapter: Mitigations | role: Mitigation | property: Steerability | failure_family: None | mitigation_family: Control | habit: "Inspect step two" | description: Breaks a brittle chain into inspectable segments before one hidden error poisons the whole run.
  - code-exec :: Code execution and structured output | chapter: Mitigations | role: Mitigation | property: Steerability | failure_family: None | mitigation_family: Control | habit: "Move exact work into exact tools" | description: Gives math, parsing, and schema-constrained tasks a stricter substrate than free-form text.
  - uncertainty :: Uncertainty signaling | chapter: Mitigations | role: Mitigation | property: "Next Token Prediction" | failure_family: None | mitigation_family: Verification | habit: "Watch where the model hesitates" | description: Useful when honest, but never a substitute for checking the high-risk specifics yourself.

Practice:
  - calibrated-trust :: Calibrated trust | chapter: Practice | role: Habit | property: None | failure_family: None | mitigation_family: Verification | habit: "Calibrated trust" | description: Do not trust or distrust the machine wholesale. Place the task on each continuum and respond to that shape.
  - verify :: Verify specifics independently | chapter: Practice | role: Habit | property: "Next Token Prediction" | failure_family: Fabrication | mitigation_family: Verification | habit: "Verify specifics" | description: Names, dates, numbers, URLs, citations, quotes. Precision is where fluency most often impersonates truth.
  - supply-context :: Supply the missing knowledge and context | chapter: Practice | role: Habit | property: "Working Memory" | failure_family: Attention | mitigation_family: Context | habit: "Supply context" | description: If the model is thin, stale, or forgetful on your domain, bring the material yourself.
  - state-goal :: State the goal, not just the format | chapter: Practice | role: Habit | property: Steerability | failure_family: Control | mitigation_family: Control | habit: "State goals" | description: A machine can obey a surface instruction and still miss the win condition. Goal language closes that gap.
  - diagnose-pairs :: Diagnose property pairs | chapter: Practice | role: Habit | property: None | failure_family: Compound | mitigation_family: Verification | habit: "Name the collision" | description: Most bad outputs are not one property failing alone. The pair tells you which fix actually matters.
  - durable-model :: Durable mental model | chapter: Practice | role: Outcome | property: None | failure_family: None | mitigation_family: None | habit: "Think in properties" | description: Model quality moves; the structure remains. The point is not memorizing edge cases but seeing the machine through a stable lens.

generative-ai ->|defines| classifier-ai | note: contrast
generative-ai ->|requires| four-d
pretraining ->|becomes| doc-completer
fine-tuning ->|becomes| assistant
doc-completer ->|powers| ntp
fine-tuning ->|leaves| sycophancy, verbosity, over-caution, loose-calibration
assistant ->|leaves| sycophancy, verbosity, over-caution, loose-calibration
ntp ->|powers| well-worn
ntp ->|fails_as| specificity
knowledge ->|fails_as| cutoff, source-amnesia
working-memory ->|fails_as| lost-middle, blank-slate
steerability ->|powers| tight-control
steerability ->|fails_as| letter-spirit, reasoning-drift
specificity ->|fails_as| hallucinated-citations
cutoff ->|fails_as| stale-answers
lost-middle ->|fails_as| long-chat-drift
reasoning-drift ->|fails_as| confidently-wrong-math
sycophancy ->|fails_as| agreeable-bad-premise
ntp ->|mitigated_by| citations, uncertainty
knowledge ->|mitigated_by| search
working-memory ->|mitigated_by| projects, checkpoints
steerability ->|mitigated_by| checkpoints, code-exec
hallucinated-citations ->|requires| verify
stale-answers ->|requires| supply-context
long-chat-drift ->|requires| supply-context
confidently-wrong-math ->|requires| checkpoints, code-exec
agreeable-bad-premise ->|requires| diagnose-pairs
ntp ->|sharpens| verify
knowledge ->|sharpens| supply-context
working-memory ->|sharpens| supply-context
steerability ->|sharpens| state-goal
sycophancy ->|sharpens| diagnose-pairs
verbosity ->|sharpens| state-goal
over-caution ->|sharpens| calibrated-trust
loose-calibration ->|sharpens| verify
hallucinated-citations ->|collides_with| ntp, knowledge
long-chat-drift ->|collides_with| working-memory, steerability
confidently-wrong-math ->|collides_with| ntp, steerability
agreeable-bad-premise ->|collides_with| sycophancy, steerability
verify, supply-context, state-goal, diagnose-pairs ->|becomes| durable-model
durable-model ->|requires| calibrated-trust
durable-model ->|requires| four-d
```

The graph is dense on purpose. A sparse story lies about AI by hiding the joints. The machine is useful exactly because the same mechanism keeps reappearing under different names: prediction becomes fluency, prediction also becomes fabrication; training becomes politeness, training also becomes sycophancy; more context helps, until more context buries the instruction that mattered.

If you want to read it as practice instead of theory, start in `Human Moves`, then jump to `Failure Map`. That path turns the whole course into one habit loop: identify the property, name the collision, choose the matching mitigation, and only then decide how much trust the output earned.
