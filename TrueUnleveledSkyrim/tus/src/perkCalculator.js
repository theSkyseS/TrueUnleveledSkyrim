function getActorSkillPoints(locals, level, raceEdid, classEdid) {
    let raceEntry = locals.raceSkillDict[raceEdid];
    let classEntry = locals.classDict[classEdid];
    let skillPoints = {};
    let totalPerkNumber = level - 1;
    let skillWeightPoints = (totalPerkNumber * locals.levelUp) / classEntry["total"];

    locals.skillNames.forEach(skill => {
        skillPoints[skill] = classEntry[skill] * skillWeightPoints;
        if (raceEntry[skill]) {
            skillPoints[skill] += raceEntry[skill];
        }
        skillPoints[skill] = Math.ceil(skillPoints[skill]);
    });
    return skillPoints;
}

exports.getActorPerks = function (locals, level, raceEdid, classEdid) {
    if (level <= 1) {
        return [];
    }

    let skillPointsDict = getActorSkillPoints(locals, level, raceEdid, classEdid);
    //let perkNumbers = getActorPerkNumbers(locals, level, skillPoints);
    let perkEdids = locals.defaultPerkEdids.slice();
    let finalPerkEdids = perkEdids.slice();

    let skillPointNumbers = [];
    let skillPointReverseDict = {};
    locals.skillNames.forEach(skill => {
        let pointNumber = skillPointsDict[skill];
        skillPointNumbers.push(pointNumber);
        if (!skillPointReverseDict.hasOwnProperty(pointNumber)) {
            skillPointReverseDict[pointNumber] = [];
        }
        skillPointReverseDict[pointNumber].push(skill);
    });

    skillPointNumbers.sort();
    skillPointNumbers.reverse();
    let perkNumberToFill = level - 1;
    skillPointNumbers.forEach(pointNumber => {
        let skills = skillPointReverseDict[pointNumber];
        let newPerkEdid;
        let hasMorePerksToAdd;

        do {
            hasMorePerksToAdd = false;
            //add one perk for every skill
            for (let i = 0; i < skills.length; i++) {
                if (perkNumberToFill <= 0) break;
                let skill = skills[i];
                let tree = locals.treeDict[skill];
                //find perk that satisfies point and required perks conditions
                for (var possiblePerkEdid in tree) {
                    if (!perkEdids.includes(possiblePerkEdid) && possiblePerkEdid !== "number") {
                        let possiblePerk = tree[possiblePerkEdid];
                        if (possiblePerk.points > skillPointsDict[skill]) continue;

                        let hasAllRequiredPerks = true;
                        possiblePerk.path.forEach(requiredPerkEdid => {
                            if (!perkEdids.includes(requiredPerkEdid)) { // not finalPerkEdids here!
                                hasAllRequiredPerks = false;
                            }
                        });

                        if (hasAllRequiredPerks) {
                            newPerkEdid = possiblePerkEdid;
                            perkEdids.push(newPerkEdid);
                            hasMorePerksToAdd = true;
                            let isAllowed = true;

                            locals.excludedPerks.forEach(entry => {
                                entry.Keys.forEach(key => {
                                    if (newPerkEdid.includes(key)) {
                                        isAllowed = false;
                                    }
                                });
            
                                entry.ForbiddenKeys.forEach(key => {
                                    if (newPerkEdid.includes(key)) {
                                        isAllowed = true;
                                    }
                                })
                            });
            
                            if(isAllowed) {
                                perkNumberToFill--;
                                finalPerkEdids.push(newPerkEdid);
                            }
                            break;
                        }
                    }
                }
            }
        }
        while (hasMorePerksToAdd);
    });
    return finalPerkEdids;
}