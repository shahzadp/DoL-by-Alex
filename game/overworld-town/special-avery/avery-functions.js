/**
 * Evaluates if Avery is in a state of hunt or not
 *
 * @returns {boolean} Whether Avery is currently hunting the player or not
 */
function isAveryHuntingPlayer() {
	return !!V.avery_mansion?.chase?.active;
}
window.isAveryHuntingPlayer = isAveryHuntingPlayer;

function averyPayout() {
	return (C.npc.Avery.love * 10 + V.endear * 10 + 10) * 100;
}
window.averyPayout = averyPayout;
