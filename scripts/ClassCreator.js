import ItemCreator from "./ItemCreator.js";
import Parser from "./Parser.js";
import Utilts from "./Utilts.js";

class ClassCreator {

    static async HandleClassCreation(whole, compendiumCreator, createFeatures, createSubclasses, createClass){

        if (!whole || !whole.class){
            return
        }

        let clsJson = whole.class;
        ClassCreator.ClassList = await fetch('modules/xml-import/scripts/subclassPrefix.json')
            .then(result => {return result.json();});

        let mergedClassJson = ClassCreator.MergeClasses(clsJson);

        let subclassedList = ClassCreator.getSubClassList(mergedClassJson);

        let subclassRelatedFeatures = [];
        if (createFeatures){
            let featuresPack = await compendiumCreator("-class-features");

            //create class features
            //only do subclass because we can assume classes are good?
            for (let singleClass of subclassedList){
                subclassRelatedFeatures = subclassRelatedFeatures.concat(singleClass.autolevel
                    //Ignore the subclasses
                    .filter(x => !ClassCreator.isSubclass(x, singleClass.name))
                    //add the class features
                    .map(async function (feat){
                        try{
                            let fullFeature = await ClassCreator.createClassFeature(singleClass.name, feat, featuresPack);

                            if(fullFeature.name == ClassCreator.getSubClassMap()[singleClass.name]){
                                return [singleClass.name, fullFeature]
                            }
                        }
                        catch(e){
                            Utilts.notificationCreator('error', `There has been an error while creating class feature ${feat.name}`);
                            console.error(`There has been an error while creating ${feat.name}`);
                            console.error(e);
                        }
                    }));

                //Load all the subclass features
                for (let singleSubclass in singleClass.subclass){
                    await Promise.all(Utilts.ensureArray(singleClass.subclass[singleSubclass].features)
                        .map(async function (feat){
                            try{
                                return ClassCreator.createClassFeature(singleSubclass, feat, featuresPack);
                            }
                            catch(e){
                                Utilts.notificationCreator('error', `There has been an error while creating class feature ${feat.name}`);
                                console.error(`There has been an error while creating ${feat.name}`);
                                console.error(e);
                            }
                        }));
                }
            }

        }

        if (createSubclasses){
            //reload items because we added any
            await Utilts.PreloadCompendiumIndex(createFeatures, false);

            await ClassCreator.createSubClasses(subclassedList, compendiumCreator);
        }


        //update subclass trigger ability with subclasses
        if (createFeatures){
            await Utilts.PreloadCompendiumIndex(createSubclasses, false);

            // console.log(await Promise.all(subclassRelatedFeatures));

            //update subclass feature to include the subclasses
            let res = (await Promise.all(subclassRelatedFeatures))
                //remove items that are not subclass features
                .filter(x => !!x)
                //add subclasses to description
                .map(async function([clsName, feature]){
                    // console.log(`adding to ${feature.name} member of ${clsName}`)
                    // console.log(subclassedList.find(c => c.name == clsName))

                    let text = Object.keys(subclassedList.find(c => c.name == clsName).subclass)
                        .reduce(function(acc, subclass){
                            return `${acc}<li>${Utilts.getSubclassTextId(subclass, "Class Features")}</li>`;
                        }, "");

                    // console.log(text)

                    //Update subclass feature to include link to all the features
                    return feature.update({
                        'system.description.value': `${feature.system.description.value}<ul>${text}</ul>`
                    })
                });

            await Promise.all(res);
        }

        if (createClass){
            await Utilts.PreloadCompendiumIndex(createFeatures || createSubclasses, false);
            let featuresPack = await compendiumCreator("-classes");

            // let singleClass = subclassedList[0];
            //create the class
            for (let singleClass of subclassedList){
                await ClassCreator.createClass(singleClass, featuresPack);
            }

        }
    }

    static isSubclass(feat, className){
        const subName = ClassCreator.getSubClassMap()[className];
        if (subName){
            return ClassCreator.ForceSingleName(feat.name).startsWith(`${subName}: `);
        }
        return false;
    }

    static getAdvancements(features, defaultLevel = 1){
        let itermediate = features.reduce(function(acc, current){
            let name = ClassCreator.ForceSingleName(current.name);

            let uuid = Utilts.getFeatUuid(name, "Class Advancements");

            if (!uuid){
                return acc;
            }

            if (acc[current.level]){
                acc[current.level].push(uuid)
            }
            else{
                acc[current.level] = [uuid]
            }

            return acc
        }, {});

        return Object.keys(itermediate).map(function(level){
            return {
                _id: randomID(16),
                type: "ItemGrant",
                configuration: {
                    items: itermediate[level],
                    optional: true,
                },
                value: {},
                level: (level != 0 ? level : defaultLevel),
                title: "Features",
            };
        });
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

                let advancement = ClassCreator.getAdvancements(singleClass.subclass[singleSubclass].features, singleClass.subclass[singleSubclass].data.level)

                const descriptionAndSource = Parser.getDescriptionAndSource(singleClass.subclass[singleSubclass].data.description)

                let subclassData = {
                    name: singleSubclass,
                    type: "subclass",
                    img: Utilts.getImage(singleSubclass),
                    system: {
                        description: {value: descriptionAndSource.description},
                        identifier: ClassCreator.sanitizeName(singleSubclass),
                        classIdentifier: ClassCreator.sanitizeName(singleClass.name),
                        advancement,
                        source: descriptionAndSource.source,
                    }
                };

                let item = await Item.create(subclassData, {temporary:true, displaySheet:false});

                await subclassPack.importDocument(item);
                console.log(`Done importing ${singleSubclass} into ${subclassPack.collection}`);
            }
        }
    }

    static sanitizeName(name){
        return name.toLowerCase().replaceAll(' ', '-').replaceAll(/[^a-z0-9\-_]/gi, "")
    }

    static async createClassFeature(className, interData, pack){
        let name = ClassCreator.ForceSingleName(interData.name);

        const descriptionAndSource = Parser.getDescriptionAndSource(interData.description)

        let thisClassFeature = {
            name,
            type: "feat",
            system: {
                description:{value: descriptionAndSource.description},
                requirements: `${className} ${interData.level}`,
                type:{value:"class"},
                source: descriptionAndSource.source,
            },
            img: Utilts.getImage("Item", ItemCreator._trimName(name).toLowerCase()),
        };

        let item = await Item.create(thisClassFeature, { temporary: true, displaySheet: false});

        let ret = await pack.importDocument(item);

        console.log(`Done importing ${name} into ${pack.collection}`);

        return ret;
    }

    static _getHD(cls){
        return "d"+ cls.hd
    }

    static _getSpellcasting(cls){
        if (/Warlock/i.test(cls.name)){
            return {
                progression: "pact",
                ability: "cha",
            }
        }

        // if (/Artificer/i.test(cls.name)){
        //     return {
        //         progression: "artificer",
        //         ability: "int",
        //     }
        // }

        var top_slot = cls["autolevel"].find(x => {
            if (x?.slots){
                if (x["@attributes"].level === "20"){
                    return true;
                }
            }

            return false;
        })

        return {
            progression: cls.spellProgression,
            ability: Parser._abilitiesMap[cls.spellAbility],
        };

        // No base class is a third caster
        // return "third"
    }

    static SetSpellLevels(baseClass){
        let value = baseClass.autolevel.reduce(function(acc, element){
                if (element.hasOwnProperty('slots')){
                    return Math.max(acc, element.slots.split(',').length)
                }

                return acc;
            }, 0);

        if (value == 0){
            baseClass.spellProgression = "none";
            return;
        }

        baseClass.spellProgression = value > 8 ? "full" : "half";
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

        let features;
        if (ClassCreator.getSubClassMap()[cls.name]){
            features = cls.autolevel.filter(x => !ClassCreator.isSubclass(x, cls.name));
        }
        else{
            features = cls.autolevel;
        }

        let advancement = ClassCreator.getAdvancements(features);

        let thisClass;
        try{
            thisClass = {
                name: cls.name,
                type: "class",
                identifier: ClassCreator.sanitizeName(cls.name),
                data: {
                    hitDice: ClassCreator._getHD(cls),
                    spellcasting: ClassCreator._getSpellcasting(cls),
                    skills: ClassCreator._getSkills(cls),
                    advancement,
                },
                sort: 100003
            };
        }
        catch (err){
            console.error(err);
            return;
        }

        thisClass.img = Utilts.getImage("Item", ItemCreator._trimName(thisClass.name))

        let item = await Item.create(thisClass, { temporary: true, displaySheet: false});
        // console.log(item);
        await pack.importDocument(item);
        // await pack.getIndex(); // Need to refresh the index to update it
        console.log(`Done importing ${thisClass.name} into ${pack.collection}`);
    }

    //https://stackoverflow.com/questions/31128855/comparing-ecma6-sets-for-equality
    static setArrayEquality(xSet, yArray){
        return xSet.size === yArray.length && yArray.every((x) => xSet.has(x));
    }

    static MergeClasses(clsJson){
        let classesCombined = [];

        let ClassSet = new Set(Utilts.ensureArray(clsJson).map(ele => ele.name))

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

            baseClass.autolevel = Utilts.ensureArray(baseClass.autolevel)

            ClassCreator.SetSpellLevels(baseClass)

            options.filter(i => i !== baseClass).forEach(otherClass => {
                if(!ClassCreator.setArrayEquality(ExpectedOtherKeys, Object.keys(otherClass))){
                    console.warn(`failed set equality test:`);
                    console.warn(otherClass);
                }
                else{
                    baseClass.autolevel = baseClass.autolevel.concat(otherClass.autolevel);
                }
            });

            return baseClass;
        });
    }

    static startWithStringFilter(str, classAutoLevel, data=false){
        str = `${str}: `
        let filtered = classAutoLevel.filter(feat => {
            return ClassCreator.ForceSingleName(feat.feature?.name)?.startsWith(str);
        });

        if(!data){
            return filtered.map(feat => feat.feature.name.substring(str.length))
        }
        else{
            return filtered.map(feat => {
                return {
                    name: ClassCreator.ForceSingleName(feat.feature.name).substring(str.length),
                    level: Number(feat['@attributes'].level),
                    description: feat.feature.text
                }
            });
        }
    }

    static getSubClassMap(){
        return ClassCreator.ClassList;
    }

    //modifies original array but *shrug*
    static getSubClassList(mergedJson){

        //populate 
        for(let oneClass of mergedJson){

            if (!ClassCreator.getSubClassMap()[oneClass.name]){
                console.warn(`No subclass for ${oneClass.name}`)
                oneClass.subclass = {};

                //TODO I feel gross
                continue;
            }


            //list subclasses of class
            const subclassNames = ClassCreator.startWithStringFilter(ClassCreator.getSubClassMap()[oneClass.name], oneClass.autolevel, true)

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

                if (usedFeatures.has(ClassCreator.ForceSingleName(current.feature.name))){
                    return acc;
                }

                acc.push({name: current.feature.name, level: Number(current['@attributes'].level), description: current.feature.text})

                return acc
            }, []);
        }

        return mergedJson;

    }

    static ForceSingleName(name){
        if(Array.isArray(name)){
            return name[0];
        }
        return name
    }
}

export default ClassCreator;