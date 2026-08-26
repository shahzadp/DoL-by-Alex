// eligibility.js checks anatomy, settings, and scene flags and answers if pregnancy can happen here.

/**
 * The pregnancy eligibility that doesn't depend on the orifice or the act. The conception gate and the
 * compatibility checks both run through this. The infertile and unfinished-content lists only hold named
 * NPCs, so a generated NPC passes them.
 *
 * @param {string} name the donor's name, or "pc"
 * @param {DonorSpecies} species the donor's species
 * @param {boolean} forced a forced impregnation bypasses disableNormalImpregnation
 * @returns {boolean}
 */
function playerPregnancyEligible(name, species, forced) {
	if (impregnationDisabled(forced)) return false;
	if (!playerSpeciesPregnancyEnabled(species)) return false;
	if (setup.pregnancy.infertile.includes(name)) return false;
	if (V.settings.incompletePregnancyEnabled === false && C.npc[name] && !setup.pregnancy.canImpregnatePlayer.includes(name)) return false;
	return true;
}
window.playerPregnancyEligible = playerPregnancyEligible;

/**
 * Can the player conceive from this donor here? Yes or no. Impregnation must be enabled, a named
 * donor must have finished pregnancy content (unless the unfinished-content toggle is on), the
 * species must be enabled, the anus has rules, and neither party is infertile.
 * An unknown orifice throws. An unknown species throws.
 *
 * @param {"vagina"|"anus"} orifice which impregnable hole the cum went in
 * @param {string} donor who came inside: an NPC's name, or "pc"
 * @param {DonorSpecies} donorSpecies the donor's species, so the right pregnancy setting gets checked
 * @returns {boolean}
 */
function canPlayerConceive(orifice, donor, donorSpecies) {
	if (orifice !== "vagina" && orifice !== "anus") throw new Error(`unknown orifice "${orifice}"`);
	childBaseSpecies(donorSpecies); // throws on unknown species
	// Forced impregnation ignores disableNormalImpregnation.
	const forced = (orifice === "vagina" && V.vaginaaction === "forceImpregnation") || (orifice === "anus" && V.anusaction === "forceImpregnation");
	if (!playerPregnancyEligible(donor, donorSpecies, forced)) return false;
	if (orifice === "anus" && !playerCanCarryAnally()) return false;
	return true;
}
window.canPlayerConceive = canPlayerConceive;

/**
 * Can this NPC conceive here? Yes or no. Proper settings must be on and the anus has rules.
 * An unknown orifice throws.
 *
 * @param {"vagina"|"anus"} orifice which impregnable hole the cum went in
 * @param {string} carrier the NPC's name
 * @param {boolean} infertile is the carrier or the other party flagged infertile
 * @returns {boolean}
 */
function canNpcConceive(orifice, carrier, infertile) {
	if (orifice !== "vagina" && orifice !== "anus") throw new Error(`unknown orifice "${orifice}"`);
	if (!(C.npc[carrier] ? V.settings.nnpcPregnancyEnabled : V.settings.npcPregnancyEnabled)) return false;
	// A named NPC the player toggled off stays off — the compatibility check enforces this, the roll must too.
	if (C.npc[carrier] && C.npc[carrier].pregnancy && C.npc[carrier].pregnancy.enabled === false) return false;
	if (orifice === "anus") {
		if (!V.settings.npcAnalPregnancyEnabled) return false;
		if (C.npc[carrier] && C.npc[carrier].pregnancy && C.npc[carrier].pregnancy.analEnabled === false) return false;
	}
	return !infertile;
}
window.canNpcConceive = canNpcConceive;

/**
 * Whether the impregnation is disabled. A forced impregnation ignores disableNormalImpregnation.
 *
 * @param {boolean} forced whether this is a forced impregnation
 * @returns {boolean}
 */
function impregnationDisabled(forced) {
	if (V.disableImpregnation) return true;
	if (V.disableNormalImpregnation && !forced) return true;
	return false;
}
window.impregnationDisabled = impregnationDisabled;

/**
 * Whether the player's pregnancy settings permit carrying a pregnancy of this species.
 *
 * @param {DonorSpecies} species the donor's species
 * @returns {boolean}
 */
function playerSpeciesPregnancyEnabled(species) {
	switch (species) {
		case "human":
			return V.settings.playerPregnancyHumanEnabled !== false;
		case "wolf":
		case "wolfboy":
		case "wolfgirl":
			return V.settings.playerPregnancyBeastEnabled !== false;
		case "hawk":
		case "harpy":
			return V.settings.playerPregnancyBeastEnabled !== false && V.settings.playerPregnancyEggLayingEnabled !== false;
		default:
			return false;
	}
}
window.playerSpeciesPregnancyEnabled = playerSpeciesPregnancyEnabled;

/**
 * Whether pc has acquired a way to carry an anal pregnancy, like the magic tattoo or earslime.
 * This is what "exceptional circumstances" means. Always false while pc has a vagina.
 *
 * @returns {boolean}
 */
function hasExceptionalAnalPregnancy() {
	return !V.player.vaginaExist && (hasPregnancyTattoo() || (V.earSlime.growth >= 100 && ["pregnancy", "mixed"].includes(V.earSlime.focus)));
}

/**
 * Whether the PC wears the magic pregnancy tattoo, which raises conception. It no longer touches the
 * cycle's pace -- the cycle runs at one day per day whatever is worn.
 *
 * @returns {boolean}
 */
function hasPregnancyTattoo() {
	return V.skin.pubic.pen === "magic" && V.skin.pubic.special === "pregnancy";
}
window.hasPregnancyTattoo = hasPregnancyTattoo;
window.hasExceptionalAnalPregnancy = hasExceptionalAnalPregnancy;

/**
 * Whether pc can carry a pregnancy anally right now. "always" treats it like any other pregnancy,
 * "exceptional" needs one of the acquired methods (earslime, magic tattoo), and false disables it.
 *
 * @returns {boolean}
 */
function playerCanCarryAnally() {
	if (V.settings.analPregnancy === "always") return true;
	if (V.settings.analPregnancy === "exceptional") return hasExceptionalAnalPregnancy();
	return false;
}
window.playerCanCarryAnally = playerCanCarryAnally;

/**
 * Whether the player can breed with the given NPC. For NPC breeding lines only.
 *
 * Accepts either a named NPC's name or an NPC object (from $NPCList or $NPCName), e.g.
 * playerCanBreedWith("Kylar"), playerCanBreedWith($NPCList[0]), or playerCanBreedWith(C.npc.Kylar).
 *
 * @param {string|object} NPC the NPC's name, or an NPC object from $NPCList / $NPCName
 * @returns {boolean}
 */
function playerCanBreedWith(NPC) {
	const { npc: resolvedNpc, name } = resolvePregnancyNpc(NPC);
	if (!resolvedNpc) return false;

	const playerCanCarry = V.player.vaginaExist || (playerCanCarryAnally() && C.npc[name] && knowsAboutAnyPregnancy("pc", name));
	const npcBreedsPlayer = playerCanCarry && resolvedNpc.penis !== "none";
	const playerBreedsNpc = V.player.penisExist && resolvedNpc.vagina !== "none";
	return npcBreedsPlayer || playerBreedsNpc;
}
window.playerCanBreedWith = playerCanBreedWith;

/**
 * Whether the player or NPC can conceive.
 *
 * @param {string|object} NPC a named NPC's name, or an NPC object
 * @returns {boolean}
 */
function pregnancyCompatible(NPC) {
	return playerPregnancyPossibleWith(NPC) || NPCPregnancyPossibleWithPlayer(NPC);
}
window.pregnancyCompatible = pregnancyCompatible;

/**
 * Normalizes an NPC argument into one { npc, name, named } shape. `npc` is the resolved NPC, or null.
 * `name` is its key. `named` is true for a persistent named NPC, false for a generated scene one. The
 * `*PossibleWith` consumers read `named` to apply the named-only rules (infertility, unfinished content).
 *
 * @param {string|object} NPC a named NPC's name, or an NPC object
 * @returns {{npc: object|null, name: string, named: boolean}}
 */
function resolvePregnancyNpc(NPC) {
	// A string is its own name; an NPC object's name is its fullDescription.
	const name = typeof NPC === "string" ? NPC : NPC?.fullDescription;
	// A named NPC is one listed in NPCNameList, with its entry in NPCName at the same index.
	const index = V.NPCNameList.indexOf(name);
	if (index !== -1) {
		const npc = V.NPCName[index];
		if (npc) return { npc, name: npc.fullDescription || npc.description, named: true };
		return { npc: null, name: "", named: false };
	}
	// A generated scene NPC isn't in the list; it's passed as the object itself.
	if (typeof NPC === "object" && NPC !== null && !Array.isArray(NPC)) return { npc: NPC, name: NPC.fullDescription, named: false };
	return { npc: null, name: "", named: false };
}
window.resolvePregnancyNpc = resolvePregnancyNpc;

/**
 * Whether the player could get pregnant by this NPC.
 *
 * @param {string|object} NPC a named NPC's name, or an NPC object (a scene $NPCList entry or a V.NPCName entry)
 * @returns {boolean}
 */
function playerPregnancyPossibleWith(NPC) {
	const { npc: resolvedNpc, name } = resolvePregnancyNpc(NPC);
	if (!resolvedNpc) return false;
	if (!playerPregnancyEligible(name, resolvedNpc.type, true)) return false;
	if (playerIsPregnant() || getParasiteObject().fetus.length) return false;
	if (!(V.player.vaginaExist || playerCanCarryAnally())) return false;
	if (resolvedNpc.gender !== "m" && resolvedNpc.gender !== "h") return false;
	if ("strapon" in resolvedNpc) return false;
	return true;
}
window.playerPregnancyPossibleWith = playerPregnancyPossibleWith;

/**
 * Whether this NPC could get pregnant by the player.
 *
 * @param {string|object} NPC a named NPC's name, or an NPC object (a scene $NPCList entry or a V.NPCName entry)
 * @returns {boolean}
 */
function NPCPregnancyPossibleWithPlayer(NPC) {
	const { npc: resolvedNpc, name, named } = resolvePregnancyNpc(NPC);
	if (!resolvedNpc) return false;
	if (impregnationDisabled(true)) return false;
	if (named) {
		if (!C.npc[name]) {
			Errors.report("Named NPC " + name + " is undefined for pregnancy compatibility check.");
			return false;
		}
		// Infertility only applies to named NPCs.
		if (setup.pregnancy.infertile.includes(name) || !resolvedNpc.pregnancy.enabled) return false;
		if (getActivePregnancies(name).length) return false;
	} else if (resolvedNpc.pregnancy) {
		return false;
	}
	if ((named ? V.settings.nnpcPregnancyEnabled : V.settings.npcPregnancyEnabled) === false) return false;
	if (!setup.pregnancy.typesEnabled.includes(resolvedNpc.type)) return false;
	if (!V.player.penisExist) return false;
	// A male NPC can carry only anally, so it needs the NPC anal and pregnancy toggle.
	if (resolvedNpc.gender === "m") {
		if (!V.settings.npcAnalPregnancyEnabled) return false;
		if (named && resolvedNpc.pregnancy.analEnabled === false) return false;
	}
	return true;
}
window.NPCPregnancyPossibleWithPlayer = NPCPregnancyPossibleWithPlayer;
