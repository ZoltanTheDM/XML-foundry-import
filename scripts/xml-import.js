import ActorCreator from "./ActorCreator.js";
import ItemCreator from "./ItemCreator.js";
import ClassCreator from "./ClassCreator.js";
import JournalCreator from "./JournalCreator.js";
import Parser from './Parser.js'
import Utilts from "./Utilts.js";
import CompendiumManagement from "./CompendiumManagement.js";
import CompendiumUI from './compendium-ui.js'

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
        backgrounds: html.find('[name=backgroundsButton]').is(':checked'),
        races: html.find('[name=raceButton]').is(':checked'),
        items: html.find('[name=itemsButton]').is(':checked'),
        classes: html.find('[name=classButton]').is(':checked'),
        subclass: html.find('[name=subclassButton]').is(':checked'),
        spells: html.find('[name=spellsButton]').is(':checked'),
        creature: html.find('[name=creatureButton]').is(':checked'),
        journal: html.find('[name=journalButton]').is(':checked'),
        feats: html.find('[name=featsButton]').is(':checked'),
      }
      let compendiumName = html.find('[name=compendium-input]').val();
      XmlImporter.parseXml(inputXML, adder, compendiumName)
    });

    html.find(".order-comp-button").click(async ev => {
      new CompendiumUI().render(true);
    });

    this.close();
  }

  static async parseXml(xmlInput, adder, compendiumName) {


    let wholeJson;
    try{
      wholeJson =  await XmlImporter.getStringOrUrlJson(xmlInput);
    }
    catch(err){
      const errMsg = `Failed to begin import, Is the text/Url correct?`
      console.error(errMsg)
      console.error(err);
      ui.notifications['error'](errMsg);

      return;
    }

    await Utilts.PreloadCompendiumIndex();

    const debug = true;

    if (adder.feats && wholeJson['feat']){
      await ItemCreator.MakeFeats(Utilts.ensureArray(wholeJson['feat']), name => XmlImporter.getCompendiumWithType(compendiumName+name, "Item"));
    }

    if (adder.backgrounds && wholeJson['background']){
      await ItemCreator.MakeBackground(Utilts.ensureArray(wholeJson['background']), (name, type) => XmlImporter.getCompendiumWithType(compendiumName+name, type));
    }

    if (adder.races && wholeJson['race']){
      await ItemCreator.MakeRaces(Utilts.ensureArray(wholeJson['race']), name => XmlImporter.getCompendiumWithType(compendiumName+name, "Item"));
    }

    if (adder.items && wholeJson['item']){
      await ItemCreator.MakeItems(Utilts.ensureArray(wholeJson['item']), name => XmlImporter.getCompendiumWithType(compendiumName+name, "Item"));
    }

    if (adder.spells && wholeJson["spell"]){
      // Look for compendium
      let item_pack = await XmlImporter.getCompendiumWithType(compendiumName+"-spells", "Item");

      let start = true;
      for (var spell of Utilts.ensureArray(wholeJson["spell"])){
        //the alphabetically first spell starts with 'Abi'
        // if (!start && spell.name.startsWith("Abi")){
        //   console.log("first spell is "+spell.name);
        //   start = true;
        // }

        if (start){
          try{
            await ItemCreator.createSpell(spell, item_pack);
          }
          catch(e){
            Utilts.notificationCreator('error', `Could not import ${spell.name}`);
            console.error(`Error importing spell: ${spell.name}`);
            console.error(e);
          }
        }
      }
    }

    if (adder.features || adder.subclass || adder.classes){
      await ClassCreator.HandleClassCreation(wholeJson, name => XmlImporter.getCompendiumWithType(compendiumName+name, "Item"), adder.features, adder.subclass, adder.classes)
    }

    //reload if we added any spells
    await Utilts.PreloadCompendiumIndex(adder.spells, false);

    if (adder.creature && wholeJson["monster"]){
      // Look for compendium
      let monster_pack = await XmlImporter.getCompendiumWithType(compendiumName+"-monsters", "Actor");

      for (var monster of Utilts.ensureArray(wholeJson["monster"])){
        try {
          await ActorCreator.createActor(monster, monster_pack);
        }
        catch (err){
          Utilts.notificationCreator('error', `Could not import ${monster.name}`);
          console.error(`Could not import ${monster.name}`);
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

    ui.notifications['info']("Comleted Import");
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

  static async getStringOrUrlJson(input){


    if(!XmlImporter.isValidHttpUrl(input)){
      let parser = new DOMParser();
      let xmlDoc = parser.parseFromString(input,"text/xml");
      return Parser.xmlToJson(xmlDoc)['compendium']
    }

    let level1 = await XmlImporter.fetchXMLfromUrl(input);

    var l1Json = Parser.xmlToJson(level1);

    if (l1Json['compendium']){
      return l1Json['compendium'];
    }

    if (!l1Json['collection']){
      throw "No Compedium or collection";
    }

    //build a nw string
    //brittle as heck
    let output = await Promise.all(l1Json.collection.doc.map(async function(singleDoc){
      return await fetch(
          new URL(singleDoc['@attributes'].href, input)
        ).then(x => x.text())
        .then(XmlImporter.removeSomeLines);
    }));

    output.join('\n')

    const START = "<?xml version='1.0' encoding='utf-8'?>\n<compendium version=\"0\" auto_indent=\"NO\">"
    const END = "</compendium>"

    var parser = new DOMParser();
    const fullString = `${START}${output}${END}`;

    // console.log(fullString)

    let xmlDoc = parser.parseFromString(`${START}${output}${END}`,"text/xml");
    return Parser.xmlToJson(xmlDoc)['compendium']
  }

  static removeSomeLines(str){
    return str.split('\n').slice(2,-2).join('\n')
  }

  static async fetchXMLfromUrl(url){
    var parser = new DOMParser();

    let res = await fetch(url);
    return parser.parseFromString(await res.text(),"text/xml");
  }

  //https://stackoverflow.com/questions/5717093/check-if-a-javascript-string-is-a-url
  static isValidHttpUrl(string) {
    let url;
    
    try {
      url = new URL(string);
    } catch (_) {
      return false;  
    }

    return url.protocol === "http:" || url.protocol === "https:";
  }

}