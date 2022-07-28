class CompendiumManagement {
    constructor(){}

    static InitOrder(){
        if(CompendiumManagement.OrderedCompList){
            return
        }

        CompendiumManagement.OrderedCompList = game.packs.contents
                .filter(CompendiumManagement.isUseful)
                .map(x => x.collection)

        CompendiumManagement.Disabled = new Set(game.packs.contents
                .filter(x => !CompendiumManagement.isUseful(x))
                .map(x => x.collection)
            );
    }

    static isUseful(comp){
        return (comp.documentName == "Item" || comp.documentName == "Actor")
    }

    static getCompendiums(){
        CompendiumManagement.InitOrder();

        return game.packs.contents
            .filter(x => !CompendiumManagement.Disabled.has(x.collection))
            .sort(CompendiumManagement.compareCompOrder);
    }

    static _htmlPrep(comps){
        return comps.map(function (comp){
            return {
                name: comp.metadata.label,
                collection: comp.collection,
                type: comp.documentName,
            };
        });
    }

    static CompendiumIndex(){
        return CompendiumManagement._htmlPrep(CompendiumManagement.getCompendiums());
    }

    static getDisabled(){
        return CompendiumManagement.Disabled;
    }

    static disabledIndex(){
        return CompendiumManagement._htmlPrep(game.packs.contents
                .filter(x => CompendiumManagement.Disabled.has(x.collection))
            );
    }

    static compareCompOrder(compA, compB){
        let aIndex = CompendiumManagement.OrderedCompList.indexOf(compA.collection);
        let bIndex = CompendiumManagement.OrderedCompList.indexOf(compB.collection);

        if (aIndex == -1){
            aIndex = CompendiumManagement.OrderedCompList.length
            CompendiumManagement.OrderedCompList.push(compA.collection)
        }

        if (bIndex == -1){
            bIndex = CompendiumManagement.OrderedCompList.length
            CompendiumManagement.OrderedCompList.push(compB.collection)
        }

        return aIndex - bIndex;
    }

    static disableComp(name){
        let index = CompendiumManagement.OrderedCompList.indexOf(name);

        if (index == -1){
            console.warn(`tried to disable non-existant compendium: ${name}`)
            return false;
        }

        CompendiumManagement.OrderedCompList.splice(index, 1);
        CompendiumManagement.Disabled.add(name);

        return true;
    }

    static enableComp(name){
        if(!CompendiumManagement.Disabled.has(name)){
            console.warn(`tried to enable non-existant compendium: ${name}`)
            return false;
        }

        CompendiumManagement.Disabled.delete(name);
        CompendiumManagement.OrderedCompList.push(name);

        return true;
    }

    static swapPositions(name, up){
        const ocl = CompendiumManagement.OrderedCompList
        let index = ocl.indexOf(name);

        if (index == -1){
            console.warn(`tried to swap a non-existant compendium: ${name}`)
            return false;
        }

        //check if at an extreme
        if ((up && index == 0) || (!up && index == (ocl.length - 1))){
            console.log("tried to swap when at an extreme")
            return false;
        }

        const otherIndex = index + (up ? -1 : 1);

        [ocl[index], ocl[otherIndex]] = [ocl[otherIndex], ocl[index]];
        return true;
    }

}
export default CompendiumManagement;
