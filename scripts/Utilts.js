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
}
export default Utilts.getInstance();
