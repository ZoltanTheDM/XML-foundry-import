import ItemCreator from "./ItemCreator.js";
import Parser from "./Parser.js";
import Utilts from "./Utilts.js";

class ClassCreator {

    static async HandleClassCreation(whole, compendiumCreator, createFeatures, createClasses){

        if (!whole || !whole.class){
            return
        }

        let clsJson = whole.class;

        let mergedClassJson = ClassCreator.MergeClasses(clsJson);

        let subclassedList = ClassCreator.getSubClassList(mergedClassJson);



        if (createFeatures){
            let featuresPack = await compendiumCreator("-class-features");

            //create class features
            //only do subclass because we can assume classes are good?
            for (let singleClass of subclassedList){
                for (let singleSubclass in singleClass.subclass){
                    singleClass.subclass[singleSubclass].features.forEach(async function (feat){
                        await ClassCreator.createClassFeature2(singleSubclass, feat, featuresPack);
                    });
                }
            }

        }

        if (!createClasses){
            return;
        }

        //reload items because we added any
        await Utilts.PreloadCompendiumIndex(createFeatures, false);


        await ClassCreator.createSubClasses(subclassedList, compendiumCreator);
    }

    static async createSubClasses(subclassedList, compendiumCreator){

        let subclassPack = await compendiumCreator("-subclasses");

        for (let singleClass of subclassedList){

            if (singleClass.subclass.length == 0){
                console.warn(`No known subclasses for ${singleClass.name}`)
                //TODO gross
                continue;
            }

            for (let singleSubclass in singleClass.subclass){

                let itermediate = singleClass.subclass[singleSubclass].features.reduce(function(acc, current){

                    if (acc[current.level]){
                        acc[current.level].push(Utilts.getFeatUuid(current.name))
                    }
                    else{
                        acc[current.level] = [Utilts.getFeatUuid(current.name)]
                    }

                    return acc
                }, {});

                let advancement = Object.keys(itermediate).map(function(level){
                    return {
                        _id: randomID(16),
                        type: "ItemGrant",
                        configuration: {
                            items: itermediate[level],
                            optional: true,
                        },
                        value: {},
                        level: (level != 0 ? level : singleClass.subclass[singleSubclass].data.level),
                        title: "Features",
                    };
                });

                let subclassData = {
                    name: singleSubclass,
                    type: "subclass",
                    img: Utilts.getImage(singleSubclass),
                    data: {
                        'description.value': Parser.htmlDescription(singleClass.subclass[singleSubclass].data.description),
                        identifier: singleSubclass.toLowerCase().replaceAll(' ', '-'),
                        classIdentifier: singleClass.name.toLowerCase(),
                        advancement,
                    }
                };

                let item = await Item.create(subclassData, {temporary:true, displaySheet:false});

                await subclassPack.importDocument(item);
                console.log(`Done importing ${singleSubclass} into ${subclassPack.collection}`);
            }
        }
    }

    static async createClassFeature2(className, interData, pack){
        let thisClassFeature = {
            name: interData.name,
            type: "feat",
            data: {
                'description.value': (interData.description ? Parser.htmlDescription(interData.description) : ""),
                requirements: `${className} ${interData.level}`,
            },
            img: Utilts.getImage("Item", ItemCreator._trimName(interData.name).toLowerCase()),
        };

        let item = await Item.create(thisClassFeature, { temporary: true, displaySheet: false});

        let ret = await pack.importDocument(item);

        console.log(`Done importing ${thisClassFeature.name} into ${pack.collection}`);

        return ret;
    }

    static _getHD(cls){
        return "d"+ cls.hd
    }

    static _getSpellcasting(cls){
        if (/Warlock/i.test(cls.name)){
            return "pact"
        }
        // if (/Artificer/i.test(cls.name)){
        //  return "artificer"
        // }

        var top_slot = cls["autolevel"].find(x => {
            if (x?.slots){
                if (x["@attributes"].level === "20"){
                    return true;
                }
            }

            return false;
        })

        if (!top_slot){
            return "none"
        }

        var slots = top_slot.slots.split(',')


        if (slots.length == 10 && Number(slots[9]) > 0){
            return "full"
        }

        if (slots.length == 6 && Number(slots[5]) > 0){
            return "half"
        }

        console.warn(`Could not get caster type for ${cls.name}`)
        return "none"

        // No base class is a third caster
        // return "third"
    }

    static _findStarter(autolevel){
        return autolevel.feature.find(y => (y.name === "Starting Proficiencies" || y.name === "Starting Ranger (Revised)"));
    }

    static _parserSkillsArray(skills, isAny){
        if (isAny){
            //get all short variables and filter out duplicates
            return Object.keys(Parser._skillsToShortMap).map(function(key){
                return Parser._skillsToShortMap[key];
            }).filter((c, index, arr) => {
                return arr.indexOf(c) === index;
            });
        }

        if (!skills){
            console.error(skills);
            return [];
        }

        // var splitter = /[,.] /;
        // var splittered = skills.split(splitter);
        return skills.split(/[,.] /).reduce((acc, x) => {
            var skill = x;
            if (skill.startsWith("and ")){
                skill = x.substring(4);
            }
            if (Parser._skillsToShortMap[skill]){
                acc.push(Parser._skillsToShortMap[skill.trim()])
            }

            return acc;
        }, []);

        // return trimed
    }
    static _getSkills(cls){
        //find starting proficiancies

        let skills = cls['proficiency'].split(", ").
            filter(ele => Parser._skillsToShortMap.hasOwnProperty(ele)).
            map(ele => Parser._skillsToShortMap[ele])

        return {
            number: Number(cls['numSkills']),
            choices: skills,
        }
    }

    static async createClass(cls, pack) {
        // console.log(cls);

        let thisClass;
        try{
            thisClass = {
                name: cls.name,
                type: "class",
                data: {
                    hitDice: ClassCreator._getHD(cls),
                    spellcasting: ClassCreator._getSpellcasting(cls),
                    skills: ClassCreator._getSkills(cls),
                },
                sort: 100003
            };
        }
        catch (err){
            console.error(err);
            return;
        }
            // console.log(thisClass);

        thisClass.img = Utilts.getImage("Item", ItemCreator._trimName(thisClass.name))

        let item = await Item.create(thisClass, { temporary: true, displaySheet: false});
        // console.log(item);
        await pack.importDocument(item);
        // await pack.getIndex(); // Need to refresh the index to update it
        console.log(`Done importing ${thisClass.name} into ${pack.collection}`);
    }

    static async createClassFeature(feature, cls, level, pack) {

        var description = ""
        if (feature.text){
            description = Parser.htmlDescription(feature.text);
        }
        else{
            console.warn(`Malformed Feature in ${cls.name}`);
            return;
        }

        let thisClassFeature = {
            name: feature.name,
            type: "feat",
            data: {
                description: {
                    value: description,
                },
                requirements: `${cls.name} ${level}`,
            },
            sort: 100003
        };

        thisClassFeature.img = Utilts.getImage("Item", ItemCreator._trimName(thisClassFeature.name).toLowerCase())

        let item = await Item.create(thisClassFeature, { temporary: true, displaySheet: false});
        // console.log(item);
        await pack.importDocument(item);
        // await pack.getIndex(); // Need to refresh the index to update it
        console.log(`Done importing ${thisClassFeature.name} into ${pack.collection}`);
    }

    //https://stackoverflow.com/questions/31128855/comparing-ecma6-sets-for-equality
    static setArrayEquality(xSet, yArray){
        return xSet.size === yArray.length && yArray.every((x) => xSet.has(x));
    }

    static MergeClasses(clsJson){
        let classesCombined = [];

        const ClassSet = new Set(clsJson.map(ele => ele.name));

        const ExpectedOtherKeys = new Set(['name', 'autolevel']);

        return [...ClassSet].map(function(clsName){
            let options = clsJson.filter(cls => cls.name == clsName)

            //find a single baseclass. It should have hitDice unlike all the suppliments
            let baseClass = options.find(cls => cls.hasOwnProperty('hd'))

            //No base class found. Dont make anything with this className
            if (!baseClass){
                console.warn(`Not enough data to make ${clsName}`)
                return
            }

            options.filter(i => i !== baseClass).forEach(otherClass => {
                if(!ClassCreator.setArrayEquality(ExpectedOtherKeys, Object.keys(otherClass))){
                    console.warn(`failed set equality test:`);
                    console.warn(otherClass);
                }
                else{
                    baseClass.autolevel = baseClass.autolevel.concat(otherClass.autolevel);
                }
            });

            baseClass.autolevel = Utilts.ensureArray(baseClass.autolevel)

            return baseClass;
        });
    }

    static startWithStringFilter(str, classAutoLevel, data=false){
        str = `${str}: `
        let filtered = classAutoLevel.filter(feat => {
            if (Array.isArray(feat.feature?.name)){
                return feat.feature.name[0].startsWith(str);
            }
            return feat.feature?.name?.startsWith(str);
        });

        if(!data){
            return filtered.map(feat => feat.feature.name.substring(str.length))
        }
        else{
            return filtered.map(feat => {
                let name = feat.feature.name;
                if (Array.isArray(feat.feature?.name)){
                    //TODO do something with the extra names
                    name = feat.feature.name[0];
                }

                return {name: name.substring(str.length), level: Number(feat['@attributes'].level), description: feat.feature.text}
            });
        }
    }

    //modifies original array but *shrug*
    static getSubClassList(mergedJson){

        const SubclassFeature = {
            'Barbarian': "Primal Path",
            'Bard': 'Bard College',
            'Cleric': 'Divine Domain',
            'Druid': 'Druid Circle',
            'Fighter': 'Martial Archetype',
            'Monk': 'Monastic Tradition',
            'Paladin': 'Sacred Oath',
            'Ranger': 'Ranger Archetype',
            'Rogue': 'Roguish Archetype',
            'Sorcerer': 'Sorcerous Origin',
            'Warlock': 'Otherworldly Patron',
            'Wizard': 'Arcane Tradition',
        }

        //populate 
        for(let oneClass of mergedJson){

            if (!SubclassFeature[oneClass.name]){
                console.error(`No subclass for ${oneClass.name}`)
                oneClass.subclass = [];

                //TODO I feel gross
                continue;
            }

            //list subclasses of class
            const subclassNames = ClassCreator.startWithStringFilter(SubclassFeature[oneClass.name], oneClass.autolevel, true)

            //get array of subclass Features under the subclass
            let subClassFeatures = subclassNames.reduce((acc, subclass) => {
                acc[subclass.name] = {
                    data: subclass,
                    features: ClassCreator.startWithStringFilter(subclass.name, oneClass.autolevel, true),
                }
                return acc
            }, {})

            oneClass.subclass = subClassFeatures;
        }

        //strip subclass features from class features
        for (let oneClass of mergedJson){

            let usedFeatures = new Set([].concat(...(Object.keys(oneClass.subclass).map(x => oneClass.subclass[x].features.map(y => `${x}: ${y.name}`)))));

            oneClass.autolevel = oneClass.autolevel.reduce((acc, current) => {
                if (!current.feature?.name){
                    return acc;
                }

                if (usedFeatures.has(current.feature.name)){
                    return acc;
                }

                acc.push({name: current.feature.name, level: Number(current['@attributes'].level), description: current.feature.text})

                return acc
            }, []);
        }

        return mergedJson;

    }
}

export default ClassCreator;