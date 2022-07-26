import ActorCreator from "./ActorCreator.js";
import ItemCreator from "./ItemCreator.js";
import ClassCreator from "./ClassCreator.js";
import JournalCreator from "./JournalCreator.js";
import Parser from './Parser.js'
import Utilts from "./Utilts.js";

// Set up the user interface
Hooks.on("renderSidebarTab", async (app, html) => {
    if (app.options.id == "compendium") {
      let button = $("<button class='import-cd'><i class='fas fa-file-import'></i> XML Import</button>")
   
      button.click(function () {
        new XmlImporter().render(true);
      });
      
      html.find(".directory-footer").append(button);
    }
  })

// Main module class
class XmlImporter extends Application
{
  static get defaultOptions()
  {
      const options = super.defaultOptions;
      options.id = "xml-importer";
      options.template = "modules/xml-import/templates/xml_import_ui.html"
      options.classes.push("xml-importer");
      options.resizable = false;
      options.height = "auto";
      options.width = 400;
      options.minimizable = true;
      options.title = "XML Importer"
      return options;
  }

  activateListeners(html) {
    super.activateListeners(html)
    html.find(".import-xml").click(async ev => {
      let inputXML = html.find('[name=all-xml]').val();
      let adder = {
        features: html.find('[name=featuresButton]').is(':checked'),
        class: html.find('[name=classButton]').is(':checked'),
        spells: html.find('[name=spellsButton]').is(':checked'),
        creature: html.find('[name=creatureButton]').is(':checked'),
        journal: html.find('[name=journalButton]').is(':checked'),
      }
      let compendiumName = html.find('[name=compendium-input]').val();
      XmlImporter.parseXml(inputXML, adder, compendiumName)
    });
    this.close();
  }

  static ensureArray(val){
    return Array.isArray(val) ? val : [val];
  }

  static async parseXml(xmlInput, adder, compendiumName) {
    var parser = new DOMParser();

    var xmlDoc = parser.parseFromString(xmlInput,"text/xml");

    var wholeJson = Parser.xmlToJson(xmlDoc)["compendium"];

    // await Utilts.PreloadCompendiumIndex((adder.class || adder.classFeatures || adder.spells || adder.creature), adder.creature);
    await Utilts.PreloadCompendiumIndex();

    const debug = true;

    if (adder.features || adder.class){
      ClassCreator.HandleClassCreation(wholeJson, name => XmlImporter.getCompendiumWithType(compendiumName+name, "Item"), adder.features, adder.class)
    }

    if (adder.spells && wholeJson["spell"]){
      // Look for compendium
      let item_pack = await XmlImporter.getCompendiumWithType(compendiumName+"-spells", "Item");

      let start = true;
      for (var spell of wholeJson["spell"]){
        //the alphabetically first spell starts with 'Abi'
        // if (!start && spell.name.startsWith("Abi")){
        //   console.log("first spell is "+spell.name);
        //   start = true;
        // }

        if (start){
          const temp = ItemCreator.createSpell(spell, item_pack);

          if (debug){
            try{
              await temp;
            }
            catch(err){
              console.error(err);
            }
          }
          else{
            temp.catch(e => {
              Utilts.notificationCreator('error', `Could not import ${spell.name}`);
              console.error("Error in ItemCreator");
              console.error(e);
            });
          }
        }
      }
    }

    //reload if we added any spells
    await Utilts.PreloadCompendiumIndex(adder.spells, false);

    if (adder.creature && wholeJson["monster"]){
      // Look for compendium
      let monster_pack = await XmlImporter.getCompendiumWithType(compendiumName+"-monsters", "Actor");

      for (var monster of wholeJson["monster"]){
        try {
          await ActorCreator.createActor(monster, monster_pack);
        }
        catch (err){
          Utilts.notificationCreator('error', `Could not import ${monster.name}`);
          console.error(err);
        }
      }
    }

    if (adder.journal){
      let jpack = await XmlImporter.getCompendiumWithType(compendiumName+"-journal", "JournalEntry");

      var nodeIterator = Parser.ElementGenenerator(xmlDoc, "journal")
      var currentNode;
      while (currentNode = nodeIterator.nextNode()) {
        JournalCreator.createJournal(currentNode, jpack)
      }
    }
  }

  static async getCompendiumWithType(compendiumName, type){
    // Look for compendium
    let pack = game.packs.find(p => p.metadata.name === compendiumName);

    if (pack == null) {
        // Create a new compendium
        pack = await CompendiumCollection.createCompendium({
            name: compendiumName,
            label: compendiumName,
            collection: compendiumName,
            type
          });
    }
    // Update pack object
    // pack = game.packs.find(p => p.metadata.name === compendiumName);
    if (!pack){
      throw "Could not find/make pack";
    }

    return pack;
  }

}