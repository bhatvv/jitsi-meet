/* jshint -W117 */
/* application specific logic */

var APP =
{
    init: function () {
        this.UI = require("./modules/UI/UI");
        this.API = require("./modules/API/API");
        this.connectionquality = require("./modules/connectionquality/connectionquality");
        this.statistics = require("./modules/statistics/statistics");
        this.RTC = require("./modules/RTC/RTC");
        this.desktopsharing = require("./modules/desktopsharing/desktopsharing");
        this.xmpp = require("./modules/xmpp/xmpp");
        this.keyboardshortcut = require("./modules/keyboardshortcut/keyboardshortcut");
        this.translation = require("./modules/translation/translation");
        this.settings = require("./modules/settings/Settings");
        this.DTMF = require("./modules/DTMF/DTMF");
        this.members = require("./modules/members/MemberList");
        this.configFetch = require("./modules/config/HttpConfigFetch");
    }
};

function init() {

    APP.desktopsharing.init();
    APP.RTC.start();
    APP.xmpp.start();
    APP.statistics.start();
    APP.connectionquality.init();
    APP.keyboardshortcut.init();
    APP.members.start();
}

/**
 * If we have HTTP endpoint for getting confgi.json configured we're going to
 * read it and override properties from config.js and interfaceConfig.js.
 * If there is no endpoint we'll just continue with initialization.
 * Keep in mind that if the endpoint has been configured and we fail to obtain
 * the config for any reason then the conference won't start and error message
 * will be displayed to the user.
 */
function obtainConfigAndInit() {
    if (config.configLocation) {
        APP.configFetch.obtainConfig(
            config.configLocation, APP.UI.getRoomNode(),
            // Get config result callback
            function(success, error) {
                if (success) {
                    init();
                } else {
                    // Show obtain config error,
                    // pass the error object for report
                    APP.UI.messageHandler.openReportDialog(
                        null, "dialog.connectError", error);
                }
            });
    } else {
        init();
    }
}


$(document).ready(function () {

    var URLProcessor = require("./modules/config/URLProcessor");
    URLProcessor.setConfigParametersFromUrl();
    APP.init();

    APP.translation.init();

    if(APP.API.isEnabled())
        APP.API.init();

    APP.UI.start(obtainConfigAndInit);

});

$(window).bind('beforeunload', function () {
    if(APP.API.isEnabled())
        APP.API.dispose();
});

module.exports = APP;

