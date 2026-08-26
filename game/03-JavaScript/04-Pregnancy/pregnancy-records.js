// One pregnancy record per conception (V.pregnancies), shared by the whole litter.
// Each child (V.childRecords) links to its pregnancy by pregnancyId.
// IDs are array indexes, so records are never removed. Cleared records are tombstoned.

// A cleared pregnancy is tombstoned by this carrier value.
const CLEARED_PREGNANCY = "cleared";
/**
 * Adds a new pregnancy record and returns its id.
 *
 * @param {object} fields the record's fields. Optional ones left out take their default
 * @returns {number} the new pregnancyId (also stored on the record itself)
 */
function pushPregnancyRecord(fields) {
	const pregnancyId = V.pregnancies.length;
	const record = {
		pregnancyId,
		carrier: fields.carrier,
		carrierSpecies: fields.carrierSpecies,
		donor: fields.donor,
		donorSpecies: fields.donorSpecies,
		possibleDonors: fields.possibleDonors ?? [],
		conceivedDate: fields.conceivedDate,
		conceivedLocation: fields.conceivedLocation ?? "unknown",
		gestationVariance: fields.gestationVariance ?? 1,
		orifice: fields.orifice,
		deliveredDate: fields.deliveredDate ?? null,
		deliveredLocation: fields.deliveredLocation ?? null,
		awareOfPregnancy: fields.awareOfPregnancy ?? [],
		awareOfCarrier: fields.awareOfCarrier ?? [],
		awareOfDonor: fields.awareOfDonor ?? [],
		talkedAbout: fields.talkedAbout ?? {},
		playerLearnedFrom: fields.playerLearnedFrom ?? null,
	};
	// egg pregnancies get hatchDelay + layCare
	// labouring pregnancies get waterBreaking
	if (fields.hatchDelay !== undefined) record.hatchDelay = fields.hatchDelay;
	if (fields.layCare !== undefined) record.layCare = fields.layCare;
	if (fields.waterBreaking !== undefined) record.waterBreaking = fields.waterBreaking;
	V.pregnancies.push(record);
	return pregnancyId;
}
window.pushPregnancyRecord = pushPregnancyRecord;

/**
 * Same as pushPregnancyRecord, for child records.
 *
 * @param {object} fields the record's fields. Optional ones left out take their default
 * @returns {number} the new childId (also stored on the record itself)
 */
function pushChildRecord(fields) {
	const childId = V.childRecords.length;
	V.childRecords.push({
		childId,
		pregnancyId: fields.pregnancyId,
		species: fields.species,
		features: fields.features,
		gender: fields.gender,
		identical: fields.identical ?? null,
		development: fields.development ?? {},
		bornDate: fields.bornDate ?? null,
		name: fields.name ?? null,
		coParents: fields.coParents ?? [], // reserved for adoption
		awareOfChild: fields.awareOfChild ?? [],
		awareOfGender: fields.awareOfGender ?? [],
	});
	return childId;
}
window.pushChildRecord = pushChildRecord;

/**
 * Makes a pregnancy record once conception has already happened, generates its children, and
 * returns the new pregnancyId.
 *
 * @param {string} carrier who's carrying: "pc" for the player, or an NPC's name
 * @param {string} carrierSpecies the carrier's base species, e.g. "human" for the player, the NPC's species otherwise
 * @param {string} donor the other genetic parent: "pc", an NPC's name, or a placeholder like "lissome man" if unknown
 * @param {DonorSpecies} donorSpecies the donor's species, what the pregnancy grows as
 * @param {PossibleDonor[]} possibleDonors everyone who could be the donor, kept for the paternity checks later
 * @param {number} conceivedDate timestamp of the conception
 * @param {"vagina"|"anus"} orifice which orifice the pregnancy is in
 * @param {string} conceivedLocation where the conception happened
 * @returns {number} the new pregnancyId
 */
function createPregnancy(carrier, carrierSpecies, donor, donorSpecies, possibleDonors, conceivedDate, orifice, conceivedLocation) {
	// layCare brings laying time down and hatchDelay brings hatching time down.
	// addEggCare feeds whichever stage the clutch is currently in.
	const isEggClutch = donorSpecies === "hawk" || donorSpecies === "harpy";
	const hatchDelay = isEggClutch ? random(0, PregnancyConstants.birdHatchDelay) : undefined;
	const layCare = isEggClutch ? 0 : undefined;
	const pregnancyId = pushPregnancyRecord({
		carrier,
		carrierSpecies,
		donor,
		donorSpecies,
		possibleDonors,
		conceivedDate,
		conceivedLocation,
		orifice,
		hatchDelay,
		layCare,
		gestationVariance: 1 + random(-PregnancyConstants.gestation.variancePercent, PregnancyConstants.gestation.variancePercent) / 100,
	});
	generateChildren(pregnancyId);
	// A PC pregnancy pauses the menstrual cycle and voids any pending conception in the other orifice,
	// so a body only ever carries one real pregnancy at a time.
	if (carrier === "pc") {
		V.sexStats.vagina.menstruation.currentState = "pregnant";
		V.pendingPregnancies = { vagina: null, anus: null };
		delete V.harpyEggs;
	}
	return pregnancyId;
}
window.createPregnancy = createPregnancy;

/**
 * Makes a child belonging to a pregnancy and returns its id.
 *
 * @param {number} pregnancyId the pregnancy this child belongs to, its index in V.pregnancies
 * @param {ChildSpecies} species the child's species, e.g. "human", "wolf", "hawk"
 * @param {Features} features size, colours, the monster trait, and the PC's beast/divine transformations
 * @param {"m"|"f"|"h"} gender the child's gender
 * @param {number|null} identical per-litter number shared by identical siblings, null if none
 * @returns {number} the new childId
 */
function createChild(pregnancyId, species, features, gender, identical) {
	return pushChildRecord({ pregnancyId, species, features, gender, identical });
}
window.createChild = createChild;

/**
 * Gestation span for a species, in seconds. getDueDate adds it to the conception date.
 *
 * @param {ChildSpecies} species the child base species, e.g. "human", "wolf", "hawk"
 * @returns {number} the full gestation length in seconds
 */
function gestationSeconds(species) {
	switch (childBaseSpecies(species)) {
		case "human":
			if (typeof V.settings.humanPregnancyMonths !== "number") throw new Error("V.settings.humanPregnancyMonths is undefined");
			return V.settings.humanPregnancyMonths * 30 * TimeConstants.secondsPerDay;
		case "wolf":
			if (typeof V.settings.wolfPregnancyWeeks !== "number") throw new Error("V.settings.wolfPregnancyWeeks is undefined");
			return V.settings.wolfPregnancyWeeks * 7 * TimeConstants.secondsPerDay;
		case "hawk":
			if (typeof V.settings.birdPregnancyWeeks !== "number") throw new Error("V.settings.birdPregnancyWeeks is undefined");
			return V.settings.birdPregnancyWeeks * 7 * TimeConstants.secondsPerDay;
	}
}
window.gestationSeconds = gestationSeconds;

/**
 * When a pregnancy is due to deliver (the lay, for an egg species), per its gestation setting. Can be sped up by layCare.
 *
 * @param {Pregnancy} pregnancy its donorSpecies picks which gestation setting applies
 */
function getDueDate(pregnancy) {
	return pregnancy.conceivedDate + gestationSeconds(pregnancy.donorSpecies) * pregnancy.gestationVariance - (pregnancy.layCare ?? 0);
}
window.getDueDate = getDueDate;

/**
 * When a laid clutch hatches. The lay date plus nest time, shifted by the clutch's hatchDelay.
 *
 * @param {Pregnancy} pregnancy must be an egg species (hawk/harpy) that has already been laid
 */
function getHatchDate(pregnancy) {
	switch (pregnancy.donorSpecies) {
		case "hawk":
		case "harpy":
			if (pregnancy.deliveredDate === null) throw new Error("no hatch date before the lay");
			return pregnancy.deliveredDate + PregnancyConstants.birdNestTime + pregnancy.hatchDelay;
		default:
			throw new Error(`species "${pregnancy.donorSpecies}" does not lay eggs`);
	}
}
window.getHatchDate = getHatchDate;

/**
 * How far along gestation is, 0 at conception and 1 at the due date. For an egg that means the lay.
 * The hatch clock that follows is getHatchDate.
 *
 * @param {Pregnancy} pregnancy any pregnancy, delivered or still active
 */
function pregnancyProgress(pregnancy) {
	return Math.clamp((Time.date.timeStamp - pregnancy.conceivedDate) / (getDueDate(pregnancy) - pregnancy.conceivedDate), 0, 1);
}
window.pregnancyProgress = pregnancyProgress;

/**
 * Days since conception. Used by early-window checks like the pregnancy test.
 *
 * @param {Pregnancy} pregnancy
 * @returns {number} fractional days elapsed since conceivedDate
 */
function daysAlong(pregnancy) {
	return (Time.date.timeStamp - pregnancy.conceivedDate) / TimeConstants.secondsPerDay;
}
window.daysAlong = daysAlong;

/**
 * The active, undelivered pregnancy a carrier has in an orifice. Both orifices can carry at once.
 *
 * @param {string} carrier "pc" for the player, or an NPC's name
 * @param {"vagina"|"anus"} orifice which orifice to check
 */
function getActivePregnancy(carrier, orifice) {
	// initnpcgendersingle calls this before a new game initialises $pregnancies, as getActivePregnancies notes.
	return (V.pregnancies ?? []).find(p => p.carrier === carrier && p.orifice === orifice && p.deliveredDate === null);
}
window.getActivePregnancy = getActivePregnancy;

/**
 * Every active (undelivered) pregnancy a carrier has. 0, 1, or 2, one per orifice.
 *
 * @param {string} carrier "pc" for the player, or an NPC's name
 */
function getActivePregnancies(carrier) {
	// The character-creation settings screen calls this before a new game initialises $pregnancies.
	return (V.pregnancies ?? []).filter(p => p.carrier === carrier && p.deliveredDate === null);
}
window.getActivePregnancies = getActivePregnancies;

/**
 * The player's current pregnancy. Prioritizes vaginal over anal.
 *
 * @returns {Pregnancy|undefined} undefined when the player isn't pregnant
 */
function getPlayerPregnancy() {
	return getActivePregnancy("pc", "vagina") ?? getActivePregnancy("pc", "anus");
}
window.getPlayerPregnancy = getPlayerPregnancy;

/**
 * The carrier's pregnancy that's currently giving birth. The player can carry two at once
 * (a vaginal and an anal one), so this picks the one whose water broke, not just the first active.
 *
 * @param {string} carrier "pc" for the player, or an NPC's name
 * @returns {Pregnancy|undefined} undefined when the carrier has nothing active
 */
function getLabouringPregnancy(carrier) {
	const active = getActivePregnancies(carrier);
	return active.find(p => p.waterBreaking) ?? active[0];
}
window.getLabouringPregnancy = getLabouringPregnancy;

/**
 * The litter being delivered.
 *
 * @param {string} carrier "pc" for the player, or an NPC's name
 * @returns {Child[]} empty when the carrier has no active pregnancy
 */
function getLabouringLitter(carrier) {
	const pregnancy = getLabouringPregnancy(carrier);
	return pregnancy ? getChildrenOf(pregnancy.pregnancyId) : [];
}
window.getLabouringLitter = getLabouringLitter;

/**
 * The orifice of the player's labouring pregnancy, or a sensible default when they aren't labouring
 * (their vagina if they have one, otherwise anus). Used to place laid eggs on the right orifice.
 *
 * @returns {"vagina"|"anus"}
 */
function playerLabouringOrifice() {
	const pregnancy = getLabouringPregnancy("pc");
	return pregnancy ? pregnancy.orifice : V.player.vaginaExist ? "vagina" : "anus";
}
window.playerLabouringOrifice = playerLabouringOrifice;

/**
 * Mark the player's labouring pregnancy as actively giving birth.
 */
function beginPlayerBirth() {
	const pregnancy = getLabouringPregnancy("pc");
	if (pregnancy) pregnancy.birthInProgress = true;
}
window.beginPlayerBirth = beginPlayerBirth;

/**
 * Marks a pregnancy as delivered now, at the given location.
 *
 * @param {number} pregnancyId the pregnancy's index in V.pregnancies
 * @param {string} deliveredLocation where the litter goes after the birth/lay (birthUi's "location"
 *   arg, e.g. "home", "wolf_cave"), not where the birth happened
 */
function recordDelivery(pregnancyId, deliveredLocation) {
	const record = V.pregnancies[pregnancyId];
	record.deliveredDate = Time.date.timeStamp;
	record.deliveredLocation = deliveredLocation;
}
window.recordDelivery = recordDelivery;

/**
 * Marks a child as born (or hatched) now. The name is set beforehand by the birth flow.
 * Kept separate from recordDelivery because eggs hatch at different times,
 * so each child's bornDate is set individually.
 *
 * @param {number} childId the child's index in V.childRecords
 */
function recordBirth(childId) {
	V.childRecords[childId].bornDate = Time.date.timeStamp;
}
window.recordBirth = recordBirth;

/**
 * The full development bag a reared child starts with. A function (not a constant) so the
 * activity timestamps are read at call time. beginRearing and the save migration both use it.
 */
function beginRearingDefaults() {
	return {
		location: null,
		birthLocation: null,
		activity: "noEvent",
		event: false,
		activityDay: Time.days,
		activityHour: Time.hour,
		crawling: 0,
		talking: 0,
		toy: null,
		acceptsDummy: undefined,
		firstWord: null,
		interactions: 0,
		interactionsTotal: 0,
	};
}
window.beginRearingDefaults = beginRearingDefaults;

/**
 * Sets up a child's rearing state at birth (or at lay, for an egg). Runs once per child.
 *
 * @param {Child} child the newly born/laid child to set up
 * @param {string} location where the child ends up living, e.g. "home", "tower"
 * @param {string} birthLocation where the birth/lay happened, kept separate from the current location
 */
function beginRearing(child, location, birthLocation) {
	child.development = { ...beginRearingDefaults(), location, birthLocation };
}
window.beginRearing = beginRearing;

/**
 * Speeds an egg clutch along by seconds towards layCare or hatchDelay.
 * Called when eating a lurker, feeding the Great Hawk, or brooding the nest.
 *
 * @param {number} pregnancyId the pregnancy's index in V.pregnancies
 * @param {number} seconds how much sooner the clutch reaches its next stage
 */
function addEggCare(pregnancyId, seconds) {
	const pregnancy = V.pregnancies[pregnancyId];
	if (pregnancy.deliveredDate === null) {
		const cap = gestationSeconds(pregnancy.donorSpecies) * PregnancyConstants.maxLayCareFraction;
		pregnancy.layCare = Math.min((pregnancy.layCare ?? 0) + seconds, cap);
	} else {
		pregnancy.hatchDelay = Math.max(0, pregnancy.hatchDelay - seconds);
	}
}
window.addEggCare = addEggCare;

/**
 * Once a PC pregnancy reaches its due date, starts labour. Waters break, and eventskip suppresses
 * events for the next passage so the player can head for a birth location.
 * Deferred while stats are frozen, an event NPC is loaded, in combat, or possessed.
 */
function checkLabour() {
	if (V.statFreeze || V.combat === 1 || V.possessed || V.NPCList[0]?.type) return;
	for (const pregnancy of getActivePregnancies("pc")) {
		if (pregnancy.waterBreaking) continue;
		if (childBaseSpecies(pregnancy.donorSpecies) === "hawk") continue;
		if (Time.date.timeStamp >= getDueDate(pregnancy)) {
			pregnancy.waterBreaking = true;
			V.eventskip = 1;
		}
	}
}
window.checkLabour = checkLabour;

/**
 * Tombstones a pregnancy record.
 *
 * @param {number} pregnancyId the pregnancy to clear
 */
function clearPregnancyRecord(pregnancyId) {
	V.pregnancies[pregnancyId].carrier = CLEARED_PREGNANCY;
}
window.clearPregnancyRecord = clearPregnancyRecord;

/**
 * Cheat and debug helper. Removes every active PC pregnancy with no birth.
 */
function clearPlayerPregnancies() {
	for (const pregnancy of getActivePregnancies("pc")) {
		clearPregnancyRecord(pregnancy.pregnancyId);
	}
}
window.clearPlayerPregnancies = clearPlayerPregnancies;

/**
 * The pregnancy record a child belongs to.
 *
 * @param {Child} child looked up by its pregnancyId
 */
function getPregnancyOf(child) {
	return V.pregnancies[child.pregnancyId];
}
window.getPregnancyOf = getPregnancyOf;

/**
 * All children belonging to a pregnancy.
 *
 * @param {number} pregnancyId the pregnancy's index in V.pregnancies
 */
function getChildrenOf(pregnancyId) {
	return V.childRecords.filter(child => child.pregnancyId === pregnancyId);
}
window.getChildrenOf = getChildrenOf;

/**
 * Whether a child has been born (or hatched).
 *
 * @param {Child} child true when its bornDate has been set
 */
function childIsBorn(child) {
	return child.bornDate !== null;
}
window.childIsBorn = childIsBorn;

/**
 * Whether a child is a laid-but-unhatched egg. Species is always a base, so a harpy litter is "hawk".
 *
 * @param {Child} child false if it's not a bird species, already hatched, or not laid yet
 */
function childIsUnhatchedEgg(child) {
	if (child.species !== "hawk") return false;
	if (child.bornDate !== null) return false; // already hatched
	return getPregnancyOf(child).deliveredDate !== null; // laid, still in the nest
}
window.childIsUnhatchedEgg = childIsUnhatchedEgg;

/**
 * Every child that exists in the world, born kids plus laid-but-unhatched eggs. A still-gestating
 * child (bornDate null, not yet laid) isn't in the world yet.
 *
 * @returns {Child[]}
 */
function getBornChildren() {
	return V.childRecords.filter(child => childIsBorn(child) || childIsUnhatchedEgg(child));
}
window.getBornChildren = getBornChildren;

/**
 * Born children currently at a location ("home", "tower", "wolf_cave", "inventory", ...).
 *
 * @param {string} location the location name to filter by
 * @returns {Child[]}
 */
function getChildrenAt(location) {
	return getBornChildren().filter(child => child.development.location === location);
}
window.getChildrenAt = getChildrenAt;

/**
 * Laid, unhatched eggs waiting in the tower nest.
 *
 * @returns {number}
 */
function nestEggCount() {
	return getChildrenAt("tower").filter(childIsUnhatchedEgg).length;
}
window.nestEggCount = nestEggCount;

/**
 * A born child's age in whole days, floored from the seconds since bornDate. Around midnight
 * this can read a day younger than a calendar-date difference would.
 *
 * @param {Child} child must already be born (bornDate set) or this returns garbage
 * @returns {number} whole days since bornDate
 */
function childAgeOf(child) {
	return Math.floor((Time.date.timeStamp - child.bornDate) / TimeConstants.secondsPerDay);
}
window.childAgeOf = childAgeOf;

// Awareness covers who knows what about a pregnancy or child. Lists hold names ("pc", or an NPC's).
// Each fact someone can know is its own list. It exists, who's carrying, who the donor is.

/**
 * Marks who knows a pregnancy exists.
 *
 * @param {number} pregnancyId the pregnancy's index in V.pregnancies
 * @param {string} who "pc", or an NPC's name
 */
function setKnowsPregnancy(pregnancyId, who) {
	V.pregnancies[pregnancyId].awareOfPregnancy.pushUnique(who);
}
window.setKnowsPregnancy = setKnowsPregnancy;

/**
 * Records how the player found out about a pregnancy, and marks them aware of it.
 *
 * @param {number} pregnancyId the pregnancy's index in V.pregnancies
 * @param {string} source a free-form label for how they found out ("mirror", "pharmacy", "wakingUp",
 *   ...), read back by playerLearnedPregnancyFrom
 */
function setPlayerLearnedFrom(pregnancyId, source) {
	V.pregnancies[pregnancyId].playerLearnedFrom = source;
	setKnowsPregnancy(pregnancyId, "pc");
}
window.setPlayerLearnedFrom = setPlayerLearnedFrom;

/**
 * Marks who knows who's carrying a pregnancy.
 *
 * @param {number} pregnancyId the pregnancy's index in V.pregnancies
 * @param {string} who "pc", or an NPC's name
 */
function setKnowsCarrier(pregnancyId, who) {
	V.pregnancies[pregnancyId].awareOfCarrier.pushUnique(who);
}
window.setKnowsCarrier = setKnowsCarrier;

/**
 * Marks who knows who the donor of a pregnancy is.
 *
 * @param {number} pregnancyId the pregnancy's index in V.pregnancies
 * @param {string} who "pc", or an NPC's name
 */
function setKnowsDonor(pregnancyId, who) {
	V.pregnancies[pregnancyId].awareOfDonor.pushUnique(who);
}
window.setKnowsDonor = setKnowsDonor;

/**
 * Marks who knows a child exists.
 *
 * @param {number} childId the child's index in V.childRecords
 * @param {string} who "pc", or an NPC's name
 */
function setKnowsChild(childId, who) {
	V.childRecords[childId].awareOfChild.pushUnique(who);
}
window.setKnowsChild = setKnowsChild;

/**
 * Marks who knows a child's gender.
 *
 * @param {number} childId the child's index in V.childRecords
 * @param {string} who "pc", or an NPC's name
 */
function setKnowsGender(childId, who) {
	V.childRecords[childId].awareOfGender.pushUnique(who);
}
window.setKnowsGender = setKnowsGender;

/**
 * Whether someone knows a pregnancy exists. Also true if they know who's carrying or who the
 * donor is.
 *
 * @param {number} pregnancyId the pregnancy's index in V.pregnancies
 * @param {string} who "pc", or an NPC's name
 */
function knowsPregnancy(pregnancyId, who) {
	const record = V.pregnancies[pregnancyId];
	return record.awareOfPregnancy.includes(who) || record.awareOfCarrier.includes(who) || record.awareOfDonor.includes(who);
}
window.knowsPregnancy = knowsPregnancy;

/**
 * Whether someone knows who's carrying a pregnancy. Knowing the pregnancy exists is enough, because
 * awareness is always recorded against one carrier's record. Knowing only the donor is not.
 *
 * @param {number} pregnancyId the pregnancy's index in V.pregnancies
 * @param {string} who "pc", or an NPC's name
 */
function knowsCarrier(pregnancyId, who) {
	const record = V.pregnancies[pregnancyId];
	return record.awareOfCarrier.includes(who) || record.awareOfPregnancy.includes(who) || (record.carrier === who && knowsPregnancy(pregnancyId, who));
}
window.knowsCarrier = knowsCarrier;

/**
 * Whether someone knows who the donor is.
 *
 * @param {number} pregnancyId the pregnancy's index in V.pregnancies
 * @param {string} who "pc", or an NPC's name
 */
function knowsDonor(pregnancyId, who) {
	return V.pregnancies[pregnancyId].awareOfDonor.includes(who);
}
window.knowsDonor = knowsDonor;

// Whether each person has discussed this pregnancy, keyed by name ("pc" or an NPC's).

/**
 * Whether the carrier and someone have discussed this pregnancy.
 *
 * @param {number} pregnancyId the pregnancy's index in V.pregnancies
 * @param {string} who "pc", or an NPC's name
 * @returns {boolean}
 */
function hasTalkedAbout(pregnancyId, who) {
	return V.pregnancies[pregnancyId].talkedAbout[who] === true;
}
window.hasTalkedAbout = hasTalkedAbout;

/**
 * Marks that this pregnancy has been discussed with someone.
 *
 * @param {number} pregnancyId the pregnancy's index in V.pregnancies
 * @param {string} who "pc", or an NPC's name
 */
function markTalkedAbout(pregnancyId, who) {
	V.pregnancies[pregnancyId].talkedAbout[who] = true;
}
window.markTalkedAbout = markTalkedAbout;

/**
 * Whether someone might be the donor.
 *
 * @param {Pregnancy} pregnancy the pregnancy to check
 * @param {string} name "pc", or an NPC's name
 */
function couldBeDonor(pregnancy, name) {
	return pregnancy.donor === name || pregnancy.possibleDonors.some(donor => donor.name === name);
}
window.couldBeDonor = couldBeDonor;

/**
 * If only one suspect's species matches the litter, the donor stops being a mystery and is
 * marked known. Reads possibleDonors without changing it.
 *
 * @param {number} pregnancyId the pregnancy's index in V.pregnancies
 */
function resolvePaternity(pregnancyId) {
	const pregnancy = V.pregnancies[pregnancyId];
	if (knowsDonor(pregnancyId, "pc")) return; // already resolved
	const litter = getChildrenOf(pregnancyId);
	const litterBase = litter[0].species; // child.species is already the base (human/wolf/hawk)
	const fits = pregnancy.possibleDonors.filter(donor => childBaseSpecies(donor.species) === litterBase);
	if (fits.length === 1) setKnowsDonor(pregnancyId, "pc");
}
window.resolvePaternity = resolvePaternity;

/**
 * Whether someone knows a child exists.
 *
 * @param {number} childId the child's index in V.childRecords
 * @param {string} who "pc", or an NPC's name
 */
function knowsChild(childId, who) {
	return V.childRecords[childId].awareOfChild.includes(who);
}
window.knowsChild = knowsChild;

/**
 * Whether someone knows a child's gender.
 *
 * @param {number} childId the child's index in V.childRecords
 * @param {string} who "pc", or an NPC's name
 */
function knowsGender(childId, who) {
	return V.childRecords[childId].awareOfGender.includes(who);
}
window.knowsGender = knowsGender;
