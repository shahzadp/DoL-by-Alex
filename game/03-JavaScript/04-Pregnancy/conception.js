// Did a pregnancy happen, and who caused it?
//
// In realistic mode, loads of cum are stored per orifice.
// Once past their washing grace period, each one takes its own roll, once per day, at that day's fertility.
// Heavier loads (deeper cum, higher potency) carry a better chance.
// The winner becomes a pending conception which implants two days later.
// Fetish mode rolls each load's odds the moment it lands (instantConception) and stores nothing.

/**
 * Completes the ear-slime "get sperm into your {orifice}" tasks when cum lands in the PC.
 *
 * @param {"vagina"|"anus"} orifice where the cum landed
 * @param {string} donor who it came from ("pc" for the player's own sperm)
 */
function completeEarSlimeSpermTask(orifice, donor) {
	const event = V.earSlime.event;
	if (event.includes("completed") || !event.includes(orifice)) return;
	if (event.includes("get your own sperm into your")) {
		if (donor === "pc") V.earSlime.event += " completed";
	} else if (event.includes("get sperm into your")) {
		V.earSlime.event += " completed";
	}
}

/**
 * Call this when cum lands in an orifice (vagina or anus).
 * In realistic mode the load is stored for future pregnancy rolls to pick.
 * In fetish mode the caller rolls it on the spot instead, so nothing is kept.
 *
 * The settings and anatomy checks happen in here, so the caller only passes what the scene provides.
 * Player only. An NPC pregnancy is a single roll at its scene, with no loads involved.
 *
 * @param {"vagina"|"anus"} orifice
 * @param {string} donor who it came from: an NPC's name, or "pc"
 * @param {DonorSpecies} donorSpecies the donor's species
 * @param {"outside"|"imminent"|"deep"} depth where the load landed
 * @param {string} location where the sex happened
 * @param {number} potency scales the weight. 1 for a normal load, 0.5 for the small penis dribble,
 *   1.25 for a knotting beast
 * @param {number|null} lifespan how long the load keeps counting, in seconds. null = 4 to 8 days
 * @returns {Load|null} the load, stored in realistic mode. null = pregnancy can't happen here
 */
function inseminate(orifice, donor, donorSpecies, depth, location, potency, lifespan) {
	const depthWeight = PregnancyConstants.depthWeight[depth];
	if (depthWeight === undefined) throw new Error(`unknown depth "${depth}"`);
	if (V.activeNightmare) return null;
	completeEarSlimeSpermTask(orifice, donor);
	if (!canPlayerConceive(orifice, donor, donorSpecies)) return null;

	// Cum outside or at the entrance can still be washed away. Deep cum can't.
	const canWash = depth !== "deep";
	if (lifespan === null) lifespan = random(PregnancyConstants.loadLifespanDays.min, PregnancyConstants.loadLifespanDays.max) * TimeConstants.secondsPerDay;
	const load = { donor, donorSpecies, time: Time.date.timeStamp, weight: depthWeight * potency, canWash, lifespan, location };
	if (V.settings.pregnancyType === "realistic") V.cumLoads[orifice].push(load);
	return load;
}
window.inseminate = inseminate;

/**
 * Whether a load still counts, meaning it hasn't outlived its lifespan.
 *
 * @param {Load} load
 * @returns {boolean}
 */
function loadIsLive(load) {
	return Time.date.timeStamp - load.time < load.lifespan;
}
window.loadIsLive = loadIsLive;

/** Remove the loads that have expired, from both orifices. */
function trimExpiredLoads() {
	V.cumLoads.vagina = V.cumLoads.vagina.filter(loadIsLive);
	V.cumLoads.anus = V.cumLoads.anus.filter(loadIsLive);
}
window.trimExpiredLoads = trimExpiredLoads;

/** Washing removes every washable load from both orifices. Cum inside stays. */
function washLoads() {
	V.cumLoads.vagina = V.cumLoads.vagina.filter(l => !l.canWash);
	V.cumLoads.anus = V.cumLoads.anus.filter(l => !l.canWash);
}
window.washLoads = washLoads;

/**
 * Conception modifier that influences how likely pc is to get pregnant.
 *
 * Contraceptive pills are 90% effective, or 100% at 2+ pills.
 *
 * Fertility boosters add 0.5x per dose, up to 4 doses (1.5x at one dose, 3x at four).
 *
 * The magic tattoo gives 1.5x.
 *
 * Earslime gives 2x when focused on pc conceiving, 0.5x when focused on pc impregnating others.
 *
 * @returns {number} a multiplier on the base pregnancy chance
 */
function playerConceptionModifier() {
	const c = PregnancyConstants.conceptionModifiers;
	const pills = V.sexStats.pills.pills;
	if (pills.contraceptive.doseTaken >= c.contraceptiveDosesToBlock) return 0;
	let modifier = pills.contraceptive.doseTaken >= 1 ? c.contraceptiveMultiplier : 1;
	modifier *= 1 + c.fertilityMultiplierPerDose * Math.clamp(pills["fertility booster"].doseTaken, 0, PregnancyConstants.fertilityMaxDoses);
	if (V.skin.pubic.pen === "magic" && V.skin.pubic.special === "pregnancy") modifier *= c.pregnancyTattooMultiplier;
	if (V.earSlime.growth >= 100) modifier *= c.earSlimeMultiplier[V.earSlime.focus] ?? 1;
	return modifier;
}
window.playerConceptionModifier = playerConceptionModifier;

/**
 * The fertility curve's slope: 1 at the peak, sliding to 0 windowDays away from it.
 *
 * @param {number} daysFromPeak days from the fertile peak (0 or less = at it)
 * @param {number} windowDays how far from the peak fertility reaches 0
 * @returns {number} 0 = no chance, 1 = most chance
 */
function fertilityRamp(daysFromPeak, windowDays) {
	if (daysFromPeak <= 0) return 1;
	return Math.clamp(1 - daysFromPeak / windowDays, 0, 1);
}
window.fertilityRamp = fertilityRamp;

/**
 * Whether the body can take on a new pregnancy at all.
 * Already carrying a pregnancy or recovering from one means no.
 * Covers both orifices, and holds whatever the mode or the cycle setting.
 *
 * @returns {boolean}
 */
function readyToCarry() {
	return V.sexStats.vagina.menstruation.currentState === "normal";
}
window.readyToCarry = readyToCarry;

/**
 * How likely conception is on a day of the cycle: a long rise into ovulation, a short fall out of it.
 * With the fertility cycle setting off, every day is fertile.
 *
 * @param {number} day the day of the cycle to read
 * @returns {number} 0 while carrying or recovering, otherwise the baselineFertility at worst, up to 1 at ovulation
 */
function fertilityOnCycleDay(day) {
	if (!readyToCarry()) return 0;
	if (V.settings.fertilityCycleEnabled === false) return 1;
	const c = PregnancyConstants.menstrualCycle;
	const m = V.sexStats.vagina.menstruation;
	const [, , ovulationStart, ovulationEnd] = m.stages; // [cycleStart, menstrualEnd, ovulationStart, ovulationEnd]
	const fertility = day > ovulationEnd ? fertilityRamp(day - ovulationEnd, c.lutealTailDays) : fertilityRamp(ovulationStart - day, m.fertileLeadDays);
	return Math.max(fertility, c.baselineFertility);
}
window.fertilityOnCycleDay = fertilityOnCycleDay;

/**
 * How fertile pc is today.
 *
 * @returns {number} 0 for no chance up to 1 at ovulation
 */
function menstrualFertility() {
	return fertilityOnCycleDay(V.sexStats.vagina.menstruation.currentDay);
}
window.menstrualFertility = menstrualFertility;

/**
 * Which day of the load's own life this is. A load takes one conception roll per day it lives,
 * counted from when it landed, so no two loads roll on the same hour.
 *
 * @param {Load} load
 * @returns {number} 0 on the day it landed, 1 the next, and so on
 */
function loadAgeDay(load) {
	return Math.floor((Time.date.timeStamp - load.time) / TimeConstants.secondsPerDay);
}
window.loadAgeDay = loadAgeDay;

/**
 * How fertile an NPC carrier is right now.
 * The NPC fertile window runs from cycleDangerousDay to postOvulationDays past it.
 * The Great Hawk is fertile only from its dangerous day onward.
 *
 * @param {string} carrier the NPC's name
 * @returns {number} 0 for no chance up to 1 at peak fertility
 */
function npcMenstrualFertility(carrier) {
	const p = C.npc[carrier] && C.npc[carrier].pregnancy;
	if (!p || !p.enabled) return 1;
	if (V.settings.fertilityCycleEnabled === false) return 1;
	if (carrier === "Great Hawk") return p.cycleDay >= p.cycleDangerousDay ? 1 : 0;
	if (p.cycleDay > p.cycleDangerousDay + PregnancyConstants.menstrualCycle.postOvulationDays) return 0;
	return fertilityRamp(p.cycleDangerousDay - p.cycleDay, p.fertileLeadDays);
}
window.npcMenstrualFertility = npcMenstrualFertility;

/**
 * Conception multiplier from a carrier NPC's birth-control state (C.npc[carrier].pregnancy.pills),
 * mirroring playerConceptionModifier. Contraceptives cut it right down, fertility pills raise it.
 *
 * @param {string} carrier the NPC who might get pregnant
 * @returns {number} a multiplier on the base NPC pregnancy chance
 */
function npcConceptionModifier(carrier) {
	const c = PregnancyConstants.conceptionModifiers;
	const npc = C.npc[carrier];
	if (!npc || !npc.pregnancy) return 1;
	if (npc.pregnancy.pills === "contraceptive") return c.npcContraceptiveMultiplier;
	if (npc.pregnancy.pills === "fertility") return c.npcFertilityMultiplier;
	return 1;
}
window.npcConceptionModifier = npcConceptionModifier;

/**
 * Realistic pregnancy gives every load one roll per day of its life, at that day's fertility.
 * Risk builds up across the fertile window. A winner becomes the pending conception.
 *
 * @param {"vagina"|"anus"} orifice
 */
function rollAndRecordConception(orifice) {
	// One real pregnancy per body: a pending or active pregnancy in either orifice prevents a new pregnancy.
	if (V.pendingPregnancies[orifice] !== null || getActivePregnancies("pc").length > 0) return;
	if (orificeHasParasites(orifice)) return;
	if (!readyToCarry()) return; // carrying or recovering: nothing to roll for

	const now = Time.date.timeStamp;
	const grace = PregnancyConstants.loadGracePeriod;
	const eligible = V.cumLoads[orifice].filter(load => now - load.time >= grace);
	if (eligible.length === 0) return;
	const clutchLoads = V.harpyEggs ? eligible.filter(load => childBaseSpecies(load.donorSpecies) === "hawk") : [];
	const ripeClutch = clutchLoads.length > 0;
	const running = ripeClutch ? clutchLoads : eligible;
	const setting = V.settings.basePlayerPregnancyChance;
	const baseChance = ripeClutch && setting > 0 ? 100 : setting;
	const fertility = ripeClutch ? 1 : menstrualFertility();

	const winners = [];
	for (const load of running) {
		const ageDay = loadAgeDay(load);
		if (load.rolledDay === ageDay) continue;
		load.rolledDay = ageDay;
		const chance = Math.clamp(baseChance * playerConceptionModifier() * fertility * load.weight, 0, 100);
		if (State.random() * 100 < chance) winners.push(load);
	}
	if (winners.length > 0) recordPendingPregnancy(orifice, winners[random(0, winners.length - 1)]);
}
window.rollAndRecordConception = rollAndRecordConception;

/**
 * The pregnancy system's hourly upkeep in every pregnancy mode.
 * Removes expired loads and implants due conceptions.
 * hourPassed (time.js) should call this once per game hour.
 */
function hourlyPregnancyUpdate() {
	trimExpiredLoads();
	startDuePregnancies();
}
window.hourlyPregnancyUpdate = hourlyPregnancyUpdate;

/**
 * Store a winning pick as the orifice's pending conception. It waits there until it is due,
 * and the morning-after pill can still discard it during the wait.
 *
 * @param {"vagina"|"anus"} orifice
 * @param {Load} load the picked load
 */
function recordPendingPregnancy(orifice, load) {
	V.pendingPregnancies[orifice] = {
		// The player's own body is the base of the child. Their transformations are read as heritage
		// when the record is made in generateChildren.
		carrierSpecies: "human",
		donor: load.donor,
		donorSpecies: load.donorSpecies,
		// Loads wash and expire later, so the list is remembered at the pick here or it's gone.
		possibleDonors: V.cumLoads[orifice]
			.filter(loadIsLive)
			.map(l => ({ name: l.donor, species: l.donorSpecies }))
			.filter((donor, i, all) => all.findIndex(other => other.name === donor.name) === i),
		conceivedDate: Time.date.timeStamp,
		conceivedLocation: load.location,
	};
}
window.recordPendingPregnancy = recordPendingPregnancy;

/**
 * Whether hawk seed has already won a draw and is waiting to implant.
 *
 * @returns {boolean}
 */
function birdConceptionPending() {
	return ["vagina", "anus"].some(orifice => {
		const pending = V.pendingPregnancies[orifice];
		return pending !== null && childBaseSpecies(pending.donorSpecies) === "hawk";
	});
}
window.birdConceptionPending = birdConceptionPending;

/**
 * The morning-after pill throws out both orifices' pending conceptions and flushes all stored loads.
 *
 * Returns a result token. The pharmacy scene turns it into the text shown to the player.
 *
 * @returns {"notPregnant"|"success"|"aLittleLate"|"late"|"tooLate"} what the pill did
 */
function takeMorningAfterPill() {
	// Work out the result before clearing, since clearing throws away the conception it reads.
	let outcome = "notPregnant";
	if (getActivePregnancy("pc", "vagina") || getActivePregnancy("pc", "anus")) {
		outcome = "tooLate";
	} else {
		const pending = [V.pendingPregnancies.vagina, V.pendingPregnancies.anus].filter(p => p !== null);
		if (pending.length > 0) {
			// Two conceptions at once are judged by the older one, the one closest to implanting.
			const age = Math.max(...pending.map(p => Time.date.timeStamp - p.conceivedDate));
			const implantation = PregnancyConstants.implantationWindow;
			if (age < implantation * PregnancyConstants.morningAfterPill.successFraction) outcome = "success";
			else if (age < implantation * PregnancyConstants.morningAfterPill.aLittleLateFraction) outcome = "aLittleLate";
			else outcome = "late";
		}
	}
	V.pendingPregnancies.vagina = null;
	V.pendingPregnancies.anus = null;
	V.cumLoads.vagina = [];
	V.cumLoads.anus = [];
	return outcome;
}
window.takeMorningAfterPill = takeMorningAfterPill;

/**
 * Make the pregnancy record for any pending conception that has finished its window.
 */
function startDuePregnancies() {
	for (const orifice of ["vagina", "anus"]) {
		const pending = V.pendingPregnancies[orifice];
		if (pending === null) continue;
		if (Time.date.timeStamp - pending.conceivedDate < PregnancyConstants.implantationWindow) continue;
		if (orificeHasParasites(orifice)) {
			V.pendingPregnancies[orifice] = null;
			continue;
		}
		createPregnancy(
			"pc",
			pending.carrierSpecies,
			pending.donor,
			pending.donorSpecies,
			pending.possibleDonors,
			pending.conceivedDate,
			orifice,
			pending.conceivedLocation
		);
		V.pendingPregnancies[orifice] = null;
	}
}
window.startDuePregnancies = startDuePregnancies;

/**
 * Fetish pregnancy rolls for pregnancy the moment a load lands.
 * A win is an instant pregnancy. The caller makes the pregnancy record on the spot.
 *
 * @param {Load} load the load that just landed
 * @returns {Load|null} the load when it took, or null when nothing happened
 */
function fetishPregnancyRoll(load) {
	if (!readyToCarry()) return null;
	const chance = V.settings.basePlayerPregnancyChance * playerConceptionModifier();
	return State.random() * 100 < Math.clamp(chance * load.weight, 0, 100) ? load : null;
}
window.fetishPregnancyRoll = fetishPregnancyRoll;
