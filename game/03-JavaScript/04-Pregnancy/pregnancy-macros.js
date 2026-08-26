// The pregnancy macros that scenes can call.
// Combat calls <<combatInseminate>> and everything about the load is worked out from the fight.
// Story scenes call <<sceneInseminate>> and provide the details themselves.
// Cum inside an NPC is one <<npcPregnancyRoll>> on the spot, NPCs store no loads.

// Which impregnable hole and landing depth each penis state means.
// The names come from the $NPCList[n].penis states during combat/sex.
// States not listed here (mouth, thighs, etc.) leave nothing behind.
const depthFromPenisState = {
	vaginaentrance: ["vagina", "outside"],
	vaginaentrancedouble: ["vagina", "outside"],
	vaginaimminent: ["vagina", "imminent"],
	vaginaimminentdouble: ["vagina", "imminent"],
	vagina: ["vagina", "deep"],
	vaginadouble: ["vagina", "deep"],
	anusentrance: ["anus", "outside"],
	anusentrancedouble: ["anus", "outside"],
	anusimminent: ["anus", "imminent"],
	anusimminentdouble: ["anus", "imminent"],
	anus: ["anus", "deep"],
	anusdouble: ["anus", "deep"],
	cheeks: ["anus", "outside"],
};

// The generated NPC types with birth content.
const randomCarrierTypes = ["human", "wolf", "wolfboy", "wolfgirl"];

/**
 * Called by the ejaculation widgets when an NPC climaxes in combat.
 * The fight fills in every detail of the load.
 *
 * `<<combatInseminate _nn>>` or `<<combatInseminate _jj true>>` (beast)
 *
 * @param {0|1|2|3|4|5} slot which $NPCList slot climaxed
 * @param {boolean} [beast=false] pass true from the beast widget to keep the beast's species and
 *   let _pregnancyBoost raise potency
 * @returns {Load|null} the stored load. null = nothing was stored
 */
function combatInseminate(slot, beast = false) {
	const npc = V.NPCList[slot];
	const landing = depthFromPenisState[npc.penis];
	if (!landing) return null;
	const [orifice, depth] = landing;

	if (npcHasStrapon(slot)) return null;
	if (condomState(slot) === "worn") return null;
	if (playerChastity(orifice)) return null;
	const donorSpecies = !beast && V.enemytype === "man" ? "human" : npc.type;
	// canPlayerConceive treats an unlisted species as a bug and throws
	if (!setup.pregnancy.typesEnabled.includes(donorSpecies)) return null;

	// Beast widget makes knots more potent (_pregnancyBoost)
	// A size 1 penis dribbles at half potency
	let potency = 1;
	if (beast && T.pregnancyBoost) potency = 1 + T.pregnancyBoost / 100;
	else if (npc.penissize === 1) potency = 0.5;

	const load = inseminate(orifice, npc.fullDescription, donorSpecies, depth, V.location, potency, null);
	if (load) {
		const carrierAction = orifice === "vagina" ? V.vaginaaction : V.anusaction;
		instantConception(orifice, load, carrierAction === "forceImpregnation");
	}
	return load;
}
window.combatInseminate = combatInseminate;

/**
 * Conceive from a load right now. Creates the PC's pregnancy and displays the fetish mode banner.
 * Shared by the Force Impregnation action and the fetish pregnancy roll.
 *
 * @param {"vagina"|"anus"} orifice
 * @param {Load} load the load that conceives
 * @returns {number} the new pregnancyId
 */
function conceiveNow(orifice, load) {
	const pregnancyId = createPregnancy(
		"pc",
		"human",
		load.donor,
		load.donorSpecies,
		[{ name: load.donor, species: load.donorSpecies }],
		Time.date.timeStamp,
		orifice,
		load.location
	);
	if (V.settings.pregnancyType === "fetish") {
		setKnowsDonor(pregnancyId, "pc");
		setKnowsCarrier(pregnancyId, "pc");
		T.playerIsNowPregnant = load.donor;
	}
	return pregnancyId;
}

/**
 * Instant conception when a load lands. Demon PC's Force Impregnation action
 * conceives on the spot in every pregnancy mode. Fetish mode rolls the load's
 * realistic-mode odds in the moment.
 *
 * @param {"vagina"|"anus"} orifice
 * @param {Load} load the load that just landed
 * @param {boolean} [force=false] conceive unconditionally instead of the fetish-mode roll
 */
function instantConception(orifice, load, force = false) {
	const forced = force && !load.canWash;
	if (!forced && V.settings.pregnancyType !== "fetish") return;
	if (getActivePregnancies("pc").length) return;
	if (orificeHasParasites(orifice)) return;
	const won = forced ? load : fetishPregnancyRoll(load);
	if (won) conceiveNow(orifice, won);
}
window.instantConception = instantConception;

/**
 * Call this when a scene puts cum inside the player outside of combat.
 * Say who and where, the pregnancy system does the rest.
 *
 * For a creampie, `<<sceneInseminate "vagina" "Whitney" "human" "deep">>`
 *
 * For six loads lasting 12 days, `<<sceneInseminate "anus" "Harper's serum" "human" "deep" 6 12>>`
 *
 * @param {"vagina"|"anus"} orifice vagina or anus
 * @param {string} donor who it came from: an NPC's name, or "pc"
 * @param {DonorSpecies} donorSpecies the donor's species
 * @param {"outside"|"imminent"|"deep"} depth where it landed
 * @param {number} [quantity=1] how many loads. Optional (default = 1)
 * @param {number|null} [days] how long the loads last in days. Optional (default = 4 to 8 days)
 * @returns {Load|null} the last stored load. null = nothing was stored
 */
function sceneInseminate(orifice, donor, donorSpecies, depth, quantity = 1, days = null) {
	if (PregnancyConstants.depthWeight[depth] === undefined) throw new Error(`unknown depth "${depth}"`);
	if (!donorSpecies) throw new Error(`no donor species given for "${donor}"`);
	if (!setup.pregnancy.typesEnabled.includes(donorSpecies)) return null; // a quiet no for everyday non-impregnating species
	let lifespan = null;
	if (days !== null) lifespan = days * TimeConstants.secondsPerDay;
	let stored = null;
	for (let i = 0; i < quantity; i++) {
		const load = inseminate(orifice, donor, donorSpecies, depth, V.location, 1, lifespan);
		if (load === null) return null; // if the first load refuses, they all would
		stored = load;
		instantConception(orifice, load);
	}
	return stored;
}
window.sceneInseminate = sceneInseminate;

/**
 * Whether a generated NPC's pregnancy is followed to term, filing them in $storedNPCs if so.
 *
 * @param {number} slot the carrier's $NPCList slot
 * @param {string} location where it happened
 * @returns {string|null} the key to record their pregnancy under, null when the game lets them walk away
 */
function rememberRandomCarrier(slot, location) {
	if (V.consensual !== 1) return null;
	const followed = Object.keys(V.storedNPCs).reduce((count, key) => (getActivePregnancies(key).length ? count + 1 : count), 0);
	const keep = setup.pregnancy.randomAlwaysKeep.includes(location) ? followed <= 15 : followed <= 10 && random(0, 1 + followed) === 0;
	if (!keep) return null;
	return storeNPC(slot, "pregnancy");
}

/**
 * Call this when someone cums inside an NPC who could get pregnant from it.
 * One roll on the spot decides it, scaled by depth. NPCs store no loads, this roll is their whole conception.
 * An NPC with no pregnancy content written for them can only conceive when the player has turned unfinished content on.
 *
 * For a creampie, `<<npcPregnancyRoll "Robin" "human" "pc" "human" "vagina">>`
 *
 * For a spill that never went in, `<<npcPregnancyRoll "Robin" "human" "someone" "human" "vagina" "imminent">>`
 *
 * From a fight, pass the slot and it sorts named from generated NPCs itself:
 * `<<npcPregnancyRoll $NPCList[_nn].fullDescription $NPCList[_nn].type "pc" "human" "vagina" "deep" $location 1 _nn>>`
 *
 * @param {string} carrier the NPC who might get pregnant: a name, or a generated one like "lissome man"
 * @param {string} carrierSpecies what the carrier is, e.g. "human"
 * @param {string} donor who came inside them: an NPC's name, or "pc"
 * @param {DonorSpecies} donorSpecies the donor's species
 * @param {"vagina"|"anus"} orifice where the cum went
 * @param {"outside"|"imminent"|"deep"} [depth="deep"] where it landed. Can be left out for a creampie, a spill scales the chance down
 * @param {string} [location] where it happened. Left out reads the player's location, pass one when the scene runs off-screen
 * @param {number} [donorFertility=1] extra multiplier on the conception chance from the donor's side (e.g. the pc's low-semen or earSlime state)
 * @param {number|null} [slot=null] the carrier's $NPCList slot. A generated NPC in a slot is filed in $storedNPCs
 * @returns {number|null} the new pregnancyId. null = no conception, or a generated carrier the game does not follow
 */
function npcPregnancyRoll(carrier, carrierSpecies, donor, donorSpecies, orifice, depth = "deep", location = V.location, donorFertility = 1, slot = null) {
	const depthWeight = PregnancyConstants.depthWeight[depth];
	if (depthWeight === undefined) throw new Error(`unknown depth "${depth}"`);
	if (!donorSpecies) throw new Error(`no donor species given for "${donor}"`);
	if (!setup.pregnancy.typesEnabled.includes(donorSpecies)) return null; // a quiet no for everyday non-impregnating species
	const generated = slot !== null && !C.npc[carrier];
	if (generated && (V.NPCList[slot].pregnancy || !randomCarrierTypes.includes(carrierSpecies))) return null;
	if (getActivePregnancies(carrier).length) return null; // one pregnancy per body, as the player has
	// Unfinished pregnancy content toggle
	if (!V.settings.incompletePregnancyEnabled && C.npc[carrier] && !setup.pregnancy.canBePregnant.includes(carrier)) return null;
	// Dream sex leaves nothing behind, so a nightmare counts as a disabled scene.
	if (V.activeNightmare || impregnationDisabled(T.npcForceImpregnation)) return null;
	const infertile = setup.pregnancy.infertile.includes(carrier) || setup.pregnancy.infertile.includes(donor);
	if (!canNpcConceive(orifice, carrier, infertile)) return null;
	// GH bears eggs, BW bears pups
	const offspring = offspringSpecies(donorSpecies, carrierSpecies);
	if (!offspring) return null;
	// A forced impregnation skips the chance roll entirely.
	if (
		!T.npcForceImpregnation &&
		State.random() >=
			(V.settings.baseNpcPregnancyChance / 100) * depthWeight * npcMenstrualFertility(carrier) * npcConceptionModifier(carrier) * donorFertility
	)
		return null;

	// Fetish mode only, and only when the player is the donor/the one impregnating
	const playerImpregnated = donor === "pc" && V.settings.pregnancyType === "fetish";
	if (playerImpregnated) T.pregnantNpc = carrier; // the fetishPregnancyImg widget prints the banner from this
	let recorded = carrier;
	if (generated) {
		V.NPCList[slot].pregnancy = 1;
		recorded = rememberRandomCarrier(slot, location);
		if (recorded === null) return null;
	}

	const time = Time.date.timeStamp;
	const pregnancyId = createPregnancy(recorded, carrierSpecies, donor, offspring, [{ name: donor, species: donorSpecies }], time, orifice, location);
	if (playerImpregnated) {
		setKnowsDonor(pregnancyId, "pc");
		if (!generated) setKnowsCarrier(pregnancyId, "pc");
	}
	return pregnancyId;
}
window.npcPregnancyRoll = npcPregnancyRoll;

DefineMacro("combatInseminate", combatInseminate);
DefineMacro("sceneInseminate", sceneInseminate);
DefineMacro("npcPregnancyRoll", npcPregnancyRoll);
