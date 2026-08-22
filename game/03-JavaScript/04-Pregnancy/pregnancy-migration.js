// Save migration. Converts old pregnancy and children data into the
// records system (V.pregnancies + V.childRecords).
const CHILD_FEATURE_KEYS = ["monster", "size", "hairColour", "eyeColour", "skinColour", "beastTransform", "divineTransform"];
const LEGACY_DEV_KEYS = ["activity", "event", "activityDay", "activityHour", "crawling", "talking", "toy", "acceptsDummy", "interactions", "interactionsTotal"];

/**
 * Carry an old child's development state onto the new record, whitelisted.
 *
 * @param {object} localVariables old variables
 * @returns {object} new development keys
 */
function pickLegacyDev(localVariables) {
	const out = {};
	if (localVariables && typeof localVariables === "object") {
		for (const key of LEGACY_DEV_KEYS) if (Object.hasOwn(localVariables, key)) out[key] = localVariables[key];
	}
	return out;
}

/**
 * Turns old { day, month: monthName, year } date objects into a timestamp.
 *
 * @param {{day: number, month: string, year: number}} dateObj month is a name ("January"), not an index
 * @returns {number} the timestamp for midnight on that date
 */
function oldDateToTimestamp(dateObj) {
	if (!dateObj || typeof dateObj.day !== "number" || typeof dateObj.year !== "number" || typeof dateObj.month !== "string") {
		throw new Error(`bad date object: ${JSON.stringify(dateObj)}`);
	}
	const monthIndex = Time.monthNames.indexOf(dateObj.month);
	if (monthIndex === -1) throw new Error(`unknown month name "${dateObj.month}"`);
	return new DateTime(dateObj.year, monthIndex + 1, dateObj.day).timeStamp;
}
window.oldDateToTimestamp = oldDateToTimestamp;

/**
 * Converts old pregnancy chance settings to the percentage the game stores now.
 * Read by the save migration and by the settings import.
 *
 * @param {number} value the old slider value
 * @param {number} scaleMax the old scale's ceiling (100 for the player and 20 for NPCs)
 * @returns {number} the equivalent chance (0 to 100)
 */
function legacyPregnancyChanceToPercent(value, scaleMax) {
	return Math.clamp(Math.round(100 / Math.max(scaleMax - value, 1)), 0, 100);
}
window.legacyPregnancyChanceToPercent = legacyPregnancyChanceToPercent;

/**
 * Copy an old babyBase() features object down to just the keys the new Features shape keeps.
 *
 * @param {object} oldFeatures an old child's features. Anything outside CHILD_FEATURE_KEYS is dropped
 * @returns {Features} the trimmed features for a child record
 */
function migrateChildFeatures(oldFeatures) {
	const features = {};
	for (const key of CHILD_FEATURE_KEYS) {
		if (Object.hasOwn(oldFeatures, key)) features[key] = oldFeatures[key];
	}
	return features;
}
window.migrateChildFeatures = migrateChildFeatures;

/**
 * Old paternity suspects (potentialFathers [{type, source}]) to the new records shape.
 *
 * @param {object} oldPregnancy the old pregnancy shape's potentialFathers array
 * @returns {Array<{name: string, species: string}>} the possibleDonors list or [] if there were none
 */
function migratePossibleDonors(oldPregnancy) {
	return Array.isArray(oldPregnancy.potentialFathers) ? oldPregnancy.potentialFathers.map(f => ({ name: f.source, species: f.type })) : [];
}
/**
 * Group by mother+birthId+father+conceived, not just mother+birthId, so two concurrent
 * pregnancies on the same mother (dual vaginal+anal, or bred twice) don't merge and swap a
 * child's donor.
 *
 * @param {object} oldChild an old child record
 * @returns {string} the litter key that groups children of the same pregnancy
 */
function litterKeyOf(oldChild) {
	return `${oldChild.mother}|${oldChild.birthId}|${oldChild.father}|${JSON.stringify(oldChild.conceived ?? null)}`;
}

/**
 * Rewrite one live id reference from an old composite childId to the new numeric one. Throws
 * on a dangling reference instead of silently pointing at nothing or the wrong child.
 *
 * @param {string} oldKey the old composite childId being pointed at
 * @param {Object<string, number>} oldKeyToNewId map built by migrateChildrenToRecords
 * @param {string} whatFor what holds the reference, named in the error if it dangles
 * @returns {number} the new numeric childId
 */
function rewriteChildIdReference(oldKey, oldKeyToNewId, whatFor) {
	if (!(oldKey in oldKeyToNewId)) throw new Error(`${whatFor} references a child that wasn't migrated: "${oldKey}"`);
	return oldKeyToNewId[oldKey];
}

/**
 * Converts every legacy $children entry into V.childRecords, building one pregnancy record
 * per litter. Runs once, driven by variables-versionUpdate.twee. $children itself is read-only
 * here, never written or deleted.
 *
 * @returns {object} map of old composite childId -> new numeric childId
 */
function migrateChildrenToRecords() {
	if (!Array.isArray(V.pregnancies)) V.pregnancies = [];
	if (!Array.isArray(V.childRecords)) V.childRecords = [];

	const oldChildren = V.children || {};
	const oldKeyToNewId = {};
	const oldBirthIdToNewPregnancyId = {}; // "carrier|oldBirthId" -> new pregnancyId, for the babyIntros translation

	const litters = new Map();
	for (const [oldKey, oldChild] of Object.entries(oldChildren)) {
		const key = litterKeyOf(oldChild);
		if (!litters.has(key)) litters.set(key, []);
		litters.get(key).push([oldKey, oldChild]);
	}

	for (const members of litters.values()) {
		const representative = members[0][1];
		const isEggLitter = members.some(([, oldChild]) => !!oldChild.eggTimer);
		if (isEggLitter && !members.every(([, oldChild]) => !!oldChild.eggTimer)) {
			throw new Error(`litter "${litterKeyOf(representative)}" mixes hatched and unhatched eggs, can't make one pregnancy from it`);
		}

		const species = representative.type;
		if (species !== "human" && species !== "wolf" && species !== "hawk") {
			throw new Error(`unknown child species "${species}"`);
		}

		let deliveredDate;
		let deliveredLocation;
		if (species === "hawk") {
			if (!representative.laid) {
				throw new Error(`hawk child has no laid date, litter "${litterKeyOf(representative)}"`);
			}
			deliveredDate = oldDateToTimestamp(representative.laid);
			deliveredLocation = representative.laidLocation ?? representative.birthLocation ?? "unknown";
		} else {
			if (isEggLitter) throw new Error(`eggTimer set on a non-hawk litter "${litterKeyOf(representative)}"`);
			deliveredDate = oldDateToTimestamp(representative.born);
			deliveredLocation = representative.birthLocation ?? "unknown";
		}

		let hatchDelay;
		if (species === "hawk") {
			const rawDelay = isEggLitter ? representative.eggTimer - deliveredDate - PregnancyConstants.birdNestTime : 0;
			hatchDelay = Math.max(0, rawDelay);
		}

		const pregnancyId = pushPregnancyRecord({
			carrier: representative.mother,
			carrierSpecies: representative.mother === "pc" ? "human" : C.npc[representative.mother]?.type ?? species,
			donor: representative.father,
			donorSpecies: species,
			possibleDonors: [],
			conceivedDate: oldDateToTimestamp(representative.conceived),
			conceivedLocation: representative.conceivedLocation ?? "unknown",
			orifice: "vagina",
			deliveredDate,
			deliveredLocation,
			awareOfPregnancy: [],
			awareOfCarrier: representative.motherKnown ? ["pc"] : [],
			awareOfDonor: representative.fatherKnown ? ["pc"] : [],
			playerLearnedFrom: null,
			hatchDelay,
		});
		applyLegacyPregnancyState(representative.mother, representative.birthId, pregnancyId);
		oldBirthIdToNewPregnancyId[representative.mother + "|" + representative.birthId] = pregnancyId;

		for (const [oldKey, oldChild] of members) {
			oldKeyToNewId[oldKey] = pushChildRecord({
				pregnancyId,
				species: oldChild.type,
				features: migrateChildFeatures(oldChild.features || {}),
				gender: oldChild.gender,
				identical: oldChild.features?.identical ? pregnancyId : null,
				development: {
					...beginRearingDefaults(),
					...pickLegacyDev(oldChild.localVariables),
					location: oldChild.location,
					birthLocation: oldChild.birthLocation,
					firstWord: oldChild.localVariables?.firstWord?.word ?? null, // source firstWord is a { word, date, ... } object
					...(oldChild.adopted ? { adoptedDate: oldDateToTimestamp(oldChild.adopted) } : {}),
				},
				bornDate: oldChild.eggTimer ? null : oldDateToTimestamp(oldChild.born),
				name: oldChild.name ?? null,
				coParents: [],
				awareOfChild: [],
				awareOfGender: [],
			});
		}
	}

	if (Array.isArray(V.eggsHatched)) {
		V.eggsHatched = V.eggsHatched.map(oldKey => rewriteChildIdReference(oldKey, oldKeyToNewId, "eggsHatched"));
	}
	if (Array.isArray(V.eggsMoved)) {
		V.eggsMoved = V.eggsMoved.map(oldKey => rewriteChildIdReference(oldKey, oldKeyToNewId, "eggsMoved"));
	}
	if (V.childSelected && typeof V.childSelected.childId === "string") {
		V.childSelected = V.childRecords[rewriteChildIdReference(V.childSelected.childId, oldKeyToNewId, "childSelected")];
	}
	if (V.childActivityEvent && typeof V.childActivityEvent.childid === "string") {
		V.childActivityEvent.childid = rewriteChildIdReference(V.childActivityEvent.childid, oldKeyToNewId, "childActivityEvent.childid");
	}

	// Baby intros are resolved by migratePregnancyData after all migrations run.
	return oldBirthIdToNewPregnancyId;
}
window.migrateChildrenToRecords = migrateChildrenToRecords;

/**
 * Repoints pending baby intros. Each entry is { birthId, mother, children }. Only birthId changes.
 *
 * @param {Object<string, number>} oldBirthIdToNewPregnancyId "carrier|oldBirthId" -> new pregnancyId
 */
function migrateBabyIntros(oldBirthIdToNewPregnancyId) {
	if (!V.babyIntros) return;
	for (const who of Object.keys(V.babyIntros)) {
		const entries = V.babyIntros[who];
		const translated = [];
		for (const entry of entries) {
			const key = entry.mother + "|" + entry.birthId;
			const pregnancyId = oldBirthIdToNewPregnancyId[key];
			if (pregnancyId === undefined) {
				// If there is no intro (which might happen with cheats)
				console.warn(`migrateBabyIntros: dropping pending baby intro for "${who}" pointing at birth "${key}" with no litter`);
				continue;
			}
			translated.push({ birthId: pregnancyId, mother: entry.mother, children: entry.children });
		}
		if (translated.length) V.babyIntros[who] = translated;
		else delete V.babyIntros[who];
	}
}
window.migrateBabyIntros = migrateBabyIntros;

/**
 * Migrates who knew about pregnancy and who's talked about it.
 *
 * @param {string} carrier the old carrier name (map key prefix)
 * @param {number} oldBirthId the old birthId (map key suffix)
 * @param {number} pregnancyId the new record's id
 */
function applyLegacyPregnancyState(carrier, oldBirthId, pregnancyId) {
	if (!V.pregnancyStats) return;
	const key = "" + carrier + oldBirthId;
	const resolveName = who => (who === "pc" ? "pc" : V.NPCNameList[who]);

	const resolveOrThrow = who => {
		const name = resolveName(who);
		if (!name) throw new Error(`applyLegacyPregnancyState: unresolved NPCNameList index "${who}" for pregnancy ${pregnancyId}`);
		return name;
	};

	const aware = V.pregnancyStats.awareOfBirthId && V.pregnancyStats.awareOfBirthId[key];
	if (Array.isArray(aware)) {
		for (const who of aware) {
			setKnowsPregnancy(pregnancyId, resolveOrThrow(who));
		}
	}

	// Old talkedAbout stored a per-person count. The new record only needs the boolean.
	const talked = V.pregnancyStats.talkedAboutPregnancy && V.pregnancyStats.talkedAboutPregnancy[key];
	if (talked && typeof talked === "object") {
		for (const who of Object.keys(talked)) {
			if (!talked[who]) continue;
			markTalkedAbout(pregnancyId, resolveOrThrow(who));
		}
	}
}
window.applyLegacyPregnancyState = applyLegacyPregnancyState;

// Parasites are a separate system, tracked directly on the pregnancy object rather than in records
const INFLIGHT_KNOWN_SPECIES = ["human", "wolf", "hawk"];

/**
 * Work out when conception must have been by counting gestationSeconds backwards, so an
 * in-flight pregnancy keeps its progress instead of restarting at day one.
 * Old pregnancy code tracked progress as a timer counting up to term, so
 * scaling that by the species' gestation length gives how long ago it started.
 *
 * @param {number} timer how far the old pregnancy had progressed
 * @param {number} timerEnd what it was counting up to (term)
 * @param {ChildSpecies} species picks the gestation length to scale by
 * @returns {number} the timestamp the pregnancy would have started at
 */
function inflightConceivedDate(timer, timerEnd, species) {
	const progressRatio = Math.clamp(timer / timerEnd, 0, 1);
	const span = gestationSeconds(species);
	return Math.round(Time.date.timeStamp - progressRatio * span);
}
window.inflightConceivedDate = inflightConceivedDate;

/**
 * Converts any in-flight pregnancy on the player's own body ($sexStats) into records, one orifice
 * at a time. Runs once, driven by variables-versionUpdate.twee. A parasite pregnancy, or an
 * orifice with nothing in progress, is left alone.
 */
function migrateInflightPregnanciesToRecords() {
	if (!Array.isArray(V.pregnancies)) V.pregnancies = [];
	if (!Array.isArray(V.childRecords)) V.childRecords = [];

	for (const orifice of ["vagina", "anus"]) {
		const oldPregnancy = V.sexStats[orifice] && V.sexStats[orifice].pregnancy;
		if (!oldPregnancy || !oldPregnancy.fetus || !oldPregnancy.fetus.length) continue;
		if (oldPregnancy.type === "parasite") continue;

		const species = oldPregnancy.type;
		if (!INFLIGHT_KNOWN_SPECIES.includes(species)) {
			throw new Error(`can't migrate the ${orifice} pregnancy: unknown species "${species}"`);
		}

		const firstFetus = oldPregnancy.fetus[0];
		if (!firstFetus.father) {
			throw new Error(`can't migrate the ${orifice} pregnancy: its fetus has no father to use as the donor`);
		}
		if (typeof oldPregnancy.timer !== "number" || typeof oldPregnancy.timerEnd !== "number" || oldPregnancy.timerEnd <= 0) {
			throw new Error(`can't migrate the ${orifice} pregnancy: bad timer (${oldPregnancy.timer}/${oldPregnancy.timerEnd})`);
		}
		for (const fetus of oldPregnancy.fetus) {
			if (fetus.type !== species) {
				throw new Error(`can't migrate the ${orifice} pregnancy: a fetus is "${fetus.type}" but the litter is "${species}"`);
			}
		}

		const conceivedDate = inflightConceivedDate(oldPregnancy.timer, oldPregnancy.timerEnd, species);
		const hatchDelay = species === "hawk" ? random(0, PregnancyConstants.birdHatchDelay) : undefined;
		const pregnancyId = pushPregnancyRecord({
			carrier: "pc",
			carrierSpecies: "human",
			donor: firstFetus.father,
			donorSpecies: species,
			possibleDonors: migratePossibleDonors(oldPregnancy),
			conceivedDate,
			conceivedLocation: firstFetus.conceivedLocation ?? "unknown",
			orifice,
			deliveredDate: null,
			deliveredLocation: null,
			waterBreaking: !!oldPregnancy.waterBreaking,
			awareOfPregnancy: oldPregnancy.awareOf ? ["pc"] : [],
			awareOfCarrier: firstFetus.motherKnown ? ["pc"] : [],
			awareOfDonor: firstFetus.fatherKnown ? ["pc"] : [],
			playerLearnedFrom: null,
			hatchDelay,
		});
		applyLegacyPregnancyState("pc", firstFetus.birthId, pregnancyId);

		for (const fetus of oldPregnancy.fetus) {
			pushChildRecord({
				pregnancyId,
				species: fetus.type,
				features: migrateChildFeatures(fetus.features || {}),
				gender: fetus.gender,
				identical: null,
				development: {},
				bornDate: null,
				name: null,
				coParents: [],
				awareOfChild: [],
				awareOfGender: [],
			});
		}

		// Clear the old pregnancy fields
		oldPregnancy.fetus = [];
		oldPregnancy.type = null;
		oldPregnancy.timer = null;
		oldPregnancy.timerEnd = null;
		oldPregnancy.awareOf = null;
		oldPregnancy.potentialFathers = [];
		oldPregnancy.waterBreaking = false;
		if ("waterBreakingTimer" in oldPregnancy) oldPregnancy.waterBreakingTimer = null;
	}
}
window.migrateInflightPregnanciesToRecords = migrateInflightPregnanciesToRecords;

/**
 * Converts any in-flight NPC pregnancies into records.
 */
function migrateNpcInflightPregnanciesToRecords() {
	if (!Array.isArray(V.pregnancies)) V.pregnancies = [];
	if (!Array.isArray(V.childRecords)) V.childRecords = [];
	const migrateOne = (carrier, carrierSpecies, oldPregnancy) => {
		const firstFetus = oldPregnancy.fetus[0];
		const species = oldPregnancy.type;
		if (!INFLIGHT_KNOWN_SPECIES.includes(species)) {
			throw new Error(`can't migrate ${carrier}'s pregnancy: unknown species "${species}"`);
		}
		if (typeof oldPregnancy.timer !== "number" || typeof oldPregnancy.timerEnd !== "number" || oldPregnancy.timerEnd <= 0) {
			throw new Error(`can't migrate ${carrier}'s pregnancy: bad timer (${oldPregnancy.timer}/${oldPregnancy.timerEnd})`);
		}
		const hatchDelay = species === "hawk" ? random(0, PregnancyConstants.birdHatchDelay) : undefined;
		const pregnancyId = pushPregnancyRecord({
			carrier,
			carrierSpecies,
			donor: firstFetus.father,
			donorSpecies: species,
			possibleDonors: migratePossibleDonors(oldPregnancy),
			conceivedDate: inflightConceivedDate(oldPregnancy.timer, oldPregnancy.timerEnd, species),
			conceivedLocation: firstFetus.conceivedLocation ?? "unknown",
			orifice: "vagina",
			deliveredDate: null,
			deliveredLocation: null,
			awareOfPregnancy: [...(oldPregnancy.pcAwareOf ? ["pc"] : []), ...(oldPregnancy.npcAwareOf ? [carrier] : [])],
			awareOfCarrier: firstFetus.motherKnown ? ["pc"] : [],
			awareOfDonor: firstFetus.fatherKnown ? ["pc"] : [],
			playerLearnedFrom: null,
			hatchDelay,
		});
		applyLegacyPregnancyState(carrier, firstFetus.birthId, pregnancyId);

		for (const fetus of oldPregnancy.fetus) {
			pushChildRecord({
				pregnancyId,
				species: fetus.type,
				features: migrateChildFeatures(fetus.features || {}),
				gender: fetus.gender,
				identical: null,
				development: {},
				bornDate: null,
				name: fetus.name || null,
				coParents: [],
				awareOfChild: [],
				awareOfGender: [],
			});
		}

		oldPregnancy.fetus = [];
		oldPregnancy.type = null;
		oldPregnancy.timer = null;
		oldPregnancy.timerEnd = null;
		oldPregnancy.waterBreaking = false;
		oldPregnancy.npcAwareOf = null;
		oldPregnancy.pcAwareOf = null;
		oldPregnancy.potentialFathers = [];
	};

	// Named NPCs
	for (const npcName of V.NPCNameList || []) {
		const npc = C.npc[npcName];
		const oldPregnancy = npc && npc.pregnancy;
		if (!oldPregnancy || !Array.isArray(oldPregnancy.fetus) || !oldPregnancy.fetus.length) continue;
		if (oldPregnancy.type === "parasite") continue;
		migrateOne(npcName, npc.type || oldPregnancy.type, oldPregnancy);
	}

	// Stored NPCs
	for (const npcKey of Object.keys(V.storedNPCs || {})) {
		const stored = V.storedNPCs[npcKey];
		const oldPregnancy = stored && stored.pregnancy;
		if (!oldPregnancy || typeof oldPregnancy !== "object" || !Array.isArray(oldPregnancy.fetus) || !oldPregnancy.fetus.length) continue;
		if (oldPregnancy.type === "parasite") continue;
		migrateOne(npcKey, (stored.npc && stored.npc.type) || oldPregnancy.type, oldPregnancy);
	}

	if (V.pregnancyStats) {
		delete V.pregnancyStats.awareOfBirthId;
		delete V.pregnancyStats.talkedAboutPregnancy;
	}
}
window.migrateNpcInflightPregnanciesToRecords = migrateNpcInflightPregnanciesToRecords;

/**
 * Converts old pregnancies to the new pregnancy records.
 */
function migratePregnancyData() {
	if (V.objectVersion?.pregnancyRecords >= 1) return;

	const snapshot = clone(V);
	try {
		const childMap = V.children ? migrateChildrenToRecords() : {};
		if (V.sexStats) migrateInflightPregnanciesToRecords();
		migrateNpcInflightPregnanciesToRecords();
		migrateBabyIntros(childMap);
		delete V.children;
		if (V.sexStats) {
			if (V.sexStats.vagina) delete V.sexStats.vagina.sperm;
			if (V.sexStats.anus) delete V.sexStats.anus.sperm;
		}
		if (!V.objectVersion) V.objectVersion = {};
		V.objectVersion.pregnancyRecords = 1; // marks success
	} catch (e) {
		for (const k of Object.keys(V)) delete V[k];
		Object.assign(V, snapshot);
		throw e;
	}
}
window.migratePregnancyData = migratePregnancyData;
