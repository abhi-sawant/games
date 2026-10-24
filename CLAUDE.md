# Games

Read README.md for the project layout and DESIGN.md before touching any UI.

- Every page uses the Riso design language in DESIGN.md. Shared tokens and components live in `src/base.css`; game stylesheets import it and add only their board's styles.
- Every game belongs to exactly one category (a section on the home page), and its ink always comes from that category, never from the game. A new game joins the category that fits it; if none fits, add a new category with its own ink first (see "Adding a new game" in DESIGN.md).
- A new game reuses the shared menu, top bar, tools, history and dialog components. Don't introduce new colours, fonts, borders or shadows per game.
