# Orçaly — Product Skins

The existing `lib/orcaly-next/skins.ts` remains the source for product-level accent, density, radius, motion and composition personality. This frontend architecture consumes it rather than forking a stylesheet per product.

| Product | Accent | Density | Radius | Visual intent |
| --- | --- | --- | --- | --- |
| Business | #164bc4 | compact | crisp | operational/executive |
| Wealth | #146447 | spacious | soft | calm/financial |
| Growth | #a44322 | comfortable | soft | experimental/evidence |
| Flow | #6245b0 | comfortable | crisp | technical/canvas |
| Academy | #865914 | spacious | soft | editorial |
| Market | #176572 | comfortable | soft | discovery/solution |
| Partners | #364996 | comfortable | crisp | commercial/pipeline |
| One | #24394c | spacious | soft | premium bundle |

Hub uses the neutral master surface and product accents only where product identity is useful.

## Rules

A skin may change:
- accent;
- density;
- display weight/tracking;
- radius personality;
- motion personality;
- chart emphasis;
- layout composition/signature pattern.

A skin may **not** fork:
- accessibility rules;
- target sizes;
- semantic state meaning;
- focus behavior;
- responsive breakpoints;
- permission/entitlement truth;
- dark-mode contrast contract.

## Product signatures

Business: operating brief, queue, timeline.  
Wealth: explainable blocks, briefing, calm financial overview.  
Growth: hypothesis, experiment comparison, learning log.  
Academy: reader, library, notes.  
Flow: graph, node relationships, command-first tools.  
Market: problem search and comparison.  
Partners: pipeline and commission status.  
One: bundle/access presentation, never an operational app.

No new logo is invented by this system.
