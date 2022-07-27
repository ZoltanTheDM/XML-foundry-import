import CompendiumManagement from "./CompendiumManagement.js";

// Main module class
class CompendiumUI extends Application
{
  constructor() {
    super({});
  }

  static get defaultOptions()
  {
      const options = super.defaultOptions;
      options.id = "compendium-order";
      options.template = "modules/xml-import/templates/compendium_order.html"
      options.classes.push("compendium-order");
      options.resizable = false;
      options.height = "auto";
      options.width = 400;
      options.minimizable = true;
      options.title = "Order Compendiums"
      return options;
  }


  async getData(options) {
    return {
      compendiums: CompendiumManagement.CompendiumIndex(),
      disabled: CompendiumManagement.disabledIndex(),
    }
  }
  activateListeners(html) {

    super.activateListeners(html);

    html.find(".up-compendium-value").on("click", null, function(ev){
      const id = ev.currentTarget.closest(".item").id;
      CompendiumManagement.swapPositions(id, true);
      this.render();
    }.bind(this))

    html.find(".down-compendium-value").on("click", null, function(ev){
      const id = ev.currentTarget.closest(".item").id;
      CompendiumManagement.swapPositions(id, false);
      this.render();
    }.bind(this))

    html.find(".disable-compendium-value").on("click", null, function(ev){
      const id = ev.currentTarget.closest(".item").id;
      CompendiumManagement.disableComp(id);
      this.render();
    }.bind(this))

    html.find(".enable-compendium-value").on("click", null, function(ev){
      const id = ev.currentTarget.closest(".item").id;
      CompendiumManagement.enableComp(id);
      this.render();
    }.bind(this))

    html.find(".compendium-target").on("click", null, async function(ev){
      const id = ev.currentTarget.closest(".item").id;

      await game.packs.contents.find(ele => ele.collection == id).render(true);
    });

  }
}

export default CompendiumUI;