module.exports = function (patcherPath, fh) {
    let module = {};
    function loadResource(name) {
        let resourcePath = patcherPath + '\\resources\\' + name + '.json';
        return fh.loadJsonFile(resourcePath);
    }

    function getSkillNames() {
        let skillNames =
            [
                'alchemy',
                'alteration',
                'archery',
                'block',
                'conjuration',
                'destruction',
                'enchanting',
                'heavyarmor',
                'illusion',
                'lightarmor',
                'lockpicking',
                'onehanded',
                'pickpocket',
                'restoration',
                'smithing',
                'sneak',
                'speech',
                'twohanded'
            ];
        return skillNames;
    }

    function getSkillWeights() {
        let weights = {};
        weights[0] = 'onehanded';
        weights[1] = 'twohanded';
        weights[2] = 'archery';
        weights[3] = 'block';
        weights[4] = 'smithing';
        weights[5] = 'heavyarmor';
        weights[6] = 'lightarmor';
        weights[7] = 'pickpocket';
        weights[8] = 'lockpicking';
        weights[9] = 'sneak';
        weights[10] = 'alchemy';
        weights[11] = 'speech';
        weights[12] = 'alteration';
        weights[13] = 'conjuration';
        weights[14] = 'destruction';
        weights[15] = 'illusion';
        weights[16] = 'restoration';
        weights[17] = 'enchanting';
        return weights;
    }

    function getActorValues() {
        let avifs = {};
        avifs['onehanded'] = 'AVOneHanded';
        avifs['twohanded'] = 'AVTwoHanded';
        avifs['archery'] = 'AVMarksman';
        avifs['block'] = 'AVBlock';
        avifs['smithing'] = 'AVSmithing';
        avifs['heavyarmor'] = 'AVHeavyArmor';
        avifs['lightarmor'] = 'AVLightArmor';
        avifs['pickpocket'] = 'AVPickpocket';
        avifs['lockpicking'] = 'AVLockpicking';
        avifs['sneak'] = 'AVSneak';
        avifs['alchemy'] = 'AVAlchemy';
        avifs['speech'] = 'AVSpeechcraft';
        avifs['alteration'] = 'AVAlteration';
        avifs['conjuration'] = 'AVConjuration';
        avifs['destruction'] = 'AVDestruction';
        avifs['illusion'] = 'AVMysticism';
        avifs['restoration'] = 'AVRestoration';
        avifs['enchanting'] = 'AVEnchanting';
        return avifs;
    }

    function getGlobalSetting(edid, type) {
        let gmst = xelib.GetElement(0, 'Skyrim.esm\\GMST\\' + edid);
        gmst = xelib.GetWinningOverride(gmst);
        let value = xelib.GetValue(gmst, 'DATA\\' + type);
        return value;
    }

    function getRecords(helpers, locals, signature) {
        let records = helpers.loadRecords(signature);
        let dict = {};
        records.forEach(handle => {
            let edid = xelib.EditorID(handle);
            dict[edid] = handle;
            locals.longNameDict[edid] = xelib.LongName(handle);
        });
        return dict;
    }

    function getLastPreviousIndexes(avif, finalIndex) {
        let perkTreeNodes = xelib.GetElements(avif, 'Perk Tree');
        let lastPreviousIndexes = [];

        perkTreeNodes.forEach(node => {
            if (xelib.HasElement(node, 'Connections')) {
                let currentIndex = xelib.GetUIntValue(node, 'INAM');
                let connections = xelib.GetElements(node, 'Connections');
                connections.forEach(cnam => {
                    let cnamIndex = xelib.GetUIntValue(cnam, '');
                    if (cnamIndex === finalIndex) {
                        lastPreviousIndexes.push(currentIndex);
                    }
                });
            }
        });

        return lastPreviousIndexes;
    }

    function getPathToIndex(avif, edids, finalIndex) {
        let pathIndexes = [];
        let currentIndexes = [finalIndex];

        do {
            let allLastPreviousIndexes = [];
            currentIndexes.forEach(currentIndex => {
                let lastPreviousIndexes = getLastPreviousIndexes(avif, currentIndex);
                allLastPreviousIndexes = allLastPreviousIndexes.concat(lastPreviousIndexes);
            });
            pathIndexes = pathIndexes.concat(allLastPreviousIndexes);
            currentIndexes = allLastPreviousIndexes;
        }
        while (currentIndexes.length > 0);

        let pathEdids = [];
        pathIndexes.forEach(index => {
            if (edids[index]) {
                pathEdids.push(edids[index]);
            }
        });
        return [...new Set(pathEdids)]
    }

    function getPerkTreeDict(locals) {
        function getPointsCondition(perkHandle) {
            let required = 0;
            if (xelib.HasElement(perkHandle, 'Conditions')) {
                let conditions = xelib.GetElements(perkHandle, 'Conditions');
                conditions.forEach(condition => {
                    let ctda = xelib.GetElement(condition, 'CTDA');
                    if (xelib.HasElement(ctda, '[3]')) {
                        let functionName = xelib.GetValue(ctda, '[3]');
                        if (functionName === 'GetBaseActorValue') {
                            required = xelib.GetUIntValue(ctda, '[2]');
                        }
                    }
                });
            }
            return required;
        }

        let dict = {};
        locals.skillNames.forEach(skillName => {
            let avifEdid = locals.actorValues[skillName];
            let avif = xelib.GetElement(0, 'Skyrim.esm\\AVIF\\' + avifEdid);
            avif = xelib.GetWinningOverride(avif);
            let perkTreeNodes = xelib.GetElements(avif, 'Perk Tree');
            let perkEntries = {};
            let edids = {};
            let indexes = {};
            let perkEdids = [];
            let numberOfPerks = 0;

            perkTreeNodes.forEach(node => {
                let perkUInt = xelib.GetUIntValue(node, 'PNAM');
                if (perkUInt) {
                    let perkHandle = xelib.GetLinksTo(node, 'PNAM');
                    perkHandle = xelib.GetWinningOverride(perkHandle);
                    let perkEdid = xelib.EditorID(perkHandle);
                    perkEdids.push(perkEdid);
                    let perkIndex = xelib.GetUIntValue(node, 'INAM');
                    edids[perkIndex] = perkEdid;
                    indexes[perkEdid] = perkIndex;
                    numberOfPerks++;
                }
            });

            perkEdids.forEach(perkEdid => {
                let perkHandle = locals.perks[perkEdid];
                let perkIndex = indexes[perkEdid];
                perkEntries[perkEdid] = {
                    edid: perkEdid,
                    handle: perkHandle,
                    longName: xelib.LongName(perkHandle),
                    path: getPathToIndex(avif, edids, perkIndex),
                    points: getPointsCondition(perkHandle)
                };
            });

            perkEdids.forEach(perkEdid => {
                let nextPerkHandle = locals.perks[perkEdid];
                let path = [perkEdid];

                while (xelib.HasElement(nextPerkHandle, 'NNAM')) {
                    nextPerkHandle = xelib.GetLinksTo(nextPerkHandle, 'NNAM');
                    if (nextPerkHandle) {
                        nextPerkHandle = xelib.GetWinningOverride(nextPerkHandle);
                        let nextPerkEdid = xelib.EditorID(nextPerkHandle);
                        numberOfPerks++;

                        perkEntries[nextPerkEdid] = {
                            edid: nextPerkEdid,
                            handle: nextPerkHandle,
                            longName: xelib.LongName(nextPerkHandle),
                            path: path.slice(),
                            points: getPointsCondition(nextPerkHandle)
                        };

                        path.push(nextPerkEdid);
                    }
                }
            });

            perkEntries["number"] = numberOfPerks;
            dict[skillName] = perkEntries;
        });
        return dict;
    }

    function getClassDict(helpers, locals) {
        let dict = {};
        let handles = helpers.loadRecords('CLAS');

        handles.forEach(handle => {
            let clasEdid = xelib.EditorID(handle);
            let weightElement = xelib.GetElement(handle, 'DATA\\Skill Weights');
            let weights = {};
            let totalWeight = 0;
            for (let i = 0; i < 18; i++) {
                let skillName = locals.skillWeights[i];
                weights[skillName] = xelib.GetUIntValue(weightElement, '[' + i + ']');
                totalWeight += weights[skillName];
            }
            weights["total"] = totalWeight;
            dict[clasEdid] = weights;
        });

        return dict;
    }

    function getRaceSkillDict(helpers, locals) {
        let dict = {};
        let handles = helpers.loadRecords('RACE');

        handles.forEach(handle => {
            let data = {};
            let skillBoosts = xelib.GetElements(handle, 'DATA\\Skill Boosts');
            skillBoosts.forEach(skillBoost => {
                let skill = xelib.GetValue(skillBoost, 'Skill');
                skill = skill.toLowerCase().replace('-', '').replace(' ', '');
                let boost = xelib.GetUIntValue(skillBoost, 'Boost');
                data[skill] = boost;
            });

            let raceEdid = xelib.EditorID(handle);
            dict[raceEdid] = data;
        });

        return dict;
    }

    module.setLocals = function (patchFile, helpers, settings, locals) {
        locals.patch = patchFile;
        locals.date = new Date();
        locals.levelUp = getGlobalSetting('iAVDSkillsLevelUp', 'Int');
        locals.levelUp = parseInt(locals.levelUp);
        locals.skillNames = getSkillNames();
        locals.skillWeights = getSkillWeights();
        locals.actorValues = getActorValues();

        //longName as key, edid as value
        locals.edidDict = {};
        //edid as key, longName as value
        locals.longNameDict = {};
        //suffix for new NPC outfits
        locals.npcOutfitSuffixes = {};
        //edid as key, handle as value
        locals.handleDict = {};
        //edid as key, esp file name as value
        locals.espDict = {};
        //handle as key, bool as value
        locals.racePerkUseStatus = {};

        locals.defaultPerkEdids = ['AlchemySkillBoosts', 'PerkSkillBoosts', 'TorchBashPerk'];
        locals.perks = getRecords(helpers, locals, 'PERK');
        locals.keywords = getRecords(helpers, locals, 'KYWD');
        locals.treeDict = getPerkTreeDict(locals);
        locals.classDict = getClassDict(helpers, locals);
        locals.raceSkillDict = getRaceSkillDict(helpers, locals);
        locals.processedNPCs = 0;
        locals.zoneTypesByKeyword = loadResource('zoneTypesByKeyword');
        locals.zoneTypesByEDID = loadResource('zoneTypesByEDID');
        locals.customFollowers = loadResource('customFollowers');
        locals.uniqueNPCs = loadResource('NPCsByEDID');
        locals.genericNPCs = loadResource('NPCsByFaction');
        locals.excludedPerks = loadResource('excludedPerks');
        locals.excludedNPCs = loadResource('excludedNPCs');
        locals.raceModifiers = loadResource('raceLevelModifiers');
    }

    return module;
}