# Free Games

Read README.md for the project layout and DESIGN.md before touching any UI.

- Every page uses the Riso design language in DESIGN.md. Shared tokens and components live in `src/base.css`; game stylesheets import it and add only their board's styles.
- A new game follows "Adding a new game" in DESIGN.md: it takes a free ink (`--lilac`, then `--mint`) and reuses the shared menu, top bar, tools, history and dialog components. Don't introduce new colours, fonts, borders or shadows per game.
