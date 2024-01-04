## How to Contribute

Interested in contributing? Here's how you can help improve the Motor Database:

1. **Fork the Repository**: Clone the repository to your account.
2. **Verify Uniqueness**: Before adding a new motor to `database.json`, ensure it isn't already listed.
3. **Edit Entries**: If a motor is already in the list, you can directly edit existing fields.
4. **Create a Pull Request**: Once you've made your changes, submit a pull request.

### Parameters

When contributing, please provide as much information as possible for the following parameters:

```json
{
  "Image": "https://www.examplemanufacturer.com/em-2205-pro/image.png",
  "Manufacturer": "Example Motors Inc.",
  "Name": "EM-2205 Pro",
  "Price ($)": "25.99",
  "Stator Diameter (mm)": "22.0",
  "Stator Height (mm)": "5.0",
  "Stator Configuration": "12N14P",
  "Flux Direction": "Radial",
  "KV (RPM/V)": "1900",
  "Internal Resistance (m\u03a9)": "35.0",
  "Enamel Type": "Polyamide",
  "Efficiency (%)": "85.0",
  "Rated Torque (Nm)": "1.2",
  "Weight (incl. Cable) (g)": "32.0",
  "Weight (excl. Cable) (g)": "29.0",
  "Cable length (mm)": "150.0",
  "Cable Gauge (AWG)": "20",
  "Connector": "MR30",
  "Shaft Diameter (external) (mm)": "5.0",
  "Shaft Diameter (internal) (mm)": "4.0",
  "Shaft Retention": "C-clip",
  "Bearing Type": "Ball Bearing",
  "Magnet Type": "Neodymium",
  "Mounting Circle (mm)": "16.0",
  "Number of Mounting Screws": "4",
  "Mounting Screw Thread": "M3",
  "Maximum Operating Temperature (\u00b0C)": "80.0",
  "Cooling Method": "Air Cooled",
  "IP Rating": "IP68",
  "Link": "https://www.examplemanufacturer.com/em-2205-pro"
},
```

### Specific Instructions for Data Entry

#### Image

The image field should contain a link to an image on the product page of the motor on the manufacturers website. The image should ideally only contain 1 motor. There should be sufficient contrast between the motor and the background. Images that also contain extra screws and nuts that come with the motor are preferred. If possible, the image should contain the wires that are attached to the motor. If possible, the image should contain the connector attached to the end of the wires. If there is no image containing only 1 motor, choose one that shows the motor from the most angles (top, bottom, 45 deg, ...).

- Use an image link from the manufacturer's product page showing a single motor.
- Prefer images with high contrast between the motor and the background.
- Include images with accessories (screws, nuts) if available.
- Show wires and connectors where possible.
- Select images that display multiple angles of the motor.

#### Price

The price should always have two decimal places. There should be no other characters used other than the numbers from 1-9 and a . for the decimal seperation. The price should always be in USD $. If the motor is only sold as a set, divide the listed price by the number of motors in the set.

- Always format prices to two decimal places in USD ($).
- Use numerical characters and a period for decimal separation.
- Divide set prices by the number of motors included.

Examples:
  - ❌ `20,9`   | ✅ `20.90`
  - ❌ `$20,99` | ✅ `8.99`

#### Measurements (mm, g, mΩ, %, etc.)
For all measurements in mm, g and mΩ, always provide at least 1 decimal place. The measurements should only contain numerical characters and a . as the decimal seperator. If unsure as to the exact dimensions, do NOT use an approximate sign ~, or greater, smaller signs (>,<). They interfere with column sorting. In that case just leave the field open. Do not indicate the unit in the data entry field.

- Provide at least one decimal place.
- Use only numerical characters and a period for decimal separation.
- Do not estimate dimensions; leave the field blank if uncertain.

Examples:
  - ❌ `22`  | ✅ `22.0`
  - ❌ `7mm` | ✅ `7.0`

#### Velocity Constant (KV)

As I have never seen a KV rating accurate to 0.1 RPM/V, the KV field should not have any decimal places. If the motor is available in multiple KV versions, create a whole new entry for the motor with another KV. There should only be one entry in the KV field. Do not seperate different KV option by a , or / in a single motor listing. Do not use any non-numeric characters in the entry field for KV.

- No decimal places needed for KV ratings.
- Create separate entries for motors with different KV versions.
- Use only one KV rating per entry without any non-numeric characters.

Examples:
  - ❌ `1550/1950/2550` | ✅ `1550`
  - ❌ `1550 KV`        | ✅ `2550`

#### Counts

Counts should not contain any decimal places, for example the Number of Mounting Screws.

- Do not include decimal places for counts (e.g., Number of Mounting Screws).

Examples:
  - ❌ `4.0` | ✅ `4`