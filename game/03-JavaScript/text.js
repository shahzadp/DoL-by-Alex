/* returns text without diacritics e.g. "crème brulee" -> "creme brulee" */
function removeDiacritics(text) {
	return text.normalize("NFKD").replace(/[^\w\s.-_\\/]/g, "");
}
window.removeDiacritics = removeDiacritics;

/* returns text in lowercase snake case e.g. crème_brulee */
function normaliseKey(text) {
	return text.replace(/[\s-]+/g, "_").toLowerCase();
}
window.normaliseKey = normaliseKey;

/* returns text in lowercase kebab case without diacritics e.g creme-brulee.png */
function normaliseFileName(text) {
	return removeDiacritics(text)
		.replace(/[\s-_]+/g, "-")
		.toLowerCase();
}
window.normaliseFileName = normaliseFileName;
