import ItemCreator from "./ItemCreator.js";
import Parser from "./Parser.js";

class ClassCreator {

	static _getHD(cls){
		return "d"+ cls.hd
	}

	static _getSpellcasting(cls){
		if (/Warlock/i.test(cls.name)){
			return "pact"
		}
		if (/Artificer/i.test(cls.name)){
			return "artificer"
		}

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

	static _getStartingProficenciesObject(cls){
		console.log(cls)
		var starting = cls.autolevel.find(x => {
			if (x["@attributes"].level === "1"){
				if (Array.isArray(x.feature)){
					if (ClassCreator._findStarter(x)){
						return true;
					}
				}
			}

			return false;
		})

		if (starting){
			return ClassCreator._findStarter(starting);
		}
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

		var profObj = ClassCreator._getStartingProficenciesObject(cls);
		console.log(profObj)
		var skillLine = profObj.text.join('\n').match(/Skills: (?<list>.+)/);
		console.log(skillLine)
		if (!skillLine){
			console.warn(`${cls.name} starting proffiencies don't match parttern`)
			return {
				number: 0,
				choices: []
			}
		}

		var match = skillLine.groups.list.match(/Choose (?<any>any )?(?<count>\w+)(( skills)? from (?<skills>.+))?/);

		// console.log(match)

		if (!match){
			console.error("failed to get match in skills:")
			console.error(skillLine, match)
		}
		return {
			"number": Parser._numberMap[match.groups.count],
			"choices": ClassCreator._parserSkillsArray(match.groups.skills, Boolean(match.groups.any))
		}
	}

	static async createClass(cls, pack) {
		// console.log(cls);

		let thisClass = {}
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
			return;
		}
			// console.log(thisClass);

		let img = await ItemCreator._getEntityImageFromCompendium(ItemCreator._trimName(thisClass.name).toLowerCase(), "Item");

		if (img){
			thisClass.img = img;
		}

		// console.log(thisClass);

		let item = await Item.create(thisClass, { temporary: true, displaySheet: false});
		// console.log(item);
		await pack.importEntity(item);
		await pack.getIndex(); // Need to refresh the index to update it
		console.log(`Done importing ${thisClass.name} into ${pack.collection}`);
	}

	static async createClassFeature(feature, cls, level, pack) {
		// console.log(cls);
		// console.log(feature);
		// console.log(level);

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
                    chat: "",
                    unidentified: ""
                },
				requirements: `${cls.name} ${level}`,
			},
			sort: 100003
		};
		// console.log(thisClassFeature);

	    let img = await ItemCreator._getEntityImageFromCompendium(ItemCreator._trimName(thisClassFeature.name).toLowerCase(), "Item");

	    if (img){
	        thisClassFeature.img = img;
	    }

		// console.log(thisClassFeature);

	    let item = await Item.create(thisClassFeature, { temporary: true, displaySheet: false});
		// console.log(item);
	    await pack.importEntity(item);
	    await pack.getIndex(); // Need to refresh the index to update it
	    console.log(`Done importing ${thisClassFeature.name} into ${pack.collection}`);
	}
}

export default ClassCreator;