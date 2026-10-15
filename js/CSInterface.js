/**
 * CSInterface - Adobe CEP Interface Library
 */
function CSInterface() {}

/**
 * Evaluates a JavaScript script in the host environment (ExtendScript).
 *
 * @param script   The JavaScript script to be evaluated.
 * @param callback Optional. A callback function that receives the result of execution.
 */
CSInterface.prototype.evalScript = function(script, callback) {
    if (window.__adobe_cep__) {
        window.__adobe_cep__.evalScript(script, callback || function() {});
    } else {
        console.warn("Adobe CEP environment not found. Script not evaluated:", script);
        if (callback) callback("CEP_NOT_FOUND");
    }
};

/**
 * Retrieves information about the host environment in which the extension is currently running.
 *
 * @return HostEnvironment object.
 */
CSInterface.prototype.getHostEnvironment = function() {
    if (window.__adobe_cep__) {
        var hostEnv = window.__adobe_cep__.getHostEnvironment();
        return JSON.parse(hostEnv);
    }
    return { appName: "PPRO", appVersion: "2026", OSVersion: "Mac" };
};

/**
 * Retrieves a system path.
 *
 * @param pathType The path type: "extension", "application", "userData", etc.
 * @return The path string.
 */
CSInterface.prototype.getSystemPath = function(pathType) {
    if (window.__adobe_cep__) {
        var path = decodeURI(window.__adobe_cep__.getSystemPath(pathType));
        try {
            var hostEnv = this.getHostEnvironment();
            if (hostEnv && hostEnv.OSVersion && hostEnv.OSVersion.indexOf("Windows") >= 0) {
                path = path.replace("file:///", "");
                path = path.replace(new RegExp("/", "g"), "\\\\");
            } else {
                path = path.replace("file://", "");
            }
        } catch (e) {
            path = path.replace("file://", "");
        }
        return path;
    }
    return "";
};

/**
 * Closes this extension.
 */
CSInterface.prototype.closeExtension = function() {
    if (window.__adobe_cep__) {
        window.__adobe_cep__.closeExtension();
    }
};

/**
 * Listens to a custom or system event from the host application.
 */
CSInterface.prototype.addEventListener = function(type, listener, obj) {
    if (window.__adobe_cep__) {
        window.__adobe_cep__.addEventListener(type, listener, obj);
    }
};

/**
 * Dispatches an event to the host application or other extensions.
 */
CSInterface.prototype.dispatchEvent = function(event) {
    if (window.__adobe_cep__) {
        window.__adobe_cep__.dispatchEvent(event);
    }
};

/**
 * Opens an URL in the default web browser of the system.
 */
CSInterface.prototype.openURLInDefaultBrowser = function(url) {
    if (window.__adobe_cep__) {
        cep.util.openURLInDefaultBrowser(url);
    } else {
        window.open(url, '_blank');
    }
};
