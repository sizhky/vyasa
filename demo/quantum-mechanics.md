# Quantum Mechanics Learning Path

A beginner's guide to tackling quantum mechanics and computational algorithms. This tech tree shows dependencies: master the foundation level first, then move to intermediate topics, and finally advance to specialized computational methods.

```items
---
title: Quantum Mechanics Learning Dependency Graph
default_open_depth: 1
color_by:
  phase:
    Foundation: "#93c5fd"
    Intermediate: "#86efac"
    Advanced: "#fcd34d"
    Computational: "#f87171"
---
Foundation Mathematics:
  - lin-alg :: Linear Algebra & Vector Spaces | phase: Foundation
  - complex :: Complex Numbers & Functions | phase: Foundation
  - calc :: Calculus (Single & Multivariable) | phase: Foundation
  - ode :: Differential Equations | phase: Foundation
  - linear-ops :: Linear Operators & Eigenvalues | phase: Foundation
Classical Mechanics Foundations:
  - newton :: Newton's Laws & Dynamics | phase: Foundation
  - lagrange :: Lagrangian & Hamiltonian Formalism | phase: Foundation
  - oscillators :: Classical Oscillators & Waves | phase: Foundation
Core Quantum Concepts:
  - postulates :: Quantum Postulates & Measurement | phase: Intermediate
  - wavefunc :: Wavefunctions & Born Rule | phase: Intermediate
  - operators :: Operators & Observables | phase: Intermediate
  - schrodinger :: Time-Dependent Schrödinger Equation | phase: Intermediate
  - potential :: Solutions: Potential Wells & Barriers | phase: Intermediate
  - hydrogen :: Hydrogen Atom Solutions | phase: Intermediate
Advanced Quantum Topics:
  - angular :: Angular Momentum & Spin | phase: Advanced
  - perturbation :: Perturbation Theory | phase: Advanced
  - wkb :: WKB Approximation | phase: Advanced
  - adiabatic :: Adiabatic Theorem | phase: Advanced
  - qm-scattering :: Scattering Theory | phase: Advanced
  - qm-identical :: Identical Particles & Statistics | phase: Advanced
Computational Methods I (Basics):
  - fft :: Fast Fourier Transform (FFT) | phase: Computational
  - integration :: Numerical Integration Methods | phase: Computational
  - ode-solve :: ODE Solvers (RK4, DOP5) | phase: Computational
  - root-find :: Root Finding Methods | phase: Computational
Computational Methods II (Intermediate):
  - matrix-diag :: Matrix Diagonalization | phase: Computational
  - variational :: Variational Principle & VQE | phase: Computational
  - finite-diff :: Finite Difference Methods | phase: Computational
  - spectral :: Spectral Methods | phase: Computational
Computational Methods III (Advanced):
  - monte-carlo :: Quantum Monte Carlo | phase: Computational
  - md-simulation :: Molecular Dynamics Simulations | phase: Computational
  - quantum-prop :: Quantum Propagators & Time Evolution | phase: Computational
  - density-functional :: Density Functional Theory (DFT) | phase: Computational

lin-alg ->|foundation for quantum spaces| postulates
complex ->|essential for wave equations| schrodinger
calc ->|required for derivatives| ode
ode ->|basis for QM equations| schrodinger
linear-ops ->|needed for observables| operators
newton ->|classical intuition| lagrange
lagrange ->|connects to Hamilton formalism| postulates
oscillators ->|classical examples for QM| potential

postulates ->|defines measurement framework| wavefunc
wavefunc ->|solved by operators| operators
operators ->|act on wavefunctions| schrodinger
schrodinger ->|governs time evolution| potential
potential ->|1D examples before H-atom| hydrogen
hydrogen ->|foundational atomic solution| angular

angular ->|needed for spin systems| qm-identical
perturbation ->|improves exact solutions| qm-scattering
wkb ->|approximates barrier penetration| perturbation
adiabatic ->|describes slow processes| perturbation
qm-scattering ->|uses partial waves| angular
qm-identical ->|fermi and bose statistics| adiabatic

integration ->|solve differential equations| ode-solve
fft ->|efficient Fourier analysis| spectral
ode-solve ->|integrate Schrödinger| quantum-prop
root-find ->|find energy eigenvalues| matrix-diag
matrix-diag ->|find eigenstates numerically| variational

finite-diff ->|discretize wavefunctions| variational
spectral ->|high accuracy methods| finite-diff
variational ->|VQE for quantum circuits| monte-carlo
quantum-prop ->|time-evolve initial states| quantum-prop

monte-carlo ->|sample quantum distributions| md-simulation
md-simulation ->|classical plus quantum effects| monte-carlo
density-functional ->|modern computational workhorse| spectral
```

## How to Use This Learning Path

1. **Start with Foundation Mathematics & Classical Mechanics** (blue boxes)
   - You need linear algebra, complex numbers, and calculus before touching quantum mechanics
   - Review Lagrangian/Hamiltonian mechanics to see the classical parent of QM

2. **Move to Core Quantum Concepts** (green boxes)
   - Once foundations are solid, learn the postulates and wavefunctions
   - Solve simple systems like potential wells and the hydrogen atom
   - These are your building blocks

3. **Advance to Specialized Topics** (yellow boxes)
   - Angular momentum, scattering, and identical particles extend your toolkit
   - Perturbation theory and approximations handle more complex systems
   - Build on core concepts as you tackle each

4. **Learn Computational Methods in Parallel** (red boxes)
   - **Basics**: FFT, ODE solvers, numerical integration—use these to simulate solutions
   - **Intermediate**: Matrix diagonalization and variational methods—compute ground states and energies
   - **Advanced**: Monte Carlo, molecular dynamics, and DFT—tackle realistic systems

## Notes

- **Edges show dependencies**: Topic A → B means you should understand A before tackling B
- **Color modes**: Click the color-by dropdown to view by `phase` (foundation/intermediate/advanced/computational)
- **Drag cards**: Rearrange the graph for your own learning sequence
- **Zoom & Pan**: Use mouse wheel to zoom; click and drag to pan around
- **Fit to View**: Press **F** to fit the entire graph, **U** to expand all groups, **Shift+U** to collapse

Happy learning! 🚀
