# Dollar Escape

Plain math:

$E = mc^2$

Escaped dollars:

$5 should render as $5.

this is a $100 phone
this is a \$100 phone
this is a $100-$200 phone
this is a \$100-\$200 phone

`\\$` should render as \\\$.

\\\$ should render as \\\$.

Inline code should stay literal: `\$` and `\\$`.

Fenced code should stay literal:

```
$E = mc^2$
\$5
\\$
\\\$
```

More literal dollar cases:

$5 at start of sentence should stay literal.
Price in parens ($25) should stay literal.
Comma/period: $1,299.99 and $20.
Range with spaces: $100 - $200 should stay literal.
Range without spaces: $100-$200 should stay literal.
Path-ish text: cost/$100/file should keep literal $.

Mixed with math:

Math still works: $a^2 + b^2 = c^2$.
Currency and math same line: pay $20 and solve $x+1=2$.
Escaped currency near math: \$20 and $x=2$.

Escaped edge cases:

\$ at end of line should stay literal.
Double escaped then dollar: \\\$ should stay literal as \\\$.
Brackets and escaped: [price is \$30](#) should show $30.

Inline/fenced code edge cases:

Inline code: `$100`, `\$100`, `price=$100`, `x="$100"`.

```python
price = "$100"
escaped = "\\$100"
expr = "$x^2$"  # should remain literal in code
```

Multiline KaTeX blocks:

$$
f(x) = x^2 + 1
\quad\text{and}\quad
g(x) = \frac{1}{x+1}
$$

Currency around block math:

Price before block is $50 (literal), math block below should render:

$$
\int_0^1 x^2\,dx = \frac{1}{3}
$$

Escaped currency after block should stay literal: \$75.
