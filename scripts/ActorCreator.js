import Parser from "./Parser.js";
import ItemCreator from "./ItemCreator.js";
import Utilts from "./Utilts.js";
class ActorCreator {
    /**
     * Returns the foundry friendly structure for the ability scores
     *
     * @param stats - ability scores
     * @param saves - saves (used to decide if the creatures is proficient in a stat or not
     * @param proficiency - proficiency score
     * @private
     */
    static _makeAbilitiesStructure(stats, saves, proficiency) {

        const abilitiesObject = {};
        for (const stat in stats) {
            if (!stats.hasOwnProperty(stat))
                continue;

            abilitiesObject[stat.toLowerCase()] = {
                value: Number(stats[stat]),
                proficient: saves ? saves[stat.toLowerCase()] ? 1 : 0 : 0,
                prof: proficiency
            };
        }
        return abilitiesObject;
    }
    /**
     * Returns the foundry friendly structure for skills
     *
     * @param propSkills - object containing all the skills data from the parser
     * @param proficiency - proficiency score
     * @private
     */
    static _makeSkillsStructure(propSkills, proficiency) {
        const skillsObject = {};
        for (const skill in propSkills.skills) {
            if (!propSkills.skills.hasOwnProperty(skill))
                continue;
            skillsObject[Parser.shortenSkills(skill)] = { value: Math.floor(propSkills.skills[skill] / proficiency) };
        }
        return skillsObject;
    }
    /**
     * Returns a foundry friendly structure for resistances
     *
     * @param modifiers - an object with all the damage modifiers of the creature
     * @private
     */
    static default_resistances = ['acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic', 'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder']
    static conditions_default = ['blinded', 'charmed', 'deafened', 'diseased', 'exhaustion', 'frightened', 'grappled', 'incapacitated', 'invisible', 'paralyzed', 'petrified', 'poisoned', 'prone', 'restrained', 'stunned', 'unconscious']
    static _makeResistancesStructure(modifiers) {
        const structure = {};
        for (const key in modifiers) {
            if (!modifiers.hasOwnProperty(key) || !modifiers[key] || Object.keys(modifiers[key]).length == 0)
                continue;
            var defaults;
            if (key === "conditionImmune"){
                defaults = ActorCreator.conditions_default;
            }
            else{
                defaults = ActorCreator.default_resistances;
            }

            var all = modifiers[key];

            //fix spelling
            all = all.replace("bludgenoning", "bludgeoning");
            all = all.replace("blugdeoning", "bludgeoning");

            //search for bypasses
            var match = all.search(/( damage)? ((from .+ (weapons|attacks))|(that is nonmagical)).*/)

            let bypasses = []
            if (match != -1){
                var bypassText = all.slice(match)

                if (bypassText.includes('nonmagical')){
                    bypasses.push("mgc");
                }

                if (bypassText.includes('silver')){
                    bypasses.push("sil");
                }

                if (bypassText.includes('adamantine')){
                    bypasses.push("ada");
                }

                all = all.slice(0,match)
            }

            var standards = [];
            const spliters = /([,;.]|and)/
            var custom = all.split(spliters);

            //find list of custom entries
            for (var i = custom.length - 1; i >= 0; i--){
                if (defaults.includes(custom[i].trim())){
                    standards.push(custom.splice(i, 1)[0]);
                }
                else if (custom[i].match(spliters)){
                    custom.splice(i, 1)
                }
            }

            structure[Parser.convertResistance(key)] = {
                value: standards,
                bypasses,
                custom: custom.join(';')
            };
        }

        return structure;
    }
    /**
     * Returns a foundry friendly structure for the traits part of the actor
     *
     * @private
     * @param propsTraits - object containing all the traits data extracted from the parser
     */
    static default_languages = ['Aarokocra', 'Abyssal', 'Aquan', 'Auran', 'Celestial', 'Common', 'Deep speech', 'Draconic', 'Druidic', 'Dwarvish', 'Elvish', 'Giant', 'Gith', 'Gnoll', 'Gnomish', 'Goblin', 'Halfling', 'Ignan', 'Infernal', 'Orc', 'Primordial', 'Sylvan', 'Terran', 'Cant', 'Undercommon']
    static _makeLanguageStructure (propsTraits){
        if (!propsTraits.languages || Object.keys(propsTraits.languages).length == 0){
            return {
                value: [],
                custom: ""
            }
        }

        var languages = [];
        //Mostly is split with , but sometimes they have Common plus other languages
        var custom_languages = propsTraits.languages.split(/(, | plus )/);
        for (var i = custom_languages.length - 1; i >= 0; i--){
            //TODO why is the split parts being includes?
            if (custom_languages[i].match(/(, | plus )/)){
                custom_languages.splice(i, 1);
            }
            else if (ActorCreator.default_languages.includes(custom_languages[i])){
                languages.push(custom_languages.splice(i, 1)[0].toLowerCase());
            }
        }
        //Empty value is just an empty string
        if(languages.length == 0){
            languages = ""
        }
        //If only 1 element, just use a single string
        else if (languages.length == 1){
            languages = languages[0]
        }

        return {
            value: languages,
            custom: custom_languages.join(";")
        }
    }
    static _makeTraitsStructure(propsTraits) {

        return {
            ...ActorCreator._makeResistancesStructure(propsTraits.damageModifiers),
            size: propsTraits.size,
            languages: ActorCreator._makeLanguageStructure(propsTraits),
        };
    }
    /**
     * Returns a foundry friendly structure for the details part
     *
     * @param propsDetails - object containing all the details data from the parser
     * @param abilities - object structure of all abilities to get the spellcasting level if needed
     * @private
     */
    static _makeDetailsStructure(propsDetails, abilities) {
        return {
            alignment: propsDetails.alignment,
            type: {
                value: propsDetails.type?.trim(),
                subtype: propsDetails.subtype
            },
            cr: propsDetails.challenge['CR'],
            xp: {
                value: propsDetails.challenge['XP']
            },
            spellLevel: abilities?.Spellcasting?.data?.level,
            source: propsDetails.source,
            biography: {value: propsDetails.description},
        };
    }
    /**
     * Returns a foundry friendly structure for the HP
     *
     * @private
     * @param propsHP - object that contains all the hp data extracted from markdown
     */
    static _makeHpStructure(propsHP) {
        return {
            value: Number(propsHP['HP']),
            max: Number(propsHP['HP']),
            formula: propsHP['formula']
        };
    };
    //https://stackoverflow.com/questions/11731072/dividing-an-array-by-filter-function
    static _partition(array, isValid) {
      return array.reduce(([pass, fail], elem) => {
        return isValid(elem) ? [[...pass, elem], fail] : [pass, [...fail, elem]];
      }, [[], []]);
    }
    /**
     * Returns a foundry friendly structure for the AC
     *
     * @private
     * @param propsAC - object that contains all the ac data extracted from markdown
     */
    static _makeAcStructure(props, bubbleUp) {
        const propsAC = props.data.attributes.armor;
        let calc = 'flat';

        //this is stupid that I am using a global

        let valueMod = 0;

        if (!propsAC.Source){
            calc = 'default'
        }
        else{

            let splitList = propsAC.Source.split(',').map(ele => ele.trim());
            let [items, notItems] = ActorCreator._partition(splitList, ele => ActorCreator.ArmorData.hasOwnProperty(ele))

            propsAC.Source = notItems.join(', ')

            if (propsAC.Source.startsWith('natural armor')){
                calc = 'natural'

                if (items.includes("shield")){
                    valueMod -= 2
                }
            }
            else if (items){
                calc = 'default'
            }

            bubbleUp.itemsOut = items.map(item => ActorCreator.ArmorData[item]);
        }

        let acValue = Number(propsAC['AC']) + valueMod;

        //if we are attempting to calculate armor, check that the AC will actually be correct
        if (calc == 'default'){
            let armorValue = ActorCreator._calcArmor(props, bubbleUp.itemsOut);

            if (acValue != armorValue){
                calc = 'flat';
            }
        }

        return {
                value: acValue,
                flat: acValue,
                calc: calc,
            };
    }

    static _calcArmor(props, items){
        let dexMod = Math.floor((Number(props.stats.Dex) - 10) / 2);
        let armor = items?.find(item => item.system.armor?.type != 'shield');

        let armorValue = armor?.system.armor.value ?? 10;
        let maxDex = armor?.system.armor.dex ?? 100;
        let hasShield = !!items?.find(item => item.system.armor?.type == 'shield');;

        return armorValue + Math.min(maxDex, dexMod) + (hasShield ? 2 : 0);
    }


    static _makeSenses(senses){
        if (!senses.vision) {
            return {};
        }

        let sensesOutput = {
            "darkvision": 0,
            "blindsight": 0,
            "tremorsense": 0,
            "truesight": 0,
        }

        let senseList = senses.vision.split(', ')

        //https://stackoverflow.com/questions/11731072/dividing-an-array-by-filter-function
        //modified to return the original items on failures and the matched regex on success
        function partitionRegMatch(array, isValid) {
          return array.reduce(([pass, fail], elem) => {
            let valid = isValid(elem)
            return valid ? [[...pass, valid], fail] : [pass, [...fail, elem]];
          }, [[], []]);
        }

        let [matches, nonMatch] = partitionRegMatch(senseList, sense => {
            let match = sense.match(/(?<sight>[\w]+) (?<distance>\d+) ft\./);

            if(!!match && sensesOutput.hasOwnProperty(match.groups['sight'])){
                return match;
            }
            return false;
        })

        for (let senseMatch of matches){
            sensesOutput[senseMatch.groups['sight']] = Number(senseMatch.groups['distance']);
        }

        sensesOutput["units"] = "ft"
        sensesOutput["special"] = nonMatch.join(', ')

        return sensesOutput
    }
    /**
     * Returns a foundry friendly structure for the attributes tab
     *
     * @param propsData - an object that contains all the data extracted from the parser
     * @private
     */
    static _makeAttributesStructure(props, bubbleUp) {
        return {
            ac: ActorCreator._makeAcStructure(props, bubbleUp),
            hp: ActorCreator._makeHpStructure(props.data.attributes.hp),
            movement: props.data.attributes.movement,
            prof: props.data,
            spellcasting: Parser.shortenAbilities(props.abilities?.Spellcasting?.data?.modifier),
            senses: ActorCreator._makeSenses(props.data.attributes.senses),
        };
    }
    /**
     * Returns the resources structure
     *
     * @param propsRes - object that contains the resources from the parser
     * @private
     */
    static _makeResourcesStructure(propsRes) {
        return {
            legact: {
                value: propsRes?.legendaryActions?.actions,
                max: propsRes?.legendaryActions?.actions
            },
            legres: {
                value: propsRes?.numberOfLegendaryResistances,
                max: propsRes?.numberOfLegendaryResistances
            },
            lair: {
                value: !!(propsRes?.legendaryActions?.lair),
                initiative: propsRes?.legendaryActions?.init,
            },
        };
    }

    /**
     * Returns a foundry friendly structure for the data field of the actor
     *
     * @param propsData - an object that contains all the data extracted from the parser
     * @private
     */
    static _makeDataStructure(props, bubbleUp) {
        return {
            abilities: ActorCreator._makeAbilitiesStructure(props.stats, props.data.savingThrowMods, props.data),
            attributes: ActorCreator._makeAttributesStructure(props, bubbleUp),
            details: ActorCreator._makeDetailsStructure(props.data.details, props.abilities),
            traits: ActorCreator._makeTraitsStructure(props.data.traits),
            skills: ActorCreator._makeSkillsStructure(props.data.skills, props.proficiency),
            resources: ActorCreator._makeResourcesStructure(props.data.resources),
            spells: props.data.spellslots,
        };
    }
    static tokenSize = {
        "grg": 4,
        "lg": 2,
        "huge": 3,
        "med": 1,
        "sm": 1,
        "tiny": 0.5
    }
    static TokenCreator(actor){
        actor.prototypeToken.displayBars = 20;
        actor.prototypeToken.bar1.attribute = "attributes.hp";

        actor.prototypeToken.width = ActorCreator.tokenSize[actor.system.traits.size];
        actor.prototypeToken.height = ActorCreator.tokenSize[actor.system.traits.size];

        if (actor.system.resources?.legact?.max > 0){
            actor.prototypeToken.bar2.attribute = "resources.legact";
        }
        else if (actor.system.resources?.legres?.max > 0){
            actor.prototypeToken.bar2.attribute = "resources.legres";
        }
    }
    /**
     * Returns an object of all the data parsed
     *
     * @param actorJson - input text
     * @private
     */
    static _makeProps(actorJson) {
        const typeAndSource = Parser.getCreatureTypeAndSource(actorJson);

        const descriptionAndSource = Parser.getDescriptionAndSource(actorJson['description'])

        const legend = Parser.getLegendaryActions(actorJson);
        const props = {
            name: Parser.getCreatureName(actorJson),
            abilities: Parser.getAbilities(actorJson),
            reactions: Parser.getReactions(actorJson),
            legendaryActions: legend,
            spells: Parser.getSpells(actorJson),
            innate: Parser.getInnateSpells(actorJson),
            stats: Parser.getCreatureStats(actorJson),
            data: {
                savingThrowMods: Parser.getSavingThrowMods(actorJson),
                attributes: {
                    armor: Parser.getCreatureACAndSource(actorJson),
                    movement: Parser.getCreatureSpeed(actorJson),
                    senses: Parser.getSenses(actorJson),
                    hp: Parser.getCreatureHP(actorJson),
                },
                details: {
                    alignment: Parser.getCreatureAlignment(actorJson),
                    type: typeAndSource['type'],
                    subtype: typeAndSource['subtype'],
                    challenge: Parser.getChallenge(actorJson),
                    //source could appear in multiple places, I think
                    source: typeAndSource['source'] ?? descriptionAndSource['source'],
                    description: descriptionAndSource['description'],
                },
                traits: {
                    size: Parser.getCreatureSize(actorJson),
                    languages: Parser.getLanguages(actorJson),
                    damageModifiers: Parser.getDamageModifiers(actorJson),
                },
                skills: {
                    skills: Parser.getSkills(actorJson)
                },
                resources: {
                    legendaryActions: legend,
                    numberOfLegendaryResistances: Parser.getNumberOfLegendaryResistances(actorJson)
                },
                spellslots: Parser.getSpellSlots(actorJson)
            },
        };
        props['proficiency'] = Parser.getProficiencyFromCR(props?.data?.details?.challenge?.CR);
        return props;
    };

    static async createActor(actorJson, pack) {
        await ActorCreator.LoadArmorData();

        // console.log(actorJson)

        const props = ActorCreator._makeProps(actorJson);

        let bubbleUp = {};

        let actor_struct = {
            name: props.name,
            type: "npc",
            img: Utilts.getImage("Actor", props.name),
            system: ActorCreator._makeDataStructure(props, bubbleUp),
            // folder: "KExLZFbww2G4bns4",
        }

        let temp_actor = await Actor.create(actor_struct, { displaySheet: false, temporary: true });

        let actor = await pack.importDocument(temp_actor);

        let itemListsToAdd = [];


        if (props.abilities){
            itemListsToAdd.push(ItemCreator.abilitiesAdder(actor, props.abilities, props.stats, false));
        }
        if (props.legendaryActions){
            if(props.legendaryActions.legend){
                itemListsToAdd.push(ItemCreator.abilitiesAdder(actor, props.legendaryActions.legend, props.stats, false));
            }

            if(props.legendaryActions.lair){
                itemListsToAdd.push(ItemCreator.abilitiesAdder(actor, props.legendaryActions.lair, props.stats, false));
            }

            if (props.legendaryActions.region){
                itemListsToAdd.push([ItemCreator.itemCreator(actor, props.legendaryActions.region.name, props.legendaryActions.region, props.stats, false)]);
            }
        }
        if (props.reactions){
            itemListsToAdd.push(ItemCreator.abilitiesAdder(actor, props.reactions, props.stats, true));
        }
        if (props.spells){
            itemListsToAdd.push(ItemCreator.spellsAdder(actor, props.spells));
        }
        if (props.innate){
            itemListsToAdd.push(ItemCreator.innateAdder(actor, props.innate));
        }

        let itemsToAdd = await Promise.all([].concat(...(await Promise.all(itemListsToAdd))));

        try {
            await actor.createEmbeddedDocuments("Item", itemsToAdd);
        }
        catch (e) {
            let str = `There has been an error while creating items in ${props.name}`;
            Utilts.notificationCreator('error', str);
            console.error(str)
            console.error(e);
        }

        if (bubbleUp.itemsOut && bubbleUp.itemsOut.length > 0){
            let res = await actor.createEmbeddedDocuments("Item", bubbleUp.itemsOut);

            //for some reason the items are not equiped when added to sheet
            //so update the item so it is
            await actor.updateEmbeddedDocuments("Item", res.map(item => {return {_id: item.id, 'data.equipped':true, 'data.proficient':true, }}));
        }

        console.log(`Done importing ${props.name} into ${pack.collection}`);
    }

    static async LoadArmorData(){
        //Load Armor
        if (!ActorCreator.ArmorData){
            //check for equiped armor set
            const PossibleArmor = new Set([
                "shield",
                "leather armor",
                "studded leather armor",
                "hide armor",
                "chain shirt",
                "chain mail",
                "scale mail",
                "ring mail",
                "half plate armor",
                "plate armor",
                "breastplate",
            ]);

            ActorCreator.ArmorData = {};
            for (const item of PossibleArmor){
                let data = (await Utilts.getItemData(item))

                if (!data){
                    console.warn(`Did not find data for ${item}`);
                }
                else{
                    data.system.equipped = true;
                    data.system.proficient = true;
                    ActorCreator.ArmorData[item] = data;
                }
            }
        }
    }
}
export default ActorCreator;
