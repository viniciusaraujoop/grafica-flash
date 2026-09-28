# Orçaly — Visual Language

Status: **architecture contract**. This document governs new Orçaly surfaces built on the isolated frontend namespace. It does not replace the current production runtime.

## 1. Intent

Orçaly should read as one product family without making every product visually identical. The shared language is carried by typography, spacing, alignment, surfaces, interaction, motion and accessibility. Product identity enters through accent, density, composition and signature patterns.

The hierarchy order is deliberate:

1. space;
2. typography;
3. alignment;
4. density;
5. hierarchy;
6. surface/color;
7. border or container only when the content needs a boundary.

A border is not a layout system. A card is not a section heading.

## 2. Family traits

- professional without corporate-template theater;
- contemporary without science-fiction UI;
- premium through restraint, not gradients or glass;
- dense where work is operational;
- editorial where reading is the task;
- mobile-first through recomposition, not desktop shrinkage;
- explicit about DEMO/SAMPLE data, unavailable states and uncertainty.

## 3. Anti-template rules

Avoid:
- repeated equal cards for unrelated information;
- border around every block;
- pills as default metadata;
- one radius everywhere;
- decorative icons on every title;
- shadows without elevation meaning;
- glassmorphism/backdrop blur;
- generic purple/blue gradients;
- center-aligned application screens;
- hover movement that changes layout;
- animation without state or spatial meaning.

Use:
- open sections separated by rhythm;
- typographic contrast;
- section dividers only where scanning benefits;
- data tables for operational density;
- lists for activity and timelines;
- figures for analytical relationships;
- semantic state surfaces for empty/error/offline/permission.

## 4. Product personalities

| Product | Character | Composition |
| --- | --- | --- |
| Hub | neutral, quiet | navigation-first |
| Business | operational, executive | queues, tables, status, fast actions |
| Wealth | calm, careful | explanation and period/source before action |
| Growth | energetic, evidence-driven | comparison and learning |
| Academy | editorial | reading and continuity |
| Flow | technical | canvas and command-first |
| Market | problem-solving | search and comparison |
| Partners | commercial, transparent | pipeline and commission state |
| One | premium bundle | access/pass, never operational dashboard |

## 5. Brand boundary

This architecture does **not** redraw logos or invent missing brand assets. Existing product accents remain the input. Product marks that do not exist stay text-based or use explicit placeholders until approved.

## 6. Content hierarchy

Page header answers: where am I, what can I do, what context is active?  
Section header answers: what is this group and why does it matter?  
State surfaces answer: what happened and what can I do next?

The global header never substitutes the page header. The global layer is ecosystem navigation; the page layer belongs to the current task.

## 7. Review questions

Before certifying a screen:
- Is the content structure understandable with borders removed?
- Would removing half the cards improve the page?
- Does the product identity come from composition instead of decoration?
- Is the main action obvious?
- Does mobile feel designed rather than compressed?
- Does every animation explain entry, exit, state, hierarchy or spatial continuity?
