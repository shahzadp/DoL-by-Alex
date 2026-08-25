/* eslint-disable no-undef */

/**
 * Creates the player's pregnancy from a donor based on pregnancy settings.
 *
 * @param {string} npc the donor's name
 * @param {DonorSpecies} npcType the donor's species
 * @param {boolean} [donorKnown=false] whether the player knows the donor
 * @param {"vagina"|"anus"} [orifice="vagina"] which orifice conceives
 * @param {TrackedNpc[]} [trackedNPCs] multiple donors when paternity is uncertain
 * @param {boolean} [awareOf=false] whether the player knows they are pregnant
 * @returns {boolean} true if a pregnancy was created
 */
function playerPregnancy(npc, npcType, donorKnown = false, orifice = "vagina", trackedNPCs, awareOf = false) {
	if (!playerSpeciesPregnancyEnabled(npcType)) return false; // species disabled in settings, or a species that can't conceive
	const donors = trackedNPCs ? trackedNPCs.map(t => ({ name: t.source, species: t.type })) : [{ name: npc, species: npcType }];
	const pregnancyId = createPregnancy("pc", "human", npc, npcType, donors, Time.date.timeStamp, orifice, V.location);
	if (awareOf) setKnowsPregnancy(pregnancyId, "pc"); // this pregnancy only, not every active one
	if (donorKnown) setKnowsDonor(pregnancyId, "pc");
	return true;
}
DefineMacro("playerPregnancy", playerPregnancy);
// debug-only wrapper, inert unless V.pregnancyTesting is set
function playerPregnancyTest(npc, npcType, donorKnown, orifice, trackedNPCs, awareOf) {
	if (V.pregnancyTesting) return playerPregnancy(npc, npcType, donorKnown, orifice, trackedNPCs, awareOf);
}
window.playerPregnancyTest = playerPregnancyTest;

/**
 * Twice a day player pregnancy side effects, per orifice. Day counting, morning sickness, and the
 * once per term breast growth and lactation. Parasites are a separate system.
 *
 * @param {"vagina"|"anus"} orifice which orifice's pregnancy to advance
 */
// eslint-disable-next-line no-unused-vars
function advancePregnancy(orifice) {
	if (V.statFreeze) return null;
	const pregnancy = getActivePregnancy("pc", orifice);
	if (!pregnancy) return null;

	V.pregnancyStats.totalDaysPregnant += 0.5;
	if (knowsPregnancy(pregnancy.pregnancyId, "pc")) V.pregnancyStats.totalDaysPregnancyKnown += 0.5;

	const progress = pregnancyProgress(pregnancy);

	if (between(progress, PregnancyConstants.morningSickness.earlyStart, PregnancyConstants.morningSickness.earlyEnd)) {
		/* Early Morning sickness */
		/* Light Nausea/dizzyness at any time of day, but mostly when waking up */
		if (random(1, 100) <= 70) {
			V.pregnancyStats.morningSicknessWaking = 1;
		}
		if (random(1, 100) <= 70) {
			V.pregnancyStats.morningSicknessGeneral = 1;
		}
	} else if (between(progress, PregnancyConstants.morningSickness.mainStart, PregnancyConstants.morningSickness.mainEnd)) {
		V.pregnancyStats.morningSicknessWaking = [1, 2, 2][random(0, 2)]; // 1/3 moderate, 2/3 severe
		if (V.sexStats[orifice].pregnancy.totalBirthEvents === 0 && V.pregnancyStats.morningSicknessWaking < 2) {
			V.pregnancyStats.morningSicknessWaking = 2;
		}
	}

	/* Breast growth and lactation. Term growth is two sizes but never past size 5 or breastsizemax. */
	if (progress >= 1 && !pregnancy.termEffectsDone) {
		pregnancy.termEffectsDone = true;
		if (V.player.breastsize <= 4 && V.player.breastsize < V.breastsizemax) {
			V.player.breastsize += 1;
			if (V.player.breastsize <= 4 && V.player.breastsize < V.breastsizemax) V.player.breastsize += 1;
			V.breastgrowthtimer = 700;
			V.breastgrowthmessage = V.player.breastsize;
			V.effectsmessage = 1;
		}
		if (V.lactating !== 1 && V.settings.breastFeedingEnabled === true && V.player.breastsize > 0) {
			V.lactating = 1;
			V.lactation_pressure = 100;
			Wikifier.wikifyEval("<<milkvolume 50>>");
			V.effectsmessage = 1;
			V.lactationmessage = 1;
		}
	}
}

/**
 * How long labour lasts, in minutes. A base time for birth, plus a bit more for
 * each baby, so twins and triplets take longer.
 * Feed the result to <<pass>>, and to getTimeString() for the "Next (H:MM)" link.
 */
function birthLaborTime() {
	const babies = getLabouringLitter("pc").length;

	const BASE_MIN = 60;
	const BASE_MAX = 180;
	const PER_EXTRA_MIN = 30;
	const PER_EXTRA_MAX = 90;

	return random(BASE_MIN, BASE_MAX) + random(PER_EXTRA_MIN, PER_EXTRA_MAX) * Math.max(0, babies - 1);
}
window.birthLaborTime = birthLaborTime;

/**
 * Births a records pregnancy. Lays or delivers each child, sets up its rearing state, and carries
 * the pregnancy-wide side effects (counts, toy unlocks, who now knows).
 *
 * Throws if the record has no children.
 *
 * @param {number} pregnancyId the pregnancy record to birth
 * @param {string} birthLocation where the birth or lay takes place
 * @param {string} location where the children are placed and reared afterwards
 */
function birthRecordedLitter(pregnancyId, birthLocation, location) {
	const pregnancy = V.pregnancies[pregnancyId];
	const litter = getChildrenOf(pregnancyId);
	if (!litter.length) throw new Error(`birthRecordedLitter: pregnancy ${pregnancyId} has no children to birth`);
	if (pregnancy.carrier === "pc") {
		if (location === "home") setKnowsAboutPregnancy(pregnancy.carrier, "Bailey");
		else if (location === "wolf_cave") setKnowsAboutPregnancy(pregnancy.carrier, "Black Wolf");
		else if (location === "tower") setKnowsAboutPregnancy(pregnancy.carrier, "Great Hawk");
	}

	recordDelivery(pregnancyId, location);

	for (const child of litter) {
		beginRearing(child, location, birthLocation);
		if (!childIsUnhatchedEgg(child)) {
			if (!child.name) child.name = generateBabyName(undefined, child.gender, child.childId);
			recordBirth(child.childId);
		}

		// Species + parentage counters (derive the parent from the link, never store it on the child).
		if (child.species === "human") V.pregnancyStats.humanChildren++;
		else if (child.species === "wolf") V.pregnancyStats.wolfChildren++;
		else if (child.species === "hawk") V.pregnancyStats.hawkChildren++;
		if (pregnancy.carrier === "pc") V.pregnancyStats.playerChildren++;
		else if (pregnancy.donor === "pc") V.pregnancyStats.npcChildren++;
		else V.pregnancyStats.npcChildrenUnrelatedToPlayer++;
	}

	// "First birth" toy unlocks, by the litter's species.
	if (litter[0].species === "human") V.pregnancyStats.humanToysUnlocked = true;
	if (litter[0].species === "wolf") V.pregnancyStats.wolfToysUnlocked = true;
	if (litter[0].species === "hawk") V.pregnancyStats.hawkToysUnlocked = true;
}
window.birthRecordedLitter = birthRecordedLitter;

// NPCs that can take their children out of Bailey's orphanage and avoid the childcare fee
const CHILD_FEE_NPCS = ["Alex"];

/**
 * Whether an NPC still has one of their own children at the orphanage (location "home").
 * Determines whether Bailey charges the PC a weekly child fee for that NPC or not.
 *
 * @param {string} npc the NPC's name
 * @returns {boolean}
 */
function npcHasChildAtOrphanage(npc) {
	return getBornChildren().some(child => {
		const pregnancy = getPregnancyOf(child);
		return (pregnancy.carrier === npc || pregnancy.donor === npc) && child.development.location === "home";
	});
}

/**
 * Clears an NPC's Bailey child fee once their last child leaves the orphanage.
 *
 * @param {string} npc the NPC's name
 */
function updateNpcChildFee(npc) {
	if (CHILD_FEE_NPCS.includes(npc) && !npcHasChildAtOrphanage(npc)) {
		delete C.npc[npc].pregnancy.fee;
	}
}

/**
 * Ends the player's labouring pregnancy: births the litter and runs the birth-side cleanup (Alex, fees).
 *
 * @param {string} birthLocation where the birth takes place
 * @param {string} location where the children are placed afterwards
 * @returns {boolean} true once birthed, false if the player has no pregnancy in labour
 */
function endPlayerPregnancy(birthLocation, location) {
	// The pregnancy in labour, if any, otherwise whichever active pregnancy the player has.
	const pregnancy = getLabouringPregnancy("pc");
	if (!pregnancy) return false;

	if (pregnancy.donor === "Alex") {
		delete C.npc.Alex.pregnancy.pcKnowledge;
		delete C.npc.Alex.pregnancy.test;
		delete C.npc.Alex.pregnancy.ultraSound;
		delete C.npc.Alex.pregnancy.sample;
		delete C.npc.Alex.pregnancy.noBirthControl;
		delete C.npc.Alex.pregnancy.ultraSoundPics;
		C.npc.Alex.pregnancy.pills = "contraceptive";
		C.npc.Alex.pregnancyAvoidance = 50;
	}
	updateNpcChildFee(pregnancy.donor);

	birthRecordedLitter(pregnancy.pregnancyId, birthLocation, location);

	// Record the birth on the player's per-orifice body stats. These drive the hymen and
	// vaginal-looseness lines, recovery, and the anal pregnancy gate. Kept off records on purpose bc
	// Virginity-restoration events (schism, scarlet) reset them to 0
	const bodyStats = V.sexStats[pregnancy.orifice].pregnancy;
	bodyStats.totalBirthEvents += 1;
	bodyStats.givenBirth += getChildrenOf(pregnancy.pregnancyId).length;

	if ((pregnancy.orifice === "vagina" && V.player.virginity.vaginal === true) || (pregnancy.orifice === "anus" && V.player.virginity.anal === true)) {
		V.pregnancyStats.playerVirginBirths.pushUnique(pregnancy.pregnancyId);
	}
	if (getActivePregnancies("pc").length === 0) {
		const menstruation = V.sexStats.vagina.menstruation;
		switch (childBaseSpecies(pregnancy.donorSpecies)) {
			case "human":
				menstruation.recoveryTime = random(2, 3) * V.settings.humanPregnancyMonths;
				break;
			case "wolf":
				menstruation.recoveryTime = random(1, 2) * V.settings.wolfPregnancyWeeks;
				break;
			case "hawk":
				menstruation.recoveryTime = 0.5;
				break;
		}
		V.sexStats.vagina.menstruation = {
			...menstruation,
			currentState: "recovering",
			recoveryTimeStart: menstruation.recoveryTime,
			recoveryStage: 0,
			periodEnabled: false,
			awareOfPeriodDelay: false,
		};
	}

	// Labour is over either way.
	pregnancy.waterBreaking = false;
	pregnancy.birthInProgress = false;

	delete V.templeVirginPregnancy;
	delete V.caveHumanPregnancyDiscovered;

	return true;
}
DefineMacro("endPlayerPregnancy", endPlayerPregnancy);
// debug-only wrapper, inert unless V.pregnancyTesting is set
function endPlayerPregnancyTest(birthLocation, location) {
	if (V.pregnancyTesting && birthLocation && location) return endPlayerPregnancy(birthLocation, location);
}
window.endPlayerPregnancyTest = endPlayerPregnancyTest;
/* Player pregnancy ends here */

/* Named NPC pregnancy starts here */
/**
 * Ages every named NPC's records pregnancy as time passes.
 * Marks the NPC aware once gestation passes npcGestation.awareProgressFraction.
 * Resolves a birth offscreen once it is past due by npcGestation.offscreenBirthGraceDays.
 */
// eslint-disable-next-line no-unused-vars
function npcPregnancyCycle() {
	if (V.statFreeze) return null;
	for (const npcName of V.NPCNameList) {
		const npc = C.npc[npcName];
		if (!npc) continue;
		const pregnancy = npc.pregnancy;
		if (!pregnancy) continue;
		const record = getActivePregnancies(npcName)[0];
		if (record) {
			if (
				Time.date.timeStamp - record.conceivedDate > gestationSeconds(record.donorSpecies) * PregnancyConstants.npcGestation.awareProgressFraction &&
				!knowsAboutPregnancy(npcName, npcName)
			) {
				setKnowsAboutPregnancy(npcName, npcName);
			}
			const dueDate = getDueDate(record);
			if (Time.date.timeStamp >= dueDate) {
				if (Time.date.timeStamp >= dueDate + PregnancyConstants.npcGestation.offscreenBirthGraceDays * TimeConstants.secondsPerDay) {
					/* Player has not seen the npc recently, sort out the pregnancy in another way */
					let birthLocation = "";
					let location = "";
					switch (npcName) {
						case "Black Wolf":
							birthLocation = "wolf_cave";
							location = "wolf_cave";
							break;
						case "Alex":
							C.npc.Alex.pregnancy.missedBirthCount = (C.npc.Alex.pregnancy.missedBirthCount || 0) + 1;
							C.npc.Alex.pregnancy.missedBirth = true;
							if (C.npc.Alex.pregnancy.nursery === true) {
								birthLocation = "alex_cottage";
								location = "alex_cottage";
							} else {
								birthLocation = "alex_cottage";
								location = "home";
							}
							break;
					}
					[birthLocation, location] = defaultBirthLocations(record.donorSpecies, birthLocation, location);
					if (!endNpcPregnancy(npcName, birthLocation, location)) {
						throw new Error(`offscreen NPC birth for "${npcName}" (pregnancy ${record.pregnancyId}) failed to deliver a past-due pregnancy`);
					}
				} else {
					/* Can deal with the npc in the next event */
					record.waterBreaking = true;
				}
			}
			continue;
		}
		if (pregnancy.enabled && V.settings.nnpcPregnancyEnabled === true) {
			pregnancy.cycleDay++;
			if (pregnancy.cycleDay >= pregnancy.cycleDaysTotal) {
				pregnancy.cycleDay = 1;
			}
		}
	}
}
/**
 * The species a pregnancy grows as. An unrecognised pairing conceives nothing.
 *
 * @param {string} donorSpecies the donor's species
 * @param {string} carrierSpecies the carrier's species, after any monster selection
 * @returns {string|null} the offspring species, or null if the pairing conceives nothing
 */
function offspringSpecies(donorSpecies, carrierSpecies) {
	const bird = ["hawk", "harpy"];
	const wolfMonster = ["wolfboy", "wolfgirl"];
	const plain = ["human", "wolf"];
	if (bird.includes(donorSpecies) || bird.includes(carrierSpecies)) return carrierSpecies;
	if (wolfMonster.includes(donorSpecies) || wolfMonster.includes(carrierSpecies)) return "wolfgirl";
	if (plain.includes(donorSpecies) && plain.includes(carrierSpecies)) return donorSpecies === "wolf" || carrierSpecies === "wolf" ? "wolf" : "human";
	return null;
}
window.offspringSpecies = offspringSpecies;

/**
 * Creates a named NPC's pregnancy from a donor.
 *
 * @param {string} carrier the pregnant NPC's name
 * @param {string} donor the donor's name, usually pc
 * @param {DonorSpecies} donorInputSpecies the donor's species
 * @param {boolean} [donorKnown=false] whether the player learns who the donor is
 * @param {boolean} [awareOf=false] whether the player learns about the pregnancy
 * @returns {boolean} true if a pregnancy was created
 */
function namedNpcPregnancy(carrier, donor, donorInputSpecies, donorKnown = false, awareOf = false) {
	if (V.settings.nnpcPregnancyEnabled === false) return false; // Named NPC pregnancy disabled
	const namedNpc = C.npc[carrier];
	// The carrier conceives in their monster form on the monster-chance roll, or always when locked into it.
	const monsterForm = lockedFlag =>
		(V.settings.monsterChance >= random(1, 100) && (V.hallucinations >= 1 || !V.settings.monsterHallucinationsOnly)) || lockedFlag === 2;
	let namedNpcType = namedNpc.type;
	if (carrier === "Black Wolf" && monsterForm(V.blackwolfmonster)) namedNpcType = "wolfgirl";
	else if (carrier === "Great Hawk" && monsterForm(V.greathawkmonster)) namedNpcType = "harpy";
	const donorSpecies = offspringSpecies(donorInputSpecies, namedNpcType);
	if (!donorSpecies) return false;

	const carrierOrifice = namedNpc.vagina !== "none" ? "vagina" : "anus";
	const pregnancyId = createPregnancy(
		carrier,
		namedNpc.type,
		donor,
		donorSpecies,
		[{ name: donor, species: donorInputSpecies }],
		Time.date.timeStamp,
		carrierOrifice,
		V.location
	);
	if (awareOf) setKnowsPregnancy(pregnancyId, "pc");
	if (donorKnown) setKnowsDonor(pregnancyId, "pc");
	return true;
}
DefineMacro("namedNpcPregnancy", namedNpcPregnancy);
// V.pregnancyTesting Check should not be removed, debugging purposes only
function namedNpcPregnancyTest(carrier, donor, pregnancyType, donorKnown, awareOf) {
	if (V.pregnancyTesting) return namedNpcPregnancy(carrier, donor, pregnancyType, donorKnown, awareOf);
}
window.namedNpcPregnancyTest = namedNpcPregnancyTest;

/**
 * Ends an NPC's pregnancy. Delivers the pregnancy off screen and runs clean up.
 *
 * @param {string} npcName the pregnant NPC's name
 * @param {string} birthLocation where the birth takes place
 * @param {string} location where the children live
 * @returns {boolean} true once delivered, false if the NPC has no pregnancy
 */
function endNpcPregnancy(npcName, birthLocation, location) {
	if (!C.npc[npcName] || !C.npc[npcName].pregnancy) {
		return false;
	}
	const pregnancy = C.npc[npcName].pregnancy;

	const record = getLabouringPregnancy(npcName);
	if (record && getChildrenOf(record.pregnancyId).length) {
		// Handled by Baileys Orphanage event and when naming them, this is backup for other situations
		if (record.donor === "pc" && location !== "home") {
			document.getElementById("passages").children[0].append(Wikifier.wikifyEval('<<earnFeat "First Fatherhood">>'));
		}
		switch (location) {
			case "home":
				setKnowsAboutPregnancy(npcName, "Bailey", record.pregnancyId, true);
				break;
			case "wolf_cave":
				setKnowsAboutPregnancy(npcName, "Black Wolf", record.pregnancyId);
				break;
		}
		birthRecordedLitter(record.pregnancyId, birthLocation, location);
		pregnancy.cycleDay = (pregnancy.cycleDaysTotal || 0) - 3;

		if (npcName === "Alex") {
			delete C.npc.Alex.pregnancy.selfKnowledge;
			delete C.npc.Alex.pregnancy.noBirthControl;

			C.npc.Alex.pregnancy.pills = "contraceptive";
			C.npc.Alex.pregnancyAvoidance = 50;
		}
		updateNpcChildFee(npcName);

		V.pregnancyStats.npcTotalBirthEvents++;
		return true;
	}

	return false;
}
DefineMacro("endNpcPregnancy", endNpcPregnancy);
// V.pregnancyTesting Check should not be removed, debugging purposes only
function endNpcPregnancyTest(npcName, birthLocation, location) {
	if (V.pregnancyTesting && npcName && birthLocation && location) return endNpcPregnancy(npcName, birthLocation, location);
}
window.endNpcPregnancyTest = endNpcPregnancyTest;
/* Named NPC pregnancy ends here */

/**
 * Copies a generated NPC out of their $NPCList slot into $storedNPCs, keyed by the given name and the
 * lowest free number after it ("pregnancy_#"). Twee callers read the key back from _lastStoredName.
 *
 * `<<storeNPC $penistarget "pregnancy">>`
 *
 * @param {number} slot the $NPCList index to store
 * @param {string} name what to store them under
 * @returns {string|null} the key they are stored under, null when the slot holds no one
 */
function storeNPC(slot, name) {
	if (!EventSystem.isSlotTaken(slot)) {
		Errors.report(`storeNPC called with invalid or empty NPCList slot (${slot})`, { Stacktrace: Utils.GetStack(), Name: name, Slot: slot });
		return null;
	}
	let index = 0;
	while (V.storedNPCs[`${name}_${index}`]) index++;
	const key = `${name}_${index}`;
	const npc = V.NPCList[slot];
	V.storedNPCs[key] = {
		npc: {
			adult: npc.adult,
			breastsize: npc.breastsize,
			breastdesc: npc.breastdesc,
			breastsdesc: npc.breastsdesc,
			description: npc.description,
			fullDescription: npc.fullDescription,
			gender: npc.gender,
			insecurity: npc.insecurity,
			name: npc.name,
			monster: npc.monster,
			penis: npc.penis,
			penisdesc: npc.penisdesc,
			penissize: npc.penissize,
			pregnancy: npc.pregnancy,
			pregnancyAvoidance: npc.pregnancyAvoidance,
			pronoun: npc.pronoun,
			skincolour: npc.skincolour,
			teen: npc.teen,
			type: npc.type,
			vagina: npc.vagina,
		},
	};
	T.lastStoredName = key;
	return key;
}
window.storeNPC = storeNPC;
DefineMacro("storeNPC", storeNPC);

/**
 * Ages every stored NPC's records pregnancy.
 * Births each one that is now due at its species' default location, then removes the stored NPC.
 *
 * @returns {boolean} false when there is nothing to process (stats frozen or no stored NPCs), else true
 */
// eslint-disable-next-line no-unused-vars
function randomPregnancyProgress() {
	if (V.statFreeze) return false;
	const toDelete = [];
	Object.keys(V.storedNPCs).forEach(npcKey => {
		const record = getActivePregnancies(npcKey)[0];
		if (record && Time.date.timeStamp >= getDueDate(record)) {
			const [birthLocation, location] = defaultBirthLocations(record.donorSpecies);
			birthRecordedLitter(record.pregnancyId, birthLocation, location);
			toDelete.push(npcKey);
		}
	});
	toDelete.forEach(npcKey => delete V.storedNPCs[npcKey]);
	return true;
}

/**
 * Fills in the default birth and placement locations for a species when a caller leaves them blank.
 *
 * @param {DonorSpecies} type the child's species
 * @param {string} [birthLocation] where the birth happens, defaulted if missing
 * @param {string} [location] where the children go afterwards, defaulted if missing
 * @returns {string[]} the resolved [birthLocation, location]
 */
function defaultBirthLocations(type, birthLocation, location) {
	switch (type) {
		case "human":
			if (!birthLocation) birthLocation = "hospital";
			if (!location) location = "home";
			break;
		case "wolf":
		case "wolfboy":
		case "wolfgirl":
			if (!birthLocation) birthLocation = "wolf_cave";
			if (!location) location = "wolf_cave";
			break;
		case "hawk":
		case "harpy":
			if (!birthLocation) birthLocation = "tower";
			if (!location) location = "tower";
			break;
		default:
			throw new Error(`defaultBirthLocations: unknown donor species "${type}"`);
	}
	return [birthLocation, location];
}

/**
 * Resolves paternity for every active player pregnancy and marks the player aware of each child.
 */
function makeAwareOfDetails() {
	getActivePregnancies("pc").forEach(p => {
		resolvePaternity(p.pregnancyId);
		getChildrenOf(p.pregnancyId).forEach(child => {
			setKnowsChild(child.childId, "pc");
		});
	});
}
DefineMacro("makeAwareOfDetails", makeAwareOfDetails);
