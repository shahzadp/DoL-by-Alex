// @ts-check

/**
 * Resolves named NPC-specific ejaculation macros.
 *
 * This helper allows callers to use a single lookup instead of repeating
 * named NPC checks. If a matching macro such as <<ejaculation-robin>>
 * exists for the resolved NPC name, it is returned for direct use.
 *
 * @param {string | number} index NPC index or identifier.
 * @param {...string} args Optional extra macro arguments.
 * @returns {string} Matching named NPC ejaculation macro, or an empty string if none applies.
 */
function namedNpcEjaculation(index, ...args) {
	const npcName = V.npc[V.npcrow.indexOf(index)];
	const npc = V.NPCList[index];
	if (!npc) return "";
	const output = args[0] ? " " + args[0] : "";
	// Prefer NPC-specific ejaculation macros when available.
	if (npcName && Macro.has(`ejaculation-${npcName.toLowerCase()}`) && setup.NPCNameList.includes(npcName)) {
		return `<<ejaculation-${npcName.toLowerCase()}${output}>>`;
	} else {
		return "";
	}
}

window.namedNpcEjaculation = namedNpcEjaculation;
DefineMacroS("namedNpcEjaculation", namedNpcEjaculation);
