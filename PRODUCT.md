# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
TinkerHub community members and students who need electronic components for a project. They use the client side on their phones, on campus, often between other things. They have no account: each device signs in anonymously, and the phone number is the lookup key for their TinkerHub project. A separate staff side (inventory managers) reviews and issues requests; it is out of scope for client-side work.

## Product Purpose
TinkerSpace Components Inventory lets members request parts from the lab's stock, get them reviewed, and collect them in person. Success is a student who submits a request in a few minutes and knows exactly what to do next, and an inventory manager who can verify and issue it quickly.

## Positioning
A request is tied to a verified TinkerHub project (proved by a screenshot of the project page on the TinkerHub app) and to live stock, so parts go to real projects and availability is never overpromised.

## Operating Context
Four-step request: choose project path (registered or new), details plus screenshot proof, pick components, review and submit. After approval the student shows their request code/QR to the inventory manager in person to receive the parts, and returns them when finished. Approvals expire if not issued in time; rejected requests can be resubmitted with a prefilled draft.

## Capabilities and Constraints
- Anonymous auth with Turnstile; no client accounts. Draft persists locally.
- Max 50 component lines per request; quantities clamp to available stock.
- Screenshots are deleted after review.
- Status page polls every 10s and has a shareable public-token link.
- Undecided: exact pickup location and hours (not yet confirmed).

## Brand Commitments
Product name shown to users: **TinkerSpace Components Inventory**. Part of the TinkerHub community. Existing accent is green (`--accent` in `src/index.css`); no logo asset exists yet.

## Evidence on Hand
No logo, component photography, or testimonials exist. Do not fabricate them. Example screenshot guide is in `public/guide`.

## Product Principles
- The student always knows the next physical step.
- Prove less, explain more: every required input says why it is needed.
- Phone-first, one decision per screen.
- Honest availability: never promise stock that is not there.
- Plain language over system terms.

## Accessibility & Inclusion
Phones on campus, possibly slow connections and bright light; keyboard and screen-reader operable core flow; touch targets at least 44px.
