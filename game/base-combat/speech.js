/*
 * Combat speech lines. A speaker is an NNPC ("Avery", "Whitney", etc.) or the player ("pc").
 * Each turn a speaker gathers the lines they can say into their own pool (T.speechPool[speaker]) and says one of them.
 * What each speaker has said this combat lives in $speechSaidLines and is unset by <<endevent>>.
 */

/* Speech categories. Categories have different priorities and cooldowns (how many turns the speaker takes
before saying a line of that category again). Categories without a cooldown can be said every turn. */
setup.speechCategories = {
	/* A virginity being taken is always highest priority. */
	virginity: { priority: 100 },

	/* Herm/crossdressing reveals are usually one-time and spoken the turn after the PC's genitals are seen. */
	reveal: { priority: 90 },

	/* An NNPC's paired reply to one of the PC's unique lines. */
	pairedReply: { priority: 85 },

	/* Used by Robin for recalling memories during sex */
	memory: { priority: 80 },

	/* These actions usually only happen once per combat: PC's parts being exposed, pregnant belly being noticed, sex toy being revealed, and penis size being discovered. */
	expose: { priority: 75 },
	penisSize: { priority: 75 },
	pregnant: { priority: 75 },
	sexToy: { priority: 75 },

	/* NNPC reacting to the PC's actions. */
	steal: { priority: 72 },
	namedrop: { priority: 71 },

	apologise: { priority: 70 },
	askRough: { priority: 70 },
	choked: { priority: 70 },
	cover: { priority: 70 },
	demand: { priority: 70 },
	escape: { priority: 70 },
	forgive: { priority: 70 },
	growl: { priority: 70 },
	lactate: { priority: 70 },
	masturbate: { priority: 70 },
	moan: { priority: 70 },
	mock: { priority: 70 },
	pepperSpray: { priority: 70 },
	playerHits: { priority: 70 },
	playerOrgasm: { priority: 70 },
	plead: { priority: 70 },
	screamForHelp: { priority: 70 },
	struggle: { priority: 70 },

	/* An NNPC's follow up line to something they said earlier. */
	followUp: { priority: 65 },

	/* NNPC hurting the PC. */
	choke: { priority: 60, cooldown: 3 },
	playerBeaten: { priority: 60, cooldown: 3 },
	spank: { priority: 60, cooldown: 3 },

	/* Ongoing acts. These come up every turn, they have a 3 turn cooldown. */
	arms: { priority: 10, cooldown: 3 },
	chastity: { priority: 10, cooldown: 3 },
	chest: { priority: 10, cooldown: 3 },
	fencing: { priority: 10, cooldown: 3 },
	fondle: { priority: 10, cooldown: 3 },
	footjob: { priority: 10, cooldown: 3 },
	hair: { priority: 10, cooldown: 3 },
	imminent: { priority: 10, cooldown: 3 },
	legLock: { priority: 10, cooldown: 3 },
	oral: { priority: 10, cooldown: 3 },
	penetrated: { priority: 10, cooldown: 3 },
	touch: { priority: 10, cooldown: 3 },
	toy: { priority: 10, cooldown: 3 },
	trib: { priority: 10, cooldown: 3 },
	vaginaFlaunt: { priority: 10, cooldown: 3 },
	withhold: { priority: 10, cooldown: 3 },

	/* Idle comments */
	idle: { priority: 5 },
};

/**
 * A line's ID is a hash of its text. Identical lines in different branches share an ID and count as said together.
 *
 * @param {string} content
 * @returns {string}
 */
function getSpeechLineId(content) {
	let hash = 5381;
	for (let i = 0; i < content.length; i++) hash = (Math.imul(hash, 33) ^ content.charCodeAt(i)) >>> 0;
	return hash.toString(36);
}

/**
 * @param {string} content the line
 * @param {string} category
 * @param {number} weight
 * @returns {SpeechLine}
 */
function createSpeechLine(content, category, weight) {
	return { content, category, weight, id: getSpeechLineId(content) };
}

/**
 * The speaker's turns this combat, oldest first. A turn they passed or said nothing has a null id and category.
 *
 * @param {SpeechSpeaker} speaker
 * @returns {SpeechHistoryEntry[]}
 */
function getSpeechHistory(speaker) {
	return V.speechSaidLines?.[speaker] ?? [];
}

/**
 * @param {SpeechSpeaker} speaker
 * @param {SpeechHistoryEntry} entry
 */
function addSpeechHistoryEntry(speaker, entry) {
	if (!V.speechSaidLines) V.speechSaidLines = {};
	if (!V.speechSaidLines[speaker]) V.speechSaidLines[speaker] = [];
	V.speechSaidLines[speaker].push(entry);
}

/**
 * Forgets which lines the speaker has said, but keeps each turn's category so cooldowns still count.
 *
 * @param {SpeechSpeaker} speaker
 */
function clearSpeechHistory(speaker) {
	V.speechSaidLines[speaker] = V.speechSaidLines[speaker].map(entry => ({ id: null, category: entry.category }));
}

/**
 * Whether the speaker said a line of this category while the category is cooling down.
 *
 * @param {SpeechSpeaker} speaker
 * @param {string} category
 * @returns {boolean}
 */
function isSpeechCategoryCoolingDown(speaker, category) {
	const { cooldown = 0 } = setup.speechCategories[category];
	if (cooldown === 0) return false;
	return getSpeechHistory(speaker)
		.slice(-cooldown)
		.some(entry => entry.category === category);
}

/**
 * Creates the speaker's pool if it doesn't exist yet.
 *
 * @param {SpeechSpeaker} speaker
 * @returns {SpeechPool}
 */
function getOrCreateSpeechPool(speaker) {
	if (!T.speechPool) T.speechPool = {};
	if (!T.speechPool[speaker]) T.speechPool[speaker] = { lines: [], canPass: false };
	return T.speechPool[speaker];
}

/**
 * @param {SpeechSpeaker} speaker
 * @returns {SpeechLine[]} the lines in the speaker's pool whose category is not on cooldown
 */
function getSayableSpeechLines(speaker) {
	return T.speechPool[speaker].lines.filter(line => !isSpeechCategoryCoolingDown(speaker, line.category));
}

/** @returns {boolean} Whether the open pool has a line the speaker can say now. */
function hasSpeechLines() {
	return getSayableSpeechLines(T.speechPoolSpeaker).length > 0;
}

/**
 * @param {SpeechSpeaker} speaker
 * @param {SpeechLine[]} lines
 * @returns {SpeechLine[]} the lines the speaker has not said this combat
 */
function getUnsaidSpeechLines(speaker, lines) {
	const history = getSpeechHistory(speaker);
	return lines.filter(line => !history.some(entry => entry.id === line.id));
}

/**
 * Keeps the highest priority lines and picks one by weight.
 *
 * @param {SpeechLine[]} lines
 * @returns {SpeechLine}
 */
function pickSpeechLine(lines) {
	const highestPriority = Math.max(...lines.map(line => setup.speechCategories[line.category].priority));
	return rollWeightedRandomFromArray(lines.filter(line => setup.speechCategories[line.category].priority === highestPriority));
}

/* <<speechPool speaker ["noMouthAction"]>>: opens the speaker's pool for this turn. */
Macro.add("speechPool", {
	handler() {
		const [speaker, passOption] = this.args;
		if (speaker !== "pc" && !setup.NPCNameList.includes(speaker)) return this.error(`needs "pc" or an NNPC's name, got "${speaker}"`);
		if (passOption !== undefined && passOption !== "noMouthAction")
			return this.error(`the second argument can only be "noMouthAction", got "${passOption}"`);
		getOrCreateSpeechPool(speaker).canPass = speaker !== "pc" && passOption !== "noMouthAction";
		T.speechPoolSpeaker = speaker;
	},
});

/* <<addSpeechLine category [weight]>>line<</addSpeechLine>>
Adds a line to the open pool. */
Macro.add("addSpeechLine", {
	tags: ["speechLine"],
	handler() {
		const [category, weight = 1] = this.args;
		if (!T.speechPoolSpeaker) return this.error("needs a <<speechPool>> first");
		if (!setup.speechCategories[category]) return this.error(`unknown speech category "${category}", add it to setup.speechCategories`);
		if (!(weight > 0)) return this.error(`the weight must be a number above 0, got "${weight}"`);
		const [shared, ...pieces] = this.payload;
		const contents = pieces.length === 0 ? [shared.contents] : pieces.map(piece => shared.contents + piece.contents);
		for (const content of contents) getOrCreateSpeechPool(T.speechPoolSpeaker).lines.push(createSpeechLine(content, category, weight));
	},
});

/* <<addPairedSpeechLine npc category>>
<<pcLine>>pc's line
<<npcLine>>nnpc's line
<</addPairedSpeechLine>>
Adds a PC line that pairs up with a NPC's reply to the NPC's pool. */
Macro.add("addPairedSpeechLine", {
	tags: ["pcLine", "npcLine"],
	handler() {
		const [replier, category] = this.args;
		const [, pcLine, npcLine] = this.payload;
		if (this.payload.length !== 3 || pcLine.name !== "pcLine" || npcLine.name !== "npcLine") return this.error("needs <<pcLine>> and then <<npcLine>>");
		if (!setup.NPCNameList.includes(replier)) return this.error(`needs the name of the NNPC who replies, got "${replier}"`);
		if (!T.speechPoolSpeaker) return this.error("needs a <<speechPool>> first");
		if (!setup.speechCategories[category]) return this.error(`unknown speech category "${category}", add it to setup.speechCategories`);
		const line = createSpeechLine(pcLine.contents, category, 1);
		line.reply = { speaker: replier, content: npcLine.contents };
		getOrCreateSpeechPool(T.speechPoolSpeaker).lines.push(line);
	},
});

/**
 * If a speaker can pass to mouth actions, rolls whether they will.
 * Always when there's nothing to say. 40% chance when only idle comments are left.
 *
 * @param {SpeechLine[]} lines the lines the speaker would pick from
 * @returns {boolean}
 */
function rollSpeechPass(lines) {
	if (lines.length === 0) return true;
	if (!lines.every(line => line.category === "idle")) return false;
	$.wiki("<<rng>>");
	return V.rng <= 40;
}

/* <<speechSay>>
Says a line from the open pool, or passes. */
Macro.add("speechSay", {
	handler() {
		if (!T.speechPoolSpeaker) return this.error("needs a <<speechPool>> first");
		const sayableLines = getSayableSpeechLines(T.speechPoolSpeaker);
		let lines = getUnsaidSpeechLines(T.speechPoolSpeaker, sayableLines);
		if (lines.length === 0 && sayableLines.length > 0) {
			const lastSaidId = getSpeechHistory(T.speechPoolSpeaker)
				.filter(entry => entry.id !== null)
				.at(-1).id;
			clearSpeechHistory(T.speechPoolSpeaker);
			lines = sayableLines.filter(line => line.id !== lastSaidId);
			if (lines.length === 0) lines = sayableLines;
		}
		const passed = T.speechPool[T.speechPoolSpeaker].canPass && rollSpeechPass(lines);
		if (passed || lines.length === 0) {
			addSpeechHistoryEntry(T.speechPoolSpeaker, { id: null, category: null });
			if (passed) T.noNameComment = true;
			return;
		}
		const line = pickSpeechLine(lines);
		addSpeechHistoryEntry(T.speechPoolSpeaker, { id: line.id, category: line.category });
		if (line.reply) getOrCreateSpeechPool(line.reply.speaker).lines.push(createSpeechLine(line.reply.content, "pairedReply", 1));
		$(this.output).wiki(line.content);
	},
});

window.hasSpeechLines = hasSpeechLines;
