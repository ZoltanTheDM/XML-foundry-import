import Parser from "./Parser.js";

class RaceCreator {
    constructor() {
    }
    static getInstance() {
        if (!RaceCreator._instance)
            RaceCreator._instance = new RaceCreator();
        return RaceCreator._instance;
    }

    async MakeRaces(raceJson, compendiumCreator, setabilities=false){
        this.racePack = await compendiumCreator("-race", "Item");

        this.holdem = [];

        for (let raceData of raceJson){
            try{
                let itemTemp = await this.handleSingleRace(raceData, setabilities);
                await this.racePack.importDocument(itemTemp);
                console.log(`Done importing ${raceData.name} into ${this.racePack.collection}`);
            }
            catch(error){
                console.error(`Failed on race ${raceData.name}`)
                console.warn(raceData)
                console.warn(error)
            }
        }


        let h = [...new Set(this.holdem)]
        // console.log(h)

    }

    async handleSingleRace(raceData, setabilities){

            // console.log(raceData);

            let ds;

            let text = raceData.trait.reduce((acc, trait) => {
                if (trait.name == "Description"){
                    ds = Parser.getDescriptionAndSource(trait.text);

                    //too lazy to fix earlier. Fixing here
                    ds.description = ds.description.replace("<p></p>", "")

                    if(ds.description){
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

            let advancement = await this.makeAdvancements(raceData, setabilities)

            let item = {
                name: raceData.name,
                type: "race",
                system: {
                    description: {value: text},
                    source: ds.source,
                    advancement,
                    movement: {
                      walk: raceData.speed,
                      units: 'ft',
                    },
                    senses: this.makeSenses(raceData),
                },
            };

            return Item.create(item, {temporary: true, displaySheet:false});
    }

    async makeAdvancements(raceData, setabilities){

        let advancements = await raceData.trait.reduce(async (acc, ele) => {

            acc = await acc;

            if(ele.name == "Size"){
                acc.push(this.makeSizeAdvancement(ele, raceData.size));
            }
            else if(/Languages?/i.test(ele.name)){
                acc.push(this.makeLanguageAdvancement(ele));
            }
            else if(RaceCreator.isProficiencies(ele.text)){
                acc.push(this.makeTraitAdvancement(ele));
            }
            //TODO
            // else if(RaceCreator.isResistances(ele.text)){
            //     acc.push(this.makeResAdvancement(ele));
            // }
            else if(RaceCreator.skipThis(ele.name)){
                //do nothing
            }
            else{
                //make a basic item for this
                let granter = RaceCreator.getGrantItem(acc);
                granter.configuration.items.push((await this.makeRaceItem(ele)).uuid);
            }

            return acc;
        }, [])

        return advancements.concat([
            this.makeASIAdvancement(raceData.ability, setabilities),
        ]);
    }

    static getGrantItem(accumuated){
        let foundGranter = accumuated.find(n => n.type == "ItemGrant");

        if (foundGranter){
            return foundGranter;
        }

        accumuated.push({
            type: "ItemGrant",
            configuration: {
                items: [],
            },
            level: 0,
            _id: randomID(16)
        });

        return accumuated.find(n => n.type == "ItemGrant");
    }

    makeSenses(raceData){
        
        let output = {};

        let darkvision = raceData.trait.find(ele => RaceCreator.isDarkVision(ele.name));

        if(darkvision){
            let match = darkvision.text.match(/(?<range>\d+)/);

            if (match){
                output.darkvision = parseInt(match.groups['range']);
            }
            else{
                console.warn(`Could not find darkvision range in '${darkvision.text}'`);
            }
        }

        return output;
    }

    async makeRaceItem(element){

        let featData = {
            name: element.name,
            type: "feat",
            system: {
                type: {value: "race"},
                description: {value: element.text},
            }
        };

        // console.log(featData)

        let item = await Item.create(featData, {temporary: true, displaySheet:false});

        // console.log("Here??")
        // console.log(featData)

        let imp = await this.racePack.importDocument(item);
        console.log(`Done importing ${element.name} into ${this.racePack.collection}`);

        return imp;
    }

    static isDarkVision(name){
        return /darkvision?/gi.test(name)
    }

    static ProfRegEx = /You (?:(?:have)|(?:gain)) proficiency (?:(?:in)|(?:with)) (?<proficiencies>[^\.]+)/i
    static isProficiencies(text){
        return RaceCreator.ProfRegEx.test(text)
    }

    //certain elements can be skipped
    static skipThis(name){
        return /Age/i.test(name) ||
            /Alignment/i.test(name) ||
            /Description/i.test(name) ||
            /Speed/i.test(name) ||
            /Darkvision/i.test(name) ||
            /Creature Type/i.test(name);
    }



    makeTraitAdvancement(traitData){
        let profMatch = traitData.text.match(RaceCreator.ProfRegEx);

        let choices = [];
        let grants = [];

        if (/your choice/.test(profMatch.groups['proficiencies'])){
            function choiceMatcher(group, matcher, par={})
            {
                if(!par.countParcer){
                    par.countParcer = match=>Parser._numberMap[match.groups['number']];
                }
                if(!par.poolParcer){
                    par.poolParcer = match=>RaceCreator.spitNLList2(match.groups['pool']).map(RaceCreator.MapSkillNames);
                }

                let match = group.match(matcher);

                if (!match){
                    return [];
                }

                return [{
                    count: par.countParcer(match),
                    pool: par.poolParcer(match),
                }];
            }

            choices = choices.concat(choiceMatcher(
                profMatch.groups['proficiencies'],
                /(?<number>\w+) of the following skills of your choice: (?<pool>.+)/
            ));

            choices = choices.concat(choiceMatcher(
                profMatch.groups['proficiencies'],
                /any combination of (?<number>\w+)/,
                {poolParcer: n=>["skills:*", "tool:*"]}
            ));

            choices = choices.concat(choiceMatcher(
                profMatch.groups['proficiencies'],
                /^(?<number>\w+) skills? of your choice/,
                {poolParcer: n=>["skills:*"]}
            ));

            choices = choices.concat(choiceMatcher(
                profMatch.groups['proficiencies'],
                /(?<number>\w+) tools? of your choice/,
                {poolParcer: n=>["tool:*"]}
            ));

            choices = choices.concat(choiceMatcher(
                profMatch.groups['proficiencies'],
                /artisan's tools of your choice: (?<pool>.+)/,
                {countParcer: n=>1}
            ));

            //TODO
            //some special cases that I am too lazy to do
            if (profMatch.groups['proficiencies'] == "Acrobatics or the Stealth skill (your choice)"){
                choice.push({
                    count: 1,
                    pool: ["skills:acr", "skills:ste"]
                });
            }
            else if (profMatch.groups['proficiencies'] == "Performance and Persuasion skills, and you have proficiency with one musical instrument of your choice"){
                choice.push({
                    count: 1,
                    pool: ["tool:music:*"]
                });
                grants.push(["skills:prf", "skills:per"])
            }
        }
        else{
            function trimWords(words){
                let output = words.replace(/skills?/, '');
                output = output.replace(/the\s+/, '');
                output = output.replace(/in\s+/, '');
                output = output.replace(/\s+$/, '');
                output = output.replace(/^\s+/, '');

                return output;
            }

            grants = RaceCreator.spitNLList2(profMatch.groups['proficiencies']).map(
                words=>RaceCreator.MapSkillNames(trimWords(words))
            );
        }




        return {
            _id: randomID(16),
            type: "Trait",
            configuration: {
                grants: grants,
                choices: choices,
                hint: traitData.text
            },
            title: traitData.name,
        };
    }

    static MapSkillNames(name){

        const SkillMap = {
            "acrobatics"            : "skills:acr",
            "animal handling"       : "skills:ani",
            "arcane"                : "skills:arc",
            "athletics"             : "skills:ath",
            "deception"             : "skills:dec",
            "history"               : "skills:his",
            "insight"               : "skills:ins",
            "intimidation"          : "skills:itm",
            "investigation"         : "skills:inv",
            "medicine"              : "skills:med",
            "nature"                : "skills:nat",
            "perception"            : "skills:prc",
            "performance"           : "skills:prf",
            "persuasion"            : "skills:per",
            "religion"              : "skills:rel",
            "sleight of hand"       : "skills:slt",
            "stealth"               : "skills:ste",
            "survival"              : "skills:sur",
            "battleaxe"             : "weapon:mar:battleaxe",
            "handaxe"               : "weapon:sim:handaxe",
            "light hammer"          : "weapon:sim:lighthammer",
            "warhammer"             : "weapon:mar:warhammer",
            "rapier"                : "weapon:mar:rapier",
            "shortsword"            : "weapon:mar:shortsword",
            "hand crossbow"         : "weapon:mar:handcrossbow",
            "longsword"             : "weapon:mar:longsword",
            "khopesh (longsword)"   : "weapon:mar:longsword",
            "shortbow"              : "weapon:sim:shortbow",
            "spear"                 : "weapon:sim:spear",
            "longbow"               : "weapon:mar:longbow",
            "javelin"               : "weapon:sim:javelin",
            "smith's tools"         : "tool:art:smith",
            "brewer's supplies"     : "tool:art:brewer",
            "mason's tools"         : "tool:art:mason",
            "artisan's tools (tinker's tools)": "tool:art:tinker",
            "navigator's tools"     : "tool:navg",
            "vehicles (water)"      : "tool:vehicle:water",
            "thieves' tools"        : "tool:thief",
            "poisoner's kit"        : "tool:pois",
            "light"                 : "armor:lgt",
            "medium armor"          : "armor:med",
        }

        let val = SkillMap[name.toLowerCase()]

        if (!val){
            console.warn(`Could not find mapped skill for ${name}`);
        }

        return val;
    }

    makeSizeAdvancement(sizeTrait, sizeLetter){
        const SizeMap = {
            "T": "tiny",
            "S": "sm",
            "M": "med",
            "L": "lg",
            "H": "huge",
            "G": "grg"
        };

        let size = SizeMap[sizeLetter];

        if (!size){
            size = "med";
            console.warn("Could not find a size, defaulting to Medium")
        }

        return {
            "_id": randomID(16),
            "type": "Size",
            "configuration": {
              "hint": sizeTrait.text,
              "sizes": [size]
            }
        }
    }

    makeLanguageAdvancement(languageTrait){
        let langMatch = languageTrait.text.match(/You (?:can )?(?:speak, )?read,? and write (?<languages>[^\.]+)/i)

        let configuration = {};

        if (langMatch){
            const langs = this.spitNLList(langMatch.groups['languages'])

            const LanguageMap = {
                "Common": "languages:standard:common",
                "Draconic": "languages:exotic:draconic",
                "Dwarvish": "languages:standard:dwarvish",
                "Elvish": "languages:standard:elvish",
                "Gnomish": "languages:standard:gnomish",
                "Orc": "languages:standard:orc",
                "Halfling": "languages:standard:halfling",
                "Infernal": "languages:exotic:infernal",
                "Terran": "languages:exotic:primordial:terran",
                "Undercommon": "languages:exotic:undercommon",
                "Goblin (DMG)": "languages:standard:goblin",
                "Goblin": "languages:standard:goblin",
                "Aquan": "languages:exotic:primordial:aquan",
                "Orc (DMG)": "languages:exotic:orc",
                "Primordial": "languages:exotic:primordial:*",
                "Gith": "languages:exotic:gith",
                "Celestial": "languages:exotic:celestial",
                "Giant": "languages:standard:giant",
                "Abyssal": "languages:exotic:abyssal",
                "Sylvan": "languages:exotic:sylvan",
                "Common (if it exists in your campaign)": "languages:standard:common",
                "Gith (UA) (Githyanki)": "languages:exotic:gith",
                "Gith (UA) (Githzerai)": "languages:exotic:gith",
            }

            const ChoicesMap = {
                "one extra language of your choice": {
                    "count": 1,
                    "pool": [
                        "languages:*"
                    ]
                },
                "one other language of your choice": {
                    "count": 1,
                    "pool": [
                        "languages:*"
                    ]
                },
                "your choice of Elvish or Vedalken": {
                    "count": 1,
                    "pool": [
                        "languages:standard:elvish"
                    ]
                },
                "two other languages of your choice": {
                    "count": 2,
                    "pool": [
                        "languages:*"
                    ]
                },
                "one other language that you": {
                    "count": 1,
                    "pool": [
                        "languages:*"
                    ]
                },
                "one additional language of your choice": {
                    "count": 1,
                    "pool": [
                        "languages:*"
                    ]
                },
            }

                // Languages with no mapping
                // "Troglodyte (DMG)": "languages:exotic:common",
                // "Bullywug (DMG)": "languages:standard:common",
                // "Loxodon": "languages:exotic:common",
                // "Minotaur": "languages:exotic:common",
                // "Vedalken": "languages:exotic:common",
                // "Quori": "languages:exotic:common",
                // "Grung": "languages:exotic:common",
                // "Leonin": "languages:exotic:common",
                // "your DM agree is appropriate for your character": "languages:exotic:common",
                // "Aven": "languages:exotic:common",
                // "Khenra": "languages:exotic:common",
                // "Naga": "languages:exotic:common",
                // "Vedalken (Kaladesh)": "languages:exotic:common",
                // "Merfolk": "languages:exotic:common",
                // "Siren": "languages:exotic:common",
                // "Vampire": "languages:exotic:common",
                // "communicate in the silent speech of the Kor": "languages:exotic:common",
                // "Minotaur (UA)": "languages:exotic:common",

            configuration = langs.reduce((acc, ele) => {
                if (LanguageMap[ele]){
                    acc.grants.push(LanguageMap[ele]);
                }
                else if (ChoicesMap[ele]){
                    acc.choices.push(ChoicesMap[ele]);
                }

                return acc;
            }, {
                grants: [],
                choices: []
            });
        }

        configuration.hint = languageTrait.text;

        return {
            type: "Trait",
            configuration,
            _id: randomID(16),
        };
    }

    spitNLList(text){
        let match = text.split(/(?:\s+and\s+)|(?:,\s+and\s+)|(?:,\s+)/);

        return match
    }


    static spitNLList2(text) {
        let TwoItems = /(?<item1>.+) (?:(?:and)|(?:or)) (?<item2>.+)/
        let ThreePlusItems = /(?<itemX>(?:(.+), ){2,})(?:(?:and)|(?:or)) (?<item2>.+)/

        if (ThreePlusItems.test(text)){
            let x = text.match(ThreePlusItems);
            return x.groups['itemX'].split(', ').slice(0, -1).concat([x.groups['item2']])
        }
        else if (TwoItems.test(text)){
            let x = text.match(TwoItems)
            return [x.groups['item1'], x.groups['item2']]
        }
        else{
            return [text]
        }
    }


    makeASIAdvancement(text, setabilities){

        let ab = {
            "type": "AbilityScoreImprovement",
            "_id": randomID(16),
            "configuration": {
            },
            "value": {
              "type": "asi"
            },
            "level": 0,
        };

        if (setabilities){
            ab.configuration = {
                "points": 3,
                "fixed": {
                    "str": 0,
                    "dex": 0,
                    "con": 0,
                    "int": 0,
                    "wis": 0,
                    "cha": 0
                },
                "cap": 2
            }
        }
        //some don't have any fixed ability score increases
        else if (typeof text === 'string'){
            const abilitiesMatch = text.matchAll(/(\w+) (\d+)/g);

            let fixed = {
                "str": 0,
                "dex": 0,
                "con": 0,
                "int": 0,
                "wis": 0,
                "cha": 0
            };


            for (let match of abilitiesMatch){
                fixed[match[1].toLowerCase()] += parseInt(match[2])
            }

            ab.configuration = {fixed}
        }

        return ab;

    }
};

export default RaceCreator.getInstance();
