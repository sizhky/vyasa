---
title: Graph Projection Future
---

> [!note]
> Hypothetical future syntax. Goal: same knowledge nodes, different reading maps.

Imagine one Japan trip guide. The author writes one graph of places once; Vyasa renders it three ways: by city, by theme, and by trip flow.

```items
---
title: "Japan Trip Map"
default_open_depth: 1
width: 88vw
min_height: 70vh
color_palette_source: graph-projection-palettes.json
default_color_by: trip_stage
view_projections:
  - id: author
    label: "City View"
    groups_from: city
  - id: topic
    label: "Theme View"
    groups_from: theme
  - id: learn
    label: "Trip Flow"
    groups_from: trip_stage
    edge_focus: relation
default_projection: learn
reveal_on:
  search_hit: nearest-group
  backlink_jump: owning-group
  itinerary_jump: owning-group
aggregate_edges:
  when_collapsed: true
  by: relation
---
Places:
  - narita :: Narita Airport | city: Tokyo | theme: Arrival | trip_stage: Arrive
  - shinjuku :: Shinjuku Base Hotel | city: Tokyo | theme: Stay | trip_stage: Arrive
  - tsukiji :: Tsukiji Outer Market | city: Tokyo | theme: Food | trip_stage: Arrive
  - teamlab :: teamLab Planets | city: Tokyo | theme: Art | trip_stage: First Days
  - asakusa :: Asakusa Sensoji | city: Tokyo | theme: Temples | trip_stage: First Days
  - akihabara :: Akihabara | city: Tokyo | theme: Pop Culture | trip_stage: First Days
  - hakone :: Hakone Ropeway | city: Hakone | theme: Nature | trip_stage: Day Trips
  - fuji :: Fuji Viewpoint | city: Fujikawaguchiko | theme: Nature | trip_stage: Day Trips
  - kyoto-station :: Kyoto Station | city: Kyoto | theme: Transit | trip_stage: Middle
  - fushimi :: Fushimi Inari Shrine | city: Kyoto | theme: Temples | trip_stage: Middle
  - gion :: Gion Evening Walk | city: Kyoto | theme: Old Town | trip_stage: Middle
  - arashiyama :: Arashiyama Bamboo Grove | city: Kyoto | theme: Nature | trip_stage: Middle
  - nishiki :: Nishiki Market | city: Kyoto | theme: Food | trip_stage: Middle
  - nara-park :: Nara Park | city: Nara | theme: Nature | trip_stage: Day Trips
  - todaiji :: Todaiji Temple | city: Nara | theme: Temples | trip_stage: Day Trips
  - osaka-castle :: Osaka Castle | city: Osaka | theme: History | trip_stage: Last Stretch
  - dotonbori :: Dotonbori | city: Osaka | theme: Nightlife | trip_stage: Last Stretch
  - kuromon :: Kuromon Market | city: Osaka | theme: Food | trip_stage: Last Stretch
  - kinosaki :: Kinosaki Onsen | city: Hyogo | theme: Rest | trip_stage: Slow Down
  - kansai-airport :: Kansai Airport | city: Osaka | theme: Departure | trip_stage: Leave

narita ->|train to| shinjuku | relation: route
shinjuku ->|morning food| tsukiji | relation: day-plan
shinjuku ->|first night| akihabara | relation: day-plan
tsukiji ->|nearby art stop| teamlab | relation: short-hop
asakusa ->|same old Tokyo day| tsukiji | relation: day-plan
asakusa ->|contrast with| akihabara | relation: mood-shift
teamlab ->|evening return| shinjuku | relation: route
akihabara ->|late snack trail| tsukiji | relation: food-trail
shinjuku ->|day trip train| hakone | relation: day-trip
hakone ->|mountain view pairing| fuji | relation: nature-trail
fuji ->|return to base| shinjuku | relation: route
shinjuku ->|bullet train| kyoto-station | relation: route
kyoto-station ->|first Kyoto stop| fushimi | relation: route
kyoto-station ->|evening base| gion | relation: route
fushimi ->|old Kyoto day| gion | relation: day-plan
fushimi ->|temple comparison| todaiji | relation: temple-trail
gion ->|market walk| nishiki | relation: short-hop
nishiki ->|food contrast| kuromon | relation: food-trail
gion ->|quiet morning| arashiyama | relation: day-plan
arashiyama ->|nature pairing| nara-park | relation: nature-trail
kyoto-station ->|easy day trip| nara-park | relation: day-trip
nara-park ->|walk to| todaiji | relation: short-hop
todaiji ->|return via Kyoto| kyoto-station | relation: route
kyoto-station ->|train to Osaka| osaka-castle | relation: route
osaka-castle ->|night finish| dotonbori | relation: day-plan
dotonbori ->|market breakfast| kuromon | relation: food-trail
kuromon ->|night food loop| dotonbori | relation: food-trail
dotonbori ->|slow down after crowds| kinosaki | relation: pace-shift
kinosaki ->|return south| osaka-castle | relation: route
osaka-castle ->|airport line| kansai-airport | relation: route
dotonbori ->|last night before flight| kansai-airport | relation: departure
kuromon ->|last meal before flight| kansai-airport | relation: departure
tsukiji ->|compare markets| nishiki | relation: food-trail
nishiki ->|compare markets| kuromon | relation: food-trail
asakusa ->|temple trail| fushimi | relation: temple-trail
fushimi ->|temple trail| todaiji | relation: temple-trail
hakone ->|rest option| kinosaki | relation: rest-trail
fuji ->|rest option| kinosaki | relation: rest-trail
arashiyama ->|quiet contrast| kinosaki | relation: rest-trail
akihabara ->|nightlife contrast| dotonbori | relation: nightlife-trail
gion ->|evening contrast| dotonbori | relation: nightlife-trail
teamlab ->|art-to-old-town contrast| gion | relation: mood-shift
nara-park ->|history pair| osaka-castle | relation: history-trail
todaiji ->|history pair| osaka-castle | relation: history-trail
shinjuku ->|urban contrast| dotonbori | relation: city-contrast
asakusa ->|old town contrast| gion | relation: old-town-trail
tsukiji ->|first food memory| kuromon | relation: food-trail
narita ->|arrival to departure arc| kansai-airport | relation: trip-arc
kyoto-station ->|hub to slow-down| kinosaki | relation: route
fushimi ->|nature temple day| arashiyama | relation: day-plan
```

What the reader sees:

- `City View`: boxes like Tokyo, Kyoto, Nara, Osaka, Hakone.
- `Theme View`: same places regroup into Food, Temples, Nature, Rest, Nightlife, Transit.
- `Trip Flow`: same places regroup into Arrive, First Days, Middle, Day Trips, Last Stretch, Slow Down, Leave.

Why this helps Vyasa: one note garden can answer "where is this?", "what kind of thing is this?", and "when should I do this?" without cloning the graph.
