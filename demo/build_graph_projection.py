"""Generate the dense Japan Projection Lab items block.

Run: /Users/yeshwanth/.venv/bin/python demo/build_graph_projection.py

Seven projections, each answering a different question a reader actually asks:
  arc          - narrative skeleton
  geography    - where things are
  money        - where the budget concentrates
  palate       - the food story
  shopping     - shopping experiences, energy vs spend
  adventures   - what the trip asks of you, energy vs spend
  threads      - transit segments / journey threads

Edges colored by transit_mode in every projection so transit is an
ambient signal regardless of which view is active.
"""

from __future__ import annotations

from pathlib import Path
from textwrap import dedent

HERE = Path(__file__).resolve().parent
TARGET = HERE / "graph-projection.md"


# ---- Node attribute definitions --------------------------------------------
# Each node tuple: (id, label, kind, city, region, trip_stage, theme,
#                    pace, energy, transit_mode, transit_segment,
#                    spend_band, cost_yen, meal_band,
#                    day_band, vibe, weather, sun_hour,
#                    cuisine, shop_type, adventure_tier, essentialness)
#
# Default for non-applicable attrs: "" (renderer skips empty values for grouping).
#
# kind:           sight | experience | transit | hotel | restaurant | shop
# spend_band:     Free | Low | Medium | High | Splurge
# cost_yen:       per-person, rough.
# adventure_tier: Gentle | Moderate | Committed | Hardcore
# essentialness:  Must Do | Flexible | Weather Dependent | Skippable
# transit_segment: which transit thread this stop belongs to (the journey arc)

# Field index map for readability when building stop_lines.
FIELDS = [
    "id", "label", "kind", "city", "region", "trip_stage", "theme",
    "pace", "energy", "transit_mode", "transit_segment",
    "spend_band", "cost_yen", "meal_band",
    "day_band", "vibe", "weather", "sun_hour",
    "cuisine", "shop_type", "adventure_tier", "essentialness",
    "description",
]


# Per-node descriptions — what a reader should expect at each stop.
# One sentence each, kept tight. Used both in markdown emission and hover card.
DESCRIPTIONS = {
    # Day 1 - Arrival + first Tokyo
    "narita": "International gateway east of Tokyo. Long Narita Express ride into the city — start of the trip.",
    "hilton-shinjuku": "High-floor hotel above Shinjuku skyline. Anchor base for the first Tokyo days.",
    "ueno": "Sprawling park with museums and quiet paths. Cherry trees in season, gentle decompression on jetlag day.",
    "asakusa": "Sensoji temple at sunrise. Go early to beat the tour buses; lantern-lit and quiet at dawn.",
    "kappabashi": "Restaurant-supply street: handmade knives, copper pans, plastic food samples. Geek-out shopping.",
    "tsukiji": "Outer-market food crawl: tamago skewers, uni, fresh oysters. Tsukiji moved but the snacking stayed.",
    "ginza": "Polished evening walk under department-store glow. Window-shop and let the day settle.",
    "daimaru-ginza": "Department store; depachika basement food hall is the real attraction. Wagashi and prepared meals.",
    "sukiyabashi": "Jiro-style sushi counter. Booking required well in advance; a one-shot splurge night.",
    # Day 2 - Tokyo deep
    "meiji": "Forested shrine inside the city. Twenty-minute gravel walk to the main hall under torii gates.",
    "harajuku": "Youth-fashion backstreets behind Takeshita-dori. Crepes, vintage, tiny boutiques.",
    "don-quijote": "Chaotic discount mega-store; snacks, costumes, kitchen gear. Souvenir haul in one stop.",
    "shibuya": "The famous scramble crossing. Watch from the Starbucks balcony or the Scramble Square deck.",
    "ichiran": "Solo-booth tonkotsu ramen. Order via slip, eat in a private cubicle. Cheap, fast, satisfying.",
    "teamlab": "Immersive digital-art installation in Toyosu. Wet feet in the koi pond; book a precise time slot.",
    "akihabara": "Electronics + anime district under neon. Multi-floor arcades, retro game shops, maid cafes.",
    "bic-camera": "Big-box electronics; cameras, kitchen gadgets, tax-free counter for visitors.",
    "yakitori-omoide": "Postwar alley of tiny grill counters near Shinjuku station. Smoky, loud, perfect.",
    # Day 3-4 - Kanto trips
    "nikko": "Day trip north for ornate Toshogu shrine complex. Long train + bus; pack a lunch.",
    "kegon": "Plunging waterfall reached by elevator down a cliff face. Best in autumn color.",
    "kamakura": "Coastal old capital; the open-air Great Buddha is the headline. Easy day trip from Tokyo.",
    "enoshima": "Tidal island connected by causeway. Caves, sea breeze, sunset over Sagami Bay.",
    # Day 5 - Hakone reset
    "hyatt-hakone": "Mountain ryokan-style resort. Onsen, kaiseki dinner, slow recovery from the rush.",
    "gora": "Switchback mountain train terminus. Funicular continues up toward the volcanic valley.",
    "owakudani": "Active sulphur vents with black eggs boiled in the springs. Sometimes closed for volcanic activity.",
    "lake-ashi": "Pirate-themed cruise ship across a caldera lake. Fuji view on clear days.",
    "kaiseki-hakone": "Multi-course traditional dinner inside the ryokan. Long, deliberate, beautiful.",
    # Day 6 - Fuji
    "fuji": "Best photo angle on Fuji from the Chureito pagoda or Lake Kawaguchi north shore.",
    "kawaguchiko": "Lakeside loop around mirror-water Fuji reflections. Bike or bus the rim.",
    # Day 7-8 - Alps + Hokuriku
    "matsumoto": "Black-painted castle keep, the original. Steep ladder-stairs inside; bring socks.",
    "kamikochi": "Alpine valley walk along the Azusa river. Open May-October; closed in winter.",
    "takayama": "Edo-period merchant district. Sake breweries open for tasting, morning markets along the river.",
    "hida-beef": "Counter-style wagyu grill. Hida beef is the regional rival to Kobe.",
    "shirakawa": "Thatched-roof gassho farmhouses in a UNESCO village. Magical in snow, busy in autumn.",
    # Day 8-9 - Hokuriku
    "marriott-kanazawa": "Modern hotel near Kanazawa station. Bullet train arrives literally beneath it.",
    "kenrokuen": "One of the three great gardens of Japan. Pruned pines, stone lanterns, careful sightlines.",
    "omicho": "Covered market with kaisendon (sashimi bowls) and snow crab in season.",
    "higashi": "Geisha district with preserved teahouses. Gold-leaf desserts and matcha sets.",
    "kanazawa-gold": "Kanazawa makes 99% of Japan's gold leaf. Souvenir cosmetics, sweets, and leaf-applied objects.",
    # Day 10-13 - Kyoto core
    "kyoto-station": "Sci-fi station building with sky bridges. Underground food court is excellent for arrival meals.",
    "ritz-kyoto": "Riverside luxury along the Kamogawa. Walking distance to Gion and Pontocho.",
    "fushimi": "Endless vermilion torii winding up Mount Inari. Go at dawn or after 5pm to avoid crowds.",
    "gion": "Geisha district of lantern-lit alleys. Walk slowly — don't crowd or photograph maiko.",
    "kikunoi": "Three-star kaiseki, a peak Kyoto dining experience. Reserve months ahead.",
    "kiyomizu": "Wooden terrace over a hillside, no nails used in construction. Great over-the-roofs view of Kyoto.",
    "nishiki": "Kyoto's 400-year covered food street. Pickles, dashi, tofu doughnuts, small samples.",
    "arashiyama": "Bamboo grove west of Kyoto. Get there before 8am or it's a tunnel of selfie sticks.",
    "kinkakuji": "Gold-leaf pavilion over a reflecting pond. One viewing loop, fast in and out.",
    "nijo": "Shogun-era castle with nightingale floors that chirp under footsteps to warn of intruders.",
    "pontocho": "Narrow lantern-lit dining alley along the river. Kawayuka platforms in summer.",
    # Day 14-15 - Nara + Koyasan + Osaka
    "nara-park": "Free-roaming deer that bow for cookies. Hold tight to your map and snacks.",
    "todaiji": "Enormous wooden hall housing the seated Great Buddha. Crawl through the pillar hole for luck.",
    "koyasan": "Mountain-top Buddhist monastery complex. Stay in a temple for vegetarian shojin dinner and morning prayers.",
    "dotonbori": "Neon canal of takoyaki, kushikatsu, okonomiyaki, glowing crab signs. Eat your way down.",
    "shinsaibashi": "Long covered arcade for fashion and souvenirs. Drugstores everywhere for Japanese skincare.",
    "hyatt-osaka": "Bay-side hotel near the Universal stop. Good for a one-night Osaka anchor.",
    # Day 16-18 - West Japan
    "himeji": "Japan's most spectacular castle keep, the White Heron. Climb six levels of original wooden floors.",
    "naoshima": "Art island in the Seto Inland Sea. Yayoi Kusama yellow pumpkin on the pier.",
    "chichu": "Tadao Ando underground museum housing Monet's Water Lilies and James Turrell rooms.",
    "hiroshima-pp": "Peace Memorial Park around the A-bomb Dome. Heavy, essential, well-curated museum.",
    "miyajima": "Famous floating torii in the bay. Visit at high tide and stay overnight — quiet after day-trippers leave.",
    "okonomi": "Hiroshima-style okonomiyaki: layered with noodles, cooked on the teppan in front of you.",
    # Day 19-20 - Return + departure
    "tokyo-station": "Brick beaux-arts landmark; Character Street and ramen alley underneath are tourist musts.",
    "odaiba": "Bayfront entertainment island. Giant Gundam statue, teamLab borderless used to live here.",
    "tsutaya": "Books and cafe in a leafy Daikanyama complex. Last calm hour before the airport.",
    "haneda": "Closer-in airport with late-night flights. Easier and faster than Narita for departure.",
}


def _node(id, label, kind, city, region, trip_stage, theme,
          pace, energy, transit_mode, transit_segment,
          spend_band, cost_yen, meal_band,
          day_band, vibe, weather, sun_hour,
          cuisine="", shop_type="", adventure_tier="", essentialness=""):
    return {
        "id": id, "label": label, "kind": kind,
        "city": city, "region": region, "trip_stage": trip_stage, "theme": theme,
        "pace": pace, "energy": energy,
        "transit_mode": transit_mode, "transit_segment": transit_segment,
        "spend_band": spend_band, "cost_yen": cost_yen, "meal_band": meal_band,
        "day_band": day_band, "vibe": vibe, "weather": weather, "sun_hour": sun_hour,
        "cuisine": cuisine, "shop_type": shop_type,
        "adventure_tier": adventure_tier, "essentialness": essentialness,
        "description": DESCRIPTIONS.get(id, ""),
    }


# ---- Nodes -----------------------------------------------------------------

NODES = [
    # Day 1 - Arrival
    _node("narita", "Narita Airport", "transit", "Tokyo", "Kanto", "Arrive", "Arrival",
          "Necessary", "Jetlag", "Rail", "Narita Express",
          "Low", 3500, "None", "Day 1", "Liminal", "Any", 14.0,
          essentialness="Must Do", adventure_tier="Gentle"),
    _node("hilton-shinjuku", "Hilton Shinjuku", "hotel", "Tokyo", "Kanto", "First Tokyo", "Stay",
          "Necessary", "Reset", "Rail", "Tokyo Local",
          "High", 22000, "None", "Day 1", "Polished", "Any", 22.5,
          essentialness="Must Do"),
    _node("ueno", "Ueno Park", "sight", "Tokyo", "Kanto", "First Tokyo", "Park",
          "Easy", "Soft", "Rail", "Tokyo Local",
          "Free", 0, "Snack", "Day 1", "Calm", "Clear", 16.5,
          essentialness="Flexible", adventure_tier="Gentle"),
    _node("asakusa", "Sensoji Dawn Loop", "experience", "Tokyo", "Kanto", "First Tokyo", "Temple",
          "Easy", "Soft", "Walk", "Tokyo Local",
          "Free", 0, "Snack", "Day 1", "Sacred", "Clear", 7.0,
          essentialness="Must Do", adventure_tier="Gentle"),
    _node("kappabashi", "Kappabashi Kitchen Street", "shop", "Tokyo", "Kanto", "First Tokyo", "Shopping",
          "Browse", "Medium", "Walk", "Tokyo Local",
          "Medium", 6000, "Lunch", "Day 1", "Nerdy", "Any", 11.0,
          shop_type="Artisan", essentialness="Flexible"),
    _node("tsukiji", "Tsukiji Outer Market", "restaurant", "Tokyo", "Kanto", "First Tokyo", "Food",
          "Busy", "Medium", "Rail", "Tokyo Local",
          "Medium", 4500, "Lunch", "Day 1", "Hungry", "Any", 12.5,
          cuisine="Street", essentialness="Must Do"),
    _node("ginza", "Ginza Evening Drift", "experience", "Tokyo", "Kanto", "First Tokyo", "Night Walk",
          "Browse", "Medium", "Walk", "Tokyo Local",
          "Free", 0, "None", "Day 1", "Polished", "Any", 19.5,
          essentialness="Flexible", adventure_tier="Gentle"),
    _node("daimaru-ginza", "Daimaru Ginza", "shop", "Tokyo", "Kanto", "First Tokyo", "Shopping",
          "Browse", "Medium", "Walk", "Tokyo Local",
          "High", 18000, "None", "Day 1", "Polished", "Any", 20.0,
          shop_type="Department Store", essentialness="Skippable"),
    _node("sukiyabashi", "Sukiyabashi Sushi Counter", "restaurant", "Tokyo", "Kanto", "First Tokyo", "Food",
          "Focus", "Medium", "Walk", "Tokyo Local",
          "Splurge", 45000, "Dinner", "Day 1", "Polished", "Any", 20.5,
          cuisine="Sushi", essentialness="Flexible"),

    # Day 2 - Tokyo deep
    _node("meiji", "Meiji Shrine", "sight", "Tokyo", "Kanto", "First Tokyo", "Temple",
          "Easy", "Soft", "Rail", "Tokyo Local",
          "Free", 0, "None", "Day 2", "Sacred", "Clear", 8.5,
          essentialness="Must Do", adventure_tier="Gentle"),
    _node("harajuku", "Harajuku Backstreets", "sight", "Tokyo", "Kanto", "First Tokyo", "Pop Culture",
          "Buzz", "High", "Walk", "Tokyo Local",
          "Low", 2500, "Snack", "Day 2", "Loud", "Clear", 10.5,
          essentialness="Flexible", adventure_tier="Gentle"),
    _node("don-quijote", "Don Quijote Mega", "shop", "Tokyo", "Kanto", "First Tokyo", "Shopping",
          "Buzz", "Medium", "Walk", "Tokyo Local",
          "Medium", 8000, "None", "Day 2", "Loud", "Any", 11.5,
          shop_type="Souvenir", essentialness="Skippable"),
    _node("shibuya", "Shibuya Crossing", "experience", "Tokyo", "Kanto", "First Tokyo", "City Icon",
          "Buzz", "High", "Rail", "Tokyo Local",
          "Free", 0, "None", "Day 2", "Iconic", "Any", 12.0,
          essentialness="Must Do", adventure_tier="Gentle"),
    _node("ichiran", "Ichiran Ramen Booth", "restaurant", "Tokyo", "Kanto", "First Tokyo", "Food",
          "Focus", "Soft", "Walk", "Tokyo Local",
          "Low", 1500, "Lunch", "Day 2", "Hungry", "Any", 13.0,
          cuisine="Ramen", essentialness="Flexible"),
    _node("teamlab", "teamLab Planets", "sight", "Tokyo", "Kanto", "First Tokyo", "Art",
          "Focus", "Medium", "Rail", "Tokyo Local",
          "High", 4800, "None", "Day 2", "Dreamlike", "Any", 14.5,
          essentialness="Must Do", adventure_tier="Gentle"),
    _node("akihabara", "Akihabara Night Stack", "sight", "Tokyo", "Kanto", "First Tokyo", "Pop Culture",
          "Buzz", "High", "Rail", "Tokyo Local",
          "Low", 2000, "None", "Day 2", "Nerdy", "Any", 19.0,
          essentialness="Flexible", adventure_tier="Gentle"),
    _node("bic-camera", "Bic Camera Akiba", "shop", "Tokyo", "Kanto", "First Tokyo", "Shopping",
          "Browse", "Medium", "Walk", "Tokyo Local",
          "High", 25000, "None", "Day 2", "Nerdy", "Any", 19.5,
          shop_type="Electronics", essentialness="Skippable"),
    _node("yakitori-omoide", "Omoide Yokocho Yakitori", "restaurant", "Tokyo", "Kanto", "First Tokyo", "Food",
          "Busy", "Medium", "Walk", "Tokyo Local",
          "Medium", 4500, "Dinner", "Day 2", "Nostalgic", "Any", 21.0,
          cuisine="Yakitori", essentialness="Flexible"),

    # Day 3-4 - Kanto trips
    _node("nikko", "Nikko Toshogu", "sight", "Nikko", "Kanto", "Kanto Trips", "Shrine Complex",
          "Long Day", "High", "Rail", "Nikko Limited Express",
          "Low", 1300, "Lunch", "Day 3", "Sacred", "Crisp", 11.0,
          essentialness="Flexible", adventure_tier="Moderate"),
    _node("kegon", "Kegon Falls", "sight", "Nikko", "Kanto", "Kanto Trips", "Waterfall",
          "Scenic", "Medium", "Bus", "Nikko Limited Express",
          "Low", 570, "None", "Day 3", "Wild", "Crisp", 14.0,
          essentialness="Weather Dependent", adventure_tier="Moderate"),
    _node("kamakura", "Great Buddha", "sight", "Kamakura", "Kanto", "Kanto Trips", "Temple",
          "Easy", "Medium", "Rail", "Yokosuka Line",
          "Low", 300, "Lunch", "Day 4", "Sacred", "Clear", 10.5,
          essentialness="Must Do", adventure_tier="Gentle"),
    _node("enoshima", "Enoshima Coast", "sight", "Enoshima", "Kanto", "Kanto Trips", "Coast",
          "Wander", "Medium", "Rail", "Enoden Line",
          "Free", 0, "Snack", "Day 4", "Breezy", "Clear", 14.0,
          essentialness="Flexible", adventure_tier="Gentle"),

    # Day 5 - Hakone
    _node("hyatt-hakone", "Hyatt Regency Hakone Resort", "hotel", "Hakone", "Kanto", "Mountain Reset", "Stay",
          "Slow", "Recover", "Walk", "Hakone Tozan Line",
          "Splurge", 38000, "Dinner", "Day 5", "Calm", "Any", 19.0,
          essentialness="Must Do"),
    _node("gora", "Gora Switchback", "experience", "Hakone", "Kanto", "Mountain Reset", "Mountain Ride",
          "Scenic", "Medium", "Rail", "Hakone Tozan Line",
          "Low", 980, "None", "Day 5", "Quirky", "Crisp", 11.0,
          essentialness="Flexible", adventure_tier="Moderate"),
    _node("owakudani", "Owakudani Valley", "experience", "Hakone", "Kanto", "Mountain Reset", "Volcanic View",
          "Scenic", "Medium", "Ropeway", "Hakone Ropeway",
          "Medium", 1500, "Snack", "Day 5", "Wild", "Crisp", 13.0,
          essentialness="Weather Dependent", adventure_tier="Moderate"),
    _node("lake-ashi", "Lake Ashi Pirate Boat", "experience", "Hakone", "Kanto", "Mountain Reset", "Water View",
          "Scenic", "Soft", "Boat", "Hakone Pleasure Boat",
          "Low", 1200, "None", "Day 5", "Calm", "Clear", 15.5,
          essentialness="Weather Dependent", adventure_tier="Gentle"),
    _node("kaiseki-hakone", "Hakone Kaiseki Dinner", "restaurant", "Hakone", "Kanto", "Mountain Reset", "Food",
          "Slow", "Soft", "Walk", "Hakone Tozan Line",
          "Splurge", 28000, "Dinner", "Day 5", "Polished", "Any", 19.5,
          cuisine="Kaiseki", essentialness="Flexible"),

    # Day 6 - Fuji
    _node("fuji", "Fuji Viewpoint", "experience", "Fujikawaguchiko", "Chubu", "Fuji Arc", "Mountain View",
          "Scenic", "Medium", "Bus", "Fuji Excursion",
          "Free", 0, "Lunch", "Day 6", "Iconic", "Crisp", 9.0,
          essentialness="Must Do", adventure_tier="Moderate"),
    _node("kawaguchiko", "Kawaguchiko Lake Loop", "experience", "Fujikawaguchiko", "Chubu", "Fuji Arc", "Lake View",
          "Scenic", "Soft", "Bus", "Fuji Excursion",
          "Free", 0, "Snack", "Day 6", "Calm", "Clear", 12.0,
          essentialness="Weather Dependent", adventure_tier="Gentle"),

    # Day 7-8 - Alps + Hokuriku
    _node("matsumoto", "Matsumoto Castle", "sight", "Matsumoto", "Chubu", "Alps Pivot", "Castle",
          "Focus", "Medium", "Rail", "Azusa Limited Express",
          "Low", 700, "Lunch", "Day 7", "Stoic", "Crisp", 10.0,
          essentialness="Must Do", adventure_tier="Gentle"),
    _node("kamikochi", "Kamikochi Valley Walk", "experience", "Kamikochi", "Chubu", "Alps Pivot", "Mountain Ride",
          "Long Day", "High", "Bus", "Kamikochi Shuttle",
          "Medium", 5500, "Snack", "Day 7", "Wild", "Crisp", 13.0,
          essentialness="Weather Dependent", adventure_tier="Committed"),
    _node("takayama", "Takayama Old Town", "sight", "Takayama", "Chubu", "Alps Pivot", "Old Town",
          "Wander", "Medium", "Rail", "Hida Wide View",
          "Low", 500, "Dinner", "Day 7", "Nostalgic", "Crisp", 17.0,
          essentialness="Flexible", adventure_tier="Gentle"),
    _node("hida-beef", "Hida Beef Counter", "restaurant", "Takayama", "Chubu", "Alps Pivot", "Food",
          "Focus", "Medium", "Walk", "Hida Wide View",
          "High", 12000, "Dinner", "Day 7", "Hungry", "Any", 20.0,
          cuisine="Wagyu", essentialness="Flexible"),
    _node("shirakawa", "Shirakawa-go", "experience", "Shirakawa-go", "Chubu", "Alps Pivot", "Village",
          "Wander", "Medium", "Bus", "Nohi Bus",
          "Low", 600, "Lunch", "Day 8", "Nostalgic", "Snow", 10.5,
          essentialness="Must Do", adventure_tier="Moderate"),
    _node("marriott-kanazawa", "Marriott Kanazawa", "hotel", "Kanazawa", "Hokuriku", "Hokuriku Arc", "Stay",
          "Necessary", "Reset", "Rail", "Hokuriku Shinkansen",
          "High", 21000, "Dinner", "Day 8", "Polished", "Any", 22.0,
          essentialness="Must Do"),
    _node("kenrokuen", "Kenrokuen Garden", "sight", "Kanazawa", "Hokuriku", "Hokuriku Arc", "Garden",
          "Easy", "Soft", "Bus", "Kanazawa Loop Bus",
          "Low", 320, "None", "Day 9", "Calm", "Clear", 9.0,
          essentialness="Must Do", adventure_tier="Gentle"),
    _node("omicho", "Omicho Market", "restaurant", "Kanazawa", "Hokuriku", "Hokuriku Arc", "Food",
          "Busy", "Medium", "Walk", "Kanazawa Loop Bus",
          "Medium", 5500, "Lunch", "Day 9", "Hungry", "Any", 11.5,
          cuisine="Seafood", essentialness="Flexible"),
    _node("higashi", "Higashi Chaya Tea", "restaurant", "Kanazawa", "Hokuriku", "Hokuriku Arc", "Old Town",
          "Browse", "Soft", "Walk", "Kanazawa Loop Bus",
          "Medium", 3500, "Tea", "Day 9", "Nostalgic", "Clear", 15.0,
          cuisine="Tea", essentialness="Flexible"),
    _node("kanazawa-gold", "Kanazawa Gold Leaf Shop", "shop", "Kanazawa", "Hokuriku", "Hokuriku Arc", "Shopping",
          "Browse", "Soft", "Walk", "Kanazawa Loop Bus",
          "Medium", 6500, "None", "Day 9", "Quirky", "Any", 16.0,
          shop_type="Artisan", essentialness="Skippable"),

    # Day 10-13 - Kyoto core
    _node("kyoto-station", "Kyoto Station", "transit", "Kyoto", "Kansai", "Kyoto Core", "Transit Hub",
          "Necessary", "Reset", "Rail", "Shinkansen Tokaido",
          "Medium", 14000, "Dinner", "Day 10", "Liminal", "Any", 18.0,
          essentialness="Must Do", adventure_tier="Gentle"),
    _node("ritz-kyoto", "Ritz-Carlton Kyoto", "hotel", "Kyoto", "Kansai", "Kyoto Core", "Stay",
          "Slow", "Recover", "Walk", "Kyoto Local",
          "Splurge", 65000, "None", "Day 10", "Polished", "Any", 21.5,
          essentialness="Must Do"),
    _node("fushimi", "Fushimi Inari Torii", "sight", "Kyoto", "Kansai", "Kyoto Core", "Shrine Complex",
          "Long Day", "High", "Rail", "Nara Line",
          "Free", 0, "Snack", "Day 10", "Sacred", "Clear", 7.5,
          essentialness="Must Do", adventure_tier="Committed"),
    _node("gion", "Gion Evening Drift", "sight", "Kyoto", "Kansai", "Kyoto Core", "Old Town",
          "Browse", "Medium", "Walk", "Kyoto Local",
          "Free", 0, "Dinner", "Day 10", "Nostalgic", "Any", 20.0,
          essentialness="Must Do", adventure_tier="Gentle"),
    _node("kikunoi", "Kikunoi Kaiseki", "restaurant", "Kyoto", "Kansai", "Kyoto Core", "Food",
          "Focus", "Soft", "Walk", "Kyoto Local",
          "Splurge", 38000, "Dinner", "Day 10", "Polished", "Any", 19.5,
          cuisine="Kaiseki", essentialness="Flexible"),
    _node("kiyomizu", "Kiyomizu Terrace", "sight", "Kyoto", "Kansai", "Kyoto Core", "Temple",
          "Focus", "Medium", "Walk", "Kyoto Local",
          "Low", 400, "Lunch", "Day 11", "Sacred", "Clear", 10.0,
          essentialness="Must Do", adventure_tier="Gentle"),
    _node("nishiki", "Nishiki Market Crawl", "restaurant", "Kyoto", "Kansai", "Kyoto Core", "Food",
          "Busy", "Medium", "Walk", "Kyoto Local",
          "Medium", 3500, "Lunch", "Day 11", "Hungry", "Any", 12.5,
          cuisine="Street", essentialness="Flexible"),
    _node("arashiyama", "Arashiyama Bamboo Grove", "experience", "Kyoto", "Kansai", "Kyoto Core", "Forest",
          "Easy", "Soft", "Rail", "Sagano Line",
          "Free", 0, "Snack", "Day 12", "Dreamlike", "Mist", 8.5,
          essentialness="Must Do", adventure_tier="Gentle"),
    _node("kinkakuji", "Kinkakuji Golden Pavilion", "sight", "Kyoto", "Kansai", "Kyoto Core", "Temple",
          "Focus", "Medium", "Bus", "Kyoto City Bus",
          "Low", 500, "None", "Day 12", "Iconic", "Clear", 14.0,
          essentialness="Must Do", adventure_tier="Gentle"),
    _node("nijo", "Nijo Castle Floors", "sight", "Kyoto", "Kansai", "Kyoto Core", "Castle",
          "Focus", "Medium", "Walk", "Kyoto Local",
          "Low", 1300, "Lunch", "Day 13", "Stoic", "Any", 10.5,
          essentialness="Flexible", adventure_tier="Gentle"),
    _node("pontocho", "Pontocho Lanterns", "experience", "Kyoto", "Kansai", "Kyoto Core", "Night Walk",
          "Browse", "Medium", "Walk", "Kyoto Local",
          "Free", 0, "Dinner", "Day 13", "Polished", "Any", 20.5,
          essentialness="Flexible", adventure_tier="Gentle"),

    # Day 14-15 - Nara + Koyasan + Osaka
    _node("nara-park", "Nara Deer Park", "sight", "Nara", "Kansai", "Nara Loop", "Park",
          "Easy", "Medium", "Rail", "Nara Line",
          "Free", 0, "Snack", "Day 14", "Quirky", "Clear", 9.5,
          essentialness="Must Do", adventure_tier="Gentle"),
    _node("todaiji", "Todaiji Great Hall", "sight", "Nara", "Kansai", "Nara Loop", "Temple",
          "Focus", "Medium", "Walk", "Nara Line",
          "Low", 600, "Lunch", "Day 14", "Sacred", "Clear", 11.0,
          essentialness="Must Do", adventure_tier="Gentle"),
    _node("koyasan", "Koyasan Okunoin Lanterns", "sight", "Koyasan", "Kansai", "Koyasan Side", "Shrine Complex",
          "Long Day", "High", "Rail", "Nankai Koya Line",
          "Medium", 5000, "Dinner", "Day 15", "Mystic", "Mist", 11.0,
          essentialness="Flexible", adventure_tier="Committed"),
    _node("dotonbori", "Dotonbori Food Crawl", "restaurant", "Osaka", "Kansai", "Osaka Bite", "Food",
          "Buzz", "High", "Walk", "Midosuji Subway",
          "Medium", 6000, "Dinner", "Day 15", "Hungry", "Any", 20.0,
          cuisine="Street", essentialness="Must Do"),
    _node("shinsaibashi", "Shinsaibashi Arcade", "shop", "Osaka", "Kansai", "Osaka Bite", "Shopping",
          "Browse", "Medium", "Walk", "Midosuji Subway",
          "Medium", 9000, "None", "Day 15", "Loud", "Any", 18.0,
          shop_type="Fashion", essentialness="Skippable"),
    _node("hyatt-osaka", "Hyatt Regency Osaka", "hotel", "Osaka", "Kansai", "Osaka Bite", "Stay",
          "Necessary", "Reset", "Rail", "Midosuji Subway",
          "High", 19000, "None", "Day 15", "Polished", "Any", 22.5,
          essentialness="Must Do"),

    # Day 16-18 - West Japan
    _node("himeji", "Himeji White Heron", "sight", "Himeji", "Kansai", "West Run", "Castle",
          "Focus", "High", "Rail", "Shinkansen Sanyo",
          "Low", 1050, "Lunch", "Day 16", "Stoic", "Clear", 11.0,
          essentialness="Must Do", adventure_tier="Moderate"),
    _node("naoshima", "Naoshima Pumpkin", "sight", "Naoshima", "Shikoku", "Art Island", "Art",
          "Focus", "Medium", "Boat", "Naoshima Ferry",
          "Free", 0, "Snack", "Day 17", "Dreamlike", "Clear", 11.0,
          essentialness="Flexible", adventure_tier="Moderate"),
    _node("chichu", "Chichu Museum", "sight", "Naoshima", "Shikoku", "Art Island", "Art",
          "Focus", "Medium", "Walk", "Naoshima Ferry",
          "High", 2100, "None", "Day 17", "Dreamlike", "Clear", 14.5,
          essentialness="Flexible", adventure_tier="Moderate"),
    _node("hiroshima-pp", "Hiroshima Peace Park", "sight", "Hiroshima", "Chugoku", "Peace + Sea", "Memorial",
          "Focus", "Heavy", "Rail", "Shinkansen Sanyo",
          "Low", 200, "Lunch", "Day 18", "Solemn", "Any", 10.5,
          essentialness="Must Do", adventure_tier="Gentle"),
    _node("miyajima", "Miyajima Floating Torii", "experience", "Miyajima", "Chugoku", "Peace + Sea", "Shrine Complex",
          "Easy", "Soft", "Boat", "JR Miyajima Ferry",
          "Low", 300, "Dinner", "Day 18", "Sacred", "Clear", 17.5,
          essentialness="Must Do", adventure_tier="Moderate"),
    _node("okonomi", "Hiroshima Okonomimura", "restaurant", "Hiroshima", "Chugoku", "Peace + Sea", "Food",
          "Focus", "Medium", "Walk", "Hiroshima Streetcar",
          "Low", 1800, "Dinner", "Day 18", "Hungry", "Any", 19.5,
          cuisine="Okonomiyaki", essentialness="Flexible"),

    # Day 19-20 - Return to Tokyo + departure
    _node("tokyo-station", "Tokyo Station", "transit", "Tokyo", "Kanto", "Return Loop", "Transit Hub",
          "Necessary", "Reset", "Rail", "Shinkansen Tokaido",
          "Medium", 18000, "Lunch", "Day 19", "Liminal", "Any", 14.0,
          essentialness="Must Do", adventure_tier="Gentle"),
    _node("odaiba", "Odaiba Bay Loop", "experience", "Tokyo", "Kanto", "Return Loop", "Night Walk",
          "Browse", "Medium", "Rail", "Yurikamome Line",
          "Free", 0, "Dinner", "Day 19", "Polished", "Any", 18.5,
          essentialness="Skippable", adventure_tier="Gentle"),
    _node("tsutaya", "Daikanyama Tsutaya", "shop", "Tokyo", "Kanto", "Return Loop", "Shopping",
          "Browse", "Soft", "Walk", "Tokyo Local",
          "Medium", 4500, "Tea", "Day 20", "Calm", "Any", 10.0,
          shop_type="Books", essentialness="Skippable"),
    _node("haneda", "Haneda Departure", "transit", "Tokyo", "Kanto", "Depart", "Arrival",
          "Necessary", "Jetlag", "Rail", "Haneda Monorail",
          "Low", 700, "None", "Day 20", "Liminal", "Any", 14.0,
          essentialness="Must Do", adventure_tier="Gentle"),
]


# ---- Projections -----------------------------------------------------------

# Default attrs every node hover card shows when a projection doesn't override.
DEFAULT_HOVER_ATTRS = ["kind", "city", "day_band", "cost_yen"]

# Per-projection edge_label_from: which edge attribute drives label text.
# Fallback after the inline pipe label.
PROJECTION_EDGE_LABEL_FROM = {
    "threads": "transit_mode",
}

PROJECTIONS = [
    # (id, label, groups_from, caption, default_color_by_override, hover_attrs)
    # hover_attrs=None  -> inherit DEFAULT_HOVER_ATTRS
    # hover_attrs=[...] -> this projection's own list
    ("arc", "Trip Arc", "trip_stage",
     "The narrative skeleton. Read this first — the trip in 16 stages.",
     "day_num",
     ["day_band", "sun_hour", "essentialness", "city"]),
    ("geography", "Geography",
     ["region", "city"],
     "The map. Six regions broken into the cities you sleep in.",
     "region",
     ["city", "kind", "day_band", "essentialness"]),
    ("money", "Money Map",
     "spend_band",
     "Where the budget concentrates. The Splurges are usually one-shot experiences; the Free stops are filler.",
     "cost_yen",
     ["cost_yen", "spend_band", "kind", "meal_band"]),
    ("palate", "Palate",
     ["meal_band", "cuisine"],
     "Japan as a meal sequence. Kaiseki dinners are a different trip from ramen lunches.",
     "cost_yen",
     ["cuisine", "meal_band", "cost_yen", "city"]),
    ("shopping", "Shopping Haul",
     ["shop_type", "energy"],
     "Shopping experiences plotted against energy. Market crawls are cheap-but-tiring; department stores are expensive-but-restful.",
     "cost_yen",
     ["shop_type", "cost_yen", "energy", "city"]),
    ("adventures", "Adventures Promised",
     ["adventure_tier", "energy"],
     "What the trip physically asks of you, layered with energy demand. Pair this with cost before booking the Committed and Hardcore tier stops.",
     "cost_yen",
     ["adventure_tier", "energy", "essentialness", "weather"]),
    ("threads", "Journey Threads",
     "transit_segment",
     "The trip as a sequence of transit threads. Each cluster is one named train, bus, or ferry route — the spine of how Japan stitches together.",
     "transit_mode",
     ["transit_segment", "city", "day_band", "kind"]),
]


# ---- Edges -----------------------------------------------------------------

ORDER = [n["id"] for n in NODES]


def itinerary_chain() -> list[str]:
    """One labeled hop per itinerary segment. Kind = target's transit_mode (lowercased).
    This gives every itinerary edge a kind so edge_kinds defaults kick in."""
    out = []
    by_id = {n["id"]: n for n in NODES}
    for a, b in zip(ORDER, ORDER[1:]):
        target = by_id.get(b, {})
        kind = str(target.get("transit_mode") or "").strip().lower() or "walk"
        out.append(f"{a} ->|{kind}| {b}")
    return out


def grouped_edges(attr: str, label: str | None = None) -> list[str]:
    buckets: dict[str, list[str]] = {}
    for n in NODES:
        value = str(n.get(attr) or "").strip()
        if not value:
            continue
        buckets.setdefault(value, []).append(n["id"])
    out = []
    for value, ids in buckets.items():
        if len(ids) < 2:
            continue
        if label:
            for a, b in zip(ids, ids[1:]):
                out.append(f"{a} ->|{label}| {b}")
        else:
            out.append(" -> ".join(ids))
    return out


def themed_jumps() -> list[str]:
    return [
        # Shinkansen + long-haul rail
        "tokyo-station ->|shinkansen| kyoto-station",
        "kyoto-station ->|shinkansen| himeji",
        "himeji ->|shinkansen| hiroshima-pp",
        "marriott-kanazawa ->|thunderbird| kyoto-station",
        # Rain pivots
        "fuji ->|rain pivot| kawaguchiko",
        "arashiyama ->|rain pivot| kinkakuji",
        "owakudani ->|rain pivot| lake-ashi",
        "kamikochi ->|rain pivot| takayama",
        # Food crawls
        "tsukiji ->|food crawl| nishiki",
        "nishiki ->|food crawl| dotonbori",
        "dotonbori ->|food crawl| okonomi",
        "omicho ->|food crawl| hida-beef",
        # Hotel anchors - stops orbit their hotel
        "hilton-shinjuku ->|home base| ueno",
        "hilton-shinjuku ->|home base| asakusa",
        "hilton-shinjuku ->|home base| meiji",
        "hilton-shinjuku ->|home base| shibuya",
        "hyatt-hakone ->|home base| owakudani",
        "hyatt-hakone ->|home base| lake-ashi",
        "marriott-kanazawa ->|home base| kenrokuen",
        "marriott-kanazawa ->|home base| omicho",
        "ritz-kyoto ->|home base| fushimi",
        "ritz-kyoto ->|home base| arashiyama",
        "ritz-kyoto ->|home base| kinkakuji",
        "hyatt-osaka ->|home base| dotonbori",
        "hyatt-osaka ->|home base| shinsaibashi",
        # Sacred arc
        "asakusa ->|sacred arc| meiji",
        "meiji ->|sacred arc| fushimi",
        "fushimi ->|sacred arc| koyasan",
        "koyasan ->|sacred arc| miyajima",
        # Art arc
        "teamlab ->|art arc| naoshima",
        "naoshima ->|art arc| chichu",
        # Castle line
        "matsumoto ->|castle line| nijo",
        "nijo ->|castle line| himeji",
        # Splurges chain - "the expensive ones"
        "sukiyabashi ->|splurge| kaiseki-hakone",
        "kaiseki-hakone ->|splurge| kikunoi",
        "kikunoi ->|splurge| ritz-kyoto",
    ]


# ---- Emission --------------------------------------------------------------

SKIP_NODE_FIELDS = {"transit_mode"}


def stop_lines() -> list[str]:
    lines = []
    for n in NODES:
        day_num = _day_index(n["day_band"]) + 1
        trip_hour = (_day_index(n["day_band"]) * 24) + n["sun_hour"]
        parts = [f"{n['id']} :: {n['label']}"]
        for field in FIELDS[2:]:  # skip id/label
            if field in SKIP_NODE_FIELDS:
                continue
            value = n.get(field)
            if value is None or value == "":
                continue
            parts.append(f"{field}: {value}")
        parts.append(f"day_num: {day_num}")
        parts.append(f"trip_hour: {trip_hour}")
        lines.append("- " + " | ".join(parts))
    return lines


def _day_index(day_band: str) -> int:
    try:
        return int(day_band.split()[-1]) - 1
    except (ValueError, IndexError):
        return 0


def build_block() -> str:
    proj_chunks = []
    for pid, plabel, gf, caption, color_override, hover_attrs in PROJECTIONS:
        if isinstance(gf, list):
            gf_block = "    groups_from: [" + ", ".join(gf) + "]"
        else:
            gf_block = f"    groups_from: {gf}"
        block = f"  - id: {pid}\n    label: \"{plabel}\"\n{gf_block}"
        block += f"\n    caption: \"{caption}\""
        if color_override:
            block += f"\n    default_color_by: {color_override}"
        if hover_attrs is not None:
            block += "\n    hover_attrs: [" + ", ".join(hover_attrs) + "]"
        edge_label_override = PROJECTION_EDGE_LABEL_FROM.get(pid)
        if edge_label_override:
            block += f"\n    edge_label_from: {edge_label_override}"
        proj_chunks.append(block)
    proj_lines = "\n".join(proj_chunks)

    default_hover_line = "hover_attrs: [" + ", ".join(DEFAULT_HOVER_ATTRS) + "]"

    header = dedent(
        f"""\
        ---
        title: "Japan Grand Loop"
        default_open_depth: -1
        width: 95vw
        color_palette_source: graph-projection-palettes.json
        default_color_by: day_num
        edge_color_by: kind
        edge_label_from: narrative
        {default_hover_line}
        view_projections:
        """
    )
    tail = dedent(
        """\

        default_projection: arc
        reveal_on: { search_hit: nearest-group, backlink_jump: owning-group, itinerary_jump: owning-group }
        aggregate_edges: { when_collapsed: true, by: relation }
        ---
        """
    )

    edges: list[str] = []
    edges += itinerary_chain()
    edges += themed_jumps()

    return (
        header
        + proj_lines
        + tail
        + "\n".join(stop_lines())
        + "\n"
        + "\n".join(edges)
        + "\n"
    )


def main() -> None:
    block = build_block()
    text = TARGET.read_text()
    start = text.index("```items\n") + len("```items\n")
    end = text.index("```", start)
    new_text = text[:start] + block + text[end:]
    TARGET.write_text(new_text)
    print(f"Wrote {TARGET} ({len(NODES)} nodes, {block.count(chr(10))} block lines)")


if __name__ == "__main__":
    main()
