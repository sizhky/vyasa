---
title: SF First Visit Transit Itinerary
---

> [!note]
> Two-day first San Francisco visit from downtown San Jose, assuming no car and public transit only.

Start Saturday around 9 AM from downtown San Jose. Stay near Union Square or Powell St because it keeps BART, Muni, cable cars, and return transit simple.

## Stay Recommendation

Pick `Union Square / Powell St` as home base. It is less charming than the waterfront, but it is the best transit hub for this plan. Fisherman's Wharf is convenient for Alcatraz and Pier 39, but worse for arriving from San Jose and moving around the city without a car.

## Trip Map

```items
---
title: "San Francisco First Visit"
default_open_depth: 1
width: 92vw
min_height: 72vh
color_palette_source: sf-itinerary-palettes.json
default_color_by: day
view_projections:
  - id: day
    label: "Day View"
    groups_from: day
  - id: area
    label: "Area View"
    groups_from: area
  - id: mood
    label: "Experience View"
    groups_from: mood
  - id: transit
    label: "Transit View"
    groups_from: transit_mode
default_projection: day
edge_color_palette: relation
  transit: "#2563eb"
  walk: "#16a34a"
  cable-car: "#b45309"
  ferry: "#0d9488"
  meal: "#ea580c"
  optional: "#64748b"
  return: "#475569"
---
Route:
  - sj-downtown :: Downtown San Jose | day: Saturday | area: San Jose | mood: Start | transit_mode: Bus+BART
  - berryessa :: Berryessa BART | day: Saturday | area: South Bay | mood: Transfer | transit_mode: Bus+BART
  - powell :: Powell St / Union Square | day: Saturday | area: Union Square | mood: Home Base | transit_mode: BART
  - hotel :: Drop Bags Near Union Square | day: Saturday | area: Union Square | mood: Logistics | transit_mode: Walk
  - cable-car :: Powell-Hyde Cable Car | day: Saturday | area: Union Square to Waterfront | mood: Classic SF | transit_mode: Cable Car
  - wharf :: Fisherman's Wharf | day: Saturday | area: Waterfront | mood: Tourist Classic | transit_mode: Walk
  - pier39 :: Pier 39 Sea Lions | day: Saturday | area: Waterfront | mood: Tourist Classic | transit_mode: Walk
  - lunch :: Clam Chowder Lunch | day: Saturday | area: Waterfront | mood: Food | transit_mode: Walk
  - pier33 :: Pier 33 Ferry Terminal | day: Saturday | area: Waterfront | mood: Transit | transit_mode: Walk
  - alcatraz :: Alcatraz Island Tour | day: Saturday | area: Bay | mood: History | transit_mode: Ferry
  - north-beach :: North Beach Dinner | day: Saturday | area: North Beach | mood: Food | transit_mode: Walk
  - coit :: Coit Tower Optional View | day: Saturday | area: North Beach | mood: Viewpoint | transit_mode: Walk
  - mission :: Mission Carnaval Parade | day: Sunday | area: Mission | mood: Culture | transit_mode: BART/Muni
  - painted-ladies :: Painted Ladies / Alamo Square | day: Sunday | area: Alamo Square | mood: Iconic Photo | transit_mode: Bus
  - ggp :: Golden Gate Park | day: Sunday | area: Golden Gate Park | mood: Park | transit_mode: Bus/Muni
  - tea-garden :: Japanese Tea Garden | day: Sunday | area: Golden Gate Park | mood: Garden | transit_mode: Walk
  - bridge-welcome :: Golden Gate Bridge Welcome Center | day: Sunday | area: Golden Gate Bridge | mood: Iconic View | transit_mode: Bus
  - bridge-walk :: Golden Gate Bridge Walk | day: Sunday | area: Golden Gate Bridge | mood: Iconic View | transit_mode: Walk
  - powell-return :: Powell St Return | day: Sunday | area: Union Square | mood: Return Setup | transit_mode: Bus+BART
  - sj-home :: Downtown San Jose Return | day: Sunday | area: San Jose | mood: Finish | transit_mode: BART+Bus

sj-downtown ->|Rapid 500| berryessa | relation: transit
berryessa ->|BART to Powell| powell | relation: transit
powell ->|walk| hotel | relation: walk
hotel ->|walk to turntable| cable-car | relation: walk
cable-car ->|ride to waterfront| wharf | relation: cable-car
wharf ->|walk| pier39 | relation: walk
pier39 ->|walk| lunch | relation: meal
lunch ->|walk| pier33 | relation: walk
pier33 ->|ferry| alcatraz | relation: ferry
alcatraz ->|ferry back| pier33 | relation: ferry
pier33 ->|walk or streetcar| north-beach | relation: transit
north-beach ->|optional climb| coit | relation: optional
coit ->|return to hotel| powell | relation: transit
powell ->|Sunday morning transit| mission | relation: transit
mission ->|bus or rideshare if tired| painted-ladies | relation: transit
painted-ladies ->|bus west| ggp | relation: transit
ggp ->|walk inside park| tea-garden | relation: walk
tea-garden ->|bus north| bridge-welcome | relation: transit
bridge-welcome ->|walk span| bridge-walk | relation: walk
bridge-walk ->|bus back downtown| powell-return | relation: transit
powell-return ->|BART to Berryessa| berryessa | relation: return
berryessa ->|Rapid 500| sj-home | relation: return
wharf ->|backup if Alcatraz sells out| coit | relation: optional
north-beach ->|late walk option| wharf | relation: optional
mission ->|food backup| north-beach | relation: meal
ggp ->|skip if running late| bridge-welcome | relation: optional
```

## Plain-English Flow

Saturday is the classic waterfront day: reach Powell, ride cable car, see Fisherman's Wharf and Pier 39, eat chowder, do Alcatraz, then dinner in North Beach. Sunday is culture plus icons: Carnaval in the Mission, Painted Ladies, Golden Gate Park, Japanese Tea Garden, then Golden Gate Bridge before returning to San Jose.

Book Alcatraz first. If Alcatraz is sold out, use that time for Coit Tower, more North Beach, or a bay walk.
