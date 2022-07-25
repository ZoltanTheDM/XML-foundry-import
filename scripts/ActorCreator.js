import Parser from "./Parser.js";
import ItemCreator from "./ItemCreator.js";
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
                proficient: saves ? saves[stat] ? 1 : 0 : 0,
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
    static default_resistances = ['acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic', 'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder', 'physical']
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

            //search for non-magical attack damage
            var match = all.search(/((bludgeoning, piercing, (and )?slashing)|(bludgeoning piercing and slashing)|(piercing and slashing))( damage)? ((from .+ (weapons|attacks))|(that is nonmagical))/)

            var fromWeapons = null;
            if (match != -1){
                let temp = all.slice(match);

                if (temp.match(/^bludgeoning,? piercing,? (and )?slashing from nonmagical attacks$/)){
                    //there are no special features of this non-magical resistance
                }
                else{
                    fromWeapons = all.slice(match)
                }

                all = all.slice(0,match)
                all = all.concat(",physical");
            }

            var standards = [];
            const spliters = /[,;.] ?/
            var custom = all.split(spliters);
            for (var i = custom.length - 1; i >= 0; i--){
                if (defaults.includes(custom[i].trim())){
                    standards.push(custom.splice(i, 1)[0]);
                }
            }

            if(standards.length == 0){
                standards = ""
            }
            else if (standards.length == 1){
                standards = standards[0]
            }

            // if (custom.length > 0 && !(custom.length == 1 && /^\s*$/.test(custom[0])) ){
            //     console.error(custom);
            // }

            if (fromWeapons){
                custom.push(fromWeapons)
            }

            structure[Parser.convertResistance(key)] = {
                value: standards,
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
            senses: propsTraits.senses['vision']
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
            type: propsDetails.type,
            cr: propsDetails.challenge['CR'],
            xp: {
                value: propsDetails.challenge['XP']
            },
            spellLevel: abilities?.Spellcasting?.data?.level,
            source: propsDetails.source
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
    static _makeAcStructure(propsAC) {
        let calc = 'flat';

        //this is stupid that I am using a global
        ActorCreator.TempArmor = [];

        let valueMod = 0;

        if (!propsAC.Source){
            calc = 'default'
        }
        else{

            let splitList = propsAC.Source.split(',').map(ele => ele.trim());
            let [items, notItems] = ActorCreator._partition(splitList, ele => ActorCreator.ArmorData.hasOwnProperty(ele))

            propsAC.Source = notItems.join(', ')

            if (propsAC.Source == 'natural armor'){
                calc = 'natural'

                if (items.includes("shield")){
                    console.log("shield noticed")
                    valueMod -= 2
                }
            }
            else if (items){
                calc = 'default'
            }

            console.log(`Add ${items} to items`);
            ActorCreator.TempArmor = items.map(item => ActorCreator.ArmorData[item])
            // for (let item of items){
                // (ActorCreator.ArmorData[item])
                // console.log(await ItemCreator._getEntityFromCompendium(item, "Item"));
            // }
        }


        return {
                value: Number(propsAC['AC']) + valueMod,
                flat: Number(propsAC['AC']) + valueMod,
                calc: calc,
                formula: "",
            };
    }
    /**
     * Returns a foundry friendly structure for the attributes tab
     *
     * @param propsAttributes - object containing all the attributes extracted from markdown
     * @param creatureProficiency - creature's proficiency modifier
     * @param abilities - abilities object for extracting the spellcaster abilities of the creature
     * @private
     */
    static _makeAttributesStructure(propsAttributes, creatureProficiency, abilities) {
        return {
            ac: ActorCreator._makeAcStructure(propsAttributes.armor),
            hp: ActorCreator._makeHpStructure(propsAttributes.hp),
            movement: propsAttributes.movement,
            prof: creatureProficiency,
            spellcasting: Parser.shortenAbilities(abilities?.Spellcasting?.data?.modifier)
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
                value: propsRes?.numberOfLegendaryActions,
                max: propsRes?.numberOfLegendaryActions
            },
            legres: {
                value: propsRes?.numberOfLegendaryResistances,
                max: propsRes?.numberOfLegendaryResistances
            }
        };
    }

    /**
     * Returns a foundry friendly structure for the data field of the actor
     *
     * @param propsData - an object that contains all the data extracted from the parser
     * @param creatureProficiency - proficiency of the actor
     * @param creatureAbilities - abilities object of the actor
     * @param creatureStats - stats of the actor
     * @private
     */
    static _makeDataStructure(propsData, creatureProficiency, creatureAbilities, creatureStats) {
        return {
            abilities: ActorCreator._makeAbilitiesStructure(creatureStats, propsData.savingThrowMods, creatureProficiency),
            attributes: ActorCreator._makeAttributesStructure(propsData.attributes, creatureProficiency, creatureAbilities),
            details: ActorCreator._makeDetailsStructure(propsData.details, creatureAbilities),
            traits: ActorCreator._makeTraitsStructure(propsData.traits),
            skills: ActorCreator._makeSkillsStructure(propsData.skills, creatureProficiency),
            resources: ActorCreator._makeResourcesStructure(propsData.resources),
            spells: propsData.spellslots
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
        actor.data.token.displayBars = 20;
        actor.data.token.bar1.attribute = "attributes.hp";

        actor.data.token.width = ActorCreator.tokenSize[actor.data.data.traits.size];
        actor.data.token.height = ActorCreator.tokenSize[actor.data.data.traits.size];

        if (actor.data.data.resources?.legact?.max > 0){
            actor.data.token.bar2.attribute = "resources.legact";
        }
        else if (actor.data.data.resources?.legres?.max > 0){
            actor.data.token.bar2.attribute = "resources.legres";
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
        const props = {
            name: Parser.getCreatureName(actorJson),
            abilities: Parser.getAbilities(actorJson),
            reactions: Parser.getReactions(actorJson),
            legendaryActions: Parser.getLegendaryActions(actorJson),
            spells: Parser.getSpells(actorJson),
            innate: Parser.getInnateSpells(actorJson),
            stats: Parser.getCreatureStats(actorJson),
            data: {
                savingThrowMods: Parser.getSavingThrowMods(actorJson),
                attributes: {
                    armor: Parser.getCreatureACAndSource(actorJson),
                    movement: Parser.getCreatureSpeed(actorJson),
                    hp: Parser.getCreatureHP(actorJson)
                },
                details: {
                    alignment: Parser.getCreatureAlignment(actorJson),
                    type: typeAndSource['type'],
                    challenge: Parser.getChallenge(actorJson),
                    source: typeAndSource['source']
                },
                traits: {
                    size: Parser.getCreatureSize(actorJson),
                    languages: Parser.getLanguages(actorJson),
                    senses: Parser.getSenses(actorJson),
                    damageModifiers: Parser.getDamageModifiers(actorJson),
                },
                skills: {
                    skills: Parser.getSkills(actorJson)
                },
                resources: {
                    numberOfLegendaryActions: Parser.getNumberOfLegendaryActions(actorJson),
                    numberOfLegendaryResistances: Parser.getNumberOfLegendaryResistances(actorJson)
                },
                spellslots: Parser.getSpellSlots(actorJson)
            }
        };
        props['proficiency'] = Parser.getProficiencyFromCR(props?.data?.details?.challenge?.CR);
        return props;
    };

    static async createActor(actorJson, pack) {
        await ActorCreator.LoadArmorData();

        // var actorJson = Parser.xmlToJson(actorXml)
        // console.log(actorJson)
        const props = ActorCreator._makeProps(actorJson);

        // ActorCreator._makeDataStructure(props.data, props.proficiency, props.abilities, props.stats);
        // console.log(ActorCreator._makeDataStructure(props.data, props.proficiency, props.abilities, props.stats))

        let img = await ItemCreator._getEntityImageFromCompendium(props.name.toLowerCase(), "Actor");

        if (!img){
            img = "icons/svg/mystery-man.svg";
        }

        let actor_struct = {
            name: props.name,
            type: "npc",
            img: img,
            sort: 12000,
            data: ActorCreator._makeDataStructure(props.data, props.proficiency, props.abilities, props.stats),
            token: {},
            items: [],
            flags: {},
            // folder: "zfFq2hfQkzxQaKNf",
        }

        // console.log(actor_struct);

        //for some reason I can't add a temporary actor
        //to a compendium...
        const temporary = false;

        let actor = await Actor.create(actor_struct, { displaySheet: false, temporary: temporary });
        // console.log(actor)
        if (props.abilities)
            await ItemCreator.abilitiesAdder(actor, props.abilities, props.stats, false);
        if (props.legendaryActions)
            await ItemCreator.abilitiesAdder(actor, props.legendaryActions, props.stats, false);
        if (props.reactions)
            await ItemCreator.abilitiesAdder(actor, props.reactions, props.stats, true);
        if (props.spells){
            await ItemCreator.spellsAdder(actor, props.spells);
        }
        if (props.innate){
            await ItemCreator.innateAdder(actor, props.innate);
        }

        if (ActorCreator.TempArmor.length > 0){
            // console.log(ActorCreator.TempArmor)
            let res = await actor.createEmbeddedDocuments("Item", ActorCreator.TempArmor);

            //for some reason the items are not equiped when added to sheet
            //so update the item so it is
            await actor.updateEmbeddedDocuments("Item", res.map(item => {return {_id: item.id, 'data.equipped':true, 'data.proficient':true, }}));
        }

        ActorCreator.TokenCreator(actor)

        // console.log(actor);
        await pack.importDocument(actor);

        if (!temporary){
            //delete the actor if it is not temporary
            actor.delete();
        }

        await pack.getIndex(); // Need to refresh the index to update it

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
                let data = await ItemCreator.getItemDataFromCompendium(item, "Item")

                if (!data){
                    console.warn(`Did not find data for ${item}`);
                }
                else{
                    data.data.equipped = true;
                    data.data.proficient = true;
                    ActorCreator.ArmorData[item] = data;
                }
            }
            console.log(ActorCreator.ArmorData)
        }
    }
}
export default ActorCreator;
