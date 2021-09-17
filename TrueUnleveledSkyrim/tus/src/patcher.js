module.exports = function (patcherPath) {
    let perkCalculator = require(patcherPath + '\\src\\perkCalculator.js');
    let module = {};

    function getFileName(record, simplify) {
        let masterRecord = xelib.GetMasterRecord(record);
        let file = xelib.GetElementFile(masterRecord);
        let fileName = xelib.GetFileName(file);
        if (simplify) {
            let index = fileName.indexOf('.');
            fileName = fileName.substring(0, index);
        }
        return fileName;
    }

    function getAllowedToPatch(settings, locals, record) {
        let signature = xelib.Signature(record);
        let edid = xelib.EditorID(record);
        let isExcluded = false;

        if (signature === 'NPC_') {
            locals.excludedNPCs.forEach(entry => {
                entry.Keys.forEach(key => {
                    if (edid.includes(key)) {
                        let isForbidden = false;
                        entry.ForbiddenKeys.forEach(forbiddenKey => {
                            if (edid.includes(forbiddenKey)) {
                                isForbidden = true;
                            }
                        });
                        if (!isForbidden) isExcluded = true;
                    }
                })
            });
        }

        if (isExcluded) return false;

        if (!settings.includedESPs) {
            return true;
        }
        let fileName = getFileName(record);
        let allowedPlugins = settings.includedESPs.split(',');
        return allowedPlugins.includes(fileName);
    }

    function getListStats(list) {
        let items = xelib.GetElements(list, 'Leveled List Entries');
        let minLevel = 1000;
        let maxLevel = 0;

        for (let i = 0; i < items.length; i++) {
            let level = xelib.GetUIntValue(items[i], 'LVLO\\Level');

            if (level < minLevel) {
                minLevel = level;
            }

            if (level > maxLevel) {
                maxLevel = level;
            }
        }

        var stats = {
            minLevel: minLevel,
            maxLevel: maxLevel,
            mediumLevel: Math.round((minLevel + maxLevel) / 2),
            lowerThird: Math.round((minLevel + maxLevel) / 3),
            higherThird: Math.round(((minLevel + maxLevel) / 3) * 2),
        };
        return stats;
    }

    module.zoneUnleveler = {
        load: function (plugin, helpers, settings, locals) {
            return {
                signature: 'ECZN',
                filter: function (record) {
                    let allowedBySettings = settings.unlevelZones;
                    return allowedBySettings && getAllowedToPatch(settings, locals, record);
                }
            }
        },
        patch: function (record, helpers, settings, locals) {
            let location = xelib.GetLinksTo(record, 'DATA\\Location');
            if (location === 0) return;
            location = xelib.GetWinningOverride(location);
            let locZoneType;
            let locEditorID = xelib.EditorID(location);

            locals.zoneTypesByEDID.forEach(zoneType => {
                let hasKey = false;
                zoneType.Keys.forEach(key => {
                    if (locEditorID.includes(key)) {
                        hasKey = true;
                    }
                });
                if (hasKey) {
                    let isAllowed = true;
                    zoneType.ForbiddenKeys.forEach(forbiddenKey => {
                        if (locEditorID.includes(forbiddenKey)) {
                            isAllowed = false;
                        }
                    });
                    if (isAllowed) {
                        locZoneType = zoneType;
                    }
                }
            });

            if (!locZoneType) {
                locals.zoneTypesByKeyword.forEach(zoneType => {
                    zoneType.Keywords.forEach(keyword => {
                        if (xelib.HasKeyword(location, keyword)) {
                            locZoneType = zoneType;
                        }
                    });
                });
            }

            if (!locZoneType) {
                let masterRecord = xelib.GetMasterRecord(record);
                let file = xelib.GetElementFile(masterRecord);
                let fileName = xelib.GetFileName(file);
                let defaultFileNames = [
                    "Skyrim.esm",
                    "Dawnguard.esm",
                    "Dragonborn.esm",
                    "Update.esm"
                ];
                //defaultFileNames = [];

                let vanillaMinLevel = xelib.GetUIntValue(record, 'DATA\\Min Level');
                let vanillaMaxLevel = xelib.GetUIntValue(record, 'DATA\\Max Level');
                let newMinLevel = vanillaMinLevel;
                let newMaxLevel = vanillaMaxLevel;
                if (newMinLevel < 10) {
                    newMinLevel = 10;
                }
                if (newMaxLevel <= 0 || newMaxLevel > 100) {
                    newMaxLevel = newMinLevel * 3;
                }
                locZoneType = {
                    MinLevel: newMinLevel,
                    MaxLevel: newMaxLevel,
                    Range: newMaxLevel - newMinLevel
                }

                if (!defaultFileNames.includes(fileName)) {
                    let logMessage = fileName + ':\ ';
                    logMessage += xelib.EditorID(record) + ' (location ' + locEditorID + ')';
                    + '\nwas unleveled using default values. Specify more encounter zone types in zoneTypesByEDID.json and zoneTypesByKeyword.json\n';
                    logMessage += 'Min Lvl: vanilla: ' + vanillaMinLevel + ' new: ' + newMinLevel + '\n';
                    logMessage += 'Max Lvl: vanilla: ' + vanillaMaxLevel + ' new: ' + newMaxLevel + '\n';
                    helpers.logMessage(logMessage);
                    console.log(logMessage);
                }

            }
            xelib.SetFlag(record, 'DATA\\Flags', 'Match PC Below Minimum Level', false);
            if (!locZoneType.EnableCombatBoundary) {
                xelib.SetFlag(record, 'DATA\\Flags', 'Disable Combat Boundary', true);
            }
            //calculate min level here, max level will be min level + range
            let min = locZoneType.MinLevel;
            let max = locZoneType.MaxLevel - locZoneType.Range;
            let minLvl = Math.floor(Math.random() * (max - min + 1)) + min;
            let maxLvl = minLvl + locZoneType.Range;
            xelib.SetUIntValue(record, 'DATA\\Min Level', minLvl);
            xelib.SetUIntValue(record, 'DATA\\Max Level', maxLvl);
        }
    };

    function unlevelLVLI(record, helpers, settings, locals, globalSuffix, unlevelMainList) {
        function unlevelItemList(list, minAllowedLevel, maxAllowedLevel) {
            function getIsRemoved(item) {
                let level = xelib.GetUIntValue(item, 'LVLO\\Level');
                let isRemoved = level > maxAllowedLevel && maxAllowedLevel !== 0;
                isRemoved = isRemoved || level < minAllowedLevel;
                //glass weapons hack
                if (level == maxAllowedLevel && !isRemoved) {
                    let reference = xelib.GetValue(item, 'LVLO\\Reference');
                    isRemoved = reference.toLowerCase().includes('glass');
                }

                return isRemoved;
            }

            let items = xelib.GetElements(list, 'Leveled List Entries');
            let hasAppropriateItems = false;

            //check if has appropriate items
            for (let i = 0; i < items.length; i++) {
                let isRemoved = getIsRemoved(items[i]);
                if (!isRemoved) {
                    hasAppropriateItems = true;
                    break;
                }
            }

            //first remove smaller or higher items
            if (hasAppropriateItems) {
                for (let i = items.length - 1; i >= 0; i--) {
                    let isRemoved = getIsRemoved(items[i]);

                    if (isRemoved) {
                        xelib.RemoveElement(list, 'Leveled List Entries\\[' + i + ']');
                    }
                }
            }

            //then set others to 1
            items = xelib.GetElements(list, 'Leveled List Entries');
            for (let i = items.length - 1; i >= 0; i--) {
                if (xelib.HasElement(items[i], 'LVLO\\Level')) {
                    xelib.SetUIntValue(items[i], 'LVLO\\Level', 1);
                }
            }

        }
        function copyList(list, edid, suffix) {
            let newList = xelib.CopyElement(list, locals.patch, true);
            let newEdid = edid + suffix + globalSuffix;
            xelib.SetValue(newList, 'EDID', newEdid);
            helpers.cacheRecord(newList, newEdid);
            let newLongName = xelib.LongName(newList);
            locals.longNameDict[newEdid] = newLongName;
            locals.edidDict[newLongName] = newEdid;
            locals.handleDict[newEdid] = newList;
            return newList;
        }

        let longName = xelib.LongName(record);
        let edid = xelib.EditorID(record);
        locals.edidDict[longName] = edid;

        let stats = getListStats(record);
        let highestLevel = Math.min(stats.maxLevel, parseInt(settings.highestLevelLVLI));
        let mediumLevel = Math.round((stats.minLevel + highestLevel) * 0.4);

        let weakList = copyList(record, edid, 'TUS_Weak');
        let strongList = copyList(record, edid, 'TUS_Strong');

        if (unlevelMainList) {
            unlevelItemList(record, 1, highestLevel);
        }
        unlevelItemList(weakList, 1, mediumLevel);
        unlevelItemList(strongList, mediumLevel + 1, highestLevel);

    }

    module.lvliUnleveler = {
        load: function (plugin, helpers, settings, locals) {
            return {
                signature: 'LVLI',
                filter: function (record) {
                    if (settings.unlevelLVLI) {
                        let edid = xelib.EditorID(record);
                        let masterRecord = xelib.GetMasterRecord(record);
                        let file = xelib.GetElementFile(masterRecord);
                        let fileName = xelib.GetFileName(file);

                        if (locals.espDict[edid]) {
                            helpers.logMessage('Record ' + edid + ' has duplicated EditorID. It is found both in ' + locals.espDict[edid] + ' and in ' + fileName);
                            helpers.logMessage("TUS handled it, but it's not very good. You should report this duplicated to author of one these mods.");
                            helpers.logMessage("Author should rename or delete this duplicate.")
                            return false;
                        }
                        else {
                            locals.espDict[edid] = fileName;
                        }
                    }

                    let allowedBySettings = settings.unlevelLVLI && xelib.HasElement(record, 'Leveled List Entries');
                    return allowedBySettings && getAllowedToPatch(settings, locals, record);
                }
            }
        },
        patch: function (record, helpers, settings, locals) {
            unlevelLVLI(record, helpers, settings, locals, '', true);
        }
    };

    module.raceUnleveler = {
        load: function (plugin, helpers, settings, locals) {
            return {
                signature: 'RACE',
                filter: function (record) {
                    return parseFloat(settings.magickaRegenModifier) !== 1.0;
                }
            }
        },
        patch: function (record, helpers, settings, locals) {
            let currentMagickaRegen = xelib.GetValue(record, 'DATA\\Magicka Regen');
            let newMagickaRegen = currentMagickaRegen * parseFloat(settings.magickaRegenModifier);
            xelib.SetFloatValue(record, 'DATA\\Magicka Regen', newMagickaRegen);
        }
    }

    function createNewOutfits(record, helpers, settings, locals, globalSuffix) {
        function copyOutfit(outfit, edid, suffix) {
            let newOutfitEdid = edid + suffix + globalSuffix;
            if (locals.handleDict[newOutfitEdid]) {
                return locals.handleDict[newOutfitEdid];
            }

            let newOutfit = xelib.CopyElement(outfit, locals.patch, true);

            xelib.SetValue(newOutfit, 'EDID', newOutfitEdid);
            helpers.cacheRecord(newOutfit, newOutfitEdid);
            let newOutfitLongName = xelib.LongName(newOutfit);
            locals.longNameDict[newOutfitEdid] = newOutfitLongName;
            locals.edidDict[newOutfitLongName] = newOutfitEdid;
            locals.handleDict[newOutfitEdid] = newOutfit;
            return newOutfit;
        }
        function rebalanceOutfit(outfit, suffix) {
            let items = xelib.GetElements(outfit, 'INAM');
            for (let i = 0; i < items.length; i++) {
                let item = items[i];
                let itemHandle = xelib.GetLinksTo(item, '');
                itemHandle = xelib.GetWinningOverride(itemHandle);
                let signature = xelib.Signature(itemHandle);
                if (signature !== 'LVLI') {
                    continue;
                }

                let itemLongName = xelib.GetValue(item, '');
                let itemEdid = locals.edidDict[itemLongName];
                if (!itemEdid) {
                    itemLongName = xelib.LongName(itemHandle);
                    itemEdid = xelib.EditorID(itemHandle);
                    locals.edidDict[itemLongName] = itemEdid;
                    locals.longNameDict[itemEdid] = itemLongName;
                }

                let newItemEdid = itemEdid + suffix + globalSuffix;

                if (!locals.longNameDict[newItemEdid] && !xelib.HasElement(itemHandle, 'Leveled List Entries')) {
                    continue;
                }

                if (!locals.longNameDict[newItemEdid]) {
                    unlevelLVLI(itemHandle, helpers, settings, locals, globalSuffix, false);
                }

                let newItemLongName = locals.longNameDict[newItemEdid];
                if (!newItemLongName) {
                }
                xelib.SetValue(item, '', newItemLongName);
            }
        }

        let edid = xelib.EditorID(record);
        let longName = xelib.LongName(record);
        locals.edidDict[longName] = edid;
        locals.longNameDict[edid] = longName;
        let weakOutfit = copyOutfit(record, edid, 'TUS_Weak');
        let strongOutfit = copyOutfit(record, edid, 'TUS_Strong');
        rebalanceOutfit(weakOutfit, 'TUS_Weak');
        rebalanceOutfit(strongOutfit, 'TUS_Strong');

    }

    module.outfitUnleveler = {
        load: function (plugin, helpers, settings, locals) {
            return {
                signature: 'OTFT',
                filter: function (record) {
                    let allowedBySettings = settings.unlevelLVLI;
                    return allowedBySettings && getAllowedToPatch(settings, locals, record);
                }
            }
        },
        patch: function (record, helpers, settings, locals) {
            createNewOutfits(record, helpers, settings, locals, '');
        }
    };

    module.lvlNpcUnleveler = {
        load: function (plugin, helpers, settings, locals) {
            return {
                signature: 'LVLN',
                filter: function (record) {
                    let allowedBySettings = settings.unlevelLVLI && xelib.HasElement(record, 'Leveled List Entries');
                    return allowedBySettings && getAllowedToPatch(settings, locals, record);
                }
            }
        },
        patch: function (record, helpers, settings, locals) {
            let stats = getListStats(record);
            if (stats.minLevel == stats.maxLevel) {
                return;
            }

            let items = xelib.GetElements(record, 'Leveled List Entries');
            for (let i = 0; i < items.length; i++) {
                let item = items[i];
                let level = xelib.GetUIntValue(item, 'LVLO\\Level');
                let suffix;
                if (level >= stats.mediumLevel) {
                    suffix = 'TUS_Strong';
                }
                else {
                    suffix = 'TUS_Weak';
                }

                //move to npc
                let npcHandle = xelib.GetLinksTo(item, 'LVLO\\Reference');
                if (npcHandle === 0) {
                    let edid = xelib.EditorID(record);
                    helpers.logMessage("There is a broken record " + edid + ". It is present in TUS.esp, in Leveled NPCs group. Check it's master overrides and determine which mod is causing the issues.");
                    return;
                }
                npcHandle = xelib.GetWinningOverride(npcHandle);
                let npcLongName = xelib.LongName(npcHandle);
                if (!locals.npcOutfitSuffixes[npcLongName]) {
                    locals.npcOutfitSuffixes[npcLongName] = suffix;
                }
            }
        }
    };

    module.npcUnleveler = {
        load: function (plugin, helpers, settings, locals) {
            return {
                signature: 'NPC_',
                filter: function (record) {
                    let allowedBySettings = settings.unlevelLVLI || settings.unlevelNPCs || settings.distributePerks || settings.removeOffsets;
                    let edid = xelib.EditorID(record);
                    return allowedBySettings && !edid.includes('Player') && getAllowedToPatch(settings, locals, record);
                }
            }
        },
        patch: function (record, helpers, settings, locals) {
            function changeOutfit() {
                let recordLongName = xelib.LongName(record);
                let suffix = locals.npcOutfitSuffixes[recordLongName];

                if (xelib.HasElement(record, 'DOFT') && suffix) {
                    let oftLongName = xelib.GetValue(record, 'DOFT');
                    let oftEdid = locals.edidDict[oftLongName];
                    if (!oftEdid) {
                        let oftHandle = xelib.GetLinksTo(record, 'DOFT');
                        oftHandle = xelib.GetWinningOverride(oftHandle);
                        oftLongName = xelib.LongName(oftHandle);
                        oftEdid = xelib.EditorID(oftHandle);
                        locals.edidDict[oftLongName] = oftEdid;
                        locals.longNameDict[oftEdid] = oftLongName;
                    }

                    let newOftEdid = oftEdid + suffix;

                    if (!locals.longNameDict[newOftEdid]) {
                        let fileName = getFileName(record, true);
                        newOftEdid = newOftEdid + '_' + fileName;
                        if (!locals.longNameDict[newOftEdid]) {
                            let oftHandle = xelib.GetLinksTo(record, 'DOFT');
                            oftHandle = xelib.GetWinningOverride(oftHandle);
                            createNewOutfits(oftHandle, helpers, settings, locals, '_' + fileName);
                        }
                    }
                    let newOftLongName = locals.longNameDict[newOftEdid];
                    xelib.SetValue(record, 'DOFT', newOftLongName);
                }

                if (xelib.HasElement(record, 'Items') && suffix) {
                    //change inventory items now
                    let items = xelib.GetElements(record, 'Items');
                    for (let i = 0; i < items.length; i++) {
                        let item = items[i];
                        let itemLongName = xelib.GetValue(item, 'CNTO\\Item');
                        let itemEdid = locals.edidDict[itemLongName];
                        if (!itemEdid) {
                            let itemHandle = xelib.GetLinksTo(item, 'CNTO\\Item');
                            itemHandle = xelib.GetWinningOverride(itemHandle);
                            itemLongName = xelib.LongName(itemHandle);
                            itemEdid = xelib.EditorID(itemHandle);
                            locals.edidDict[itemLongName] = itemEdid;
                            locals.longNameDict[itemEdid] = itemLongName;
                        }

                        let newItemEdid = itemEdid + suffix;
                        let newItemLongName = locals.longNameDict[newItemEdid];
                        if (newItemLongName) {
                            xelib.SetValue(item, 'CNTO\\Item', newItemLongName);
                        }
                    }
                }
            }
            function getRaceEdid() {
                let raceLongName = xelib.GetValue(record, 'RNAM');
                if (!locals.edidDict[raceLongName]) {
                    let raceHandle = xelib.GetLinksTo(record, 'RNAM');
                    locals.edidDict[raceLongName] = xelib.EditorID(raceHandle);
                }
                let raceEdid = locals.edidDict[raceLongName];
                return raceEdid;
            }
            function setPerks() {
                let classLongName = xelib.GetValue(record, 'CNAM');
                if (!locals.edidDict[classLongName]) {
                    let classHandle = xelib.GetLinksTo(record, 'CNAM');
                    locals.edidDict[classLongName] = xelib.EditorID(classHandle);
                }
                let classEdid = locals.edidDict[classLongName];
                let raceEdid = getRaceEdid();
                let perkEdids = perkCalculator.getActorPerks(locals, staticLevel, raceEdid, classEdid);
                if (xelib.HasElement(record, 'Perks') && settings.removeOldPerks) {
                    xelib.RemoveElement(record, 'Perks');
                }

                perkEdids.forEach(perkEdid => {
                    let perkLongName = locals.longNameDict[perkEdid];
                    let hasPerk = false;
                    if (!settings.removeOldPerks) {
                        hasPerk = xelib.HasPerk(record, perkEdid);
                    }

                    if (!hasPerk) {
                        xelib.AddPerk(record, perkLongName, '1');
                    }
                });
            }
            function hasFaction(factions) {
                let hasFaction = false;
                if (xelib.HasElement(record, 'Factions')) {
                    let snams = xelib.GetElements(record, 'Factions');

                    for (let j = 0; j < snams.length; j++) {
                        let factionHandle = xelib.GetLinksTo(snams[j], 'Faction');
                        let faction = xelib.EditorID(factionHandle);
                        if (factions.includes(faction)) {
                            hasFaction = true;
                            break;
                        }
                    }
                }
                return hasFaction;
            }
            function getIsFollower(edid) {
                let isFollower = false;
                locals.customFollowers.forEach(dictEntry => {
                    let hasKey = edid.includes(dictEntry.Key);

                    if (hasKey) {
                        let isAllowed = true;
                        dictEntry.ForbiddenKeys.forEach(forbiddenKey => {
                            if (edid.includes(forbiddenKey)) {
                                hasKey = false;
                            }
                        });
                    }

                    if (hasKey) {
                        isFollower = true;
                    }
                });

                if (!isFollower) {
                    isFollower = hasFaction(['PotentialFollowerFaction', 'PotentialHirelingFaction'])
                }
                return isFollower;
            }
            function getStaticLevel(edid) {
                let level;
                let multLvl = 0;
                let npcEntry;
                //find by edid
                locals.uniqueNPCs.forEach(entry => {
                    entry.Keys.forEach(key => {
                        if (edid.includes(key)) {
                            npcEntry = entry;
                        }
                    });

                    entry.ForbiddenKeys.forEach(key => {
                        if (edid.includes(key)) {
                            npcEntry = undefined;
                        }
                    })
                });

                if (npcEntry) {
                    level = npcEntry.Level;
                }
                else { //find by faction
                    locals.genericNPCs.forEach(entry => {
                        if (hasFaction(entry.Factions)) {
                            npcEntry = entry;
                        }
                    });

                    if (npcEntry) {
                        if (npcEntry.Level) {
                            level = npcEntry.Level;
                        }
                        else {
                            let min = npcEntry.MinLevel;
                            let max = npcEntry.MaxLevel;
                            level = Math.floor(Math.random() * (max - min + 1)) + min;
                            level = Math.round(level);
                        }
                    }
                }

                if (!npcEntry) {
                    if (xelib.GetFlag(record, 'ACBS\\Flags', 'PC Level Mult')) {
                        multLvl = xelib.GetValue(record, 'ACBS\\Level Mult');
                        multLvl = parseFloat(multLvl);
                        if (multLvl <= 0) {
                            multLvl = 1;
                        }

                        let minLvl = xelib.GetUIntValue(record, 'ACBS\\Calc min level');
                        let maxLvl = xelib.GetUIntValue(record, 'ACBS\\Calc max level');
                        if (minLvl < 1) {
                            minLvl = 1;
                        }

                        let isUniqueNPC = xelib.GetFlag(record, 'ACBS\\Flags', 'Unique');
                        if (maxLvl === 0 || maxLvl > 81) {
                            maxLvl = isUniqueNPC ? 81 : (50 + minLvl) / 2;
                        }
                        level = (minLvl + maxLvl) * (multLvl / 2);
                        level = Math.round(level);
                    }
                    else {
                        level = xelib.GetUIntValue(record, 'ACBS\\Level');
                    }
                }

                let raceEdid = getRaceEdid();
                let raceEntry;

                locals.raceModifiers.forEach(entry => {
                    entry.Keys.forEach(key => {
                        if (raceEdid.includes(key)) {
                            raceEntry = entry;
                        }
                    });

                    entry.ForbiddenKeys.forEach(key => {
                        if (raceEdid.includes(key)) {
                            raceEntry = undefined;
                        }
                    })
                });

                if (raceEntry) {
                    level = level * raceEntry.LevelModifier;
                }

                return level;
            }
            function getWillReceivePerks() {
                let raceName = xelib.GetValue(record, 'RNAM');
                if (!locals.racePerkUseStatus.hasOwnProperty(raceName)) {
                    let raceHandle = xelib.GetLinksTo(record, 'RNAM');
                    raceHandle = xelib.GetWinningOverride(raceHandle);
                    let canUsePerks = xelib.HasKeyword(raceHandle, 'ActorTypeNPC') || xelib.HasKeyword(raceHandle, 'ActorTypeUndead');
                    locals.racePerkUseStatus[raceName] = canUsePerks;
                }
                return locals.racePerkUseStatus[raceName];
            }

            locals.processedNPCs++;
            if (locals.processedNPCs % 100 === 1) {
                helpers.logMessage('Processed ' + (locals.processedNPCs - 1) + ' NPCs');
            }

            if (settings.unlevelLVLI) {
                changeOutfit();
            }

            let edid = xelib.EditorID(record);
            let staticLevel = getStaticLevel(edid);
            let isFollower = getIsFollower(edid);

            if (settings.unlevelNPCs && !isFollower) {
                xelib.SetFlag(record, 'ACBS\\Flags', 'PC Level Mult', false);
                xelib.SetUIntValue(record, 'ACBS\\Level', staticLevel);
            }

            if (settings.unlevelNPCs && isFollower) {
                xelib.SetFlag(record, 'ACBS\\Flags', 'PC Level Mult', true);
                xelib.SetUIntValue(record, 'ACBS\\Calc min level', Math.round(staticLevel * 0.5));
                xelib.SetUIntValue(record, 'ACBS\\Calc max level', Math.round(staticLevel * 1.5));
            }

            let willReceivePerks = getWillReceivePerks();

            if (settings.removeOffsets && willReceivePerks) {
                //set auto-cals stats
                xelib.SetFlag(record, 'ACBS\\Flags', 'Auto-calc stats', true);
                //remove offsets
                xelib.SetUIntValue(record, 'ACBS\\Magicka Offset', 0);
                xelib.SetUIntValue(record, 'ACBS\\Stamina Offset', 0);
                xelib.SetUIntValue(record, 'ACBS\\Health Offset', 0);
            }

            if (settings.distributePerks && willReceivePerks) {
                setPerks();
            }
        }
    };

    function finalizeLvliUnleveling(record, locals, suffix) {
        let items = xelib.GetElements(record, 'Leveled List Entries');
        for (let i = items.length - 1; i >= 0; i--) {
            let itemHandle = xelib.GetLinksTo(items[i], 'LVLO\\Reference');
            if (itemHandle == 0) {
                continue;
            }

            itemHandle = xelib.GetWinningOverride(itemHandle);
            let itemEdid = xelib.EditorID(itemHandle);
            let newItemEdid = itemEdid + suffix;
            let newItemLongName = locals.longNameDict[newItemEdid];
            if (newItemLongName) {
                xelib.SetValue(items[i], 'LVLO\\Reference', newItemLongName);
            }
        }
    }

    module.lvliSecondUnleveler = {
        load: function (plugin, helpers, settings, locals) {
            return {
                signature: 'LVLI',
                filter: function (record) {
                    let allowedBySettings = settings.unlevelLVLI && xelib.HasElement(record, 'Leveled List Entries');
                    return allowedBySettings && getAllowedToPatch(settings, locals, record);
                }
            }
        },
        patch: function (record, helpers, settings, locals) {
            let edid = xelib.EditorID(record);
            let weakList = locals.handleDict[edid + 'TUS_Weak'];
            finalizeLvliUnleveling(weakList, locals, 'TUS_Weak');
            let strongList = locals.handleDict[edid + 'TUS_Strong'];
            finalizeLvliUnleveling(strongList, locals, 'TUS_Strong');
        }
    };

    return module;
};
