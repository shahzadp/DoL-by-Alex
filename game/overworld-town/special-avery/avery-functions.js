/**
 * Evaluates if Avery is in a state of hunt or not
 *
 * @returns {boolean} Whether Avery is currently hunting the player or not
 */
function isAveryHuntingPlayer() {
	return !!V.avery_mansion?.chase?.active;
}
window.isAveryHuntingPlayer = isAveryHuntingPlayer;

/**
 * Checks if Avery's mansion is unlocked.
 *
 * @returns {boolean} Indicates whether Avery's mansion is unlocked or not
 */
function isAveryMansionUnlocked() {
	return V.avery_mansion !== undefined;
}
window.isAveryMansionUnlocked = isAveryMansionUnlocked;

/**
 * Checks if Avery is inside the dungeon
 *
 * @returns {boolean} Indicates whether Avery is in the dungeon or not
 */
function isAveryInsideDungeon() {
	return V.avery_dungeon !== undefined;
}
window.isAveryInsideDungeon = isAveryInsideDungeon;

/**
 * Checks if Avery apologized at least once for hunting the player
 * Avery must have at least chased the player once and returned home with a bouquet of roses
 *
 * @returns {boolean} Indicates whether Avery apologized for hunting the player
 */
function hasAveryApologizedForChase() {
	return V.averySeen.includes("chase") && !V.avery_mansion?.rage?.apologetic;
}
window.hasAveryApologizedForChase = hasAveryApologizedForChase;
