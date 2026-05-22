---
title: Japan Projection Lab
---

> [!note]
> Same trip skeleton. More masks than a Noh stage.

```items
---
title: "Japan Grand Loop"
default_open_depth: -1
width: 95vw
color_palette_source: graph-projection-palettes.json
default_color_by: day_num
edge_color_by: transit_mode
hover_attrs: [kind, city, day_band, cost_yen]
view_projections:
  - id: arc
    label: "Trip Arc"
    groups_from: trip_stage
    caption: "The narrative skeleton. Read this first — the trip in 16 stages."
    default_color_by: day_num
    hover_attrs: [day_band, sun_hour, essentialness, city]
  - id: geography
    label: "Geography"
    groups_from: [region, city]
    caption: "The map. Six regions broken into the cities you sleep in."
    default_color_by: region
    hover_attrs: [city, transit_mode, kind, day_band]
  - id: money
    label: "Money Map"
    groups_from: spend_band
    caption: "Where the budget concentrates. The Splurges are usually one-shot experiences; the Free stops are filler."
    default_color_by: cost_yen
    hover_attrs: [cost_yen, spend_band, kind, meal_band]
  - id: palate
    label: "Palate"
    groups_from: [meal_band, cuisine]
    caption: "Japan as a meal sequence. Kaiseki dinners are a different trip from ramen lunches."
    default_color_by: cost_yen
    hover_attrs: [cuisine, meal_band, cost_yen, city]
  - id: shopping
    label: "Shopping Haul"
    groups_from: [shop_type, energy]
    caption: "Shopping experiences plotted against energy. Market crawls are cheap-but-tiring; department stores are expensive-but-restful."
    default_color_by: cost_yen
    hover_attrs: [shop_type, cost_yen, energy, city]
  - id: adventures
    label: "Adventures Promised"
    groups_from: [adventure_tier, energy]
    caption: "What the trip physically asks of you, layered with energy demand. Pair this with cost before booking the Committed and Hardcore tier stops."
    default_color_by: cost_yen
    hover_attrs: [adventure_tier, energy, essentialness, weather]
  - id: threads
    label: "Journey Threads"
    groups_from: transit_segment
    caption: "The trip as a sequence of transit threads. Each cluster is one named train, bus, or ferry route — the spine of how Japan stitches together."
    default_color_by: transit_mode
    hover_attrs: [transit_segment, transit_mode, city, day_band]
default_projection: arc
reveal_on: { search_hit: nearest-group, backlink_jump: owning-group, itinerary_jump: owning-group }
aggregate_edges: { when_collapsed: true, by: relation }
---
Stops:
  - narita :: Narita Airport | kind: transit | city: Tokyo | region: Kanto | trip_stage: Arrive | theme: Arrival | pace: Necessary | energy: Jetlag | transit_mode: Rail | transit_segment: Narita Express | spend_band: Low | cost_yen: 3500 | meal_band: None | day_band: Day 1 | vibe: Liminal | weather: Any | sun_hour: 14.0 | adventure_tier: Gentle | essentialness: Must Do | day_num: 1 | trip_hour: 14.0
  - hilton-shinjuku :: Hilton Shinjuku | kind: hotel | city: Tokyo | region: Kanto | trip_stage: First Tokyo | theme: Stay | pace: Necessary | energy: Reset | transit_mode: Rail | transit_segment: Tokyo Local | spend_band: High | cost_yen: 22000 | meal_band: None | day_band: Day 1 | vibe: Polished | weather: Any | sun_hour: 22.5 | essentialness: Must Do | day_num: 1 | trip_hour: 22.5
  - ueno :: Ueno Park | kind: sight | city: Tokyo | region: Kanto | trip_stage: First Tokyo | theme: Park | pace: Easy | energy: Soft | transit_mode: Rail | transit_segment: Tokyo Local | spend_band: Free | cost_yen: 0 | meal_band: Snack | day_band: Day 1 | vibe: Calm | weather: Clear | sun_hour: 16.5 | adventure_tier: Gentle | essentialness: Flexible | day_num: 1 | trip_hour: 16.5
  - asakusa :: Sensoji Dawn Loop | kind: experience | city: Tokyo | region: Kanto | trip_stage: First Tokyo | theme: Temple | pace: Easy | energy: Soft | transit_mode: Walk | transit_segment: Tokyo Local | spend_band: Free | cost_yen: 0 | meal_band: Snack | day_band: Day 1 | vibe: Sacred | weather: Clear | sun_hour: 7.0 | adventure_tier: Gentle | essentialness: Must Do | day_num: 1 | trip_hour: 7.0
  - kappabashi :: Kappabashi Kitchen Street | kind: shop | city: Tokyo | region: Kanto | trip_stage: First Tokyo | theme: Shopping | pace: Browse | energy: Medium | transit_mode: Walk | transit_segment: Tokyo Local | spend_band: Medium | cost_yen: 6000 | meal_band: Lunch | day_band: Day 1 | vibe: Nerdy | weather: Any | sun_hour: 11.0 | shop_type: Artisan | essentialness: Flexible | day_num: 1 | trip_hour: 11.0
  - tsukiji :: Tsukiji Outer Market | kind: restaurant | city: Tokyo | region: Kanto | trip_stage: First Tokyo | theme: Food | pace: Busy | energy: Medium | transit_mode: Rail | transit_segment: Tokyo Local | spend_band: Medium | cost_yen: 4500 | meal_band: Lunch | day_band: Day 1 | vibe: Hungry | weather: Any | sun_hour: 12.5 | cuisine: Street | essentialness: Must Do | day_num: 1 | trip_hour: 12.5
  - ginza :: Ginza Evening Drift | kind: experience | city: Tokyo | region: Kanto | trip_stage: First Tokyo | theme: Night Walk | pace: Browse | energy: Medium | transit_mode: Walk | transit_segment: Tokyo Local | spend_band: Free | cost_yen: 0 | meal_band: None | day_band: Day 1 | vibe: Polished | weather: Any | sun_hour: 19.5 | adventure_tier: Gentle | essentialness: Flexible | day_num: 1 | trip_hour: 19.5
  - daimaru-ginza :: Daimaru Ginza | kind: shop | city: Tokyo | region: Kanto | trip_stage: First Tokyo | theme: Shopping | pace: Browse | energy: Medium | transit_mode: Walk | transit_segment: Tokyo Local | spend_band: High | cost_yen: 18000 | meal_band: None | day_band: Day 1 | vibe: Polished | weather: Any | sun_hour: 20.0 | shop_type: Department Store | essentialness: Skippable | day_num: 1 | trip_hour: 20.0
  - sukiyabashi :: Sukiyabashi Sushi Counter | kind: restaurant | city: Tokyo | region: Kanto | trip_stage: First Tokyo | theme: Food | pace: Focus | energy: Medium | transit_mode: Walk | transit_segment: Tokyo Local | spend_band: Splurge | cost_yen: 45000 | meal_band: Dinner | day_band: Day 1 | vibe: Polished | weather: Any | sun_hour: 20.5 | cuisine: Sushi | essentialness: Flexible | day_num: 1 | trip_hour: 20.5
  - meiji :: Meiji Shrine | kind: sight | city: Tokyo | region: Kanto | trip_stage: First Tokyo | theme: Temple | pace: Easy | energy: Soft | transit_mode: Rail | transit_segment: Tokyo Local | spend_band: Free | cost_yen: 0 | meal_band: None | day_band: Day 2 | vibe: Sacred | weather: Clear | sun_hour: 8.5 | adventure_tier: Gentle | essentialness: Must Do | day_num: 2 | trip_hour: 32.5
  - harajuku :: Harajuku Backstreets | kind: sight | city: Tokyo | region: Kanto | trip_stage: First Tokyo | theme: Pop Culture | pace: Buzz | energy: High | transit_mode: Walk | transit_segment: Tokyo Local | spend_band: Low | cost_yen: 2500 | meal_band: Snack | day_band: Day 2 | vibe: Loud | weather: Clear | sun_hour: 10.5 | adventure_tier: Gentle | essentialness: Flexible | day_num: 2 | trip_hour: 34.5
  - don-quijote :: Don Quijote Mega | kind: shop | city: Tokyo | region: Kanto | trip_stage: First Tokyo | theme: Shopping | pace: Buzz | energy: Medium | transit_mode: Walk | transit_segment: Tokyo Local | spend_band: Medium | cost_yen: 8000 | meal_band: None | day_band: Day 2 | vibe: Loud | weather: Any | sun_hour: 11.5 | shop_type: Souvenir | essentialness: Skippable | day_num: 2 | trip_hour: 35.5
  - shibuya :: Shibuya Crossing | kind: experience | city: Tokyo | region: Kanto | trip_stage: First Tokyo | theme: City Icon | pace: Buzz | energy: High | transit_mode: Rail | transit_segment: Tokyo Local | spend_band: Free | cost_yen: 0 | meal_band: None | day_band: Day 2 | vibe: Iconic | weather: Any | sun_hour: 12.0 | adventure_tier: Gentle | essentialness: Must Do | day_num: 2 | trip_hour: 36.0
  - ichiran :: Ichiran Ramen Booth | kind: restaurant | city: Tokyo | region: Kanto | trip_stage: First Tokyo | theme: Food | pace: Focus | energy: Soft | transit_mode: Walk | transit_segment: Tokyo Local | spend_band: Low | cost_yen: 1500 | meal_band: Lunch | day_band: Day 2 | vibe: Hungry | weather: Any | sun_hour: 13.0 | cuisine: Ramen | essentialness: Flexible | day_num: 2 | trip_hour: 37.0
  - teamlab :: teamLab Planets | kind: sight | city: Tokyo | region: Kanto | trip_stage: First Tokyo | theme: Art | pace: Focus | energy: Medium | transit_mode: Rail | transit_segment: Tokyo Local | spend_band: High | cost_yen: 4800 | meal_band: None | day_band: Day 2 | vibe: Dreamlike | weather: Any | sun_hour: 14.5 | adventure_tier: Gentle | essentialness: Must Do | day_num: 2 | trip_hour: 38.5
  - akihabara :: Akihabara Night Stack | kind: sight | city: Tokyo | region: Kanto | trip_stage: First Tokyo | theme: Pop Culture | pace: Buzz | energy: High | transit_mode: Rail | transit_segment: Tokyo Local | spend_band: Low | cost_yen: 2000 | meal_band: None | day_band: Day 2 | vibe: Nerdy | weather: Any | sun_hour: 19.0 | adventure_tier: Gentle | essentialness: Flexible | day_num: 2 | trip_hour: 43.0
  - bic-camera :: Bic Camera Akiba | kind: shop | city: Tokyo | region: Kanto | trip_stage: First Tokyo | theme: Shopping | pace: Browse | energy: Medium | transit_mode: Walk | transit_segment: Tokyo Local | spend_band: High | cost_yen: 25000 | meal_band: None | day_band: Day 2 | vibe: Nerdy | weather: Any | sun_hour: 19.5 | shop_type: Electronics | essentialness: Skippable | day_num: 2 | trip_hour: 43.5
  - yakitori-omoide :: Omoide Yokocho Yakitori | kind: restaurant | city: Tokyo | region: Kanto | trip_stage: First Tokyo | theme: Food | pace: Busy | energy: Medium | transit_mode: Walk | transit_segment: Tokyo Local | spend_band: Medium | cost_yen: 4500 | meal_band: Dinner | day_band: Day 2 | vibe: Nostalgic | weather: Any | sun_hour: 21.0 | cuisine: Yakitori | essentialness: Flexible | day_num: 2 | trip_hour: 45.0
  - nikko :: Nikko Toshogu | kind: sight | city: Nikko | region: Kanto | trip_stage: Kanto Trips | theme: Shrine Complex | pace: Long Day | energy: High | transit_mode: Rail | transit_segment: Nikko Limited Express | spend_band: Low | cost_yen: 1300 | meal_band: Lunch | day_band: Day 3 | vibe: Sacred | weather: Crisp | sun_hour: 11.0 | adventure_tier: Moderate | essentialness: Flexible | day_num: 3 | trip_hour: 59.0
  - kegon :: Kegon Falls | kind: sight | city: Nikko | region: Kanto | trip_stage: Kanto Trips | theme: Waterfall | pace: Scenic | energy: Medium | transit_mode: Bus | transit_segment: Nikko Limited Express | spend_band: Low | cost_yen: 570 | meal_band: None | day_band: Day 3 | vibe: Wild | weather: Crisp | sun_hour: 14.0 | adventure_tier: Moderate | essentialness: Weather Dependent | day_num: 3 | trip_hour: 62.0
  - kamakura :: Great Buddha | kind: sight | city: Kamakura | region: Kanto | trip_stage: Kanto Trips | theme: Temple | pace: Easy | energy: Medium | transit_mode: Rail | transit_segment: Yokosuka Line | spend_band: Low | cost_yen: 300 | meal_band: Lunch | day_band: Day 4 | vibe: Sacred | weather: Clear | sun_hour: 10.5 | adventure_tier: Gentle | essentialness: Must Do | day_num: 4 | trip_hour: 82.5
  - enoshima :: Enoshima Coast | kind: sight | city: Enoshima | region: Kanto | trip_stage: Kanto Trips | theme: Coast | pace: Wander | energy: Medium | transit_mode: Rail | transit_segment: Enoden Line | spend_band: Free | cost_yen: 0 | meal_band: Snack | day_band: Day 4 | vibe: Breezy | weather: Clear | sun_hour: 14.0 | adventure_tier: Gentle | essentialness: Flexible | day_num: 4 | trip_hour: 86.0
  - hyatt-hakone :: Hyatt Regency Hakone Resort | kind: hotel | city: Hakone | region: Kanto | trip_stage: Mountain Reset | theme: Stay | pace: Slow | energy: Recover | transit_mode: Walk | transit_segment: Hakone Tozan Line | spend_band: Splurge | cost_yen: 38000 | meal_band: Dinner | day_band: Day 5 | vibe: Calm | weather: Any | sun_hour: 19.0 | essentialness: Must Do | day_num: 5 | trip_hour: 115.0
  - gora :: Gora Switchback | kind: experience | city: Hakone | region: Kanto | trip_stage: Mountain Reset | theme: Mountain Ride | pace: Scenic | energy: Medium | transit_mode: Rail | transit_segment: Hakone Tozan Line | spend_band: Low | cost_yen: 980 | meal_band: None | day_band: Day 5 | vibe: Quirky | weather: Crisp | sun_hour: 11.0 | adventure_tier: Moderate | essentialness: Flexible | day_num: 5 | trip_hour: 107.0
  - owakudani :: Owakudani Valley | kind: experience | city: Hakone | region: Kanto | trip_stage: Mountain Reset | theme: Volcanic View | pace: Scenic | energy: Medium | transit_mode: Ropeway | transit_segment: Hakone Ropeway | spend_band: Medium | cost_yen: 1500 | meal_band: Snack | day_band: Day 5 | vibe: Wild | weather: Crisp | sun_hour: 13.0 | adventure_tier: Moderate | essentialness: Weather Dependent | day_num: 5 | trip_hour: 109.0
  - lake-ashi :: Lake Ashi Pirate Boat | kind: experience | city: Hakone | region: Kanto | trip_stage: Mountain Reset | theme: Water View | pace: Scenic | energy: Soft | transit_mode: Boat | transit_segment: Hakone Pleasure Boat | spend_band: Low | cost_yen: 1200 | meal_band: None | day_band: Day 5 | vibe: Calm | weather: Clear | sun_hour: 15.5 | adventure_tier: Gentle | essentialness: Weather Dependent | day_num: 5 | trip_hour: 111.5
  - kaiseki-hakone :: Hakone Kaiseki Dinner | kind: restaurant | city: Hakone | region: Kanto | trip_stage: Mountain Reset | theme: Food | pace: Slow | energy: Soft | transit_mode: Walk | transit_segment: Hakone Tozan Line | spend_band: Splurge | cost_yen: 28000 | meal_band: Dinner | day_band: Day 5 | vibe: Polished | weather: Any | sun_hour: 19.5 | cuisine: Kaiseki | essentialness: Flexible | day_num: 5 | trip_hour: 115.5
  - fuji :: Fuji Viewpoint | kind: experience | city: Fujikawaguchiko | region: Chubu | trip_stage: Fuji Arc | theme: Mountain View | pace: Scenic | energy: Medium | transit_mode: Bus | transit_segment: Fuji Excursion | spend_band: Free | cost_yen: 0 | meal_band: Lunch | day_band: Day 6 | vibe: Iconic | weather: Crisp | sun_hour: 9.0 | adventure_tier: Moderate | essentialness: Must Do | day_num: 6 | trip_hour: 129.0
  - kawaguchiko :: Kawaguchiko Lake Loop | kind: experience | city: Fujikawaguchiko | region: Chubu | trip_stage: Fuji Arc | theme: Lake View | pace: Scenic | energy: Soft | transit_mode: Bus | transit_segment: Fuji Excursion | spend_band: Free | cost_yen: 0 | meal_band: Snack | day_band: Day 6 | vibe: Calm | weather: Clear | sun_hour: 12.0 | adventure_tier: Gentle | essentialness: Weather Dependent | day_num: 6 | trip_hour: 132.0
  - matsumoto :: Matsumoto Castle | kind: sight | city: Matsumoto | region: Chubu | trip_stage: Alps Pivot | theme: Castle | pace: Focus | energy: Medium | transit_mode: Rail | transit_segment: Azusa Limited Express | spend_band: Low | cost_yen: 700 | meal_band: Lunch | day_band: Day 7 | vibe: Stoic | weather: Crisp | sun_hour: 10.0 | adventure_tier: Gentle | essentialness: Must Do | day_num: 7 | trip_hour: 154.0
  - kamikochi :: Kamikochi Valley Walk | kind: experience | city: Kamikochi | region: Chubu | trip_stage: Alps Pivot | theme: Mountain Ride | pace: Long Day | energy: High | transit_mode: Bus | transit_segment: Kamikochi Shuttle | spend_band: Medium | cost_yen: 5500 | meal_band: Snack | day_band: Day 7 | vibe: Wild | weather: Crisp | sun_hour: 13.0 | adventure_tier: Committed | essentialness: Weather Dependent | day_num: 7 | trip_hour: 157.0
  - takayama :: Takayama Old Town | kind: sight | city: Takayama | region: Chubu | trip_stage: Alps Pivot | theme: Old Town | pace: Wander | energy: Medium | transit_mode: Rail | transit_segment: Hida Wide View | spend_band: Low | cost_yen: 500 | meal_band: Dinner | day_band: Day 7 | vibe: Nostalgic | weather: Crisp | sun_hour: 17.0 | adventure_tier: Gentle | essentialness: Flexible | day_num: 7 | trip_hour: 161.0
  - hida-beef :: Hida Beef Counter | kind: restaurant | city: Takayama | region: Chubu | trip_stage: Alps Pivot | theme: Food | pace: Focus | energy: Medium | transit_mode: Walk | transit_segment: Hida Wide View | spend_band: High | cost_yen: 12000 | meal_band: Dinner | day_band: Day 7 | vibe: Hungry | weather: Any | sun_hour: 20.0 | cuisine: Wagyu | essentialness: Flexible | day_num: 7 | trip_hour: 164.0
  - shirakawa :: Shirakawa-go | kind: experience | city: Shirakawa-go | region: Chubu | trip_stage: Alps Pivot | theme: Village | pace: Wander | energy: Medium | transit_mode: Bus | transit_segment: Nohi Bus | spend_band: Low | cost_yen: 600 | meal_band: Lunch | day_band: Day 8 | vibe: Nostalgic | weather: Snow | sun_hour: 10.5 | adventure_tier: Moderate | essentialness: Must Do | day_num: 8 | trip_hour: 178.5
  - marriott-kanazawa :: Marriott Kanazawa | kind: hotel | city: Kanazawa | region: Hokuriku | trip_stage: Hokuriku Arc | theme: Stay | pace: Necessary | energy: Reset | transit_mode: Rail | transit_segment: Hokuriku Shinkansen | spend_band: High | cost_yen: 21000 | meal_band: Dinner | day_band: Day 8 | vibe: Polished | weather: Any | sun_hour: 22.0 | essentialness: Must Do | day_num: 8 | trip_hour: 190.0
  - kenrokuen :: Kenrokuen Garden | kind: sight | city: Kanazawa | region: Hokuriku | trip_stage: Hokuriku Arc | theme: Garden | pace: Easy | energy: Soft | transit_mode: Bus | transit_segment: Kanazawa Loop Bus | spend_band: Low | cost_yen: 320 | meal_band: None | day_band: Day 9 | vibe: Calm | weather: Clear | sun_hour: 9.0 | adventure_tier: Gentle | essentialness: Must Do | day_num: 9 | trip_hour: 201.0
  - omicho :: Omicho Market | kind: restaurant | city: Kanazawa | region: Hokuriku | trip_stage: Hokuriku Arc | theme: Food | pace: Busy | energy: Medium | transit_mode: Walk | transit_segment: Kanazawa Loop Bus | spend_band: Medium | cost_yen: 5500 | meal_band: Lunch | day_band: Day 9 | vibe: Hungry | weather: Any | sun_hour: 11.5 | cuisine: Seafood | essentialness: Flexible | day_num: 9 | trip_hour: 203.5
  - higashi :: Higashi Chaya Tea | kind: restaurant | city: Kanazawa | region: Hokuriku | trip_stage: Hokuriku Arc | theme: Old Town | pace: Browse | energy: Soft | transit_mode: Walk | transit_segment: Kanazawa Loop Bus | spend_band: Medium | cost_yen: 3500 | meal_band: Tea | day_band: Day 9 | vibe: Nostalgic | weather: Clear | sun_hour: 15.0 | cuisine: Tea | essentialness: Flexible | day_num: 9 | trip_hour: 207.0
  - kanazawa-gold :: Kanazawa Gold Leaf Shop | kind: shop | city: Kanazawa | region: Hokuriku | trip_stage: Hokuriku Arc | theme: Shopping | pace: Browse | energy: Soft | transit_mode: Walk | transit_segment: Kanazawa Loop Bus | spend_band: Medium | cost_yen: 6500 | meal_band: None | day_band: Day 9 | vibe: Quirky | weather: Any | sun_hour: 16.0 | shop_type: Artisan | essentialness: Skippable | day_num: 9 | trip_hour: 208.0
  - kyoto-station :: Kyoto Station | kind: transit | city: Kyoto | region: Kansai | trip_stage: Kyoto Core | theme: Transit Hub | pace: Necessary | energy: Reset | transit_mode: Rail | transit_segment: Shinkansen Tokaido | spend_band: Medium | cost_yen: 14000 | meal_band: Dinner | day_band: Day 10 | vibe: Liminal | weather: Any | sun_hour: 18.0 | adventure_tier: Gentle | essentialness: Must Do | day_num: 10 | trip_hour: 234.0
  - ritz-kyoto :: Ritz-Carlton Kyoto | kind: hotel | city: Kyoto | region: Kansai | trip_stage: Kyoto Core | theme: Stay | pace: Slow | energy: Recover | transit_mode: Walk | transit_segment: Kyoto Local | spend_band: Splurge | cost_yen: 65000 | meal_band: None | day_band: Day 10 | vibe: Polished | weather: Any | sun_hour: 21.5 | essentialness: Must Do | day_num: 10 | trip_hour: 237.5
  - fushimi :: Fushimi Inari Torii | kind: sight | city: Kyoto | region: Kansai | trip_stage: Kyoto Core | theme: Shrine Complex | pace: Long Day | energy: High | transit_mode: Rail | transit_segment: Nara Line | spend_band: Free | cost_yen: 0 | meal_band: Snack | day_band: Day 10 | vibe: Sacred | weather: Clear | sun_hour: 7.5 | adventure_tier: Committed | essentialness: Must Do | day_num: 10 | trip_hour: 223.5
  - gion :: Gion Evening Drift | kind: sight | city: Kyoto | region: Kansai | trip_stage: Kyoto Core | theme: Old Town | pace: Browse | energy: Medium | transit_mode: Walk | transit_segment: Kyoto Local | spend_band: Free | cost_yen: 0 | meal_band: Dinner | day_band: Day 10 | vibe: Nostalgic | weather: Any | sun_hour: 20.0 | adventure_tier: Gentle | essentialness: Must Do | day_num: 10 | trip_hour: 236.0
  - kikunoi :: Kikunoi Kaiseki | kind: restaurant | city: Kyoto | region: Kansai | trip_stage: Kyoto Core | theme: Food | pace: Focus | energy: Soft | transit_mode: Walk | transit_segment: Kyoto Local | spend_band: Splurge | cost_yen: 38000 | meal_band: Dinner | day_band: Day 10 | vibe: Polished | weather: Any | sun_hour: 19.5 | cuisine: Kaiseki | essentialness: Flexible | day_num: 10 | trip_hour: 235.5
  - kiyomizu :: Kiyomizu Terrace | kind: sight | city: Kyoto | region: Kansai | trip_stage: Kyoto Core | theme: Temple | pace: Focus | energy: Medium | transit_mode: Walk | transit_segment: Kyoto Local | spend_band: Low | cost_yen: 400 | meal_band: Lunch | day_band: Day 11 | vibe: Sacred | weather: Clear | sun_hour: 10.0 | adventure_tier: Gentle | essentialness: Must Do | day_num: 11 | trip_hour: 250.0
  - nishiki :: Nishiki Market Crawl | kind: restaurant | city: Kyoto | region: Kansai | trip_stage: Kyoto Core | theme: Food | pace: Busy | energy: Medium | transit_mode: Walk | transit_segment: Kyoto Local | spend_band: Medium | cost_yen: 3500 | meal_band: Lunch | day_band: Day 11 | vibe: Hungry | weather: Any | sun_hour: 12.5 | cuisine: Street | essentialness: Flexible | day_num: 11 | trip_hour: 252.5
  - arashiyama :: Arashiyama Bamboo Grove | kind: experience | city: Kyoto | region: Kansai | trip_stage: Kyoto Core | theme: Forest | pace: Easy | energy: Soft | transit_mode: Rail | transit_segment: Sagano Line | spend_band: Free | cost_yen: 0 | meal_band: Snack | day_band: Day 12 | vibe: Dreamlike | weather: Mist | sun_hour: 8.5 | adventure_tier: Gentle | essentialness: Must Do | day_num: 12 | trip_hour: 272.5
  - kinkakuji :: Kinkakuji Golden Pavilion | kind: sight | city: Kyoto | region: Kansai | trip_stage: Kyoto Core | theme: Temple | pace: Focus | energy: Medium | transit_mode: Bus | transit_segment: Kyoto City Bus | spend_band: Low | cost_yen: 500 | meal_band: None | day_band: Day 12 | vibe: Iconic | weather: Clear | sun_hour: 14.0 | adventure_tier: Gentle | essentialness: Must Do | day_num: 12 | trip_hour: 278.0
  - nijo :: Nijo Castle Floors | kind: sight | city: Kyoto | region: Kansai | trip_stage: Kyoto Core | theme: Castle | pace: Focus | energy: Medium | transit_mode: Walk | transit_segment: Kyoto Local | spend_band: Low | cost_yen: 1300 | meal_band: Lunch | day_band: Day 13 | vibe: Stoic | weather: Any | sun_hour: 10.5 | adventure_tier: Gentle | essentialness: Flexible | day_num: 13 | trip_hour: 298.5
  - pontocho :: Pontocho Lanterns | kind: experience | city: Kyoto | region: Kansai | trip_stage: Kyoto Core | theme: Night Walk | pace: Browse | energy: Medium | transit_mode: Walk | transit_segment: Kyoto Local | spend_band: Free | cost_yen: 0 | meal_band: Dinner | day_band: Day 13 | vibe: Polished | weather: Any | sun_hour: 20.5 | adventure_tier: Gentle | essentialness: Flexible | day_num: 13 | trip_hour: 308.5
  - nara-park :: Nara Deer Park | kind: sight | city: Nara | region: Kansai | trip_stage: Nara Loop | theme: Park | pace: Easy | energy: Medium | transit_mode: Rail | transit_segment: Nara Line | spend_band: Free | cost_yen: 0 | meal_band: Snack | day_band: Day 14 | vibe: Quirky | weather: Clear | sun_hour: 9.5 | adventure_tier: Gentle | essentialness: Must Do | day_num: 14 | trip_hour: 321.5
  - todaiji :: Todaiji Great Hall | kind: sight | city: Nara | region: Kansai | trip_stage: Nara Loop | theme: Temple | pace: Focus | energy: Medium | transit_mode: Walk | transit_segment: Nara Line | spend_band: Low | cost_yen: 600 | meal_band: Lunch | day_band: Day 14 | vibe: Sacred | weather: Clear | sun_hour: 11.0 | adventure_tier: Gentle | essentialness: Must Do | day_num: 14 | trip_hour: 323.0
  - koyasan :: Koyasan Okunoin Lanterns | kind: sight | city: Koyasan | region: Kansai | trip_stage: Koyasan Side | theme: Shrine Complex | pace: Long Day | energy: High | transit_mode: Rail | transit_segment: Nankai Koya Line | spend_band: Medium | cost_yen: 5000 | meal_band: Dinner | day_band: Day 15 | vibe: Mystic | weather: Mist | sun_hour: 11.0 | adventure_tier: Committed | essentialness: Flexible | day_num: 15 | trip_hour: 347.0
  - dotonbori :: Dotonbori Food Crawl | kind: restaurant | city: Osaka | region: Kansai | trip_stage: Osaka Bite | theme: Food | pace: Buzz | energy: High | transit_mode: Walk | transit_segment: Midosuji Subway | spend_band: Medium | cost_yen: 6000 | meal_band: Dinner | day_band: Day 15 | vibe: Hungry | weather: Any | sun_hour: 20.0 | cuisine: Street | essentialness: Must Do | day_num: 15 | trip_hour: 356.0
  - shinsaibashi :: Shinsaibashi Arcade | kind: shop | city: Osaka | region: Kansai | trip_stage: Osaka Bite | theme: Shopping | pace: Browse | energy: Medium | transit_mode: Walk | transit_segment: Midosuji Subway | spend_band: Medium | cost_yen: 9000 | meal_band: None | day_band: Day 15 | vibe: Loud | weather: Any | sun_hour: 18.0 | shop_type: Fashion | essentialness: Skippable | day_num: 15 | trip_hour: 354.0
  - hyatt-osaka :: Hyatt Regency Osaka | kind: hotel | city: Osaka | region: Kansai | trip_stage: Osaka Bite | theme: Stay | pace: Necessary | energy: Reset | transit_mode: Rail | transit_segment: Midosuji Subway | spend_band: High | cost_yen: 19000 | meal_band: None | day_band: Day 15 | vibe: Polished | weather: Any | sun_hour: 22.5 | essentialness: Must Do | day_num: 15 | trip_hour: 358.5
  - himeji :: Himeji White Heron | kind: sight | city: Himeji | region: Kansai | trip_stage: West Run | theme: Castle | pace: Focus | energy: High | transit_mode: Rail | transit_segment: Shinkansen Sanyo | spend_band: Low | cost_yen: 1050 | meal_band: Lunch | day_band: Day 16 | vibe: Stoic | weather: Clear | sun_hour: 11.0 | adventure_tier: Moderate | essentialness: Must Do | day_num: 16 | trip_hour: 371.0
  - naoshima :: Naoshima Pumpkin | kind: sight | city: Naoshima | region: Shikoku | trip_stage: Art Island | theme: Art | pace: Focus | energy: Medium | transit_mode: Boat | transit_segment: Naoshima Ferry | spend_band: Free | cost_yen: 0 | meal_band: Snack | day_band: Day 17 | vibe: Dreamlike | weather: Clear | sun_hour: 11.0 | adventure_tier: Moderate | essentialness: Flexible | day_num: 17 | trip_hour: 395.0
  - chichu :: Chichu Museum | kind: sight | city: Naoshima | region: Shikoku | trip_stage: Art Island | theme: Art | pace: Focus | energy: Medium | transit_mode: Walk | transit_segment: Naoshima Ferry | spend_band: High | cost_yen: 2100 | meal_band: None | day_band: Day 17 | vibe: Dreamlike | weather: Clear | sun_hour: 14.5 | adventure_tier: Moderate | essentialness: Flexible | day_num: 17 | trip_hour: 398.5
  - hiroshima-pp :: Hiroshima Peace Park | kind: sight | city: Hiroshima | region: Chugoku | trip_stage: Peace + Sea | theme: Memorial | pace: Focus | energy: Heavy | transit_mode: Rail | transit_segment: Shinkansen Sanyo | spend_band: Low | cost_yen: 200 | meal_band: Lunch | day_band: Day 18 | vibe: Solemn | weather: Any | sun_hour: 10.5 | adventure_tier: Gentle | essentialness: Must Do | day_num: 18 | trip_hour: 418.5
  - miyajima :: Miyajima Floating Torii | kind: experience | city: Miyajima | region: Chugoku | trip_stage: Peace + Sea | theme: Shrine Complex | pace: Easy | energy: Soft | transit_mode: Boat | transit_segment: JR Miyajima Ferry | spend_band: Low | cost_yen: 300 | meal_band: Dinner | day_band: Day 18 | vibe: Sacred | weather: Clear | sun_hour: 17.5 | adventure_tier: Moderate | essentialness: Must Do | day_num: 18 | trip_hour: 425.5
  - okonomi :: Hiroshima Okonomimura | kind: restaurant | city: Hiroshima | region: Chugoku | trip_stage: Peace + Sea | theme: Food | pace: Focus | energy: Medium | transit_mode: Walk | transit_segment: Hiroshima Streetcar | spend_band: Low | cost_yen: 1800 | meal_band: Dinner | day_band: Day 18 | vibe: Hungry | weather: Any | sun_hour: 19.5 | cuisine: Okonomiyaki | essentialness: Flexible | day_num: 18 | trip_hour: 427.5
  - tokyo-station :: Tokyo Station | kind: transit | city: Tokyo | region: Kanto | trip_stage: Return Loop | theme: Transit Hub | pace: Necessary | energy: Reset | transit_mode: Rail | transit_segment: Shinkansen Tokaido | spend_band: Medium | cost_yen: 18000 | meal_band: Lunch | day_band: Day 19 | vibe: Liminal | weather: Any | sun_hour: 14.0 | adventure_tier: Gentle | essentialness: Must Do | day_num: 19 | trip_hour: 446.0
  - odaiba :: Odaiba Bay Loop | kind: experience | city: Tokyo | region: Kanto | trip_stage: Return Loop | theme: Night Walk | pace: Browse | energy: Medium | transit_mode: Rail | transit_segment: Yurikamome Line | spend_band: Free | cost_yen: 0 | meal_band: Dinner | day_band: Day 19 | vibe: Polished | weather: Any | sun_hour: 18.5 | adventure_tier: Gentle | essentialness: Skippable | day_num: 19 | trip_hour: 450.5
  - tsutaya :: Daikanyama Tsutaya | kind: shop | city: Tokyo | region: Kanto | trip_stage: Return Loop | theme: Shopping | pace: Browse | energy: Soft | transit_mode: Walk | transit_segment: Tokyo Local | spend_band: Medium | cost_yen: 4500 | meal_band: Tea | day_band: Day 20 | vibe: Calm | weather: Any | sun_hour: 10.0 | shop_type: Books | essentialness: Skippable | day_num: 20 | trip_hour: 466.0
  - haneda :: Haneda Departure | kind: transit | city: Tokyo | region: Kanto | trip_stage: Depart | theme: Arrival | pace: Necessary | energy: Jetlag | transit_mode: Rail | transit_segment: Haneda Monorail | spend_band: Low | cost_yen: 700 | meal_band: None | day_band: Day 20 | vibe: Liminal | weather: Any | sun_hour: 14.0 | adventure_tier: Gentle | essentialness: Must Do | day_num: 20 | trip_hour: 470.0
narita -> hilton-shinjuku -> ueno -> asakusa -> kappabashi -> tsukiji -> ginza -> daimaru-ginza -> sukiyabashi -> meiji -> harajuku -> don-quijote -> shibuya -> ichiran -> teamlab -> akihabara -> bic-camera -> yakitori-omoide -> nikko -> kegon -> kamakura -> enoshima -> hyatt-hakone -> gora -> owakudani -> lake-ashi -> kaiseki-hakone -> fuji -> kawaguchiko -> matsumoto -> kamikochi -> takayama -> hida-beef -> shirakawa -> marriott-kanazawa -> kenrokuen -> omicho -> higashi -> kanazawa-gold -> kyoto-station -> ritz-kyoto -> fushimi -> gion -> kikunoi -> kiyomizu -> nishiki -> arashiyama -> kinkakuji -> nijo -> pontocho -> nara-park -> todaiji -> koyasan -> dotonbori -> shinsaibashi -> hyatt-osaka -> himeji -> naoshima -> chichu -> hiroshima-pp -> miyajima -> okonomi -> tokyo-station -> odaiba -> tsutaya -> haneda
narita -> hilton-shinjuku -> ueno -> asakusa -> kappabashi -> tsukiji -> ginza -> daimaru-ginza -> sukiyabashi -> meiji -> harajuku -> don-quijote -> shibuya -> ichiran -> teamlab -> akihabara -> bic-camera -> yakitori-omoide -> tokyo-station -> odaiba -> tsutaya -> haneda
nikko -> kegon
hyatt-hakone -> gora -> owakudani -> lake-ashi -> kaiseki-hakone
fuji -> kawaguchiko
takayama -> hida-beef
marriott-kanazawa -> kenrokuen -> omicho -> higashi -> kanazawa-gold
kyoto-station -> ritz-kyoto -> fushimi -> gion -> kikunoi -> kiyomizu -> nishiki -> arashiyama -> kinkakuji -> nijo -> pontocho
nara-park -> todaiji
dotonbori -> shinsaibashi -> hyatt-osaka
naoshima -> chichu
hiroshima-pp -> okonomi
hilton-shinjuku ->|segment| ueno
ueno ->|segment| asakusa
asakusa ->|segment| kappabashi
kappabashi ->|segment| tsukiji
tsukiji ->|segment| ginza
ginza ->|segment| daimaru-ginza
daimaru-ginza ->|segment| sukiyabashi
sukiyabashi ->|segment| meiji
meiji ->|segment| harajuku
harajuku ->|segment| don-quijote
don-quijote ->|segment| shibuya
shibuya ->|segment| ichiran
ichiran ->|segment| teamlab
teamlab ->|segment| akihabara
akihabara ->|segment| bic-camera
bic-camera ->|segment| yakitori-omoide
yakitori-omoide ->|segment| tsutaya
nikko ->|segment| kegon
hyatt-hakone ->|segment| gora
gora ->|segment| kaiseki-hakone
fuji ->|segment| kawaguchiko
takayama ->|segment| hida-beef
kenrokuen ->|segment| omicho
omicho ->|segment| higashi
higashi ->|segment| kanazawa-gold
kyoto-station ->|segment| tokyo-station
ritz-kyoto ->|segment| gion
gion ->|segment| kikunoi
kikunoi ->|segment| kiyomizu
kiyomizu ->|segment| nishiki
nishiki ->|segment| nijo
nijo ->|segment| pontocho
fushimi ->|segment| nara-park
nara-park ->|segment| todaiji
dotonbori ->|segment| shinsaibashi
shinsaibashi ->|segment| hyatt-osaka
himeji ->|segment| hiroshima-pp
naoshima ->|segment| chichu
tokyo-station ->|shinkansen| kyoto-station
kyoto-station ->|shinkansen| himeji
himeji ->|shinkansen| hiroshima-pp
marriott-kanazawa ->|thunderbird| kyoto-station
fuji ->|rain pivot| kawaguchiko
arashiyama ->|rain pivot| kinkakuji
owakudani ->|rain pivot| lake-ashi
kamikochi ->|rain pivot| takayama
tsukiji ->|food crawl| nishiki
nishiki ->|food crawl| dotonbori
dotonbori ->|food crawl| okonomi
omicho ->|food crawl| hida-beef
hilton-shinjuku ->|home base| ueno
hilton-shinjuku ->|home base| asakusa
hilton-shinjuku ->|home base| meiji
hilton-shinjuku ->|home base| shibuya
hyatt-hakone ->|home base| owakudani
hyatt-hakone ->|home base| lake-ashi
marriott-kanazawa ->|home base| kenrokuen
marriott-kanazawa ->|home base| omicho
ritz-kyoto ->|home base| fushimi
ritz-kyoto ->|home base| arashiyama
ritz-kyoto ->|home base| kinkakuji
hyatt-osaka ->|home base| dotonbori
hyatt-osaka ->|home base| shinsaibashi
asakusa ->|sacred arc| meiji
meiji ->|sacred arc| fushimi
fushimi ->|sacred arc| koyasan
koyasan ->|sacred arc| miyajima
teamlab ->|art arc| naoshima
naoshima ->|art arc| chichu
matsumoto ->|castle line| nijo
nijo ->|castle line| himeji
sukiyabashi ->|splurge| kaiseki-hakone
kaiseki-hakone ->|splurge| kikunoi
kikunoi ->|splurge| ritz-kyoto
```
