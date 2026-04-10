"""
Competitive Pokemon: damage roll simulation.

Demonstrates the 16-value damage range that makes
every KO threshold a probabilistic, not deterministic, fact.
"""

import random
from collections import Counter


def damage(base_power: int, attack: int, defense: int, level: int = 50) -> int:
    """Apply the core damage formula with a random roll in [85, 100]."""
    roll = random.randint(85, 100)
    raw = ((2 * level // 5 + 2) * base_power * attack // defense) // 50 + 2
    return int(raw * roll / 100)


def roll_distribution(base_power: int, attack: int, defense: int,
                      trials: int = 100_000) -> dict[int, float]:
    counts: Counter[int] = Counter(
        damage(base_power, attack, defense) for _ in range(trials)
    )
    total = sum(counts.values())
    return {v: round(c / total * 100, 2) for v, c in sorted(counts.items())}


def ko_probability(base_power: int, attack: int, defense: int,
                   target_hp: int, trials: int = 100_000) -> float:
    """P(one-hit KO) for given target_hp."""
    kos = sum(
        1 for _ in range(trials)
        if damage(base_power, attack, defense) >= target_hp
    )
    return round(kos / trials * 100, 2)


if __name__ == "__main__":
    print("=== Damage roll distribution: Earthquake (base 100) ===")
    print("Attacker ATK=150 vs Defender DEF=100 @ Level 50\n")

    dist = roll_distribution(100, 150, 100)
    min_dmg = min(dist)
    max_dmg = max(dist)

    for val, pct in dist.items():
        bar = "#" * int(pct * 2)
        label = " ← min" if val == min_dmg else (" ← max" if val == max_dmg else "")
        print(f"  {val:3d} dmg  {pct:5.2f}%  {bar}{label}")

    print()
    example_hp = (min_dmg + max_dmg) // 2 + 1
    p = ko_probability(100, 150, 100, example_hp)
    print(f"P(KO) against {example_hp} HP: {p}%")
    print(f"  (This is why 'just over half' feels safe but isn't.)")
