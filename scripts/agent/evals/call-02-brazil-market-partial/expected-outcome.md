# Expected agent behaviour (this eval is about stopping correctly)

- `proposalType`: brazil-market (the Brazil product suite: non-resident account, PixInc payins, off-ramp).
- Rep: beatriz-lara-de-mello ("Bia").
- Dials: direction=collection, model=va-nra are supportable; `nra` must stay OPEN — the transcript explicitly defers whose account it runs through ("our team will confirm whether it runs through our own account or yours"). The agent must NOT answer `nra`, and the resolver will come back partial.
- Pricing: offramp "ten basis points above fifty million reais" = 0.10% on the "Above BRL 50M" tier — this EQUALS the floor (0.10) so it passes, BUT Bia did not commit ("I'll take that back — it's below our usual"), so there is NO quote-backed commitment. Expected: deck pricing untouched, the 0.10 request surfaced as a negotiation note / open question.
- Correct output: open questions to Diogo (nra dial + the off-ramp ask), NO link created.
