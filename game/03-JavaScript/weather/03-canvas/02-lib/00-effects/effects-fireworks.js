/*
	Fireworks! A shell rises, dies at its apex, and onDestroy spawns the burst there.
*/
Weather.Renderer.Effects.add({
	name: "fireworks",
	defaultParameters: {
		launchesPerMinute: 16,
		apexMin: 0.1, // fraction of canvas height from the top
		apexMax: 0.4,
		launchPadding: 4, // px

		shellGravity: 40, // px/s^2
		shellSize: 1,
		shellColour: "#fff3c4",
		trailRate: 80, // sparks/s
		trailLife: 0.4, // s
		trailAlpha: 0.5,
		trailGravity: 10, // px/s^2

		burstCount: 28,
		burstSpeedMin: 30, // px/s
		burstSpeedMax: 45,
		burstDrag: 0.0015,
		burstCreep: 0.9, // px/s
		burstGravity: 14, // px/s^2
		burstLifetime: 2.6, // s
		burstFadeStart: 0.9, // s
		blinkRateMin: 7, // Hz
		blinkRateMax: 13,
		blinkLow: 0.2,
		sparkSize: 1,
		sparkFlashSize: 2.5, // opening size, shrinks to sparkSize
		sparkFlashTime: 0.4, // s
		depthScale: 0.4,
		rayLength: 0.7,
		rayAlpha: 0.35,
		glow: 2.5, // shadowBlur px
		burstSaturation: 90, // %, random hue
		burstLightness: 65, // %
	},

	init() {
		const rate = this.parentLayer.animationGroup.updateRate;
		const ticker = new Weather.Renderer.Animation({
			image: new BaseCanvas(1, 1).element,
			canvas: this.canvas,
			numFrames: 1,
			frameDelay: rate,
			offset: 0,
			alwaysDisplay: false,
			condition: () => this.drawCondition(),
		});
		this.parentLayer.animationGroup.add(`${this.id}_ticker`, ticker);
		ticker.enable();

		this.deltaTime = rate / 1000;
		this.emitters = [];

		this.burst = (x, y) => {
			const em = new Weather.Renderer.ParticleEmitter(this.canvas.ctx, {
				origin: { x, y },
				maxParticles: this.burstCount,
				spawnInterval: 0.0001,
				autoDestroy: true,
				initialSettings: {
					shape: "circle",
					size: { w: this.sparkSize, h: this.sparkSize },
					color: `hsl(${Math.random() * 360}, ${this.burstSaturation}%, ${this.burstLightness}%)`,
					gravity: this.burstGravity,
					fade: false,
					lifetime: this.burstLifetime,
				},
				generator: () => {
					const angle = Math.random() * Math.PI * 2;
					const speed = this.burstSpeedMin + Math.random() * (this.burstSpeedMax - this.burstSpeedMin);
					return { velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed } };
				},
				onUpdate: (p, dt) => {
					if (p.age <= dt * 1.5) {
						p.depth = Math.random() * 2 - 1;
						const r = Math.sqrt(1 - p.depth * p.depth);
						p.position.x -= p.velocity.x * dt * (1 - r);
						p.position.y -= p.velocity.y * dt * (1 - r);
						p.velocity.x *= r;
						p.velocity.y *= r;

						const mag = Math.hypot(p.velocity.x, p.velocity.y) || 1;
						p.creepX = (p.velocity.x / mag) * this.burstCreep * r;
						p.creepY = (p.velocity.y / mag) * this.burstCreep * r;
						p.blinkFreq = (this.blinkRateMin + Math.random() * (this.blinkRateMax - this.blinkRateMin)) * Math.PI * 2;
						p.blinkPhase = Math.random() * Math.PI * 2;
					}

					const k = Math.pow(this.burstDrag, dt);
					p.velocity.x *= k;
					p.velocity.y *= k;
					p.position.x += p.creepX * dt;
					p.position.y += p.creepY * dt;

					const t = Math.min(1, p.age / this.sparkFlashTime);
					p.size.w = p.size.h = (this.sparkFlashSize + (this.sparkSize - this.sparkFlashSize) * t) * (1 + p.depth * this.depthScale);

					let alpha = 1;
					if (p.age > this.burstFadeStart) {
						alpha = Math.max(0, 1 - (p.age - this.burstFadeStart) / (this.burstLifetime - this.burstFadeStart));
						if (Math.sin(p.age * p.blinkFreq + p.blinkPhase) < -0.3) alpha *= this.blinkLow;
					}
					p.alpha = alpha;
				},
				animationGroup: this.parentLayer.animationGroup,
			});
			em.rays = true;
			em.enable();
			this.emitters.push(em);
		};

		this.launch = () => {
			const w = this.canvas.element.width;
			const h = this.canvas.element.height;
			const x = this.launchPadding + Math.random() * (w - this.launchPadding * 2);
			const climb = h * (1 - this.apexMin - Math.random() * (this.apexMax - this.apexMin));
			// v = sqrt(2gh): vertical speed hits zero at the apex, after v/g seconds
			const v = Math.sqrt(2 * this.shellGravity * climb);
			const trail = new Weather.Renderer.ParticleEmitter(this.canvas.ctx, {
				origin: { x, y: h },
				maxParticles: Math.ceil(this.trailRate * this.trailLife) + 1,
				spawnRate: this.trailRate,
				autoDestroy: true,
				initialSettings: {
					shape: "circle",
					size: { w: 1, h: 1 },
					color: this.shellColour,
					alpha: this.trailAlpha,
					gravity: this.trailGravity,
					lifetime: this.trailLife,
					fadeTime: this.trailLife,
				},
				generator: () => ({ velocity: { x: (Math.random() - 0.5) * 4, y: Math.random() * 4 } }),
				animationGroup: this.parentLayer.animationGroup,
			});

			const em = new Weather.Renderer.ParticleEmitter(this.canvas.ctx, {
				origin: { x, y: h },
				maxParticles: 1,
				spawnInterval: 0.0001,
				autoDestroy: true,
				initialSettings: {
					shape: "circle",
					size: { w: this.shellSize, h: this.shellSize },
					color: this.shellColour,
					gravity: this.shellGravity,
					fade: false,
					lifetime: v / this.shellGravity,
				},
				generator: () => ({ velocity: { x: (Math.random() - 0.5) * 3, y: -v } }),
				onUpdate: p => {
					trail.origin.x = p.position.x;
					trail.origin.y = p.position.y;
				},
				onDestroy: p => {
					trail.spawnRate = null;
					this.burst(p.position.x, p.position.y);
				},
				animationGroup: this.parentLayer.animationGroup,
			});
			trail.enable();
			em.enable();
			this.emitters.push(trail, em);
		};
	},

	draw() {
		this.canvas.clear();

		if (Math.random() < (this.launchesPerMinute / 60) * this.deltaTime) this.launch();

		const ctx = this.canvas.ctx;
		ctx.shadowBlur = this.glow;
		for (const em of this.emitters) {
			if (em.spawnInterval != null && em.particles.length >= em.maxParticles) em.spawnInterval = null;
			ctx.shadowColor = em.initialSettings.color;
			if (em.rays) {
				ctx.strokeStyle = em.initialSettings.color;
				ctx.lineWidth = 1;
				for (const p of em.particles) {
					ctx.globalAlpha = p.alpha * this.rayAlpha;
					ctx.beginPath();
					ctx.moveTo(p.position.x - (p.position.x - em.origin.x) * this.rayLength, p.position.y - (p.position.y - em.origin.y) * this.rayLength);
					ctx.lineTo(p.position.x, p.position.y);
					ctx.stroke();
				}
				ctx.globalAlpha = 1;
			}
			em.draw();
		}
		ctx.shadowBlur = 0;
		this.emitters = this.emitters.filter(em => em.spawnRate != null || em.spawnInterval != null || em.particles.length > 0);
	},

	onDisable() {
		for (const em of this.emitters) em.destroy();
		this.emitters = [];
	},
});
