# Motor Database

View the batabase here:

https://marc-frank.github.io/motor-database/

## How to contribute

Clone the repository to your account.

Before adding a new table row to the index.html, check to make sure the motor isn't already in the list

If it already has an entry, you can directly edit the fields by typing in the parameters

 

To simplify the creation of the html code, you can use the Motor Database Formatter

https://github.com/marc-frank/motor-database-formatter/releases

![image](https://github.com/marc-frank/motor-database/assets/74321912/0d60f608-8d0f-4b03-bfbe-8408335a0183)

### Here are all parameters listed in the database:

- Image
- Manufacturer
- Name
- Price [$]
- Stator Diameter [mm]
- Stator Height [mm]
- Stator Configuration
- Flux Direction
- KV [RPM/V]
- Internal Resistance [mΩ]
- Enamel Type
- Efficiency [%]
- Rated Torque [Nm]
- Weight (incl. Cable) [g]
- Weight (excl. Cable) [g]
- Cable length [mm]
- Cable Gauge
- Connector
- Shaft Diameter (external) [mm]
- Shaft Diameter (internal) [mm]
- Shaft Retention
- Bearing Type
- Magnet Type
- Mounting Circle [mm]
- Number of Mounting Screws
- Mounting Screw Thread
- Maximum Operating Temperature [°C]
- Cooling Method
- IP Rating
- Link

The elements of the html code have to be filled with content in the same order as the header

The Formatter app does this automatically:

![image](https://github.com/marc-frank/motor-database/assets/74321912/58e7d852-9e84-42f4-8cd0-cdc762dd9460)

If you have finished making your edit, create a pull request.

I will then re-build and deploy the website.

## Instructions for Inputting Data

### Image

The image field should contain a link to an image on the product page of the motor on the manufacturers website. The image should ideally only contain 1 motor. There should be sufficient contrast between the motor and the background. Images that also contain extra screws and nuts that come with the motor are preferred. If possible, the image should contain the wires that are attached to the motor. If possible, the image should contain the connector attached to the end of the wires. If there is no image containing only 1 motor, choose one that shows the motor from the most angles (top, bottom, 45 deg, ...).

### Price

The price should always have two decimal places. There should be no other characters used other than the numbers from 1-9 and a . for the decimal seperation. The price should always be in USD $. If the motor is only sold as a set, divide the listed price by the number of motors in the set.

❌ - 20,9

❌ - 20

❌ - 20.9

❌ - 6,99

❌ - 20,99

❌ - $20,99

❌ - 17,99$

❌ - 20,99€

✅ - 20.90

✅ - 8.99

✅ - 30.00

### Measurements in mm, g, mΩ, %, ...

For all measurements in mm, g and mΩ, always provide at least 1 decimal place. The measurements should only contain numerical characters and a . as the decimal seperator. If unsure as to the exact dimensions, do NOT use an approximate sign ~, or greater, smaller signs (>,<). They interfere with column sorting. In that case just leave the field open. Do not indicate the unit in the data entry field.

❌ - 22

❌ - 7

❌ - >15

❌ - 5"

❌ - 7mm

✅ - 22.0

✅ - 7.0

✅ - 1.5

### Measurements of the velocity constant (KV)

As I have never seen a KV rating accurate to 0.1 RPM/V, the KV field should not have any decimal places. If the motor is available in multiple KV versions, create a whole new entry for the motor with another KV. There should only be one entry in the KV field. Do not seperate different KV option by a , or / in a single motor listing. Do not use any non-numeric characters in the entry field for KV.

❌ - 1550, 1950, 2550

❌ - 1550/1950/2550

❌ - 1550 KV

✅ - 1550

✅ - 1950

✅ - 2550

### Counts

Counts should not contain any decimal places, for example the Number of Mounting Screws.

❌ - 4.0

✅ - 4
