/* Turns a new pregnancy record into its children/litter. */

/**
 * The child body base a donor's species produces: "human", "wolf", or "hawk".
 *
 * generateChildren calls this to set the litter's body from the donor.
 * resolvePaternity calls this to test a suspected donor's species against the litter.
 *
 * @param {DonorSpecies} donorSpecies the donor's species
 * @returns {ChildSpecies}
 */
function childBaseSpecies(donorSpecies) {
	switch (donorSpecies) {
		case "human":
			return "human";
		case "wolf":
		case "wolfboy":
		case "wolfgirl":
			return "wolf";
		case "hawk":
		case "harpy":
			return "hawk";
		default:
			throw new Error(`unknown donor species "${donorSpecies}"`);
	}
}
window.childBaseSpecies = childBaseSpecies;

/**
 * Whether the donor is a monster person, which gives the child the "monster" trait.
 * A monster person's species name always differs from their base species name.
 *
 * @param {DonorSpecies} donorSpecies
 * @returns {boolean}
 */
function isMonsterPerson(donorSpecies) {
	return childBaseSpecies(donorSpecies) !== donorSpecies;
}
window.isMonsterPerson = isMonsterPerson;

/**
 * Litter size for a species, drawn from its weighted distribution in childGen.
 *
 * @param {ChildSpecies} base child base species
 * @returns {number}
 */
function rollLitterSize(base) {
	return weightedRandom(...PregnancyConstants.childGen[`${base}LitterWeights`]);
}
window.rollLitterSize = rollLitterSize;

/**
 * A parent's gender and colours, read live from their name.
 * The parent is the PC, a known NPC, or an unknown generated donor with no stored details.
 *
 * @param {NpcNames|"pc"} name
 * @returns {ChildParent}
 */
function resolveChildParent(name) {
	if (name === "pc") {
		return { gender: V.player.sex, hairColour: V.naturalhaircolour, eyeColour: V.eyeselect, skinColour: Skin.color.natural };
	}
	const npc = C.npc[name];
	if (npc) {
		const hasVagina = npc.vagina !== "none";
		const hasPenis = npc.penis !== "none";
		let gender;
		if (hasVagina && hasPenis) gender = "h";
		else if (hasVagina) gender = "f";
		else if (hasPenis) gender = "m";
		else throw new Error(`parent "${name}" has no genitals`);
		let skinColour = npc.skincolour;
		if (skinColour === "black") skinColour = "dark";
		else if (skinColour === "white") skinColour = "light";
		return { gender, hairColour: npc.hairColour, eyeColour: npc.eyeColour, skinColour };
	}
	// an unknown generated donor has nothing stored to inherit from
	return { gender: null, hairColour: null, eyeColour: null, skinColour: null };
}
window.resolveChildParent = resolveChildParent;

/**
 * A child's gender. Even 50/50 male/female split.
 * A herm parent gives a 1/4 chance of a herm child, or 100% chance for herm self-pregnancy.
 *
 * @param {ChildParent} carrierParent
 * @param {ChildParent} donorParent
 * @param {boolean} sameParent
 * @returns {"m"|"f"|"h"}
 */
function rollChildGender(carrierParent, donorParent, sameParent) {
	const parentIsHerm = carrierParent.gender === "h" || donorParent.gender === "h";
	if (parentIsHerm && (sameParent || random(1, 100) <= PregnancyConstants.childGen.hermChildPercent)) return "h";
	return random(0, 1) === 0 ? "m" : "f";
}
window.rollChildGender = rollChildGender;

/**
 * The PC's beast and divine transformations, passed to their litter.
 *
 * @returns {{beast: "cat"|"cow"|"wolf"|"bird"|"fox"|null, divine: "angel"|"fallen"|"demon"|null}}
 */
function pcHeritage() {
	let beast = null;
	if (V.cat >= 6) beast = "cat";
	else if (V.cow >= 6) beast = "cow";
	else if (V.wolfgirl >= 6) beast = "wolf";
	else if (V.harpy >= 6) beast = "bird";
	else if (V.fox >= 6) beast = "fox";

	// Fallen needs to be checked before angel
	let divine = null;
	if (V.fallenangel >= 4) divine = "fallen";
	else if (V.angel >= 6) divine = "angel";
	else if (V.demon >= 6) divine = "demon";

	return { beast, divine };
}
window.pcHeritage = pcHeritage;

/**
 * A child's size, weighted toward the pc's build. Half the time it matches, otherwise it's a step
 * smaller or larger. NPC carriers with no build roll evenly.
 *
 * @param {0|1|2|3|undefined} bodySize the carrier's build
 * @returns {"tiny"|"small"|"normal"|"large"}
 */
function rollChildSize(bodySize) {
	const childSizes = PregnancyConstants.genePool.childSize;
	if (bodySize === undefined) return childSizes.random();
	const roll = random(1, 100);
	const step = roll <= PregnancyConstants.childGen.childSizeSameMax ? 0 : roll <= PregnancyConstants.childGen.childSizeSmallerMax ? -1 : 1;
	return childSizes[Math.clamp(bodySize + step, 0, childSizes.length - 1)];
}

/**
 * A child's trait, taken from one parent at random, with a fallback when that parent has none (an unknown donor).
 *
 * @param {*} carrierVal the carrier parent's value for this trait
 * @param {*} donorVal the donor parent's value for this trait
 * @param {Function} fallback produces a value when the donor is not known
 * @returns {*} the inherited trait, or fallback() trait if donor is not known
 */
function inheritTrait(carrierVal, donorVal, fallback) {
	const inherited = random(0, 1) === 0 ? carrierVal : donorVal;
	return inherited || fallback();
}

/**
 * A child's eye colour: inherit from a parent, or roll the eye-colour pool for an unknown parent.
 *
 * @param {ChildParent} carrierParent
 * @param {ChildParent} donorParent
 * @returns {string}
 */
function rollChildEyeColour(carrierParent, donorParent) {
	return inheritTrait(carrierParent.eyeColour, donorParent.eyeColour, () => PregnancyConstants.genePool.eyeColour.random());
}
window.rollChildEyeColour = rollChildEyeColour;

/**
 * A child's skin colour: inherit from a parent, or fall back to the darkSkinChance roll.
 *
 * @param {ChildParent} carrierParent
 * @param {ChildParent} donorParent
 * @returns {string}
 */
function rollChildSkinColour(carrierParent, donorParent) {
	return inheritTrait(carrierParent.skinColour, donorParent.skinColour, () => (random(1, 100) <= V.settings.darkSkinChance ? "dark" : "light"));
}
window.rollChildSkinColour = rollChildSkinColour;

/**
 * A child's hair colour. Wolf pups take a fur colour, hawk chicks take a feather colour,
 * and humans inherit a parent's hair or roll the hair pool.
 *
 * @param {ChildSpecies} base
 * @param {ChildParent} carrierParent
 * @param {ChildParent} donorParent
 * @param {string[]} wolfFur the fur colours a wolf pup can be this litter
 * @returns {string}
 */
function rollChildHairColour(base, carrierParent, donorParent, wolfFur) {
	if (base === "wolf") return wolfFur.random();
	if (base === "hawk") return PregnancyConstants.genePool.hawkFeather.random();
	return inheritTrait(carrierParent.hairColour, donorParent.hairColour, () => PregnancyConstants.genePool.hairColour.random());
}
window.rollChildHairColour = rollChildHairColour;

/**
 * Returns colour if given, otherwise a random eye colour from the gene pool.
 *
 * @param {string} [colour] a specific eye colour, or falsy to roll one
 * @returns {string}
 */
function eyeColourCalc(colour) {
	if (colour) return colour;
	return PregnancyConstants.genePool.eyeColour.random();
}
window.eyeColourCalc = eyeColourCalc;

/**
 * Create the child/children for a new pregnancy record. Called once per pregnancy from createPregnancy.
 *
 * @param {number} pregnancyId
 */
function generateChildren(pregnancyId) {
	const pregnancy = V.pregnancies[pregnancyId];
	const base = childBaseSpecies(pregnancy.donorSpecies);
	const isMonster = isMonsterPerson(pregnancy.donorSpecies);
	let litterSize = rollLitterSize(base);
	// A harpy PC grows their clutch in advance (giveHarpyEggs). Its count replaces the rolled
	// litter size. createPregnancy clears the clutch afterwards.
	if (base === "hawk" && pregnancy.carrier === "pc" && V.harpyEggs) {
		litterSize = V.harpyEggs.count;
	}
	const carrierParent = resolveChildParent(pregnancy.carrier);
	const donorParent = resolveChildParent(pregnancy.donor);
	const sameParent = pregnancy.carrier === pregnancy.donor;
	// The player's beast/divine transformations only pass down when the player is actually a parent.
	const heritage = pregnancy.carrier === "pc" || pregnancy.donor === "pc" ? pcHeritage() : { beast: null, divine: null };
	const bodySize = pregnancy.carrier === "pc" ? V.bodysize : undefined;
	// The Black Wolf's pups are always black. Every other wolf rolls the fur pool.
	const wolfFur = pregnancy.carrier === "Black Wolf" || pregnancy.donor === "Black Wolf" ? ["black"] : PregnancyConstants.genePool.wolfFur;

	// Identical twins/triplets rolling for humans.
	// Self-impregnation births always make identical twins/triplets.
	// Twins have a 1/3 chance of being identical.
	// Triplets have a ~2/3 chance of being all fraternal, ~22% chance of two being identical, and ~11% chance of all being identical.
	let identicalCount = 0;
	if (base === "human" && litterSize > 1) {
		if (sameParent) {
			identicalCount = litterSize;
		} else if (random(1, 100) <= PregnancyConstants.childGen.identicalMultiplePercent) {
			identicalCount = 2;
			if (litterSize > 2 && random(1, 100) <= PregnancyConstants.childGen.identicalMultiplePercent) identicalCount = 3;
		}
	}

	const rollChildTraits = () => {
		const eyeColour = rollChildEyeColour(carrierParent, donorParent);
		const skinColour = rollChildSkinColour(carrierParent, donorParent);
		const hairColour = rollChildHairColour(base, carrierParent, donorParent, wolfFur);
		const features = {
			beastTransform: heritage.beast,
			divineTransform: heritage.divine,
			hairColour,
			eyeColour,
			skinColour,
			size: rollChildSize(bodySize),
		};
		if (isMonster) features.monster = "monster";
		return { gender: rollChildGender(carrierParent, donorParent, sameParent), features };
	};

	// Identical siblings are copies of one generated child and share an id that links them.
	// Every other child is rolled on its own.
	// identicalCount is 0, 2, or 3 (never exactly 1), so "there are identicals" is a single condition.
	const hasIdenticals = identicalCount > 1;
	const identicalId = hasIdenticals ? pregnancyId : null;
	const original = hasIdenticals ? rollChildTraits() : null;
	for (let i = 0; i < litterSize; i++) {
		if (i < identicalCount) {
			createChild(pregnancyId, base, clone(original.features), original.gender, identicalId);
		} else {
			const child = rollChildTraits();
			createChild(pregnancyId, base, child.features, child.gender, null);
		}
	}
}
window.generateChildren = generateChildren;

/**
 * Generates a baby's name from name pools.
 *
 * @param {string} name the child's name
 * @param {"m"|"f"|"h"} gender determines which name pool the name pulls from
 * @param {number} childId the child being named
 * @returns {string} the name, or "Unnamed" if every name is taken
 */
function generateBabyName(name, gender, childId) {
	if (!!name && name !== "Unnamed") {
		return name.replace(/[^a-zA-ZÀ-ÿ\u4e00-\u9fa5 ]+/g, "").substring(0, 30);
	}
	const usedNames = new Set();
	getBornChildren().forEach(child => {
		if (child.childId !== childId && child.name !== "Unnamed") usedNames.add(child.name);
	});
	let names = [];
	switch (gender) {
		case "m":
			// eslint-disable-next-line prettier/prettier
			names = ['Addison','Algernon','Allan','Alpha','Anton','Axel','Bazza','Benton','Bernard','Brand','Brett','Cale','Calvin','Carol','Chuck','Chucky','Clay','Cornelius','Crofton','Darden','Dax','Den','Deven','Digby','Don','Douglas','Driscoll','Duane','Duke','Edmund','Elsdon','Freeman','Gabby','Garland','George','Godfrey','Graeme','Grier','Hammond','Harlan','Hendrix','Herman','Hewie','Hugh','Indiana','Ingram','Jackie','Jasper','Jaxon','Jaycob','Jere','Kamden','Kelcey','Kendall','Kevin','Kian','Kieran','Kirby','Lanny','Lawson','Laz','Leland','Levi','Lindon','Linton','Lionel','Lonny','Lucas','Manley','Maverick','Merlyn','Michael','Monty','Murphy','Nate','Ned','Nowell','Odell','Ollie','Osbert','Otto','Paget','Pip','Quintin','Raymund','Ricky','Robert','Ross','Rudolph','Sammy','Scotty','Stacey','Thad','Theodore','Tommy','Trey','Tyson','Val','Vernon','Willis','Wilmer','Winton','Wisdom'];
			break;
		case "f":
			// eslint-disable-next-line prettier/prettier
			names = ['Adelyn','Alene','Alexa','Aliah','Alyson','Angelica','Annalise','Annora','Azaria','Bessie','Betsy','Bettie','Biddy','Brianne','Camellia','Camille','Camryn','Caroline','Chastity','Chelsea','Chelsey','Cindy','Clematis','Darla','Deb','Debby','Dortha','Eleanora','Eliana','Elsabeth','Elyse','Emerson','Emmeline','Erica','Ettie','Eustacia','Evelyn','Gabrielle','Georgiana','Harper','Harrietta','Haylie','Haze','Hunter','Hyacinth','Indiana','Indie','Jacquetta','Janie','Jannine','Jonquil','Kaelyn','Kam','Khloe','Kolleen','Korrine','Kourtney','Krystine','Lavena','Leeann','Lela','Lesleigh','Lindsie','Lorena','Lucile','Luvinia','Lyn','Lyssa','Madeleine','Marian','Maudie','Maureen','Maxine','Melody','Milani','Misti','Nat','Noelle','Ottoline','Paige','Pauline','Payton','Pearl','Perlie','Petronel','Phebe','Posie','Praise','Rexana','Serena','Sharalyn','Sharla','Shauna','Sky','Sybella','Tracy','Tresha','Trudi','Wallis','Wilda','Yvette'];
			break;
	}
	// eslint-disable-next-line prettier/prettier
	names.pushUnique('Aaren','Addison','Alex','Alpha','Andie','Arden','Ariel','Artie','Ashton','Aston','Aubrey','Beau','Bernie','Bertie','Beverly','Bobbie','Brooklyn','Caelan','Cameron','Carol','Cary','Casey','Channing','Charley','Cherokee','Cheyenne','Coby','Codie','Collyn','Cyan','Dale','Dallas','Dana','Darby','Dee','Derby','Devan','Devin','Emmerson','Emory','Finley','Flannery','Florence','Gabby','Garnet','Garnett','Gray','Hadyn','Harlow','Hollis','Jackie','Jade','Jae','Jaiden','Johnnie','Joyce','Justice','Kam','Kelcey','Kelsey','Leslie','Lindsey','Lorin','Lyric','Maitland','Marley','McKinley','Merlyn','Murphy','Nicky','Oakley','Odell','Pacey','Paget','Peyton','Presley','Rain','Raleigh','Reagan','Regan','Reilly','Remington','Robbie','Rory','Royale','Sage','Sam','Schuyler','Selby','Shae','Shaye','Shelly','Skylar','Sloan','Stacey','Stacy','Tayler','Tommie','Tracey','Tristen','Tristin','Val');
	names = names.filter(name => !usedNames.has(name));

	let result = names[random(0, names.length - 1)];
	if (!result) result = "Unnamed";
	return result;
}
window.generateBabyName = generateBabyName;
