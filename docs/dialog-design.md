# Dialog design

- Write dialog titles as short, clear statements or questions that describe their purpose. Use sentence case and specific actions or affected items; avoid vague titles such as “Warning” or “Are you sure?”. Titles and action labels should make the decision understandable together.
- Use the shared Sushi dialog host for focus management, Escape, pending state and errors. Use public component APIs and tokens.
- Centre dialogs. Use the compact width (28rem) for confirmations, validation and short choices, the form width (36rem) for editing, and 42rem for Settings with its Sushi navigation. Always respect the viewport.
- Keep the title, introductory text and bottom actions fixed; scroll only the middle content. Leave space for focus rings and use thin scrollbars near the right edge without moving the content towards them.
- Use consistent spacing, the shared dialog radius and border, and no shadow or glow. Keep labels above full-width controls.
- Put actions at the bottom right: neutral Cancel first, one primary action last. Destructive actions use the error colour and a specific verb. Avoid vague OK/Yes/No and unnecessary footers.
- Every labelled dialog action starts with a matching Lucide icon (1rem, aria-hidden): X for Cancel/Close, Save for saving, Plus for adding, Trash for removal, and RotateCcw for reset. Keep icon placement and spacing consistent; titles remain plain.
- Base Nodes categories and confirmation dialogs show levels as “number – model name”. Model levels keep their plain number column. Do not add level numbers to Refinement categories or Inspector source labels. Item counts remain soft badges.
- Settings and node colours may close on backdrop click because changes apply immediately. Keep confirmation and editing dialogs protected from backdrop dismissal, especially while an action is pending.
- Colours, appearance and shortcuts apply immediately. Provide contextual reset actions at the bottom right, without Save or Cancel. Give equally weighted colour actions the same soft neutral style.
- Confirmations explain the consequence and whether it is reversible, using shared confirmation content without an additional warning/info box. Do not add decorative icons to confirmations. Keep validation errors inline, accessible, and near their context.
- Show introductory guidance as calm, naturally wrapping text rather than decorative message boxes. Reserve message boxes for feedback. Group shortcuts under translated headings with Lucide icons and make scrolling apparent when content actually overflows.
- Edit within the existing dialog rather than opening nested dialogs. Translate all visible text into German and English.
- Use the node-colours dialog as the visual reference: a plain title without an icon or forced uppercase, calm introductory text, a thin bordered content area, and compact buttons at the bottom right. Editing forms use neutral text Cancel and primary Save; immediately applied settings use equally weighted soft actions.
- All dialogs share the same opening animation: gentle fade with 6px upward movement over 280ms, easing out; closing uses a short 180ms fade. Configure this centrally in the dialog host. Respect reduced motion and Nori’s animation preference.

Reference: [Material dialog guidelines](https://m1.material.io/components/dialogs.html).

## Open Sushi issue

- Dialogs lock their position when opened. Switching from a short property list to a taller editing form grows the dialog downwards rather than keeping it centred. Offer automatic recentering on content resize (while preserving deliberate dragging), or a public reposition method. Reproduce with Edit annotations → Add annotation type. Avoid compensating through private dialog styles or forced reopening.

- Sushi accordion focus outlines extend outside a clipped collapse container; the catalogue currently uses the public focus-offset token to draw them inside. Verify trigger and first/last item focus in expanded and collapsed states. Sushi should provide an inset focus option by default for clipped containers.
- Sushi tab panels currently rely on browser-default focus outlines without a panel focus token. Nori styles the public tabpanel role within Settings; Sushi should expose consistent panel focus tokens.
