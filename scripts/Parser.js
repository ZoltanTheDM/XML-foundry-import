class Parser {
    static _skillsToShortMap = {
        'Acrobatics': 'acr',
        'Animal Handling': 'ani',
        'Animal handling': 'ani', //Something has a different capitalization
        'Arcana': 'arc',
        'Athletics': 'ath',
        'Deception': 'dec',
        'History': 'his',
        'Insight': 'ins',
        'Intimidation': 'itm',
        'Investigation': 'inv',
        'Medicine': 'med',
        'Nature': 'nat',
        'Perception': 'prc',
        'Performance': 'prf',
        'Persuasion': 'per',
        'Presuasion': 'per', //Something is mispelled in the data set
        'Religion': 'rel',
        'Sleight of Hand': 'slt',
        'Sleight of hand': 'slt', //Something has a different capitalization
        'Stealth': 'ste',
        'Survival': 'sur',
    };
    static _sizesMap = {
        "G": "grg",
        "L": "lg",
        "H": "huge",
        "M": "med",
        "S": "sm",
        "T": "tiny"
    };
    static _resistanceMap = {
        "immune": "di",
        "vulnerable": "dv",
        "resist": "dr",
        "conditionImmune": "ci"
    };
    static _abilitiesMap = {
        'Strength': 'str',
        'Dexterity': 'dex',
        'Constitution': 'con',
        'Intelligence': 'int',
        "Wisdom": 'wis',
        "Charisma": 'cha'
    };
    static _unitMap = {
        'foot': 'ft',
        'feet': 'ft',
        'ft': 'ft',
        'mile': 'mi',
    };
    static _numberMap = {
        'two': 2,
        'three': 3,
        'four': 4,
        'six': 6,
        'eight': 8,
        'nine': 9,
        'twenty': 20,
    };

    static shortenAbilities(ability) {
        if (ability){
            return Parser._abilitiesMap[ability];
        }

        return "";
    }
    static shortenSkills(skill) {
        return Parser._skillsToShortMap[skill];
    }
    static convertSizes(size) {
        return Parser._sizesMap[size];
    }
    static convertResistance(resistance) {
        return Parser._resistanceMap[resistance];
    }
    static _clearText(text) {
        text = text.replace(/_/g, '');
        return text;
    }
    static _clearNumber(text) {
        var match = text.match(/^([\dOl]+)/);
        return match[1].replace("O", "0").replace("l", "1");
    }
    /**
     * Returns a creature's name
     *
     * @param text - markdown text
     */
    static getCreatureName(json) {
        return json["name"];
    }
    static getCreatureSize(json) {
        return Parser._sizesMap[json["size"]];
    }
    static getCreatureAlignment(json) {
        return json["alignment"];
    }
    // static getCreatureSizeAndAlignment(text) {
    //     const match = text.match(/\*(\w+) (\w+).*, (.*?)\*/);
    //     if (!match)
    //         return;
    //     return {
    //         size: match[1],
    //         race: match[2],
    //         alignment: match[3]
    //     };
    // }
    /**
     * Returns an object that contains the creatures AC and the source of that armor class
     *
     * @Fields: AC, source
     *
     * @param text - markdown text
     */
    static getCreatureACAndSource(json) {
        return {
            AC: json['ac'].match(/^(\d+)/)[1],
        }
        
    }
    /**
     * Returns an object that contains the creatures HP and the formula to calculate it
     *
     * @Fields: HP, formula
     *
     * @param text - markdown text
     */
    static getCreatureHP(json) {
        const match = json['hp'].match(/([0-9]+) \((.*?)\)/);
        if (match){
            return {
                HP: match[1],
                formula: match[2]
            };
        }
        else{
            return {
                HP: 0,
                formula: json['hp']
            };
        }
    }
    /**
     * Returns an object that contains a creature's speed
     *
     * @Fields: value, special
     *
     * @param text - markdown text
     */
    static getCreatureSpeed(json) {
        const speedMatch = json['speed'].match(/([0-9]+ ft.),? ?(.*)?/);
        return { value: speedMatch[1], special: speedMatch[2] };
    }

    static getCreatureTypeAndSource(json) {
        const typeMatch = json['type'].match(/^\s*(?<type>[\w ]+)\s*(\((?<subtype>[^\)]+)\))?\s*(, \s*(?<source>.+))?$/);//\s*(?<subtype>\([^\)]\))?\s*(, )?\s*(?<source>[\w ]+)?$
        return { type: typeMatch.groups['type'], source: typeMatch.groups['source'] };
    }
    /**
     * Returns a creature's stats
     *
     * @Fields: Str, Dex, Con, Int, Wis, Cha
     *
     * @param text - markdown text
     */
    static getCreatureStats(json) {
        // const stats = [...text.matchAll(/\|([0-9]+) \([+-][0-9]+\)/g)];
        const updatedStats = {
            Str: Parser._clearNumber(json['str']),
            Dex: Parser._clearNumber(json['dex']),
            Con: Parser._clearNumber(json['con']),
            Int: Parser._clearNumber(json['int']),
            Wis: Parser._clearNumber(json['wis']),
            Cha: Parser._clearNumber(json['cha'])
        };
        // stats.forEach((stat, index) => {
        //     updatedStats[Object.keys(updatedStats)[index]] = Number(stat[1]);
        // });
        return updatedStats;
    }
    /**
     * Returns a creature's saving throws as an object
     *
     * @ExampleFields: Str, Dex
     *
     * @param text - markdown text
     */
    static getSavingThrowMods(json) {
        const savesObject = {};
        if (json['save'] == undefined || Object.keys(json["save"]).length == 0){
            return savesObject;
        }
        const savesMatch = [...json['save'].matchAll(/(\w{3}) \+([0-9]+)/g)];
        savesMatch.forEach((save) => {
            savesObject[save[1]] = Number(save[2]);
        });
        return savesObject;
    }
    /**
     * Returns a creature's skills
     *
     * @ExampleFields: Perception, Insist
     *
     * @param text - markdown text
     */
    static getSkills(json) {
        const skillsObject = {};
        if (json["skill"] == undefined || Object.keys(json["skill"]).length == 0){
            return skillsObject;
        }
        const skills = [...json["skill"].matchAll(/(?<name>\w[\w ]+) \+(?<mod>[0-9]+)/g)];
        skills.forEach((skill) => {
            if (Object.keys(Parser._skillsToShortMap).includes(skill.groups['name'])){
                skillsObject[skill.groups['name']] = Number(skill.groups['mod']);
            }
            else{
                console.warn(`could not find "${skill.groups['name']}"`);
            }
        });
        return skillsObject;
    }
    /**
     * Returns a creature's damage modifiers (Vulnerability, Resistance, Immunity)
     *
     * @ExampleFields: Immunity, Vulnerability
     *
     * @param text - markdown text
     */
    static getDamageModifiers(json) {
        return {
            immune: json["immune"],
            vulnerable: json["vulnerable"],
            resist: json["resist"],
            conditionImmune: json["conditionImmune"]
        };
    }
    /**
     * Returns a creature's senses
     *
     * @ExampleFields: vision, passive Perception
     *
     * @param text - markdown text
     */
    static getSenses(json) {
        const sensesObject = {};
        if (!json["senses"] || Object.keys(json["senses"]).length == 0){
            sensesObject["passive Perception"] = json["passive"]
            return sensesObject;
        }
        const match = json["senses"].match(/(.+),? ?(passive Perception)? ?([0-9]+)?/);
        sensesObject["vision"] = match[1];
        sensesObject["passive Perception"] = json["passive"] || match[3];
        return sensesObject;
    }
    /**
     * Returns a creature's languages as a string
     *
     * @param text - markdown text
     */
    static getLanguages(json) {
        return json['languages'];
    }
    /**
     * Returns a creature's challange rating
     *
     * @Fields: CR, XP
     *
     * @param text - markdown text
     */
    static getChallenge(json) {
        //Special cases of missing of strange CRs
        if (json['cr'] == '00' || Object.keys(json['cr']).length == 0){
            return {
                CR: 0
            }
        }
        return {
            CR: eval(json['cr'].replace('l', 1))
        }
        // const match = text.match(/\*\*Challenge\*\* (([0-9]+\/[0-9]+)|([0-9]+)) \((.*) XP\)/);
        // return { CR: eval(match[1]), XP: Number(match[4].replace(',', '')) };
    }
    /**
     * Returns an attack's range.
     *
     * The object contains 2 fields, one for the ranges represented by a single number and one for ranges
     * represented with in the short/long style.
     *
     * @Fields: singleRange -> value, units, shape ; doubleRange -> short, long, units
     *
     * @param text - markdown text
     */
    static getAttackRange(text) {
        let singleRangeMatch = text.match(/ ([0-9]+)([ \-])(ft|feet|foot)( line| cone| cube| sphere)?/);
        let doubleRangeMatch = text.match(/ ([0-9]+)\/([0-9]+) (\w+)/);
        const rangeObject = {
            singleRange: { value: null, units: null, type: null },
            doubleRange: { value: null, long: null, units: null }
        };
        if (singleRangeMatch) {
            if (singleRangeMatch[4])
                singleRangeMatch[4] = singleRangeMatch[4].replace(' ', '');
            rangeObject.singleRange.value = singleRangeMatch[1];
            rangeObject.singleRange.units = 'ft';
            rangeObject.singleRange.type = singleRangeMatch[4];
        }
        if (doubleRangeMatch) {
            rangeObject.doubleRange.value = doubleRangeMatch[1];
            rangeObject.doubleRange.long = doubleRangeMatch[2];
            rangeObject.doubleRange.units = 'ft';
        }
        return rangeObject;
    }
    /**
     * Returns an attack's damage
     *
     * @param text - markdown text
     */
    static getAttackDamage(text) {
        const match = [...text.matchAll(/(\((?<dice>\d+d\d+)(?<mod> ?[+-] ?\d+)?\)|(?<static>\d+)) (?<type>\w+) damage/g)];
        // const match = [...text.matchAll(/(\((?<dice>\d+d\d+)(?<mod> ?[+-] ?\d+)?\)|(?<static>\d+)) (?<type>\w+) damage/g)];
        const attackObject = [];
        match.forEach((attack) => {
            // attackObject.push([`${attack.groups.dice} ${attack.groups.mod ? attack.groups.mod : ''}`, attack.groups.type, Number(attack.groups.mod?.replace(/ /g, ''))]);
            if (attack.groups.static){
                attackObject.push([`${attack.groups.static}`, attack.groups.type, Number(attack.groups.mod?.replace(/ /g, ''))]);
            }
            else{
                attackObject.push([`${attack.groups.dice} ${attack.groups.mod ? attack.groups.mod : ''}`, attack.groups.type, Number(attack.groups.mod?.replace(/ /g, ''))]);
            }
        });
        return attackObject;
    }
    /**
     * Returns an attack's save DC and ability
     *
     * @Fields: DC, ability
     *
     * @param text - markdown text
     */
    static getAttackSave(text) {
        let match = text.match(/DC (?<save>\d+) (?<name>\w+)/);
        if (!match)
            return;
        const saveObject = {};
        saveObject["dc"] = Number(match.groups.save);
        saveObject["ability"] = Parser.shortenAbilities(match.groups.name);
        saveObject["scaling"] = "flat";
        return saveObject;
    }
    /**
     * Returns an attacks to hit modifier
     *
     * @param text - markdown text
     */
    static getAttackHit(text) {
        const match = text.match(/(?<hit>[+-] ?\d+) to hit/);
        if (match)
            return Number(match.groups.hit.replace(' ', ''));
        return;
    }
    static getAttackType(text, attackObject){
        if (/^Melee Spell Attack/i.test(text)){
            return "msak";
        }
        if (/^Ranged Spell Attack/i.test(text)){
            return "rsak";
        }
        if (/^Melee Weapon Attack/i.test(text)){
            return "mwak";
        }
        if (/^Ranged Weapon Attack/i.test(text)){
            return "rwak";
        }

        if (attackObject.save){
            return "save";
        }

        if (/regain[\s\w]+hit points/i.test(text)){
            return "heal";
        }

        return "other";
    }
    /**
     * Returns an attack
     *
     * @Fields: damage, range, save, hit, target
     *
     * @param text - markdown text
     */
    static getAttack(text) {
        const attackObject = {};
        attackObject['damage'] = Parser.getAttackDamage(text);
        attackObject['range'] = Parser.getAttackRange(text);
        attackObject['save'] = Parser.getAttackSave(text);
        attackObject['hit'] = Parser.getAttackHit(text);
        attackObject['target'] = 1;
        attackObject.actionType = Parser.getAttackType(text, attackObject);
        return attackObject;
    }

    static htmlDescription(textArray){

        if (typeof textArray === 'string' || textArray instanceof String){
            return textArray
        }

        let value = textArray.reduce((acc, current) => {
            if (Object.keys(current).length === 0 || /^\s*$/.test(current)){
                return acc + "</p><p>"
            }
            if (acc.endsWith("<p>")){
                return acc + current
            }
            return acc + "<br>" + current
        }, "<p>");
        value = value + "</p>"
        return value;
    }
    /**
     * Returns a creature's spellcasting details
     *
     * @Fields: level -> spellcaster level, modifier -> spellcasting ability modifier
     *
     * @param text - markdown text
     */
    static getSpellcastingStats(text) {
        const spellcastingLevel = text.match(/(?<level>[\dlO]+)\w{1,2}[ -]level[ -]spell ?caster/);
        const spellcastingModifier = text.match(/(spell ?casting ability is|spellcaster (that|who) uses) (?<mod>\w+)/);
        return {
            level: spellcastingLevel ? Number(spellcastingLevel.groups.level.replace('l', '1').replace('O', '0')) : 0,
            modifier: spellcastingModifier.groups.mod
        };
    }
    /**
     * Returns a creature's abilities
     * A creature's abilities could be for example attacks or features
     *
     * @Fields: description, data
     * @Note: `data` field may vary depending on the type of ability that is parsed
     *
     * @param text - markdown text
     */
    static getAbilities(json) {
        // const match = [...text.matchAll(/\*\*\*(.*?)\.\*\*\* (.*)/g)];
        // const extraMatch = [...text.matchAll(/(&nbsp;)+\*\*(.*?)\.\*\* (.*)/g)];
        const abilitiesObject = {};
        let actions = []
        if (Array.isArray(json['action'])){
            actions = actions.concat(json['action'])
        }
        else if (json['action']){
            actions.push(json['action'])
        }

        if (Array.isArray(json['trait'])){
            actions = actions.concat(json['trait'])
        }
        else if (json['trait']){
            actions.push(json['trait'])
        }
        // if (!Array.isArray(json['traits'])){
        //     actions.push(json['action'])
        // }
        actions.forEach((ability) => {
            //sometimes there are empty abilities
            if (Object.keys(ability['name']).length == 0 && Object.keys(ability['text']).length == 0){
                return;
            }

            let text = Parser.htmlDescription(ability.text)

            let cleanName = ability.name;

            var abilityObject = {
                description: Parser._clearText(text),
                data: {}
            };
            if (cleanName === 'Spellcasting'){
                abilityObject.data = Parser.getSpellcastingStats(text);
            }
            // else if (ability['name'].startsWith('Innate Spellcasting')){
            //     console.log(ability['name'])
            //     abilitiesObject.innate = {
            //         data: Parser.getSpellcastingStats(text),
            //         spells: Parser.getInnateSpells(ability['text'])
            //     }
            // }
            else{
                abilityObject.data = Parser.getAttack(text);
            }

            let recharge_match = ability.name.match(/ \(Recharges after a (?<short>Short or )?Long Rest\)/);

            if (recharge_match){
                if (recharge_match.groups.short){
                    abilityObject.data.uses = {
                        value: 1,
                        max: 1,
                        per: "sr"
                    }
                }
                else{
                    abilityObject.data.uses = {
                        value: 1,
                        max: 1,
                        per: "lr"
                    }
                }

                cleanName = cleanName.replace(/ \(Recharges after a (?<short>Short or )?Long Rest\)/, "");
            }

            let day_match = ability.name.match(/ \((?<count>\d)\/day\)/i);

            if (day_match){
                abilityObject.data.uses = {
                  value: Number(day_match.groups.count),
                  max: Number(day_match.groups.count),
                  per: "day"
                }

                cleanName = cleanName.replace(/ \((?<count>\d)\/day\)/i, "");
            }

            let recharge_on = ability.name.match(/ \(Recharge (?<recharge>\d)([-—]6)?\)/);

            if (recharge_on){
                if (recharge_on.groups.recharge){
                    abilityObject.data.recharge = {
                        value: Number(recharge_on.groups.recharge)
                    };
                }

                cleanName = cleanName.replace(/ \(Recharge (?<recharge>\d)([-—]6)?\)/, "");
            }

            abilitiesObject[cleanName] = abilityObject;

        });
        // extraMatch.forEach((extraAbility) => {
        //     abilitiesObject[extraAbility[2]] = {
        //         description: Parser._clearText(extraAbility[3]),
        //         data: {}
        //     };
        //     abilitiesObject[extraAbility[2]].data = Parser.getAttack(extraAbility[3]);
        // });
        return abilitiesObject;
    }
    /**
     * Returns a creature's abilities
     * A creature's abilities could be for example attacks or features
     *
     * @Fields: description, data
     * @Note: `data` field may vary depending on the type of ability that is parsed
     *
     * @param text - markdown text
     */
    static getReactions(json) {
        // const match = [...text.matchAll(/\*\*\*(.*?)\.\*\*\* (.*)/g)];
        // const extraMatch = [...text.matchAll(/(&nbsp;)+\*\*(.*?)\.\*\* (.*)/g)];
        const abilitiesObject = {};
        let actions = []
        if (Array.isArray(json['reaction'])){
            actions = actions.concat(json['reaction'])
        }
        else if (json['reaction']){
            actions.push(json['reaction'])
        }

        // console.log(actions)

        // if (Array.isArray(json['trait'])){
        //     actions = actions.concat(json['trait'])
        // }
        // else if (json['trait']){
        //     actions.push(json['trait'])
        // }
        // if (!Array.isArray(json['traits'])){
        //     actions.push(json['action'])
        // }
        actions.forEach((ability) => {
            //sometimes there are empty abilities
            if ((!ability || (!ability.name || !ability.text)) || (Object.keys(ability['name']).length == 0 && Object.keys(ability['text']).length == 0)){
                return;
            }

            var text = Parser.htmlDescription(ability.text)

            let cleanName = ability.name;

            var abilityObject = {
                description: Parser._clearText(text),
                data: {}
            };

            abilityObject.data = Parser.getAttack(text);

            let recharge_match = ability.name.match(/ \(Recharges after a (?<short>Short or )?Long Rest\)/);

            if (recharge_match){
                if (recharge_match.groups.short){
                    abilityObject.data.uses = {
                        value: 1,
                        max: 1,
                        per: "sr"
                    }
                }
                else{
                    abilityObject.data.uses = {
                        value: 1,
                        max: 1,
                        per: "lr"
                    }
                }

                cleanName = cleanName.replace(/ \(Recharges after a (?<short>Short or )?Long Rest\)/, "");
            }

            let day_match = ability.name.match(/ \((?<count>\d)\/day\)/i);

            if (day_match){
                abilityObject.data.uses = {
                  value: Number(day_match.groups.count),
                  max: Number(day_match.groups.count),
                  per: "day"
                }

                cleanName = cleanName.replace(/ \((?<count>\d)\/day\)/i, "");
            }

            let recharge_on = ability.name.match(/ \(Recharge (?<recharge>\d)([-—]6)?\)/);

            if (recharge_on){
                if (recharge_on.groups.recharge){
                    abilityObject.data.recharge = {
                        value: Number(recharge_on.groups.recharge)
                    };
                }

                cleanName = cleanName.replace(/ \(Recharge (?<recharge>\d)([-—]6)?\)/, "");
            }

            abilitiesObject[cleanName] = abilityObject;

        });
        // console.log(abilitiesObject)
        // extraMatch.forEach((extraAbility) => {
        //     abilitiesObject[extraAbility[2]] = {
        //         description: Parser._clearText(extraAbility[3]),
        //         data: {}
        //     };
        //     abilitiesObject[extraAbility[2]].data = Parser.getAttack(extraAbility[3]);
        // });
        return abilitiesObject;
    }
    /**
     * Returns a creature's legendary actions
     *
     * @Field description, data, cost
     * @Note1 data field may vary depending on the type of action parsed
     * @Note2 cost field is by default 1, will be modified if the name of the action has a (Costs x Actions) structure
     *
     * @param text
     */
    static getLegendaryActions(json) {
        if (json['legendary'] == undefined){
            return []
        }
        const actionObject = {};
        var legendaries = []
        if (Array.isArray(json['legendary'])){
            legendaries = legendaries.concat(json['legendary'])
        }
        else{
            legendaries.push(json['legendary'])
        }

        legendaries.forEach((action) => {
            //sometimes happens with number of legendary actions
            if (!action['name'] || Object.keys(action['name']).length == 0){
                return;
            }

            var name = action.name.match(/[^\(]+/)[0].trim();

            let cost_match = action.name.match(/\(Costs (?<cost>\d) Actions\)/);

            //sometimes a legendary action is missing it text.
            //probably means its text is in the next one
            //not handled for now because usually is a lair action
            //or regional effect
            if (!action.text){
                return;
            }

            var text = Parser.htmlDescription(action.text);

            var cost = 1;
            if (cost_match){
                cost = Number(cost_match.groups.cost);
            }

            actionObject[name] = {
                description: text,
                data: Parser.getAttack(text),
                cost: cost
            };
        });
        return actionObject;
    }
    /**
     * Returns the number of legendary actions from an actor
     *
     * @param text - markdown text
     */
    static getNumberOfLegendaryActions(json) {
        if (json['legendary'] == undefined){
            return 0;
        }
        else{
            return 3;
        }
        // const legendaryActionDescription = text.match(/.* can take ([0-9]+) legendary actions,.*/);
        // return Number(legendaryActionDescription?.[1]);
    }
    /**
     * Returns the number of legendary resistances from an actor
     *
     * @param text - markdown text
     */
    static getNumberOfLegendaryResistances(json) {
        if (json['trait']){
            var traits = []
            if (!Array.isArray(json['trait'])){
                traits.push(json['trait']);
            }
            else{
                traits = json['trait'];
            }

            for (var t of traits){
                var match = t['name'].match(/Legendary Resistance \(([0-9]+)\/Day\)/)
                if (match){
                    return Number(match[1])
                }
            }
        }
        return 0;
    }
    /**
     * Returns a creature's spell list
     *
     * @ExampleFields: Cantrips, 1, 2, 3, 4
     * @Note: The function only returns the spell name because 5e stat block have only the names of the spells i guess...
     *
     * @param text - markdown text
     */
    static getSpells(json) {
        if (!json["trait"]){
            return {}
        }

        var traits = [];
        if (!Array.isArray(json['trait'])){
            traits.push(json['trait'])
        }
        else{
            traits = json['trait']
        }

        var spellscasting = traits.find(t => t.name === "Spellcasting");

        const spellsObject = {};
        if (spellscasting){
            var spells;
            if (Array.isArray(spellscasting['text'])){
                spells = spellscasting['text'].join('\n')
            }
            else{
                spells = spellscasting['text']
            }

            spells = Parser.fixSpelling(spells);

            const matchedSpells = [...spells.matchAll(/(1st-)?(?<cantrip>Cantrips|(?<level>\d+)(st|nd|rd|th) [Ll]evel) [\({](?<will>(?<slots>\d)( \d(st|nd|rd|th)-level)? slots?|at[- ]will)\):[\. ](?<spells>.+)/g)];
            matchedSpells.forEach((spell) => {
                const typeOfSpell = spell.groups.level ? spell.groups.level : spell.groups.cantrip;
                var spellLine = spell.groups.spells;
                if (/\w\* \w/.test(spell.groups.spells)){
                    spellLine = spellLine.replace(/\* /, '*, ');
                }
                spellsObject[typeOfSpell] = spellLine.replace(/[’]/g, "'").replace(/\*/g, "").replace(/\(.+\)/g, "").replace(/\./g, ",").split(",");
            });
        }

        return spellsObject;
    }
    static fixSpelling(spells){
        spells = spells.replace("featherfall", "feather fall");
        spells = spells.replace("Evard's evard's black tentacles", "evard's black tentacles");
        spells = spells.replace("water wall", "Wall of Water");
        spells = spells.replace("Everard's black tentacles", "evard's black tentacles");
        spells = spells.replace(/protection from good( and evil)?/, "protection from evil and good");
        spells = spells.replace("phantasamal force", "phantasmal force");
        spells = spells.replace(/spirit guardians?/, "spirit guardians");
        // spells = spells.replace("protection from good", "protection from evil and good");
        spells = spells.replace("guardians of faith", "guardian of faith");
        // spells = spells.replace("featherfall", "feather fall");
        return spells;
    }
    /**
     * Returns a creature's number of available spellslots
     *
     * @param text - markdown text
     */
    static getSpellSlots(json) {
        if (!json["trait"]){
            return {}
        }

        var traits = [];
        if (!Array.isArray(json['trait'])){
            traits.push(json['trait'])
        }
        else{
            traits = json['trait']
        }

        var spellscasting = traits.find(t => t.name === "Spellcasting");

        const slotsObject = {};
        if (spellscasting){
            var spells;
            if (Array.isArray(spellscasting['text'])){
                spells = spellscasting['text'].join('\n')
            }
            else{
                spells = spellscasting['text']
            }

            const matchedSpells = [...spells.matchAll(/(1st-)?(?<cantrip>Cantrips|(?<level>\d+)(st|nd|rd|th) [Ll]evel) [\({](?<will>(?<slots>\d)( \d(st|nd|rd|th)-level)? slots?|at[- ]will)\):[\. ](.+)/g)];
            matchedSpells.forEach((slot) => {
                if (slot.groups.level){
                    slotsObject[`spell${slot.groups.level}`] = {
                        value: Number(slot.groups.slots),
                        max: Number(slot.groups.slots),
                        override: Number(slot.groups.slots)
                    };
                }
            });
        }

        return slotsObject;
    }
    static getInnateSpells(json) {
        if (!json["trait"]){
            return {}
        }

        var traits = [];
        if (!Array.isArray(json['trait'])){
            traits.push(json['trait'])
        }
        else{
            traits = json['trait']
        }

        var spellscasting = traits.find(t => t.name.startsWith("Innate Spellcasting"));

        // console.log(spellscasting)

        const spellsObject = {};
        if (spellscasting){
            var spells;
            if (Array.isArray(spellscasting.text)){
                spells = spellscasting.text.join('\n')
            }
            else{
                spells = spellscasting.text;
            }

            // console.log(spells.split(/ (\d\/Day)/i))
            var specialSplit = spells.split(/•? (\d\/Day)/i);
            if(specialSplit.length === 1){
                //ignore
            }
            else if(specialSplit.length === 3){
                spells = specialSplit[0]+'\n'+specialSplit[1]+specialSplit[2]
            }
            else if(specialSplit.length === 5){
                spells = specialSplit[0]+'\n'+specialSplit[1]+specialSplit[2]+'\n'+specialSplit[3]+specialSplit[4]
            }
            else{
                console.error("Got a very strange split");
            }

            spells = Parser.fixSpelling(spells);

            const matchedSpells = [...spells.matchAll(/((?<will>at[- ]will)|((?<perday>\d+)\/day( each)?)):[\. ](?<spells>.+)/gi)];
            matchedSpells.forEach((spellLine) => {
                const typeOfSpell = spellLine.groups.perday ? Number(spellLine.groups.perday) : spellLine.groups.will;

                var stringSpells = spellLine.groups.spells.replace(/\./g, ",");

                spellsObject[typeOfSpell] = Parser.smartSplit(stringSpells);
            });
        }
        // console.log(spellsObject)
        return spellsObject;
    }
    static smartSplit(stringSpells){
        let inPar = false;
        return [...stringSpells].reduce((acc, x) => {
            // console.log(x)
            if (!inPar && x === "("){
                inPar = true;
            }
            else if (inPar && x === ")"){
                inPar = false;
            }

            if (x !== ',' || inPar){
                if (!(/\s/.test(x)) || acc[acc.length - 1] !== ""){
                    acc[acc.length - 1] = acc[acc.length - 1].concat(x);
                }
            }
            else{
                acc.push("");
                // console.log(acc)
            }
            return acc;
        }, [""]);
    }
    static trimSpellName(spell){
        return spell.replace(/[’]/g, "'").replace(/\*/g, "").replace(/\(.+\)/g, "").toLowerCase().trim();
    }
    /**
     * Returns a creature's proficiency
     * The proficiency is calculated using an attack where the to hit score has the prof added adn the + to the damage roll doesn't
     *
     * @param abilities - an object of all the creatures abilities
     */
    static getProficiency(abilities) {
        for (const key in abilities) {
            if (!abilities.hasOwnProperty(key))
                continue;
            if (abilities[key]?.data?.hit && abilities[key]?.data?.damage?.[0]?.[2])
                return abilities[key].data.hit - abilities[key].data.damage[0][2];
        }
        return 0;
    }
    static getProficiencyFromCR(CR) {
        return Math.max(Math.floor((CR - 1) / 4) + 2, 2);
    }
    /**
     * Returns the ability modifier given the ability score
     *
     * @param abilityScore - ability score, example 20 -> returns +5
     */
    static getAbilityModifier(abilityScore) {
        return Math.floor(abilityScore / 2 - 5);
    }

    // Changes XML to JSON
    static xmlToJson(xml) {
        
        // Create the return object
        var obj = {};

        if (xml.nodeType == 1) { // element
            // do attributes
            if (xml.attributes.length > 0) {
            obj["@attributes"] = {};
                for (var j = 0; j < xml.attributes.length; j++) {
                    var attribute = xml.attributes.item(j);
                    obj["@attributes"][attribute.nodeName] = attribute.nodeValue;
                }
            }
        } else if (xml.nodeType == 3) { // text
            obj = xml.nodeValue;
        }

        // do children
        if (xml.hasChildNodes()) {
            for(var i = 0; i < xml.childNodes.length; i++) {
                var item = xml.childNodes.item(i);
                var nodeName = item.nodeName;
                if (typeof(obj[nodeName]) == "undefined") {
                    var temp = Parser.xmlToJson(item)
                    if (!typeof(temp) == "string" || !/^\s+$/.test(temp)){
                        obj[nodeName] = temp;
                    }
                } else {
                    if (typeof(obj[nodeName].push) == "undefined") {
                        var old = obj[nodeName];
                        obj[nodeName] = [];
                        obj[nodeName].push(old);
                    }
                    obj[nodeName].push(Parser.xmlToJson(item));
                }
            }
        }

        if (typeof(obj['#text']) == "string"){
            return obj["#text"]
        }
        return obj;
    }

    static ElementGenenerator = function(xml, element_type){
        var itr = xml.createNodeIterator(
            xml,
            NodeFilter.SHOW_ELEMENT,
          {
            acceptNode: function(node) {
              // Logic to determine whether to accept, reject or skip node
              // In this case, only accept nodes that have content
              // other than whitespace
              if (new RegExp(element_type).test(node.nodeName)) {
                return NodeFilter.FILTER_ACCEPT
              }
            }
          },
          false
        )

        return itr;
    }

}

export default Parser;
