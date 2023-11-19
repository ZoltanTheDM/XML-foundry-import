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
        let racePack = await compendiumCreator("-race", "Item");

        this.holdem = [];

        for (let raceData of raceJson){
            try{
                let itemTemp = await this.handleSingleRace(raceData, setabilities);
                await racePack.importDocument(itemTemp);
                console.log(`Done importing ${raceData.name} into ${racePack.collection}`);
            }
            catch(error){
                console.error(`Failed on race ${raceData.name}`)
                console.warn(raceData)
                console.warn(error)
            }
        }

        console.log(new Set(this.holdem))

    }

    async handleSingleRace(raceData, setabilities){

            console.log(raceData);

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

            let advancement = this.makeAdvancements(raceData, setabilities)

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
                },
            };

            return Item.create(item, {temporary: true, displaySheet:false});
    }

    makeAdvancements(raceData, setabilities){

        let advancements = raceData.trait.reduce((acc, ele) => {

            if(ele.name == "Size"){
                acc.push(this.makeSizeAdvancement(ele, raceData.size));
            }
            if(/Languages?/i.test(ele.name)){
                acc.push(this.makeLanguageAdvancement(ele));
            }
            if(/darkvision?/i.test(ele.name)){
                acc.push(this.makeLanguageAdvancement(ele));
            }

            return acc;
        }, [])

        return advancements.concat([
            this.makeASIAdvancement(raceData.ability, setabilities),
        ]);
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

        if (!langMatch){
            console.warn("Failed on dong any language matching!");
            console.log(languageTrait)
        }
        else{
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
        this.holdem = this.holdem.concat(match)

        return match
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
