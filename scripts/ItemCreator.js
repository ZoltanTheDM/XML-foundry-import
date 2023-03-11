import Parser from "./Parser.js";
import Utilts from "./Utilts.js";
class ItemCreator {
    constructor() {
    }
    static getInstance() {
        if (!ItemCreator._instance)
            ItemCreator._instance = new ItemCreator();
        return ItemCreator._instance;
    }

    /**
     * Converts the array of names to the array of spell entities for the createEmbeddedEntity
     *
     * @param spells - array of spells
     * @param compendium - a compendium to get the entity structure from
     * @private
     */
    async _prepareSpellsArray(spells, name) {
        for (let spell of spells) {
            let index = spells.indexOf(spell);
            spells[index] = await Utilts.getSpellData(spell.trim());
        }
        return spells.filter(el => el != null);
    }
    /**
     * Returns an array of all the spells entity
     *
     * @param spells - an object that contains all the spells
     * @private
     */
    async _prepareSpellsObject(spells, name) {
        let spellsArray = [];
        for (const key in spells) {
            if (!spells.hasOwnProperty(key))
                continue;
            const newSpells = await this._prepareSpellsArray(spells[key], name);
            spellsArray = [
                ...spellsArray,
                ...newSpells
            ];
        }
        return spellsArray;
    }
    /**
     * Adds all the spells to the actor object
     *
     * @param actor - owner of the spells
     * @param spells - an array of spell names
     */
    async spellsAdder(actor, spells) {
        if (!spells || Object.keys(spells).length == 0)
            return [];

        const spellList = await this._prepareSpellsObject(spells, actor.name);

        return spellList.map(spell => spell.toObject());
    }

    async innateAdder(actor, spellsDetails) {
        if (!spellsDetails || Object.keys(spellsDetails).length == 0)
            return [];

        let innates = [];

        for (var use_level in spellsDetails){
            var uses = {
                value: 0,
                max: 0,
                per: ""
            }
            if (!(/At will/i.test(use_level))){
                uses = {
                    value: use_level,
                    max: use_level,
                    per: "day"
                }
            }

            async function getSpellData(spell){
                let spellItem = await Utilts.getSpellData(Parser.trimSpellName(spell), actor.name)

                if (spellItem){
                    let spellObject = spellItem.toObject();
                    spellObject.system.uses = uses;
                    if (spellObject.system.preparation){
                        spellObject.system.preparation.mode = use_level !== "At will" ? "innate" : "atwill";
                    }
                    else{
                        console.error("did not have a preperation");
                        console.error(spellObject);
                    }

                    return spellObject
                }
                else{
                    Utilts.notificationCreator('warn', `${Parser.trimSpellName(spell)} not found`);
                }

            }

            let spellListLevel = await Promise.all(spellsDetails[use_level].map(getSpellData));

            innates.push(spellListLevel.filter(x => !!x));

        };

        return innates.reduce((acc, val) => acc.concat(val), [])
    }
    /**
     * Removes the to hit value from the damage array
     *
     * @param abilityData - data of the ability currently being cleaned
     * @private
     */
    _cleanAbilityDamage(abilityData) {
        //if undefined return undefined
        if (!abilityData){
            return;
        }
        abilityData.forEach((ability) => {
            ability.pop();
        });
        return {parts: abilityData};
    }
    /**
     * Returns a foundry friendly structure for range and target
     *
     * @param abilityRange - ability.data.range data that came from the parser
     * @private
     */
    _makeRangeTargetStructure(abilityRange) {
        const structure = {};
        if (!abilityRange)
            return structure;
        if (abilityRange?.singleRange?.type) {
            structure['target'] = abilityRange.singleRange;
            structure['range'] = {
                value: null,
                long: null,
                units: 'self'
            };
        }
        else {
            structure['range'] = abilityRange.doubleRange.short ? abilityRange.doubleRange : abilityRange.singleRange;
        }
        return structure;
    }
    /**
     * Returns the ability that is used for the attack
     *
     * @param ability - ability data
     * @param actorStats - the stats of the actor
     * @private
     */
    _getAttackAbility(ability, actorStats, prof, names) {
        if (!ability?.data?.hit)
            return {
                ability: undefined,
                bonus: 0
            };
        for (const key in actorStats) {
            if (actorStats.hasOwnProperty(key))
                if (Number(ability?.data?.hit) === Parser.getAbilityModifier(actorStats[key]) + prof)
                    return {
                        ability: key.toLowerCase(),
                        bonus: 0
                    };
        }

        var obj = {}

        Object.keys(actorStats).map(mod => 
            obj[mod] = Number(ability?.data?.hit) - Parser.getAbilityModifier(actorStats[mod]) - prof,
        );

        //find the smallest non-negative bonus
        var thing = Object.keys(obj).reduce((total, mod) => {
            if (obj[mod] > 0 && (total.bonus == 0 || obj[mod] < total.bonus)){
                return {
                    ability: mod.toLowerCase(),
                    bonus: obj[mod]
                };
            }

            return total;
        }, {
            ability: undefined,
            bonus: 0
        });

        if (!thing.ability){
            console.warn(`Monster ${names[1]}'s ability: ${names[0]} has no modifier`);
        }
        return thing;
    }
    /**
     * Returns an object for the activation of an attack
     *
     * @param ability - ability to get the activation of
     * @private
     */
    _getActivation(ability, isReactions) {
        const activationObject = { type: '', cost: 0, condition: '' };
        if (ability?.cost) {
            activationObject.type = 'legendary';
            activationObject.cost = ability.cost;
        }
        else if (ability?.type == 'lair'){
            activationObject.type = 'lair';
        }
        else if ((ability?.data?.damage?.length !== undefined && ability?.data?.damage?.length !== 0) || ability?.data?.save) {
            activationObject.type = 'action';
            activationObject.cost = 1;
        }
        else if (ability?.data?.uses?.per){
            activationObject.type = 'none';
        }
        else if (isReactions){
            activationObject.type = "reaction";
            activationObject.cost = 1;
        }
        return activationObject;
    }
    _getUses(ability) {
        const actionUses = {value: 0, max: 0, per: ""};
        if (ability?.data?.uses?.per){
            actionUses.per = ability?.data?.uses?.per;
            actionUses.value = Number(ability?.data?.uses?.value);
            actionUses.max = Number(ability?.data?.uses?.max);
        }
        return actionUses;
    }
    _getRecharge(ability) {
        const actionRecharge = {value: 0, max: 0, per: ""};
        if (ability?.data?.recharge){
            actionRecharge.charged = true;
            actionRecharge.value = Number(ability?.data?.recharge.value);
        }
        return actionRecharge;
    }
    /**
     * Creates the item to be added to the actor
     *
     * @param actor - actor that is the owner of the item
     * @param itemName - the name of the item
     * @param itemData - data of the item from the parser
     * @param actorStats - stats of the actor
     */
    async itemCreator(actor, itemName, itemData, actorStats, isReactions) {
        var attack = this._getAttackAbility(itemData, actorStats, actor.system.attributes.prof, [itemName, actor.name]);

        let thisItem = {
            name: itemName,
            type: itemData?.data?.damage?.[0]?.[2] ? 'weapon' : 'feat',
            system: {
                type: {value: 'monster'},
                description: { value: itemData['description'] },
                activation: this._getActivation(itemData, isReactions),
                ability: attack.ability,
                attackBonus: attack.bonus,
                actionType: itemData?.data?.actionType,
                damage: this._cleanAbilityDamage(itemData?.['data']?.['damage']),
                save: itemData?.['data']?.['save'],
                equipped: true,
                uses: this._getUses(itemData),
                recharge: this._getRecharge(itemData),
            },
        };

        thisItem.img = Utilts.getImage("Item", thisItem.name);

        Object.assign(thisItem.system, this._makeRangeTargetStructure(itemData?.['data']?.['range']));

        return thisItem;
    }
    /**
     * Adds all abilities to the actor
     *
     * @param actor - owner of the abilities
     * @param abilities - abilities object
     * @param actorStats - stats of the actor
     */
    async abilitiesAdder(actor, abilities, actorStats, isReactions) {
        let items = []

        for (const key in abilities) {
            if (abilities.hasOwnProperty(key)){
                items.push(this.itemCreator(actor, key, abilities[key], actorStats, isReactions));
            }
        }

        return items
    }

    _trimName(spellName){
        return spellName.match(/^(?<name>\w([\w'\- \/]*\w)?)( \(.+\))?/).groups.name
    }

    _trimDescription(textArray){

        const ds = Parser.getDescriptionAndSource(textArray)

        return ds.description

    }

    _activationCost(spellJson){
        if (!spellJson['time'] || Object.keys(spellJson['time']) == 0){
            return {}
        }

        var match = spellJson['time'].match(/(?<time>\d+) (?<unit>\w+)([,.]? (?<custom>.+))?/)

        if (!match){
            return {}
        }

        return {
            type: match.groups.unit,
            cost: Number(match.groups.time),
            condition: match.groups.custom
        }
    }

    _spellDuration(spellJson){
        if (!spellJson['duration'] || Object.keys(spellJson['duration']) == 0){
            return {}
        }

        var match = spellJson["duration"].match(/((?<cons>Concentration, )?.*((?<number>(\d+)|(one)) (?<unit>(minute|hour|round|day))s?)|(?<inst>Instantaneous)|(?<dispelled>Until dispelled)|(?<special>[Ss]pecial))/)
        if (!match || !match.groups){
            console.error(spellJson)
            throw "could not figure out duration";
        }

        if (!match?.groups?.inst && !match?.groups?.number && !match?.groups?.dispelled && ! match?.groups?.special){
            console.error(match.groups)
            throw "could not figure out duration";
        }

        if (match.groups.dispelled){
            return {
                value: null,
                units: "perm"
            }
        }
        if (match.groups.special){
            return {
                value: null,
                units: "spec"
            }
        }
        if (match.groups.inst){
            return {
                value: null,
                units: "inst"
            }
        }

        //special case for the word one instead of 1
        let value = match.groups.number == "one" ? 1 : Number(match.groups.number)

        return {
            value,
            units: match.groups.unit
        }
    }

    _spellRange(spellJson){
        if (!spellJson['range'] || Object.keys(spellJson['range']) == 0){
            return {}
        }


        let match = spellJson['range'].match(/(((?<number>\d+) (?<unit>(feet|mile)))|(?<self>Self)|(?<touch>Touch)|(?<sight>Sight)|(?<special>Special)|(?<unlimited>Unlimited))/)
        if (!match){
            console.error(match)
        }

        if (match.groups.self){
            return {
                value: null,
                long: null,
                units: "self"
            }
        }
        if (match.groups.touch){
            return {
                value: null,
                long: null,
                units: "touch"
            }
        }
        if (match.groups.sight || match.groups.special){
            return {
                value: null,
                long: null,
                units: "spec"
            }
        }
        if (match.groups.unlimited){
            return {
                value: null,
                long: null,
                units: "any"
            }
        }

        var unit;
        if (match.groups.unit === "feet"){
            unit = "ft"
        }
        else if (match.groups.unit === "mile"){
            unit = "mi"
        }
        return {
            value: Number(match.groups.number),
            long: 0,
            units: unit
        }
    }

    _spellLevel(spellJson){
        return Number(spellJson.level)
    }

    static _SchoolMap = {
        T: 'trs',
        N: 'nec',
        D: 'div',
        I: 'ill',
        C: 'con',
        A: 'abj',
        EN: 'enc',
        EV: 'evo',
    }

    _spellSchool(spellJson){
        return ItemCreator._SchoolMap[spellJson.school]
    }

    _spellComponents(spellJson){
        if (!spellJson['components'] || Object.keys(spellJson['components']) == 0){
            return {}
        }


        var match = spellJson.components.match(/(?<verbal>V)?(, )?(?<somatic>S)?(, )?((?<material>M) \((?<stuff>.+)\))?/)
        if(!match){
            console.error("no match for spell components")
        }


        let concentration = false;
        if (spellJson.duration?.match){
            concentration = Boolean(spellJson.duration.match(/(?<cons>Concentration)/i))
        }

        return {
            value: "",
            vocal: Boolean(match.groups.verbal),
            somatic: Boolean(match.groups.somatic),
            material: Boolean(match.groups.material),
            ritual: Boolean(/YES/i.test(spellJson.ritual)),
            concentration,
        }
    }

    _spellMaterials(spellJson){
        if (!spellJson['components'] || Object.keys(spellJson['components']) == 0){
            return {}
        }

        var match = spellJson.components.match(/M \((?<material>.+)\)/)

        if (!match){
            return {
                value: "",
                consumed: false,
                cost: 0,
                supply: 0
            }
        }

        var cost = 0;
        var match2 = match.groups.material.match(/(?<cost>[\d,]+)\s*gp/)
        if (match2){
            cost = Number(match2.groups.cost.replace(',',''))
        }
        var consumed = match.groups.material.match(/consume/)
        return {
            value: match.groups.material,
            consumed: Boolean(consumed),
            cost: cost,
            supply: 0
        }
    }

    _spellTarget(spellJson){
        if (!spellJson['range'] || Object.keys(spellJson['range']) == 0){
            return {}
        }

        var easy_area_check = spellJson.range.match(/\((?<number>\d+)[\- ](?<unit>foot|mile)[\- ](?<area>cone|line|cube|radius)\)/i)
        if (easy_area_check){
            return {
                value: Number(easy_area_check.groups.number),
                units: Parser._unitMap[easy_area_check.groups.unit],
                type: easy_area_check.groups.area
            }
        }

        var text = this._trimDescription(spellJson.text)

        var radius_check = text.match(/(?<number>\d+)[- ]foot[- ]radius/)

        if (radius_check){
            return {
                value: Number(radius_check.groups.number),
                units: "ft",
                type: "radius"
            }
        }

        var wall_check = text.match(/wall up to (?<length>\d+) feet long/i)

        if (wall_check){
            return {
                value: Number(wall_check.groups.length),
                units: "ft",
                type: "wall"
            }
        }

        var count_check = text.match(/up to (?<number>\w+)( willing)? creature/i)

        if (count_check){
            // console.error("Count check worked '"+count_check.groups.number+"'");
            return {
                value: Parser._numberMap[count_check.groups.number],
                units: "",
                type: "creature"
            }
        }

        var single_creature = text.match(/(one|a|the)( willing)? (creature|beast|corpse|humanoid|target)/i)

        if (single_creature){
            return {
                value: 1,
                units: "",
                type: "creature"
            }
        }

        var space = text.match(/Unoccupied space/i)
        var point = text.match(/point you choose/i)

        if (space || point){
            return {
                value: null,
                units: "",
                type: "space"
            }
        }

        var object_check = text.match(/an object/i)
        var weapon_check = text.match(/a( nonmagical)? weapon/i)

        if (object_check || weapon_check){
            return {
                value: 1,
                units: "",
                type: "object"
            }
        }

        var any_creatures = text.match(/any number of creatures/i)

        if (any_creatures){
            return {
                value: null,
                units: "any",
                type: "creature"
            }
        }

        var self_check = spellJson.range.match(/Self/i)

        if (self_check){
            return {
                value: null,
                units: "",
                type: "self"
            }
        }
        
        var area_check = text.match(/(?<number>\d+)[\- ](?<unit>foot|mile)[\- ](?<area>cone|line|cube|radius)/i)
        if (area_check){
            return {
                value: Number(area_check.groups.number),
                units: Parser._unitMap[area_check.groups.unit],
                type: area_check.groups.area
            }
        }

        console.warn("No target data found")
        return {
            value: null,
            units: "",
            type: ""
        }
    }

    _formulas(spellJson){
        var text = this._trimDescription(spellJson.text)
        let output = {}
        {
            var save = text.match(/make a (?<type>\w+) saving throw/i)

            if (/Make a melee spell attack/i.test(text)){
                output.actionType = "msak"
                output.spellSave = {
                    ability: "",
                    dc: null,
                    scaling: "spell"
                }
            }
            else if (/Make a ranged spell attack/i.test(text)){
                output.actionType = "rsak"
                output.spellSave = {
                    ability: "",
                    dc: null,
                    scaling: "spell"
                }
            }
            else if (save){
                output.actionType = "save"
                output.spellSave = {
                    ability: Parser._abilitiesMap[save.groups.type],
                    dc: null,
                    scaling: "spell"
                }
            }
            else if (/regain[\s\w]+hit points/i.test(text)){
                output.actionType = "heal"
                output.spellSave = {
                    ability: "",
                    dc: null,
                    scaling: "spell"
                }
            }
            else{
                output.actionType = "util"
                output.spellSave = {
                    ability: "",
                    dc: null,
                    scaling: "spell"
                }
            }
        }

        const damageRegEx = RegExp(/(?<roll>\d*d\d+(\s*\+\s*\d+)?)( (?<type>acid|bludgeoning|cold|fire|force|lightning|necrotic|piercing|poison|psychic|radiant|slashing|thunder) damage)?/, 'ig');

        let usableText = text;

        let high_level = text.search("At Higher Levels")
        if (high_level > 0){
            usableText = text.substring(0, high_level)
        }

        let rolls = [...usableText.matchAll(damageRegEx)];
        output.damage = {
            versatile: "",
            value: ""
        }
        output.damage.parts = rolls.reduce((acc, obj)=>{
            if (obj.groups.type){
                acc.push([obj.groups.roll, obj.groups.type])
            }
            return acc
        }, []);

        let found = rolls.find(ele => !Boolean(ele.groups.type))
        if (found){
            output.formula = found.groups.roll;
        }
        else{
            output.formula = "";
        }

        return output;
    }

    _spellScaling(spellJson){
        var text = this._trimDescription(spellJson.text)

        var higher_levels = text.search("At Higher Levels")

        if (higher_levels >= 0){
            var match = text.substring(higher_levels).match(/(?<formula>\d*d\d+)/)

            var formula = ""
            if (match){
                formula = match.groups.formula;
            }

            return {
                mode: "level",
                formula: formula
            }
        }

        if (/when you reach 5th level/.test(text)){
            return {
                mode: "cantrip",
                formula: ""
            }
        }

        return {
            mode: "none",
            formula: ""
        }
    }

    async createSpell(spellJson, pack) {
        //some are updates, if there is no text ingore it
        if (!("text" in spellJson)){
            return;
        }

        const descriptionAndSource = Parser.getDescriptionAndSource(spellJson.text, ItemCreator.higherLevelReplace);

        let formulas = this._formulas(spellJson)
        let thisSpell = {
            name: this._trimName(spellJson.name),
            type: "spell",
            system: {
                description: {
                    value: descriptionAndSource.description,
                    chat: "",
                    unidentified: ""
                },
                // source: "PHB pg. 216",
                activation: this._activationCost(spellJson),
                duration: this._spellDuration(spellJson),
                target: this._spellTarget(spellJson),
                range: this._spellRange(spellJson),
                actionType: formulas.actionType,
                damage: formulas.damage,
                formula: formulas.formula,
                save: formulas.spellSave,
                level: this._spellLevel(spellJson),
                school: this._spellSchool(spellJson),
                components: this._spellComponents(spellJson),
                materials: this._spellMaterials(spellJson),
                scaling: this._spellScaling(spellJson),
                source: descriptionAndSource.source,
            },
            sort: 200002
        };

        thisSpell.img = Utilts.getImage("Item", this._trimName(thisSpell.name))

        // await Item.create(thisSpell, { displaySheet: true});
        let item = await Item.create(thisSpell, { temporary: true, displaySheet: false});
        await pack.importDocument(item);
        // await pack.getIndex(); // Need to refresh the index to update it
        console.log(`Done importing ${thisSpell.name} into ${pack.collection}`);
    }
    
    async MakeFeats(featJson, compendiumCreator){

        let featPack = await compendiumCreator("-feats", "Item");

        for (let featPre of featJson){

            let feat = ItemCreator.checkForClassOption(featPre)

            const ds = Parser.getDescriptionAndSource(feat.text)

            let featData = {
                name: feat.name,
                type: "feat",
                system: {
                    description: {value: ds.description},
                    requirements: ItemCreator.isObjEmpty(feat.prerequisite) ? "" : feat.prerequisite,
                    type: feat.type,
                    source: ds.source,
                }
            };

            let item = await Item.create(featData, {temporary: true, displaySheet:false});

            await featPack.importDocument(item);
            console.log(`Done importing ${feat.name.name} into ${featPack.collection}`);
        }

    }

    static traitToHtml(trait){
        return "<h2>" + trait.name + "</h2>" + trait.text;
    }

    async MakeBackground(backgroundJson, compendiumCreator){
        let backgroundPack = await compendiumCreator("-backgrounds", "Item");
        let rollTablesPack = await compendiumCreator("-rollTable", "RollTable");

        for (let background of backgroundJson){

            let ds;
            let traits = [];
            let features = [];

            for (let trait of Utilts.ensureArray(background.trait)){
                if (trait.name == 'Description'){
                    //standard blurb
                    ds = Parser.getDescriptionAndSource(trait.text)
                }
                else if (trait.name.startsWith("Feature:")){
                    //make a background feature, return the compendium item
                    features.push(ItemCreator.MakeBackgroundFeature(trait, background.name, ds?.source, backgroundPack));
                }
                else{
                    //other traits, including roll tables etc...
                    //finds and returns the roll table
                    let newTrait = await ItemCreator.DetermineRollTable(trait, background.name, rollTablesPack)
                    traits.push(newTrait);
                }
            }

            let descriptionString = [ds.description, ...traits].join("<hr>");

            features = await Promise.all(features);

            features.map(feat => feat.uuid)

            let backgroundData = {
                name: background.name,
                type: "background",
                system: {
                    description: {value: descriptionString},
                    source: ds.source,
                    advancement: [{
                        "type": "ItemGrant",
                        "configuration": {
                            "items": features.map(feat => feat.uuid),
                            "optional": false,
                        },
                        "level": 0,
                        "title": "Feature"
                    }]
                }
            };

            let item = await Item.create(backgroundData, {temporary: true, displaySheet:false});

            await backgroundPack.importDocument(item);

            console.log(`Done importing ${background.name.name} into ${backgroundPack.collection}`);
        }
    }

    static async MakeBackgroundFeature(trait, requirement, source, backgroundPack){

        let featData = {
            name: trait.name.slice("Feature: ".length),
            type: "feat",
            system: {
                description: {value: trait.text},
                requirements: requirement,
                type: {value: "background"},
                source: source,
            }
        };

        let item = await Item.create(featData, {temporary: true, displaySheet:false});

        return await backgroundPack.importDocument(item);
    }

    static async DetermineRollTable(inputTrait, sourceName, rollTablesPack){
        let text = inputTrait.text;

        let tablesMatcher = text.matchAll(/d(?<dice>\d+) \| (?<tableName>[^\n]+)(?<table>(\n\d+ \| [^\n]+)+)/g);

        for (let match of tablesMatcher){

            let linesMatcher = match.groups.table.matchAll(/(?<die>\d+) \| (?<text>[^\n]+)/g);

            function lineToReuslt(lineMatch){
                let value = parseInt(lineMatch.groups.die);
                return {
                    type: 0,
                    weight: 1,
                    range: [value, value],
                    text: lineMatch.groups.text,
                }
            }

            let tableData = {
                name: `${match.groups.tableName} (${sourceName})`,
                formula: `1d${match.groups.dice}`,
                replacement: true,
                displayRoll: true,
                results: [...linesMatcher].map(lineToReuslt)
            }

            let rt = await RollTable.create(tableData, {temporary: true, displaySheet:false});

            let newRollTable = await rollTablesPack.importDocument(rt);

            text = text.replace(match[0], "<br>"+newRollTable.link);
        }

        return `<h2>${inputTrait.name}</h2>${text}`;
    }

    async MakeItems(itemsJson, compendiumCreator){
        let itemPack = await compendiumCreator("-items", "Item");

        for (let item of itemsJson){

            // console.log(item)

            //get description and source data
            const ds = Parser.getDescriptionAndSource(item.text)

            //get data unique to item types
            const sub = ItemCreator.toItemType(item);

            //All items inculde the following stuff
            let itemData = {
                name: item.name,
                system:{
                    description:{value: ds.description},
                    source: ds.source,
                },
                img: Utilts.getImage("Item", item.name),
            };

            //not all items have a value
            if (item.value && typeof(item.value) == "string"){
                itemData.system.price = {value: parseFloat(item.value)};
            }

            //not all items have a weight
            if (item.weight && typeof(item.weight) == "string"){
                itemData.system.weight = parseFloat(item.weight);
            }

            //merge common data and specific data
            let fullItemData = mergeObject(itemData, sub, {recursive: true, insertKeys: true, insertValues: true, overwrite: true});

            // console.log(fullItemData);

            //create the item
            let itemTemp = await Item.create(fullItemData, {temporary: true, displaySheet:false});

            await itemPack.importDocument(itemTemp);
            console.log(`Done importing ${item.name} into ${itemPack.collection}`);
        }

    }



    static toItemType(item) {

        //check for item detials
        if (item.detail && Object.keys(item.detail).length > 0){
            let details = item.detail.split(', ');

            // ItemCreator.details = new Set([...ItemCreator.details, item.detail])

            //block for weapons (including Staffs)
            if (details.includes('Melee Weapon')){
                if (details.includes('martial Weapon')){
                    return ItemCreator.weaponFunc("martialM", "mwak", item);
                }
                else if (details.includes('simple Weapon')){
                    return ItemCreator.weaponFunc("simpleM", "mwak", item);
                }
                else{
                    return ItemCreator.weaponFunc("simpleM", "mwak", item);
                }
            }
            else if (details.includes('Staff')){
                    return ItemCreator.weaponFunc("simpleM", "mwak", item);
            }
            else if (details.includes('Ranged Weapon')){
                if (details.includes('martial Weapon')){
                    return ItemCreator.weaponFunc("martialR", "rwak", item);
                }
                else if (details.includes('simple Weapon')){
                    return ItemCreator.weaponFunc("simpleR", "rwak", item);
                }
                else{
                    return ItemCreator.weaponFunc("simpleR", "rwak", item);
                }
            }

            //block for armor (including Shields)
            if (details.includes('Light Armor')){
                return ItemCreator.armorFunc("light", item);
            }
            else if (details.includes('Medium Armor')){
                return ItemCreator.armorFunc("medium", item);
            }
            else if (details.includes('Heavy Armor')){
                return ItemCreator.armorFunc("heavy", item);
            }
            else if (details.includes('Shield')){
                return ItemCreator.armorFunc("shield", item);
            }

            //Some descriptions have specific item types
            const ItemTypeMap = {
                Ammunition: {type: 'consumable', system:{consumableType: 'ammo'}},
                'Gaming Set': {type: 'tool', system:{toolType: "game"}},
                'Instrument': {type: 'tool', system:{toolType: "music"}},
                'Artisan Tools': {type: 'tool', system:{toolType: "tool"}},
                Poison: {type: 'consumable', system:{consumableType: 'poison'}},
                'Trade Good': {type: 'loot'},
                Tools: {type: 'tool'},
                'Food and Drink': {type: 'consumable', system:{consumableType: "food"}},
                'Spellcasting Focus': {type: 'equipment', system:{armor:{type:"trinket"}}},
                'Wondrous item (tattoo)': {type: 'equipment', system:{armor:{type:"trinket"}}},
            }

            for (let detail of details){
                if (Object.keys(ItemTypeMap).includes(detail)){
                    return ItemTypeMap[detail];
                }
            }


        }

        //special case, some range weapons don't have details
        if (item.type == 'R'){
            return ItemCreator.weaponFunc("martialR", "rwak", item);
        }

        //If nothing else has worked yet check the item type
        const ItemTypeMap = {
            P: {type: 'consumable', system:{consumableType: 'potion'}},
            "$": {type: 'loot'},
            W: {type: 'equipment', system:{armor:{type:"trinket"}}},
            WD: {type: 'consumable', system:{consumableType: 'wand'}},
            RG: {type: 'equipment', system:{armor:{type:"trinket"}}},
            SC: {type: 'consumable', system:{consumableType: 'scroll'}},
            RD: {type: 'consumable', system:{consumableType: 'rod'}},
        }

        if (Object.keys(ItemTypeMap).includes(item.type)){
            return ItemTypeMap[item.type];
        }
        
        // console.log(item.detail)
        // console.log(item);

        //default to equipement trinket
        return {type: 'equipment', system:{armor:{type:"trinket"}}};
    }

    //helper function for armor
    static armorFunc(type, item){
        let tempArr = {type: 'equipment', system:{
            armor:{type, value:parseInt(item.ac)},
            stealth: !!item.stealth,
            strength: ((item.strength && typeof(item.strength) === 'string') ? parseInt(item.strength) : null),
        }};

        return tempArr;
    }

    //helper function for weapons
    static weaponFunc(type, action, item){
        const weap = {system:{
            weaponType: type,
            actionType: action,
        }};
        const weap2 = ItemCreator.weaponDetails(item);

        return mergeObject(weap, weap2, {recursive: true, insertKeys: true, insertValues: true, overwrite: true});
    }

    //get all weapon details
    static weaponDetails(item){
        const DamageTypeMap = {
            S: 'slashing',
            B: 'bludgeoning',
            P: 'piercing',
        }

        //check weapon properties
        let properties = {};
        if (typeof(item.property) === "string"){
            const propertiesMap = {
                'V': 'ver',
                'M': 'mgc',
                'A': 'amm',
                'LD': 'rel',
                'L': 'lgt',
                'F': 'fin',
                'T': 'thr',
                'S': 'spc',
                '2H': 'two',
                'H': 'hvy',
                'R': 'rch',
            };

            properties = item.property.split(',').reduce((acc, p) => {

                acc[propertiesMap[p]] = true;
                return acc;
            }, {});
        }

        //get simple weapon damages
        let temp = {type: 'weapon', system:{
            activation: {type: 'action'},
            damage: {parts: [[item.dmg1, DamageTypeMap[item.dmgType]]]},
            properties,
        }}

        //get simple versatile damages
        if (item.dmg2){
            temp.versatile = item.dmg2;
        }

        //get range values
        if (item.range){
            let RangeMatch = item.range.match(/(?<close>\d+)\/(?<far>\d+)/);
            temp.system.range = {
                value: parseInt(RangeMatch.groups.close),
                long: parseInt(RangeMatch.groups.far),
                units: 'ft',
            };
        }

        return temp;
    }

    //Some feats are actually class feature options
    //such as manuvers and similar
    static checkForClassOption(feat){
        //check for a colon starting name
        let colonMatcher = feat.name.match(/(?<start>.+): ?(?<name>.+)/)

        //compare vs classOptionMap
        if(colonMatcher && (colonMatcher.groups?.start?.toLowerCase() in ItemCreator.classOptionMap)){
            //remove the extra name part

            feat.type = {
                value: "class",
                subtype: ItemCreator.classOptionMap[colonMatcher.groups.start.toLowerCase()]
            }

            //remove the name
            feat.name = colonMatcher.groups.name
        }
        else{
            //nothing special about this feat
            feat.type = {value:"feat"}
        }

        //return modified feat object
        return feat
    }

    //A mapping of key words to dnd5e System keys
    static classOptionMap = {
        infusion: "artificerInfusion",
        invocation: "eldritchInvocation",
        "elemental discipline": "elementalDiscipline",
        "maneuver" : "maneuver",
        "pact boon" : "pact",
        rune: "rune",
    }

    async MakeRaces(raceJson, compendiumCreator){
        let racePack = await compendiumCreator("-race", "Item");

        for (let raceData of raceJson){

            let ds;

            let text = raceData.trait.reduce((acc, trait) => {
                if (trait.name == "Description"){
                    ds = Parser.getDescriptionAndSource(trait.text);
                    console.log(ds);

                    //too lazy to fix earlier. Fixing here
                    ds.description = ds.description.replace("<p></p>", "")

                    if(ds.description){
                        console.log(`hey there "${ds.description}"`)
                        return `${acc}<p><em>${ds.description}</em></p><p><em><strong>Ability Score Increase.</strong></em> ${raceData.ability}</p>`;
                    }
                    else{
                        return `${acc}<p><em><strong>Ability Score Increase.</strong></em> ${raceData.ability}</p>`;
                    }
                }
                else{
                    return `${acc}<p><em><strong>${trait.name}.</strong></em> ${trait.text}</p>`
                }

                return acc;
            }, "");

            console.log(ds);

            let item = {
                name: raceData.name,
                type: "feat",
                system: {
                    description: {value: text},
                    source: ds.source,
                },
            };

            let itemTemp = await Item.create(item, {temporary: true, displaySheet:false});

            await racePack.importDocument(itemTemp);
            console.log(`Done importing ${item.name} into ${racePack.collection}`);

        }

    }

    static isObjEmpty (obj) {
        return Object.keys(obj).length === 0;
    }

    static higherLevelReplace (text) {
        return text.replace("At Higher Levels", "</p><p><strong>At Higher Levels</strong>");
    }
}
export default ItemCreator.getInstance();
