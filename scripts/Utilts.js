const MISSING = "icons/svg/mystery-man.svg"

class Utilts {
    constructor() {
    }
    static getInstance() {
        if (!Utilts._instance)
            Utilts._instance = new Utilts();
        return Utilts._instance;
    }
    notificationCreator(type, message) {
        ui.notifications[type](message);
    }

    async PreloadCompendiumIndex(loadItems=true, loadActors=true){

        //if we aren't doing any return quickly
        if (!loadItems && !loadActors){
            return;
        }

        if (loadActors){
            Utilts.actorImages = {};
        }

        if (loadItems){
            Utilts.itemsImages = {};
            Utilts.spellList = {};
            Utilts.feats = {};
        }

        for(let comp of game.packs.contents){
            const isActors = comp.documentName == "Actor";
            const isItems = comp.documentName == "Item";

            if (isItems || isActors){
                let indexedValues = await comp.getIndex()
                let out = indexedValues.forEach(function(currentValue){

                    //get images that aren't missing
                    if (currentValue.img != MISSING){
                        //get name to images
                        if (isActors && loadActors){
                            Utilts.actorImages[currentValue.name] = currentValue.img;
                        }
                        else if(loadItems){
                            Utilts.itemsImages[currentValue.name] = currentValue.img;
                        }
                    }

                    //get list of spells
                    if (loadItems && currentValue.type == "spell"){
                        //TODO order the compendiums
                        //name to uuid
                        Utilts.spellList[currentValue.name.toLowerCase()] = `Compendium.${comp.collection}.${currentValue._id}`
                    }

                    if (loadItems && currentValue.type == "feat"){
                        Utilts.feats[currentValue.name.toLowerCase()] = `Compendium.${comp.collection}.${currentValue._id}`
                    }
                })

            }
        }

        return
    }

    getImage(type, name){
        if (type == "Item"){
            return Utilts.itemsImages[name] ?? MISSING;
        }

        if (type == "Actor"){
            return Utilts.actorImages[name] ?? MISSING;
        }

        return MISSING;
    }

    async getSpellData(name, monsterName="???"){
        if (Utilts.spellList.hasOwnProperty(name.toLowerCase())){
            return fromUuid(Utilts.spellList[name.toLowerCase()])
        }
        else{
            console.warn(`${name} not found in ${monsterName}`);
            ui.notifications['warn'](`${name} not found`);
        }
    }

    async getFeatData(name, featTop="???"){
        if (Utilts.feats.hasOwnProperty(name.toLowerCase())){
            return fromUuid(Utilts.feats[name.toLowerCase()])
        }
        else{
            console.warn(`${name} not found in ${featTop}`);
            ui.notifications['warn'](`${name} not found`);
        }
    }
    
    getFeatUuid(name, featTop="???"){
        if (Utilts.feats.hasOwnProperty(name.toLowerCase())){
            return Utilts.feats[name.toLowerCase()]
        }
        else{
            console.warn(`${name} not found in ${featTop}`);
            ui.notifications['warn'](`${name} not found`);
        }
    }

    ensureArray(val){
        return Array.isArray(val) ? val : [val];
    }

}
export default Utilts.getInstance();
