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
            return;
        const spellList = await this._prepareSpellsObject(spells, actor.name);
        for (var spell of spellList){
            try {
                await actor.createEmbeddedDocuments("Item", [spell.toObject()]);
            }
            catch (e) {
                Utilts.notificationCreator('error', `There has been an error while creating ${itemName}`);
                console.error(e);
            }
        }
    }

    async innateAdder(actor, spellsDetails) {
        if (!spellsDetails || Object.keys(spellsDetails).length == 0)
            return;

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
                    spellObject.data.uses = uses;
                    if (spellObject.data.preparation){
                        spellObject.data.preparation.mode = use_level !== "At will" ? "innate" : "atwill";
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

            try {
                //remeber to filter out the spells that were not found
                let spells = spellListLevel.filter(x => !!x)
                await actor.createEmbeddedDocuments("Item", spells);
            }
            catch (e) {
                let str = `There has been an error while creating innate spells: ${spellListLevel.map(s => s?.name)}`;
                Utilts.notificationCreator('error', str);
                console.error(str)
                console.error(e);
            }

        };
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
        var attack = this._getAttackAbility(itemData, actorStats, actor.data.data.attributes.prof, [itemName, actor.data.name]);
        let thisItem = {
            name: itemName,
            type: itemData?.data?.damage?.[0]?.[2] ? 'weapon' : 'feat',
            data: {
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

        Object.assign(thisItem.data, this._makeRangeTargetStructure(itemData?.['data']?.['range']));

        try {
            await actor.createEmbeddedDocuments("Item", [thisItem]);
        }
        catch (e) {
            Utilts.notificationCreator('error', `There has been an error while creating ${itemName}`);
            console.error(`There has been an error while creating ${itemName}`);
            console.error(e);
        }
    }
    /**
     * Adds all abilities to the actor
     *
     * @param actor - owner of the abilities
     * @param abilities - abilities object
     * @param actorStats - stats of the actor
     */
    async abilitiesAdder(actor, abilities, actorStats, isReactions) {
        for (const key in abilities) {
            if (abilities.hasOwnProperty(key)){
                await this.itemCreator(actor, key, abilities[key], actorStats, isReactions);
            }
        }
    }

    _trimName(spellName){
        return spellName.match(/^(?<name>\w([\w'\- ]*\w)?)( \(.+\))?/).groups.name
    }

    _trimDescription(textArray){
        if (typeof textArray === 'string' || textArray instanceof String){
            return "<p>"+textArray.replace("At Higher Levels", "</p><p><strong>At Higher Levels</strong>")+"</p>"
        }

        let value = textArray.reduce((acc, current) => {
            if (Object.keys(current).length === 0){
                return acc + "</p><p>"
            }
            let match = current.match(/(?<hilvl>At Higher Levels\S*)(?<text>.+)/)
            if (match){
                return acc+"<strong>"+match.groups.hilvl+"</strong>"+match.groups.text;
            }
            return acc + current
        }, "<p>");
        value = value.concat("</p>");
        return value;
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


        let concentration;
        if (spellJson.duration instanceof String){
            concentration = Boolean(spellJson.duration.match(/(?<cons>Concentration)/))
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

        let formulas = this._formulas(spellJson)
        let thisSpell = {
            name: this._trimName(spellJson.name),
            type: "spell",
            data: {
                description: {
                    value: this._trimDescription(spellJson.text),
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
                scaling: this._spellScaling(spellJson)
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

        let featPack = await compendiumCreator("-feats");

        for (let feat of featJson){
            let featData = {
                name: feat.name,
                type: "feat",
                data: {
                    'description.value': feat.text,
                    requirements: feat.prerequisite ?? "",
                }
            };

            let item = await Item.create(featData, {temporary: true, displaySheet:false});

            await featPack.importDocument(item);
            console.log(`Done importing ${feat.name.name} into ${featPack.collection}`);
        }

    }
}
export default ItemCreator.getInstance();
