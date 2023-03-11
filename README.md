# XML Importer for FoundryVTT

This is a module for importing data into FoundryVTT for dnd5e as a compendium from an XML source.

The code is pretty rough but it is functional for importing spells and creatures.

## Usage

1. At the bottom of the compendium tab there will be a new button: `XML-Import`. Clicking it will open up the dialog box.
2. Change the prefix if you want. Default is `xml`. This will change the compendium it is output to.
3. Paste a url to an xml or the contents of an `xml` into the large text box.
4. Use checkboxes for importing classes, spells and/or, monsters
5. You may want to change your compendium order with the `Order Compendiums` button
5. Click `Import`
6. Wait and watch its progress in the console. This can take quite a while depending on the size of the XML.

The only way I know of to stop the importing process once it has started is refreashing.

## Recommendation

After creating compendiums I would recommend making it into a [compendium pack](https://foundryvtt.com/article/compendium/). I ran and created a pack on a local instance of foundry then transfered it to the online server.

It took on the order of **15 minutes** to complete several hundred monsters.

## Future Work

* A progress bar/inidicator
* A stop in progress import button
* Import Racail Traits
* Import Vehicles properly
* Handle magical weapon damage
* For some reason I have been unable to create temporary actors and add them to a compendium. For now they are created and deleted when they are added to the compendium. This deleting breaks if there is an error thrown. Which has led to a bunch of actors created and never deleted...
* performance increase by using paralellism
* Cantrip scaling seems incomplete and hard to read depending on the source
* Make the code more readable
* Needs Tests!

## Credit

Lots of code shamelessly borrowed from these other importer projects:

* https://github.com/jwinget/fvtt-module-critterdb-import/
* https://github.com/HadaIonut/Foundry-Markdown-Importer
