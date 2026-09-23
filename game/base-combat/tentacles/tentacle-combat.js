function sortTentaclesByDescription() {
	const tentacles = Object.keys(V.tentacles)
		.filter(t => !isNaN(t))
		.map(t => V.tentacles[t]);
	tentacles.sort((a, b) => a.desc.localeCompare(b.desc));
	tentacles.forEach((tentacle, i) => {
		V.tentacles[i] = tentacle;
	});
}
window.sortTentaclesByDescription = sortTentaclesByDescription;
