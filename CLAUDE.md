# Notes for Claude

## Git branches

- Give every working branch a short, descriptive kebab-case name that says what the change does
  (e.g. `full-height-table-column-filters`), not a random or auto-generated name like
  `claude/trusting-brahmagupta-v4ieem`. If a session starts on such a branch, rename it
  before pushing (and delete the old remote branch).

## Filling or checking motor data

The owner wants every field filled with what the maker publishes, found without being prompted.
Each rule below exists because it was missed once and the owner had to point it out.
Data rules and formats are in `.github/CONTRIBUTING.md`; this section is about *finding* the data.

### Read the whole product page, not just the spec list

- Read the title, the tag/subtitle line under it, the KV/variant selector, the description, the
  spec list, **the packing list**, FAQs and changelog notes. iFlight's Defender 25 says "1404" only
  in its tag line and packing list ("1 x Defender 25 1404 Motor"); the spec list never mentions it.
- Open **every image** on the page and in the description: spec sheets, outline drawings, test
  reports, exploded views and feature graphics. Many makers (EMAX, iFlight, BrotherHobby,
  RCinPower, T-Motor/T-HOBBY, MAD, BETAFPV) publish their full specs *only* as images. OCR them,
  then look at the drawings yourself: mount pattern and screw count, shaft diameter, lead length.
  The EMAX RS2306 White Edition entry had only a name and KV, though its description images carry
  a complete spec sheet and drawing.
- When there are several sources, prefer the model-specific spec sheet or drawing, then the
  maker's page text, then retailers. A different version (V2 vs V3, 2207 vs 2207.5) or a sibling
  model is not a source.

### Fill visual fields from the photos

- Look at every gallery photo, not just the main one: scale photos, bottom views, package contents.
  - **Shaft retention:** screw head on the shaft end → `Screw`; C-clip or E-clip → `Clip`. BETAFPV Snow 2306 was left blank although the photo clearly shows the screw.
  - **Connector:** bare tinned lead ends → `none`; otherwise name the plug. Snow 2306's scale photo shows bare ends; "not published" was wrong.
  - **Base type:** open spokes showing the windings → `Naked Bottom`; solid plate → `Closed Bottom`.
  - **Bell type:** one-piece → `Unibell`; separate cap or ring → `Assembled Bell`.
  - **Shaft type:** visible bore → `Hollow`; solid end face → `Solid`.
  - **Flux direction:** radial unless it's visibly an axial-flux motor.
- `"not published"` on a visual field is only right when no photo of the exact motor shows the detail.

### Parse values exactly

- Never truncate a number. "Mounting Holes: 3*3 φ1.4mm" plus "M1.4 screws" in the packing list
  means a thread of `M1.4`, not `M1`. Cross-check threads, patterns and screw counts against the
  drawing and the packing list.
- Prices are the regular (crossed-out / compare-at) price for one motor, not a sale price, and
  divided by the pack size. Variants often have different prices, so set prices per KV when they
  differ. If the owner gives a price, keep it.
- Only non-USD prices available: convert to USD with that day's ECB reference rate and say so.
- Requests from this environment count as US visitors. Some Shopify stores charge Americans
  more: EMAX's US market is about 1.54× its international price, FlyFishRC's about 1.25×. Use the
  international-market price the owner sees. Fetch `/products/<handle>.js` with
  `-b localization=DE` and `-b localization=US`; if the store keeps USD for DE but the prices
  differ, use the DE price (the displayed one; that market shows no crossed-out price). Stores
  that switch to local currency abroad keep their US USD price. EMAX RSII 2207 is $23.99 for the
  owner but $36.94 in the US market.
- Check that the Image URL loads from another site. iFlight's CDN blocks hotlinking, so its images
  look missing on the website. Test with
  `curl -A 'Mozilla/5.0' -H 'Referer: https://marc-frank.github.io/' -o /dev/null -w '%{http_code} %{content_type}' URL`
  and use a copy that loads, e.g. iflight-rc.eu or a retailer.

### Never blank or skip published data

- Take what the maker publishes, even if it looks odd (a resistance identical to a sibling model,
  an unusual thread). Don't blank values as "suspected copies"; mention doubts in the summary instead.
- Don't leave a field blank because the format is awkward. A rectangular mount pattern is written
  `"16.0, 19.0"`; two hole sets are written `"25.0, 30.0"` with `"4, 4"` and `"M3, M4"`.
- Allowed derivations:
  - Stator size from FPV model numbers (2207.5 → 22.0 / 7.5).
  - Bearing dimensions from bearing codes (684 → 9 × 4 × 4).
  - Inner shaft diameter from the bearing bore.
  - Weight with cable = motor weight + published wire weight.
- Anything else stays empty until a source is found.
- If no source exists after checking all of the above, use `"not published"`.

### Keep links alive and the catalog current

- If a Link is dead, find the moved page (maker, sister brand such as CubeMars for T-Motor
  actuators, official store) and update it. Remove the motor only if no live page exists anywhere.
- Before starting, check open pull requests and issues (`gh api repos/marc-frank/motor-database/pulls`):
  they may already hold the data or request specific manufacturers.
- Recheck existing entries too, including ones filled before you started, not just empty ones.

### Sources beyond the maker's page

- Aggregators that cite maker spec sheets: dronemotors.la (full dump at
  `https://dronemotors.la/llms-full.txt`).
- Retailer listings of the exact product: getfpv, racedayquads, pyrodrone, rotorriot, wrekd,
  fpv24, rcdrone.top. Shopify stores expose `/products/<handle>.json` and
  `/search/suggest.json?q=…&resources[type]=product`.
- Maker manuals, catalog PDFs and spare-part pages: bearing sets often state the bearing size.
- Cloudflare- or JS-rendered sites (getfpv, t-hobby, mad-motor, brotherhobby) need a headless
  browser; plain curl gets a challenge page.

### Before reporting done

- Count blank cells per field (`""`, including Per-KV gaps) and say what's left and why.
- `scripts/motordb.py` has no writer. Serialize with
  `json.dumps(motor, indent=4, ensure_ascii=False) + "\n"` *before* opening the file, so a failure
  can't truncate it. Then run `python3 scripts/motordb.py validate`.
