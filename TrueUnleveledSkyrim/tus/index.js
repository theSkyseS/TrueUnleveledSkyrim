/* global ngapp, xelib, registerPatcher, patcherUrl */
let localsBuilder = require(patcherPath + '\\src\\localsBuilder.js')(patcherPath, fh);
let patcher = require(patcherPath + '\\src\\patcher.js')(patcherPath);

registerPatcher({
    info: info,
    gameModes: [xelib.gmTES5, xelib.gmSSE],
    settings: {
        label: 'True Unleveled Skyrim',
        templateUrl: `${patcherUrl}/partials/settings.html`,
        defaultSettings: {
            patchFileName: 'TUS.esp',
            unlevelZones: true,
            unlevelLVLI: true,
            unlevelNPCs: true,
            removeOffsets: false,
            highestLevelLVLI: 27,
            magickaRegenModifier: 1.0,
            removeOldPerks: false,
            distributePerks: true,
            includedESPs: ''
        }
    },
    requiredFiles: [],
    execute: (patchFile, helpers, settings, locals) => ({
        initialize: function () {
            localsBuilder.setLocals(patchFile, helpers, settings, locals);
        },
        process: [
            patcher.raceUnleveler,
            patcher.zoneUnleveler,
            patcher.lvliUnleveler,
            patcher.outfitUnleveler,
            patcher.lvliSecondUnleveler,
            patcher.lvlNpcUnleveler,
            patcher.npcUnleveler
        ],
        finalize: function () {
            let diff = new Date() - locals.date;
            let seconds = Math.round(diff / 1000);
            let minutes = Math.floor(seconds / 60);
            helpers.logMessage('Elapsed minutes:' + minutes);
            helpers.logMessage('Elapsed seconds:' + (seconds - (minutes * 60)));
        }
    })
});