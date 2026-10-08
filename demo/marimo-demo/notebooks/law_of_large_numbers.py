# /// script
# requires-python = ">=3.10,<3.15"
# dependencies = ["marimo", "altair", "marimo-studio==0.2.3"]
#
# [tool.marimo-studio]
# default = "lln"
#
# [tool.marimo-studio.cells]
# ///
import marimo

__generated_with = "0.25.0"
app = marimo.App()


@app.cell
def imports():
    import math, random
    import altair as alt
    import marimo as mo

    def running_means(samples):
        """
        >>> running_means([1, 0, 1, 0])
        [1.0, 0.5, 0.6666666666666666, 0.5]
        """
        total, means = 0.0, []
        for count, value in enumerate(samples, start=1):
            total += value
            means.append(total / count)
        return means

    def page_chart(chart, height=240):
        """Transparent background and neutral axes, so the chart sits on the document page in light or dark mode."""
        muted = "#8888"
        return (chart.properties(width="container", height=height)
                .configure(background="transparent")
                .configure_view(stroke=None)
                .configure_axis(gridColor="#8883", domainColor=muted, tickColor=muted, labelColor="#888", titleColor="#888")
                .configure_legend(labelColor="#888"))

    def thinned(values, limit=400):
        """Keep at most `limit` (step, value) points so the chart stays small.

        >>> thinned([5, 6, 7, 8], limit=2)
        [{'step': 1, 'value': 5}, {'step': 3, 'value': 7}]
        """
        stride = max(1, len(values) // limit)
        return [{"step": i + 1, "value": v} for i, v in enumerate(values) if i % stride == 0]
    return alt, math, mo, page_chart, random, running_means, thinned


@app.cell
def seed_state(mo):
    get_seed, set_seed = mo.state(7, allow_self_loops=True)
    return get_seed, set_seed


@app.cell
def flip_controls(get_seed, mo, random, set_seed):
    flips = mo.ui.slider(10, 5000, step=10, value=500, label="Coin flips", show_value=True, full_width=True)
    seed_field = mo.ui.number(start=0, stop=9999, step=1, value=get_seed(), label="Seed",
                              on_change=lambda value: set_seed(int(value or 0)))
    seed_shuffle = mo.ui.button(label="🔀", tooltip="Flip a new sequence",
                                on_click=lambda _: set_seed(random.randint(0, 9999)))
    mo.vstack([flips, mo.hstack([seed_field, seed_shuffle], justify="start", align="end")])
    return flips, seed_field, seed_shuffle


@app.cell
def flip_chart(alt, flips, get_seed, mo, page_chart, random, running_means, thinned):
    _rng = random.Random(get_seed())
    _means = running_means(_rng.randint(0, 1) for _ in range(flips.value))
    _line = alt.Chart(alt.Data(values=thinned(_means))).mark_line().encode(
        x=alt.X("step:Q", title="Flips"), y=alt.Y("value:Q", title="Share of heads", scale=alt.Scale(domain=[0, 1])))
    _target = alt.Chart(alt.Data(values=[{"value": 0.5}])).mark_rule(strokeDash=[4, 4]).encode(y="value:Q")
    mo.vstack([
        mo.md(f"After **{flips.value:,}** flips with seed **{get_seed()}**, the share of heads is "
              f"**{_means[-1]:.3f}**, which is **{abs(_means[-1] - 0.5):.3f}** from 0.5."),
        page_chart(_line + _target),
    ])
    return


@app.cell
def error_controls(mo):
    trials = mo.ui.slider(10, 300, step=10, value=100, label="Repeated experiments per size", show_value=True, full_width=True)
    trials
    return (trials,)


@app.cell
def error_chart(alt, math, mo, page_chart, random, trials):
    _rows = []
    for _n in (10, 30, 100, 300, 1000, 3000):
        _rng = random.Random(_n)
        _gap = sum(abs(sum(_rng.randint(0, 1) for _ in range(_n)) / _n - 0.5) for _ in range(trials.value)) / trials.value
        _rows.append({"flips": _n, "gap": round(_gap, 4), "source": "Measured"})
        _rows.append({"flips": _n, "gap": round(0.5 * math.sqrt(2 / (math.pi * _n)), 4), "source": "0.5 × √(2 / πn)"})
    mo.vstack([
        page_chart(alt.Chart(alt.Data(values=_rows)).mark_line(point=True).encode(
            x=alt.X("flips:Q", scale=alt.Scale(type="log"), title="Flips"),
            y=alt.Y("gap:Q", scale=alt.Scale(type="log"), title="Mean distance from 0.5"),
            color=alt.Color("source:N", title=None),
        )),
        mo.ui.table([r for r in _rows if r["source"] == "Measured"], selection=None, label="Measured gap"),
    ])
    return


@app.cell
def dist_controls(mo):
    distribution = mo.ui.dropdown(["Uniform(0, 1)", "Exponential(1)", "Normal(0, 1)", "Cauchy"],
                                  value="Uniform(0, 1)", label="Distribution")
    samples = mo.ui.slider(100, 20000, step=100, value=5000, label="Samples", show_value=True, full_width=True)
    mo.vstack([distribution, samples])
    return distribution, samples


@app.cell
def dist_chart(alt, distribution, math, mo, page_chart, random, running_means, samples, thinned):
    _rng = random.Random(42)
    _draw = {
        "Uniform(0, 1)": (_rng.random, 0.5),
        "Exponential(1)": (lambda: _rng.expovariate(1), 1.0),
        "Normal(0, 1)": (lambda: _rng.gauss(0, 1), 0.0),
        "Cauchy": (lambda: math.tan(math.pi * (_rng.random() - 0.5)), None),
    }[distribution.value]
    _means = running_means(_draw[0]() for _ in range(samples.value))
    _note = f"True mean: **{_draw[1]}**." if _draw[1] is not None else "Cauchy has **no mean**, so the running mean never settles."
    mo.vstack([
        mo.md(_note),
        page_chart(alt.Chart(alt.Data(values=thinned(_means))).mark_line().encode(
            x=alt.X("step:Q", title="Samples"), y=alt.Y("value:Q", title="Running mean"),
        )),
    ])
    return


if __name__ == "__main__":
    app.run()
