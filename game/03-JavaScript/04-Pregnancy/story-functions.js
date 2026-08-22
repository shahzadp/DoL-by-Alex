/** The player's parasite pregnancy on $sexStats. Real pregnancies live on records. */
function getParasiteObject() {
	return V.player.vaginaExist ? V.sexStats.vagina.pregnancy : V.sexStats.anus.pregnancy;
}
window.getParasiteObject = getParasiteObject;

/** Total births the player's body has been through, across both orifices. */
function playerNormalPregnancyTotal() {
	return V.sexStats.vagina.pregnancy.totalBirthEvents + V.sexStats.anus.pregnancy.totalBirthEvents;
}
window.playerNormalPregnancyTotal = playerNormalPregnancyTotal;

/**
 * Pregnancy belly size. Stays hidden until the pregnancy progresses
 * and then ramps up to term size by the due date based on litter.
 *
 * @param {object} pregnancy a records pregnancy
 * @returns {number} belly contribution on the 0-maxSize belly-sprite scale
 */
function pregnancyBellySize(pregnancy) {
	const litter = getChildrenOf(pregnancy.pregnancyId).length;
	const termSize = Math.clamp(PregnancyConstants.belly.termBase + litter, 0, PregnancyConstants.belly.maxSize);
	const showAt = PregnancyConstants.belly.showFraction;
	const shown = Math.clamp((pregnancyProgress(pregnancy) - showAt) / (1 - showAt), 0, 1);
	return shown * termSize;
}
window.pregnancyBellySize = pregnancyBellySize;

// pregnancyOnly: count only the belly from pregnancies, excluding parasites and bloat —
// for checks that ask whether the pregnancy itself shows.
function playerBellySize(pregnancyOnly = false) {
	let bellySize = V.bellySizeDebug || 0;
	if (!V.statFreeze) {
		// Pregnancies live in records. The belly grows with progress
		// toward a term size set by the litter count. Both
		// orifices can carry at once, so their bellies add up.
		for (const orifice of ["vagina", "anus"]) {
			const pregnancy = getActivePregnancy("pc", orifice);
			if (pregnancy) bellySize += pregnancyBellySize(pregnancy);
		}
		// Parasites are a separate system from real pregnancies. They live directly on
		// V.sexStats.*.pregnancy, not in records.
		if (!pregnancyOnly) {
			if (V.sexStats.vagina.pregnancy.type === "parasite") bellySize += Math.clamp(V.sexStats.vagina.pregnancy.fetus.length, 0, 4);
			if (V.sexStats.anus.pregnancy.type === "parasite") bellySize += Math.clamp(V.sexStats.anus.pregnancy.fetus.length, 0, 4);
			if (V.daily.bloated) bellySize += Math.clamp(V.daily.bloated, 1, 2);
			if (V.parasite.tummy.name === "urchin") bellySize += 2;
			if (V.parasite.tummy.name === "slime") bellySize -= 2;
		}
	}

	return Math.floor(Math.clamp(bellySize, 0, PregnancyConstants.belly.maxSize));
}
window.playerBellySize = playerBellySize;

function playerBellyVisible(pregnancyOnly = false) {
	const visibility = PregnancyConstants.belly.visibility;
	const size = playerBellySize(pregnancyOnly);
	if (size < visibility.bareMin) return false;
	if (
		size < visibility.clothedMin &&
		((V.worn.upper.name !== "naked" && !V.worn.upper.type.includes("bellyShow")) || !V.worn.over_upper.type.includes("naked"))
	)
		return false;
	if (
		size < visibility.hiddenMin &&
		(V.worn.upper.type.includes("bellyHide") || V.worn.lower.type.includes("bellyHide") || !V.worn.over_upper.type.includes("naked"))
	)
		return false;

	return true;
}
window.playerBellyVisible = playerBellyVisible;

function npcBellySize(npc) {
	let bellySize = 0;
	for (const pregnancy of getActivePregnancies(npc)) bellySize += pregnancyBellySize(pregnancy);

	return Math.floor(Math.clamp(bellySize, 0, PregnancyConstants.belly.maxSize));
}
window.npcBellySize = npcBellySize;

function npcBellyVisible(npc) {
	return npcBellySize(npc) >= PregnancyConstants.belly.visibility.bareMin;
}
window.npcBellyVisible = npcBellyVisible;

function npcPregnancyProgress(npc, percent = true) {
	const pregnancy = getActivePregnancies(npc)[0];
	if (!pregnancy) return null;
	return percent ? pregnancyProgress(pregnancy) : Time.date.timeStamp - pregnancy.conceivedDate;
}
window.npcPregnancyProgress = npcPregnancyProgress;

function npcIsPregnant(npc) {
	return getActivePregnancies(npc).length > 0;
}
window.npcIsPregnant = npcIsPregnant;

function npcPregnancyEnding(npc) {
	const pregnancy = getLabouringPregnancy(npc);
	return !!(pregnancy && pregnancy.waterBreaking);
}
window.npcPregnancyEnding = npcPregnancyEnding;

/**
 * Whether a bird NPC has an egg ready and if its fertilised.
 * "fertilised" = an active hawk pregnancy that's due to lay.
 * "unfertilised" = not pregnant but in the fertile window.
 * undefined = nothing ready, or egg laying is disabled.
 *
 * @param {string} npc the NPC's name
 * @returns {"fertilised"|"unfertilised"|undefined}
 */
function birdEggsReady(npc) {
	if (V.settings.playerPregnancyEggLayingEnabled === false || !C.npc[npc] || C.npc[npc].vagina === "none") return undefined;
	const pregnancy = C.npc[npc].pregnancy;
	if (getActivePregnancies(npc).some(p => childBaseSpecies(p.donorSpecies) === "hawk" && (p.waterBreaking || Time.date.timeStamp >= getDueDate(p))))
		return "fertilised";
	if (npc === "Great Hawk" && V.daily.hawkUnfertilisedEggs) return undefined;
	if (
		!npcIsPregnant(npc) &&
		((V.settings.fertilityCycleEnabled === true && pregnancy.cycleDay === pregnancy.cycleDangerousDay + 2) ||
			(V.settings.fertilityCycleEnabled === false && pregnancy.nonCycleFertility < 1 && pregnancy.nonCycleHasEggs))
	)
		return "unfertilised";
}
window.birdEggsReady = birdEggsReady;

function playerIsPregnant() {
	return getActivePregnancies("pc").length > 0;
}
window.playerIsPregnant = playerIsPregnant;

function playerPregnancyProgress(percent = true) {
	const active = getActivePregnancies("pc");
	if (!active.length) return null;
	const furthest = active.reduce((a, b) => (pregnancyProgress(a) >= pregnancyProgress(b) ? a : b));
	return percent ? pregnancyProgress(furthest) : Time.date.timeStamp - furthest.conceivedDate;
}
window.playerPregnancyProgress = playerPregnancyProgress;

function isPregnancyEnding() {
	if (V.statFreeze) return null;
	return getActivePregnancies("pc").some(pregnancy => pregnancy.waterBreaking && !pregnancy.birthInProgress);
}
window.isPregnancyEnding = isPregnancyEnding;

function playerNormalPregnancyType() {
	const pregnancy = getLabouringPregnancy("pc");
	return pregnancy ? childBaseSpecies(pregnancy.donorSpecies) : null;
}
window.playerNormalPregnancyType = playerNormalPregnancyType;

/**
 * Shared setup for the daily and waking pregnancy symptom events.
 *
 * @returns {object|null} the readings the symptom events need, or null when no symptom event should fire
 */
function pregnancyEventReadings() {
	if (V.statFreeze) return null;
	if (!V.player.vaginaExist && playerNormalPregnancyTotal() === 0 && !playerIsPregnant()) return null;
	const pregnancy = getPlayerPregnancy();
	if (!pregnancy && (V.sexStats.vagina.pregnancy.type === "parasite" || V.sexStats.anus.pregnancy.type === "parasite")) return null;
	return {
		pregnancy,
		menstruation: V.sexStats.vagina.menstruation,
		pills: V.sexStats.pills,
		pregnancyStage: pregnancy ? pregnancyProgress(pregnancy) : false,
		normalPregnancyEvents: pregnancy ? childBaseSpecies(pregnancy.donorSpecies) !== "hawk" : false,
	};
}

/**
 * Rolls one pregnancy symptom for a chosen event category.
 *
 * @param {string} effectName the event category to roll within
 * @param {object} pregnancy the pregnancy the symptom is for
 * @returns {string} the rolled symptom effect name
 */
function pregnancyEventSymptom(effectName, pregnancy) {
	switch (effectName) {
		case "discomfortModerate":
			return weightedRandom(["lightHeaded", 1], ["dizzy", 3], ["mildNausea", 3], ["nausea", 1], ["headache", 1]);
		case "discomfortSevere":
			return weightedRandom(
				["lightHeaded", 1],
				["dizzy", 1],
				["sensitiveBreasts", 1],
				["mildNausea", 1],
				["headache", 1],
				["nausea", 4],
				["dryheaving", 3]
			);
		case "midPregnancy":
			return weightedRandom(
				["tired", 1],
				[V.submissive >= 1000 ? "crying" : "angry", 1],
				[childBaseSpecies(pregnancy.donorSpecies) === "wolf" ? "meatCraving" : "foodCraving", 1]
			);
		case "nearBirth":
			return weightedRandom(["lightBabyKick", 1], ["babyKick", 1], ["babyMovement", 1], ["babyHiccup", 1]);
		case "nearBirthEvent":
			return weightedRandom(["lightBabyKick", 1], ["babyKick", 1], ["babyMovement", 1], ["babyHiccup", 1], ["earlyContractions", 2]);
		case "periodIssues":
			return weightedRandom(["nothing", 1], ["cramping", 1], ["bloated", 1], ["lightHeaded", 1], ["mildNausea", 1], ["nausea", 1]);
	}
	return false;
}

function wakingPregnancyEvent() {
	const readings = pregnancyEventReadings();
	if (!readings) return false;
	const { pregnancy, menstruation, pills, pregnancyStage, normalPregnancyEvents } = readings;

	const rng = random(0, 100);
	let wakingEffects;

	if (playerBellySize(true) >= 8 && !playerAwareTheyArePregnant()) {
		return "bellySize";
	} else if (
		V.settings.fertilityCycleEnabled === true &&
		V.player.vaginaExist &&
		!menstruation.awareOfPeriodDelay &&
		V.awareness >= 200 &&
		!playerAwareTheyArePregnant() &&
		pregnancyStage !== false &&
		between(menstruation.currentDay, 3, 5) &&
		(random(0, 100) >= 105 - V.sciencetrait * 5 || playerNormalPregnancyTotal() >= 3)
	) {
		return "missedPeriod";
	} else if (
		playerBellySize() >= 12 &&
		["genitals", "under_upper", "upper", "under_lower", "lower"].find(slot => V.worn[slot].type.includes("constricting"))
	) {
		return "clothesRemoval";
	} else if (
		V.settings.playerPregnancyEggLayingEnabled === true &&
		((playerNormalPregnancyType() === "hawk" && pregnancyProgress(getLabouringPregnancy("pc")) >= 1) ||
			(!playerIsPregnant() && !birdConceptionPending() && V.harpyEggs?.daysTillLaying <= 0))
	) {
		return "eggLaying";
	} else if (normalPregnancyEvents && between(pregnancyStage, 0.9, 1)) {
		wakingEffects = "nearBirthEvent";
	} else if (normalPregnancyEvents && between(pregnancyStage, 0.7, 0.9)) {
		wakingEffects = "nearBirth";
	} else if (normalPregnancyEvents && between(pregnancyStage, 0.4, 0.7) && rng > 50) {
		wakingEffects = "midPregnancy";
	} else if (normalPregnancyEvents && V.pregnancyStats.morningSicknessWaking >= 2) {
		wakingEffects = "discomfortSevere";
		V.pregnancyStats.morningSicknessWaking = 0;
	} else if (normalPregnancyEvents && V.pregnancyStats.morningSicknessWaking >= 1 && rng >= 50) {
		wakingEffects = "discomfortModerate";
		V.pregnancyStats.morningSicknessWaking = 0;
	} else if (normalPregnancyEvents && (pills.pills.contraceptive.doseTaken >= 2 || pills.pills["fertility booster"].doseTaken >= 2) && rng >= 50) {
		wakingEffects = "discomfortModerate";
	} else if ((pills.pills.contraceptive.doseTaken >= 1 || pills.pills["fertility booster"].doseTaken >= 1) && rng >= 75) {
		wakingEffects = "discomfortMild";
	}
	if (wakingEffects === "discomfortMild") {
		return weightedRandom(["nothing", 2], ["lightHeaded", 2], ["dizzy", 3], ["mildNausea", 1]);
	}
	return pregnancyEventSymptom(wakingEffects, pregnancy);
}
window.wakingPregnancyEvent = wakingPregnancyEvent;

function dailyPregnancyEvent() {
	const readings = pregnancyEventReadings();
	if (!readings) return false;
	const { pregnancy, menstruation, pills, pregnancyStage, normalPregnancyEvents } = readings;

	const rng = random(0, 100) + (V.daily.pregnancyEvent || 0);
	let dailyEffects;

	if (normalPregnancyEvents && ((between(pregnancyStage, 0.9, 0.95) && rng > 80) || (between(pregnancyStage, 0.95, 1) && rng >= 75))) {
		dailyEffects = "nearBirthEvent";
	} else if (normalPregnancyEvents && ((between(pregnancyStage, 0.7, 0.8) && rng > 85) || (between(pregnancyStage, 0.8, 0.9) && rng >= 80))) {
		dailyEffects = "nearBirth";
	} else if (normalPregnancyEvents && ((between(pregnancyStage, 0.4, 0.5) && rng > 90) || (between(pregnancyStage, 0.5, 0.7) && rng >= 85))) {
		dailyEffects = "midPregnancy";
	} else if (normalPregnancyEvents && V.pregnancyStats.morningSicknessGeneral >= 2 && rng >= 85) {
		dailyEffects = "discomfortSevere";
		V.pregnancyStats.morningSicknessGeneral--;
	} else if (normalPregnancyEvents && V.pregnancyStats.morningSicknessGeneral >= 1 && rng >= 90) {
		dailyEffects = "discomfortModerate";
		V.pregnancyStats.morningSicknessGeneral--;
	} else if (normalPregnancyEvents && (pills.pills.contraceptive.doseTaken >= 2 || pills.pills["fertility booster"].doseTaken >= 2) && rng >= 90) {
		dailyEffects = "discomfortModerate";
	} else if ((pills.pills.contraceptive.doseTaken >= 1 || pills.pills["fertility booster"].doseTaken >= 1) && rng >= 95) {
		dailyEffects = "discomfortMild";
	} else if (
		V.settings.fertilityCycleEnabled === true &&
		menstruation.currentState === "normal" &&
		(menstruation.currentDay < 3 || (menstruation.currentDay >= menstruation.currentDaysMax - 1 && rng >= 80)) &&
		menstruation.periodEnabled
	) {
		dailyEffects = "periodIssues";
	}

	if (dailyEffects === "discomfortMild") {
		return weightedRandom(["nothing", 1], ["lightHeaded", 2], ["dizzy", 4], ["mildNausea", 1]);
	}
	return pregnancyEventSymptom(dailyEffects, pregnancy);
}
window.dailyPregnancyEvent = dailyPregnancyEvent;

function pregnancyNameCorrection(name, caps = false) {
	switch (name) {
		case "Black Wolf":
		case "Great Hawk":
		case "Night Monster":
		case "Ivory Wraith":
		case "cum bucket":
			name = (caps ? "The " : "the ") + name;
			break;
		case "pc":
			name = caps ? "Yourself" : "yourself";
			break;
		default:
			name = name[0] === name[0].toLowerCase() ? (caps ? "A" : "a") + (["a", "e", "i", "o", "u"].includes(name[0]) ? "n " : " ") + name : name;
			break;
	}
	return name;
}
window.pregnancyNameCorrection = pregnancyNameCorrection;

/**
 * The character-screen fertility meter. Indexes riskMeterLabels, 0 (safe) up to the most fertile.
 *
 * @returns {number}
 */
function playerPregnancyRisk() {
	const levels = PregnancyConstants.riskMeterLabels.length - 1;
	if (V.settings.playerPregnancyHumanEnabled === false && V.settings.playerPregnancyBeastEnabled === false) return 0; // player pregnancy disabled
	if (!V.player.vaginaExist && !playerCanCarryAnally()) return 0;
	return Math.clamp(Math.round(menstrualFertility() * levels), 0, levels);
}
window.playerPregnancyRisk = playerPregnancyRisk;

/**
 * The PC's risky and dangerous days as calendar dates (MM/DD), for the stats screen.
 *
 * @returns {{risky: string, dangerous: string, today: "safe"|"risky"|"dangerous"}}
 */
function menstrualFertileDates() {
	const m = V.sexStats.vagina.menstruation;
	const [, , ovulationStart, ovulationEnd] = m.stages;
	const riskyStart = ovulationStart - m.fertileLeadDays;
	const cycleShift = m.currentDay > ovulationEnd ? m.currentDaysMax : 0;
	const dateFor = cycleDay => {
		const d = new DateTime(Time.date).addDays(Math.round(cycleDay + cycleShift - m.currentDay));
		return `${String(d.month).padStart(2, "0")}/${String(d.day).padStart(2, "0")}`;
	};
	const fertility = menstrualFertility();
	const today = fertility >= 1 ? "dangerous" : fertility > 0 ? "risky" : "safe";
	return {
		risky: `${dateFor(riskyStart)} to ${dateFor(ovulationStart - 1)}`,
		dangerous: `${dateFor(ovulationStart)} to ${dateFor(Math.ceil(ovulationEnd))}`,
		today,
	};
}
window.menstrualFertileDates = menstrualFertileDates;

/**
 * Advance the cycle by up to a day.
 * Fertility boosters (2+ doses) and the magic tattoo each add half a day.
 * The base half-day is skipped when a contraceptive blocks it.
 *
 * @param {Menstruation} menstruation V.sexStats.vagina.menstruation
 * @param {object} pills V.sexStats.pills
 */
function advanceMenstrualDay(menstruation, pills) {
	if (pills.pills["fertility booster"].doseTaken >= 2) menstruation.currentDay += 0.5;
	if (V.skin.pubic.pen === "magic" && V.skin.pubic.special === "pregnancy") menstruation.currentDay += 0.5;
	const contraceptive = pills.pills.contraceptive.doseTaken;
	const blocked = (contraceptive >= 1 && random(0, 100) >= 50) || contraceptive >= 2;
	if (!blocked) menstruation.currentDay += 0.5;
}
window.advanceMenstrualDay = advanceMenstrualDay;

/**
 * Roll a fresh cycle's phase boundaries from its length.
 *
 * The four values are day markers into the cycle:
 *   [0] cycleStart     always 0, the period begins
 *   [1] menstrualEnd   the period ends
 *   [2] ovulationStart peak fertility opens
 *   [3] ovulationEnd   the fertile window closes, half a day to a day later
 *
 * @param {number} currentDaysMax the cycle's length in days
 * @returns {number[]} [cycleStart, menstrualEnd, ovulationStart, ovulationEnd]
 */
function rollMenstrualStages(currentDaysMax) {
	const c = PregnancyConstants.menstrualCycle;
	const menstrualEnd = random(c.periodDaysMin, c.periodDaysMax);
	const ovulationStart = Math.round(currentDaysMax * c.ovulationStartCycleFraction);
	return [0, menstrualEnd, ovulationStart, ovulationStart + random(1, 2) * 0.5];
}
window.rollMenstrualStages = rollMenstrualStages;

function playerHeatMinArousal() {
	if (!V.sexStats || !V.sexStats.pills || (V.statFreeze && !V.statFreezeIgnoreRestrictions)) return 0;
	if (!V.player.vaginaExist && !playerCanCarryAnally()) return 0;
	if (playerIsPregnant() && !V.pregnancyStats.heatStillEnabled) return 0;

	const pills = V.sexStats.pills.pills;
	const risk = playerPregnancyRisk();
	const levels = PregnancyConstants.riskMeterLabels.length - 1;
	let minArousal = 0;

	// Should always be the first to modify minArousal
	if (risk >= levels - 1 && pills.contraceptive.doseTaken === 0) {
		if (V.earSlime.growth > 50 && V.earSlime.focus === "pregnancy" && !V.earSlime.defyCooldown) {
			minArousal += Math.clamp(V.earSlime.growth, 0, 200) * 5 * (risk - (levels - 2));
		}
		if (V.wolfgirl >= 2) minArousal += Math.clamp(V.wolfbuild, 0, 100) * 10 * (risk - (levels - 2));
		if (V.cat >= 2) minArousal += Math.clamp(V.catbuild, 0, 100) * 10 * (risk - (levels - 2));
		if (V.cow >= 2) minArousal += Math.clamp(V.cowbuild, 0, 100) * 10 * (risk - (levels - 2));
		if (V.fox >= 2) minArousal += Math.clamp(V.foxbuild, 0, 100) * 10 * (risk - (levels - 2));
	}
	if (minArousal === 0) V.pregnancyStats.heatStillEnabled = !playerIsPregnant();

	if (pills["fertility booster"].doseTaken > 2) {
		minArousal += 500;
	}

	return minArousal;
}
window.playerHeatMinArousal = playerHeatMinArousal;

function playerRutMinArousal() {
	if (!V.player.penisExist || V.player.penissize < 1 || !V.sexStats || !V.sexStats.pills || (V.statFreeze && !V.statFreezeIgnoreRestrictions)) return 0;

	const pills = V.sexStats.pills.pills;
	let minArousal = 0;

	if (pills.contraceptive.doseTaken === 0 && V.player.beastRut !== undefined && V.player.beastRut <= 1) {
		if (V.earSlime.growth > 50 && V.earSlime.focus === "impregnation" && !V.earSlime.defyCooldown) {
			minArousal += Math.clamp(V.earSlime.growth, 0, 200) * 5;
		}
		if (V.wolfgirl >= 2) minArousal += Math.clamp(V.wolfbuild, 0, 100) * 10;
		if (V.cat >= 2) minArousal += Math.clamp(V.catbuild, 0, 100) * 10;
		if (V.cow >= 2) minArousal += Math.clamp(V.cowbuild, 0, 100) * 10;
		if (V.fox >= 2) minArousal += Math.clamp(V.foxbuild, 0, 100) * 10;
	}
	if (pills["fertility booster"].doseTaken > 2) {
		minArousal += 500;
	}

	return minArousal;
}
window.playerRutMinArousal = playerRutMinArousal;

function playerAwareTheyCanBePregnant() {
	return V.player.vaginaExist || (playerCanCarryAnally() && V.sexStats.anus.pregnancy.totalBirthEvents >= 1) || playerAwareTheyArePregnant();
}
window.playerAwareTheyCanBePregnant = playerAwareTheyCanBePregnant;

function playerAwareTheyArePregnant() {
	return getActivePregnancies("pc").some(p => knowsPregnancy(p.pregnancyId, "pc"));
}
window.playerAwareTheyArePregnant = playerAwareTheyArePregnant;

// How the player found out about their pregnancy
// ("mirror"/"pharmacy"/"temple"/"wakingUp"/ "pregnancyTest")
// null if not yet aware. Reads the first active records pregnancy.
function playerLearnedPregnancyFrom() {
	const pregnancy = getPlayerPregnancy();
	return pregnancy ? pregnancy.playerLearnedFrom : null;
}
window.playerLearnedPregnancyFrom = playerLearnedPregnancyFrom;

// Marks the player aware of each active pregnancy and records how they learned.
function setPlayerLearnedPregnancyFrom(source) {
	getActivePregnancies("pc").forEach(pregnancy => setPlayerLearnedFrom(pregnancy.pregnancyId, source));
}
window.setPlayerLearnedPregnancyFrom = setPlayerLearnedPregnancyFrom;

// Whether the player knows their pregnancy's litter details (count/species/gender) due to ultrasound
function playerKnowsLitterDetails(pregnancy) {
	const litter = getChildrenOf(pregnancy.pregnancyId);
	return litter.length > 0 && knowsChild(litter[0].childId, "pc");
}
window.playerKnowsLitterDetails = playerKnowsLitterDetails;

// Whether the player knows the litter's species, either confirmed by ultrasound
// or deduced when every possible donor is the same base species
function playerKnowsLitterSpecies(pregnancy) {
	if (playerKnowsLitterDetails(pregnancy)) return true;
	const donors = pregnancy.possibleDonors;
	return donors.length > 0 && donors.every(d => childBaseSpecies(d.species) === childBaseSpecies(donors[0].species));
}
window.playerKnowsLitterSpecies = playerKnowsLitterSpecies;

function playerAwareTheyAreInHeat() {
	return playerHeatMinArousal() && playerAwareTheyCanBePregnant();
}
window.playerAwareTheyAreInHeat = playerAwareTheyAreInHeat;

function pregnancyDaysEta(pregnancy) {
	if (!pregnancy) return null;
	return Math.floor((getDueDate(pregnancy) - Time.date.timeStamp) / TimeConstants.secondsPerDay);
}
window.pregnancyDaysEta = pregnancyDaysEta;

/**
 * The records a (carrier, existingId) pair selects: just that one prengancy record when existingId is given,
 * otherwise every pregnancy the carrier actively carries.
 *
 * @param {string} carrier "pc", or an NPC's name
 * @param {number} [existingId] a specific pregnancyId
 * @returns {Pregnancy[]}
 */
function carrierRecords(carrier, existingId) {
	if (existingId !== undefined) {
		const record = V.pregnancies[existingId];
		return record && record.carrier === carrier ? [record] : [];
	}
	return getActivePregnancies(carrier);
}

/**
 * Whether whoToCheck knows about a pregnancy the carrier is carrying. With existingId, checks that one
 * record (active or delivered). Without it, checks any pregnancy the carrier is currently carrying.
 *
 * @param {string} carrier "pc", or an NPC's name
 * @param {string} whoToCheck who might know: "pc", or an NPC's name
 * @param {number} [existingId] a specific pregnancyId to check instead of the carrier's active ones
 * @returns {boolean}
 */
function knowsAboutPregnancy(carrier, whoToCheck, existingId) {
	return carrierRecords(carrier, existingId).some(p => knowsPregnancy(p.pregnancyId, whoToCheck));
}
window.knowsAboutPregnancy = knowsAboutPregnancy;

/**
 * Adds a baby introduction entry so a scene can announce newly revealed children to whoNowKnows.
 * Keyed by name, shaped { birthId, mother/carrier, children }
 *
 * @param {string} introFor who the introduction is for: "pc", or an NPC's name
 * @param {string} carrier the carrier of the birth
 * @param {number} birthId the pregnancyId of the birth
 * @param {number} children how many children the birth produced
 */
function addBabyIntro(introFor, carrier, birthId, children) {
	if (!V.babyIntros) V.babyIntros = {};
	if (!V.babyIntros[introFor]) V.babyIntros[introFor] = [];
	if (!V.babyIntros[introFor].find(intro => intro.birthId === birthId && intro.mother === carrier)) {
		V.babyIntros[introFor].push({ birthId, mother: carrier, children });
	}
}

/**
 * Marks whoNowKnows aware of a pregnancy the carrier has. Without existingId, every pregnancy the
 * carrier is actively carrying is marked. With existingId, only that one pregnancy record (active or delivered).
 *
 * For example `<<setKnowsAboutPregnancy "pc" "Whitney">>` makes Whitney aware of the pc's current pregnancy.
 *
 * @param {string} carrier whose pregnancy it is: "pc", or an NPC's name
 * @param {string} whoNowKnows who now knows: "pc", or an NPC's name
 * @param {number} [existingId] a specific pregnancyId to mark instead of all of the carrier's active ones
 * @param {boolean} [track] also add a baby introduction for a named NPC carrier's birth (not the pc's)
 * @returns {boolean} whether any pregnancy was newly marked
 */
function setKnowsAboutPregnancy(carrier, whoNowKnows, existingId, track) {
	if (V.statFreeze) return null;
	let marked = false;
	for (const record of carrierRecords(carrier, existingId)) {
		if (knowsPregnancy(record.pregnancyId, whoNowKnows)) continue;
		setKnowsPregnancy(record.pregnancyId, whoNowKnows);
		marked = true;
		if (track && carrier !== "pc" && C.npc[carrier]) {
			addBabyIntro(whoNowKnows, record.carrier, record.pregnancyId, getChildrenOf(record.pregnancyId).length);
		}
	}
	return marked;
}
DefineMacro("setKnowsAboutPregnancy", setKnowsAboutPregnancy);

function setKnowsAboutPregnancyCurrentLoaded() {
	if (V.statFreeze) return null;
	if (playerIsPregnant() && playerBellyVisible(true)) {
		V.NPCList.forEach(npc => {
			if (npc.fullDescription) setKnowsAboutPregnancy("pc", npc.fullDescription);
		});
	}
}
DefineMacro("setKnowsAboutPregnancyCurrentLoaded", setKnowsAboutPregnancyCurrentLoaded);

/**
 * How many of the parent's births whoToCheck knows about.
 * A birth counts once regardless of litter size.
 *
 * @param {string} parent the parent (carrier or donor) whose births to count
 * @param {string} whoToCheck who might know: "pc", or an NPC's name
 * @param {string} [location] only count births whose litter is at this location
 * @returns {number}
 */
function knowsAboutPregnancyTotal(parent, whoToCheck, location) {
	// Group the born children by pregnancy up front, instead of a full scan per pregnancy.
	const bornByPregnancy = new Map();
	for (const child of getBornChildren()) {
		if (!bornByPregnancy.has(child.pregnancyId)) bornByPregnancy.set(child.pregnancyId, []);
		bornByPregnancy.get(child.pregnancyId).push(child);
	}
	return V.pregnancies.reduce((count, p) => {
		if (p.carrier !== parent && p.donor !== parent) return count;
		if (!knowsPregnancy(p.pregnancyId, whoToCheck)) return count;
		const litter = bornByPregnancy.get(p.pregnancyId);
		if (!litter) return count;
		if (location && litter[0].development.location !== location) return count;
		return count + 1;
	}, 0);
}
window.knowsAboutPregnancyTotal = knowsAboutPregnancyTotal;

/**
 * Whether whoToCheck knows about any pregnancy the carrier has ever carried, active or delivered.
 *
 * @param {string} carrier "pc", or an NPC's name
 * @param {string} whoToCheck who might know: "pc", or an NPC's name
 * @returns {boolean}
 */
function knowsAboutAnyPregnancy(carrier, whoToCheck) {
	return V.pregnancies.some(p => p.carrier === carrier && knowsPregnancy(p.pregnancyId, whoToCheck));
}
window.knowsAboutAnyPregnancy = knowsAboutAnyPregnancy;

/**
 * How many children of the parent whoToCheck knows about.
 *
 * @param {string} parent the parent (carrier or donor) whose children to count
 * @param {string} whoToCheck who might know: "pc", or an NPC's name
 * @param {string} [location] only count children at this location
 * @returns {number}
 */
function knowsAboutChildrenTotal(parent, whoToCheck, location) {
	return getBornChildren().reduce((count, child) => {
		const pregnancy = getPregnancyOf(child);
		if (pregnancy.carrier !== parent && pregnancy.donor !== parent) return count;
		if (!knowsPregnancy(child.pregnancyId, whoToCheck)) return count;
		if (location && child.development.location !== location) return count;
		return count + 1;
	}, 0);
}
window.knowsAboutChildrenTotal = knowsAboutChildrenTotal;

/**
 * Every born child carrier carried and donor sired, across all their shared pregnancies.
 * Directional. A self-pregnancy never counts.
 *
 * @param {string} carrier who carried, "pc" or an NPC name
 * @param {string} donor who sired, "pc" or an NPC name
 * @returns {Child[]}
 */
function childrenFromParents(carrier, donor) {
	return getBornChildren().filter(child => {
		const pregnancy = getPregnancyOf(child);
		return pregnancy.carrier !== pregnancy.donor && pregnancy.carrier === carrier && pregnancy.donor === donor;
	});
}

/**
 * Born children two people share, whichever of them carried.
 *
 * @param {string} parent1
 * @param {string} parent2
 * @returns {Child[]}
 */
function childrenBetweenParents(parent1, parent2) {
	return [...childrenFromParents(parent1, parent2), ...childrenFromParents(parent2, parent1)];
}
window.childrenBetweenParents = childrenBetweenParents;

/**
 * How many born children two people share, regardless of who carried.
 *
 * @param {string} parent1
 * @param {string} parent2
 * @returns {number}
 */
function childrenCountBetweenParents(parent1, parent2) {
	return childrenBetweenParents(parent1, parent2).length;
}
window.childrenCountBetweenParents = childrenCountBetweenParents;

/**
 * How many distinct pregnancies two people share, regardless of who carried.
 *
 * @param {string} parent1
 * @param {string} parent2
 * @returns {number}
 */
function pregnancyCountBetweenParents(parent1, parent2) {
	return new Set(childrenBetweenParents(parent1, parent2).map(child => child.pregnancyId)).size;
}
window.pregnancyCountBetweenParents = pregnancyCountBetweenParents;

/**
 * How many distinct pregnancies carrier carried that donor sired. Directional.
 *
 * @param {string} carrier who carried
 * @param {string} donor who sired
 * @returns {number}
 */
function pregnancyCountFromParents(carrier, donor) {
	return new Set(childrenFromParents(carrier, donor).map(child => child.pregnancyId)).size;
}
window.pregnancyCountFromParents = pregnancyCountFromParents;

/**
 * Whether the player has ever conceived a pregnancy with an NPC, active or already delivered.
 *
 * @param {string} name the NPC's name
 * @returns {boolean}
 */
function playerConceivedWith(name) {
	return V.pregnancies.some(p => (p.carrier === "pc" && p.donor === name) || (p.carrier === name && p.donor === "pc"));
}
window.playerConceivedWith = playerConceivedWith;

/**
 * Queues a baby introduction for a birth.
 *
 * @param {string} carrier whose birth it is: "pc", or an NPC's name
 * @param {string} introFor who the introduction is for: "pc", or an NPC's name
 * @param {number} [birthId] a specific pregnancyId. If left out, the labouring (pc) or first active (NPC) pregnancy is used.
 */
function setBabyIntro(carrier, introFor, birthId) {
	if (!carrier || !introFor) throw new Error(`setBabyIntro: got carrier "${carrier}" and introFor "${introFor}"`);
	if (!V.babyIntros) V.babyIntros = {};
	if (!V.babyIntros[introFor]) V.babyIntros[introFor] = [];

	if (birthId !== undefined) {
		// Player already gave birth
		const children = getBornChildren().filter(child => getPregnancyOf(child).carrier === carrier && child.pregnancyId === birthId);
		if (children.length) addBabyIntro(introFor, carrier, birthId, children.length);
	} else if (carrier === "pc") {
		const pregnancy = getLabouringPregnancy("pc");
		const litter = pregnancy ? getChildrenOf(pregnancy.pregnancyId) : [];
		if (litter.length) addBabyIntro(introFor, "pc", pregnancy.pregnancyId, litter.length);
	} else {
		const pregnancy = getActivePregnancies(carrier)[0];
		const litter = pregnancy ? getChildrenOf(pregnancy.pregnancyId) : [];
		if (litter.length) addBabyIntro(introFor, pregnancy.carrier, pregnancy.pregnancyId, litter.length);
	}
}
DefineMacro("setBabyIntro", setBabyIntro);

/**
 * Removes a queued baby introduction for one specific birth.
 *
 * @param {string} carrier whose birth it is: "pc", or an NPC's name
 * @param {string} introFor who the introduction was for: "pc", or an NPC's name
 * @param {number} birthId the birth's pregnancyId. Required.
 */
function removeBabyIntro(carrier, introFor, birthId) {
	if (!V.babyIntros || !V.babyIntros[introFor] || !carrier || !introFor || birthId === undefined) return false;
	const children = getBornChildren().filter(child => getPregnancyOf(child).carrier === carrier && child.pregnancyId === birthId);
	if (children.length) {
		V.babyIntros[introFor] = V.babyIntros[introFor].filter(intro => !(intro.birthId === birthId && intro.mother === carrier));
		if (!V.babyIntros[introFor].length) delete V.babyIntros[introFor];
	}
}
DefineMacro("removeBabyIntro", removeBabyIntro);

/**
 * Whether the carrier's pregnancy has been discussed with someone. With existingId, that one
 * record; otherwise any pregnancy the carrier actively carries.
 *
 * @param {string} carrier "pc", or an NPC's name
 * @param {string} whoToCheck who might have discussed it: "pc", or an NPC's name
 * @param {number} [existingId] a specific pregnancyId
 * @returns {boolean}
 */
function talkedAboutPregnancy(carrier, whoToCheck, existingId) {
	return carrierRecords(carrier, existingId).some(p => hasTalkedAbout(p.pregnancyId, whoToCheck));
}
window.talkedAboutPregnancy = talkedAboutPregnancy;

/**
 * Marks the carrier's pregnancy as discussed with someone. Telling someone covers whatever the
 * carrier is carrying, so without existingId every active pregnancy is flagged.
 *
 * @param {string} carrier "pc", or an NPC's name
 * @param {string} whoToIncrement who it was discussed with: "pc", or an NPC's name
 * @param {number} [existingId] a specific pregnancyId
 */
function setTalkedAboutPregnancy(carrier, whoToIncrement, existingId) {
	if (whoToIncrement !== "pc" && !V.NPCNameList.includes(whoToIncrement)) return; // no junk keys in the record
	carrierRecords(carrier, existingId).forEach(p => markTalkedAbout(p.pregnancyId, whoToIncrement));
}
DefineMacro("setTalkedAboutPregnancy", setTalkedAboutPregnancy);
