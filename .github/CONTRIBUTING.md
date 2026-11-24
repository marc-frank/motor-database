# How to Contribute

Thanks for helping! The database is a folder of plain JSON files, one per motor model. You can add or fix a motor straight from your browser on GitHub — no spreadsheets, no tools to install.

- [Fix or complete a motor](#fix-or-complete-a-motor)
- [Add a motor](#add-a-motor)
- [Request motors without editing](#request-motors-without-editing)
- [Working locally](#working-locally)
- [File format](#file-format)
- [Data rules](#data-rules)

## Fix or complete a motor

1. On the [website](https://marc-frank.github.io/motor-database/), click the motor and then **Edit on GitHub** in its details panel. This opens the motor's file in GitHub's editor.
2. Change or fill in the values (see [Data rules](#data-rules)). Leave anything you don't know as `""`.
3. Click **Commit changes…** and then **Propose changes**. GitHub forks the repository for you and opens a pull request.

A check runs on every pull request and tells you if something in the file is off (a typo in a field name, a missing comma, …).

## Add a motor

1. Search the website first to make sure the motor isn't listed yet. Different KV versions of a motor are **not** separate motors: they all go in one file.
2. Open the manufacturer's folder in [`motors/`](../motors). If the manufacturer is new, open `motors/` itself.
3. Click **Add file → Create new file** and name it after the motor, e.g. `F60_PRO_V.json` (for a new manufacturer: `New_Manufacturer/F60_PRO_V.json`). Use letters, numbers, `.`, `-` and `_`; replace spaces with `_`.
4. Paste in the contents of [`templates/motor.json`](../templates/motor.json) and replace the example values. Remove the `Per-KV Values` block if nothing differs between KV versions.
5. Commit and propose the change as above.

Adding a whole manufacturer at once? It's fine to put several motor files in one pull request.

## Request motors without editing

If you'd rather not edit files, [open an issue](https://github.com/marc-frank/motor-database/issues/new/choose) with links to the product pages and someone will add them.

## Working locally

If you have Git and Python 3 (no packages needed):

```bash
git clone https://github.com/<you>/motor-database.git
cd motor-database
python3 scripts/motordb.py validate   # check every file in motors/
python3 scripts/motordb.py build      # also write database.json/.csv and motors.html
python3 -m http.server                # preview at http://localhost:8000
```

For bulk changes across many motors, edit the JSON files directly or write a small script over `motors/*/*.json`, then run `validate` before committing.

`database.json`, `database.csv` and `motors.html` (a JavaScript-free table) are not part of the repository: they are generated from `motors/` every time the site is deployed from `main`, and published next to the website.

## File format

```
motors/
├── T-Motor/
│   ├── F60_PRO_V.json
│   └── P2207_V3.json
└── iFlight/
    └── XING2_2207.json
```

- **Folder:** the `Manufacturer` value with spaces and special characters replaced by `_`. The check tells you if a file is in the wrong folder.
- **File name:** the motor name in the same style. It only has to be unique and readable; the website uses the file's contents.
- **Fields:** every file has all the fields from [`motor.schema.json`](../motor.schema.json), in the order of the template. Unknown values are `""`. `Manufacturer` and `Link` are required.
- **All values are strings** (`"22.0"`, not `22.0`), except `KV (RPM/V)`.
- **`KV (RPM/V)`** lists every KV version the motor is sold in, e.g. `["1950", "2800"]`, or `[]` if unknown. The website shows one row per KV.
- **`Per-KV Values`** (optional) holds values that differ between KV versions, typically internal resistance, weight, price or a separate product link. Leave the shared field `""` when it is set per KV:

```json
"Internal Resistance (mΩ)": "",
...
"Per-KV Values": {
    "1950": { "Internal Resistance (mΩ)": "65.0" },
    "2400": { "Internal Resistance (mΩ)": "50.0" }
}
```

- **New fields** are added to `motor.schema.json` and to every motor file in the same pull request (please open an issue first to discuss).

## Data rules

Consistent values keep sorting and filtering on the website working.

### Numbers with a unit (mm, g, mΩ, …)

- Only digits and a `.` as decimal separator, with at least one decimal place. No unit, no `~`, `<` or `>`.
- If you aren't sure of a value, leave it `""` rather than estimating.
- `"not published"` means the field was looked for in the maker's pages, spec sheets, drawings, photos and retailer listings and isn't published anywhere. It's used for the rarely published fields (weight without cable, lamination thickness, base/bell/shaft material, winding type, enamel type, bearing dimensions). Replace it if you find a source.

| ❌ | ✅ |
| --- | --- |
| `22` | `22.0` |
| `7mm` | `7.0` |
| `~30` | `""` |

### Price

- In US dollars, two decimal places, digits and `.` only.
- If the motor is only sold in sets, divide by the number of motors in the set.

| ❌ | ✅ |
| --- | --- |
| `20,9` | `20.90` |
| `$20.99` | `20.99` |

### KV

- Whole numbers only, one list item per KV version.

| ❌ | ✅ |
| --- | --- |
| `"1550/1950/2550"` | `["1550", "1950", "2550"]` |
| `["1550 KV"]` | `["1550"]` |

### Counts

- Whole numbers, e.g. `Number of Mounting Screws`: `"4"`, not `"4.0"`.

### Link

- The manufacturer's product page for this motor (not a reseller), if there is one.

### Image

A direct link to an image from the manufacturer's product page:

- Ideally a single motor, with good contrast against the background.
- Wires and connector visible, and the included screws, if such a photo exists.
- Otherwise pick the photo that shows the motor from the most angles.
