// Behavior « cosmos-animation » : séquence plein écran 16:9 sur fond spatial
// étoilé sans bordure, fidèle aux visuels paysage fournis.

/** @type {import('../../core/behaviors').Behavior} */
export default {
  onFound(ctx) {
    initScene(ctx)
    ctx.state.animTime = 0
    ctx.state.started = true
    if (ctx.state.ready) {
      ctx.state.leftMesh.visible = false
      ctx.state.rightMesh.visible = false
      ctx.state.cardMesh.visible = false
      ctx.state.cardGlowMat.uniforms.uOpacity.value = 0
    }
  },

  onLost(ctx) {
    ctx.state.started = false
  },

  onTap(ctx) {
    if (!ctx.state.ready) return
    ctx.state.animTime = 0
    ctx.state.started = true
  },

  onUpdate(ctx, _t, dt) {
    if (!ctx.state.ready || !ctx.state.started) return
    const brick = ctx.bricks.get('cosmos')
    if (!brick || !brick.shown) return

    ctx.state.animTime = (ctx.state.animTime || 0) + dt
    const time = Math.min(8.2, ctx.state.animTime)
    const {
      fondMesh,
      leftMesh,
      rightMesh,
      cardMesh,
      spaceBackdrop,
      backdropMat,
      nebulaMat,
      cardGlowMat,
      sparkleMat,
      leftBlink,
      rightBlink,
      leftPivot,
      rightPivot,
      cardPivot,
    } = ctx.state

    // -----------------------------------------------------------------------
    // Plein écran 16:9 en mode aperçu (zéro bordure, zéro barre noire, zéro marge).
    const W = 1.6
    const H = 0.9
    let stageScale = 1.0
    if (ctx.mode === 'preview') {
      const vw = typeof window !== 'undefined' ? window.innerWidth || 1280 : 1280
      const vh = typeof window !== 'undefined' ? window.innerHeight || 720 : 720
      const aspect = Math.max(0.3, vw / vh)
      if (!ctx.state.baseDist) ctx.state.baseDist = Math.max(0.5, ctx.view.distance - 0.03)
      const frustumH = 2 * ctx.state.baseDist * Math.tan((22.5 * Math.PI) / 180)
      const frustumW = frustumH * aspect
      stageScale = Math.min(frustumW / W, frustumH / H)
      spaceBackdrop.visible = true
      backdropMat.uniforms.uTime.value = time
    } else {
      spaceBackdrop.visible = false
    }

    brick.object3d.scale.setScalar(stageScale)
    brick.object3d.position.z = 0

    // -----------------------------------------------------------------------
    // 0–2s : Fond étoilé plein écran uniquement, lent push-in sur les étoiles et nébuleuses.
    // Le fond couvre 100 % du cadre bord à bord dès t=0 jusqu'à la fin.
    const pushP = clamp01(time / 2.0)
    const pushEase = easeInOutCubic(pushP)
    const finalBgScale = ctx.mode === 'preview' ? Math.max(1.0, coverScaleRatio()) : 1.0

    fondMesh.visible = true
    fondMesh.material.opacity = 1
    fondMesh.scale.set(finalBgScale, finalBgScale, 1)
    fondMesh.position.set(0, 0, 0)

    const pushLayerScale = mix(0.88, 1.0, pushEase)
    ctx.state.nebulaMesh.scale.set(finalBgScale * pushLayerScale, finalBgScale * pushLayerScale, 1)
    ctx.state.sparkles.scale.setScalar(pushLayerScale)

    const endFade = 1 - clamp01((time - 7.1) / 0.85)
    nebulaMat.uniforms.uTime.value = time
    nebulaMat.uniforms.uOpacity.value = 0.22 * endFade

    // -----------------------------------------------------------------------
    // 2–4.5s : Les deux mascottes bondissent depuis le fond vers le spectateur
    // avec squash-and-stretch et rebond, puis atterrissent de chaque côté.
    // 4.5–6.5s : Pose joyeuse, clignement des yeux et petites étincelles.
    animateMascot(leftMesh, leftPivot, leftBlink, time, {
      startTime: 2.0,
      startX: -0.22,
      startY: 0.06,
      startZ: 0.015,
      endZ: 0.08,
      leanDir: -1,
      blinkTimes: [4.95, 5.88],
    })

    animateMascot(rightMesh, rightPivot, rightBlink, time, {
      startTime: 2.06,
      startX: 0.22,
      startY: 0.06,
      startZ: 0.015,
      endZ: 0.08,
      leanDir: 1,
      blinkTimes: [5.12, 6.06],
    })

    // -----------------------------------------------------------------------
    // 6.5–8s : La grande carte violette apparaît en fondu au centre (quasi toute
    // la hauteur), avec halo doux et étincelles sur ses bords, puis arrêt exact.
    if (time < 6.5) {
      cardMesh.visible = false
      cardMesh.material.opacity = 0
      cardGlowMat.uniforms.uOpacity.value = 0
    } else {
      cardMesh.visible = true
      const cardP = clamp01((time - 6.5) / 1.25)
      const cardEase = easeOutCubic(cardP)
      cardMesh.material.opacity = cardEase
      const cardS = mix(0.96, 1.0, cardEase)
      cardMesh.scale.set(cardS, cardS, 1)
      cardMesh.position.set(cardPivot.x, cardPivot.y, 0.05)

      const glowBell = Math.sin(clamp01((time - 6.5) / 1.45) * Math.PI)
      cardGlowMat.uniforms.uOpacity.value = glowBell * 0.5
    }

    sparkleMat.uniforms.uTime.value = time
    sparkleMat.uniforms.uViewport.value = typeof window !== 'undefined' ? window.innerHeight || 720 : 720
  },
}

function coverScaleRatio() {
  if (typeof window === 'undefined') return 1
  const vw = window.innerWidth || 1280
  const vh = window.innerHeight || 720
  const aspect = vw / vh
  const target = 16 / 9
  // Si la fenêtre est plus large ou plus haute que 16:9, le fond couvre 100% du cadre
  return aspect > target ? aspect / target : target / aspect
}

// ---------------------------------------------------------------------------
// Initialisation

function initScene(ctx) {
  if (ctx.state.ready) return
  const brick = ctx.bricks.get('cosmos')
  if (!brick) return

  const meshes = brick.object3d.children
  if (meshes.length < 4) return

  const THREE = ctx.THREE
  const fondMesh = meshes[0]
  const leftMesh = meshes[1]
  const rightMesh = meshes[2]
  const cardMesh = meshes[3]

  const W = 1.6
  const H = 0.9
  const toStageX = (px) => (px / 2800 - 0.5) * W
  const toStageY = (py) => (0.5 - py / 1575) * H

  // Pivots exacts calibrés sur AR_2_image_finale_paysage (2800×1575)
  const leftPivot = {x: toStageX(450), y: toStageY(1500)}
  const rightPivot = {x: toStageX(2310), y: toStageY(1500)}
  const cardPivot = {x: toStageX(1400), y: toStageY(787)}

  reanchorGeometry(leftMesh, leftPivot.x, leftPivot.y)
  reanchorGeometry(rightMesh, rightPivot.x, rightPivot.y)
  reanchorGeometry(cardMesh, cardPivot.x, cardPivot.y)

  fondMesh.renderOrder = 10
  cardMesh.renderOrder = 12
  leftMesh.renderOrder = 14
  rightMesh.renderOrder = 15

  // 0. Fond spatial continu derrière toute la scène (élimine tout gris/marge hors 16:9)
  const backdropMat = createBackdropMaterial(THREE)
  const spaceBackdrop = new THREE.Mesh(new THREE.PlaneGeometry(18, 10), backdropMat)
  spaceBackdrop.position.set(0, 0, -0.015)
  spaceBackdrop.renderOrder = 7
  brick.object3d.add(spaceBackdrop)

  // 1. Nébuleuse dérivante subtile
  const nebulaMat = createNebulaMaterial(THREE)
  const nebulaMesh = new THREE.Mesh(new THREE.PlaneGeometry(W, H), nebulaMat)
  nebulaMesh.position.set(0, 0, 0.004)
  nebulaMesh.renderOrder = 11
  brick.object3d.add(nebulaMesh)

  // 2. Halo violet derrière la grande carte centrale
  const cardGlowMat = createCardGlowMaterial(THREE)
  const cardGlowMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.76, 1.02), cardGlowMat)
  cardGlowMesh.position.set(cardPivot.x, cardPivot.y, 0.042)
  cardGlowMesh.renderOrder = 11
  brick.object3d.add(cardGlowMesh)

  // 3. Paupières de clignement (coordonnées exactes des yeux sur les visuels paysage)
  const leftEyeCenter = {
    x: toStageX(416) - leftPivot.x,
    y: toStageY(869) - leftPivot.y,
  }
  const leftBlink = createBlinkGroup(THREE, leftEyeCenter.x, leftEyeCenter.y, 0.046, 0.036, 0x160a14, 0x2c1628)
  leftBlink.position.z = 0.004
  leftBlink.renderOrder = 16
  leftMesh.add(leftBlink)

  const rightEyeCenter = {
    x: toStageX(2355) - rightPivot.x,
    y: toStageY(914) - rightPivot.y,
  }
  const rightBlink = createBlinkGroup(THREE, rightEyeCenter.x, rightEyeCenter.y, 0.056, 0.042, 0x62a6ff, 0x12121a)
  rightBlink.position.z = 0.004
  rightBlink.renderOrder = 16
  rightMesh.add(rightBlink)

  // 4. Étoiles scintillantes et étincelles chronométrées
  const sparkleMat = createSparklesMaterial(THREE)
  const sparkles = createSparklesPoints(THREE, sparkleMat, W, H, cardPivot)
  sparkles.renderOrder = 18
  brick.object3d.add(sparkles)

  Object.assign(ctx.state, {
    ready: true,
    fondMesh,
    leftMesh,
    rightMesh,
    cardMesh,
    spaceBackdrop,
    backdropMat,
    nebulaMesh,
    nebulaMat,
    cardGlowMat,
    sparkles,
    sparkleMat,
    leftBlink,
    rightBlink,
    leftPivot,
    rightPivot,
    cardPivot,
  })
}

function reanchorGeometry(mesh, px, py) {
  mesh.geometry.translate(-px, -py, 0)
  mesh.position.set(px, py, mesh.position.z)
}

// ---------------------------------------------------------------------------
// Animation des mascottes

function animateMascot(mesh, pivot, blinkGroup, time, cfg) {
  if (time < cfg.startTime) {
    mesh.visible = false
    mesh.material.opacity = 0
    blinkGroup.visible = false
    return
  }

  mesh.visible = true
  const localT = time - cfg.startTime
  const jumpDur = 2.44

  if (localT < jumpDur) {
    const t1 = 1.32
    const t2 = 1.88
    let x = pivot.x
    let y = pivot.y
    let z = cfg.endZ
    let baseScale = 1
    let sx = 1
    let sy = 1
    let rotZ = 0

    if (localT < t1) {
      const p = localT / t1
      const ease = easeOutCubic(p)
      x = mix(cfg.startX, pivot.x, ease)
      const arc = Math.sin(p * Math.PI) * 0.24
      y = mix(cfg.startY, pivot.y, easeQuadIn(p)) + arc
      z = mix(cfg.startZ, cfg.endZ + 0.08 * Math.sin(p * Math.PI), ease)
      baseScale = mix(0.14, 1.0, easeOutBackSoft(p))
      mesh.material.opacity = clamp01(p * 4.5)

      if (p < 0.35) {
        const k = Math.sin((p / 0.35) * Math.PI)
        sx = 1 - 0.14 * k
        sy = 1 + 0.18 * k
      } else if (p > 0.78) {
        const k = (p - 0.78) / 0.22
        sx = 1 + 0.18 * k
        sy = 1 - 0.20 * k
      }
      rotZ = cfg.leanDir * 0.07 * Math.sin(p * Math.PI)
    } else if (localT < t2) {
      const p = (localT - t1) / (t2 - t1)
      mesh.material.opacity = 1
      y = pivot.y + Math.sin(p * Math.PI) * 0.085
      z = cfg.endZ + 0.02 * Math.sin(p * Math.PI)
      if (p < 0.25) {
        const k = 1 - p / 0.25
        sx = 1 + 0.18 * k
        sy = 1 - 0.20 * k
      } else {
        const k = Math.sin(((p - 0.25) / 0.75) * Math.PI)
        sx = 1 - 0.08 * k
        sy = 1 + 0.10 * k
      }
      rotZ = -cfg.leanDir * 0.03 * Math.sin(p * Math.PI)
    } else {
      const p = (localT - t2) / (jumpDur - t2)
      mesh.material.opacity = 1
      y = pivot.y + Math.sin(p * Math.PI) * 0.022
      const squash = Math.sin(p * Math.PI) * (1 - p)
      sx = 1 + 0.07 * squash
      sy = 1 - 0.07 * squash
    }

    mesh.position.set(x, y, z)
    mesh.scale.set(baseScale * sx, baseScale * sy, 1)
    mesh.rotation.z = rotZ
    blinkGroup.visible = false
    return
  }

  mesh.material.opacity = 1
  if (time < 6.5) {
    const p = clamp01((time - 4.5) / 2.0)
    const env = Math.sin(p * Math.PI)
    const bob = Math.sin((time - 4.5) * Math.PI * 2.0) * 0.008 * env
    const lean = cfg.leanDir * 0.025 * env
    mesh.position.set(pivot.x, pivot.y + bob, cfg.endZ)
    mesh.scale.set(1 + 0.015 * env, 1 - 0.015 * env, 1)
    mesh.rotation.z = lean
  } else {
    mesh.position.set(pivot.x, pivot.y, cfg.endZ)
    mesh.scale.set(1, 1, 1)
    mesh.rotation.z = 0
  }

  let blinkAmt = 0
  for (const bt of cfg.blinkTimes) {
    const d = time - bt
    if (d >= 0 && d <= 0.18) {
      blinkAmt = Math.max(blinkAmt, Math.sin((d / 0.18) * Math.PI))
    }
  }
  if (blinkAmt > 0.02) {
    blinkGroup.visible = true
    blinkGroup.scale.set(1, Math.max(0.05, blinkAmt), 1)
  } else {
    blinkGroup.visible = false
  }
}

function createBlinkGroup(THREE, cx, cy, w, h, fillHex, lineHex) {
  const group = new THREE.Group()
  group.position.set(cx, cy, 0)

  const lidGeo = new THREE.CircleGeometry(1, 20)
  lidGeo.scale(w, h, 1)
  const lidMat = new THREE.MeshBasicMaterial({color: fillHex, depthWrite: false})
  group.add(new THREE.Mesh(lidGeo, lidMat))

  const pts = []
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI * (0.12 + 0.76 * (i / 12))
    pts.push(new THREE.Vector3(Math.cos(a) * w * 0.85, -Math.sin(a) * h * 0.38, 0.001))
  }
  const lineGeo = new THREE.BufferGeometry().setFromPoints(pts)
  group.add(new THREE.Line(lineGeo, new THREE.LineBasicMaterial({color: lineHex})))

  return group
}

// ---------------------------------------------------------------------------
// Shaders (fond spatial continu, nébuleuse, halo, étincelles)

function createBackdropMaterial(THREE) {
  return new THREE.ShaderMaterial({
    uniforms: {uTime: {value: 0}},
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        vec3 topCol = vec3(0.03, 0.02, 0.18);
        vec3 midCol = vec3(0.11, 0.05, 0.32);
        vec3 botCol = vec3(0.16, 0.07, 0.38);
        vec3 col = mix(botCol, topCol, smoothstep(0.0, 1.0, vUv.y));
        col = mix(col, midCol, 0.35);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    depthWrite: false,
  })
}

function createNebulaMaterial(THREE) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: {value: 0},
      uOpacity: {value: 0},
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uOpacity;
      varying vec2 vUv;
      float blob(vec2 p, vec2 c, vec2 r) {
        vec2 d = (p - c) / r;
        return exp(-dot(d, d) * 1.8);
      }
      void main() {
        vec2 p = vUv;
        float b1 = blob(p, vec2(0.20 + sin(uTime * 0.35) * 0.04, 0.76), vec2(0.26, 0.22));
        float b2 = blob(p, vec2(0.80 - cos(uTime * 0.28) * 0.04, 0.72), vec2(0.28, 0.24));
        float b3 = blob(p, vec2(0.50 + sin(uTime * 0.22) * 0.03, 0.24), vec2(0.32, 0.20));
        vec3 col = b1 * vec3(0.55, 0.22, 0.85) + b2 * vec3(0.22, 0.38, 0.92) + b3 * vec3(0.45, 0.18, 0.78);
        float a = clamp(b1 + b2 + b3, 0.0, 1.0) * uOpacity;
        if (a < 0.004) discard;
        gl_FragColor = vec4(col, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
}

function createCardGlowMaterial(THREE) {
  return new THREE.ShaderMaterial({
    uniforms: {uOpacity: {value: 0}},
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        vec2 d = abs(vUv - 0.5) * 2.0;
        vec2 q = max(d - vec2(0.56, 0.72), 0.0);
        float dist = length(q);
        float glow = exp(-dist * 7.0) * smoothstep(1.0, 0.4, max(d.x, d.y));
        float a = glow * uOpacity;
        if (a < 0.004) discard;
        vec3 col = mix(vec3(0.56, 0.26, 0.98), vec3(0.86, 0.54, 1.0), glow);
        gl_FragColor = vec4(col, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
}

function createSparklesMaterial(THREE) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: {value: 0},
      uViewport: {value: 720},
    },
    vertexShader: `
      uniform float uTime;
      uniform float uViewport;
      attribute float aStart;
      attribute float aEnd;
      attribute float aSize;
      attribute float aSeed;
      attribute vec3 aColor;
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vColor = aColor;
        float alpha = 0.0;
        float sizeScale = 1.0;

        if (aStart < 0.5) {
          float fadeOut = 1.0 - smoothstep(7.1, 7.95, uTime);
          float tw = 0.5 + 0.5 * sin(uTime * (2.2 + aSeed * 2.5) + aSeed * 18.0);
          alpha = (0.25 + 0.75 * tw) * fadeOut;
          sizeScale = 0.8 + 0.45 * tw;
        } else {
          if (uTime >= aStart && uTime <= aEnd) {
            float p = (uTime - aStart) / max(0.01, aEnd - aStart);
            float bell = sin(p * 3.14159265);
            alpha = pow(bell, 0.75);
            sizeScale = 0.35 + 0.95 * bell;
          }
        }

        vAlpha = alpha;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float sc = length(modelMatrix[0].xyz);
        gl_PointSize = aSize * sizeScale * sc * projectionMatrix[1][1] * uViewport * 0.5 / max(0.2, -mv.z);
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        if (vAlpha < 0.01) discard;
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        float crs = max(
          smoothstep(0.09, 0.0, abs(c.x)) * smoothstep(0.48, 0.0, abs(c.y)),
          smoothstep(0.09, 0.0, abs(c.y)) * smoothstep(0.48, 0.0, abs(c.x))
        );
        float core = smoothstep(0.20, 0.0, d);
        float a = clamp(max(crs, core), 0.0, 1.0) * vAlpha;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vColor, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
}

function createSparklesPoints(THREE, material, W, H, cardPivot) {
  const items = []
  const gold = [1.0, 0.91, 0.58]
  const pink = [0.98, 0.72, 0.88]
  const cyan = [0.55, 0.85, 1.0]
  const white = [1.0, 1.0, 1.0]

  // 1) Étoiles de fond scintillantes (0 -> 7.95s)
  for (let i = 0; i < 40; i++) {
    const x = (seeded(i * 3 + 1) - 0.5) * W * 0.96
    const y = (seeded(i * 3 + 2) - 0.5) * H * 0.94
    const palette = i % 5 === 0 ? gold : i % 7 === 0 ? pink : white
    items.push({
      x, y, z: 0.008,
      start: 0, end: 8.0,
      size: 0.020 + seeded(i * 3 + 3) * 0.018,
      seed: seeded(i * 7 + 5),
      color: palette,
    })
  }

  // 2) Étincelles autour des mascottes (4.5 -> 6.5s)
  for (let i = 0; i < 18; i++) {
    const isLeft = i % 2 === 0
    const cx = isLeft ? -0.54 : 0.52
    const cy = isLeft ? -0.05 : -0.08
    const ang = (i / 18) * Math.PI * 2 + seeded(i + 40) * 0.5
    const rad = 0.21 + seeded(i + 70) * 0.11
    const s = 4.55 + (i % 6) * 0.22
    items.push({
      x: cx + Math.cos(ang) * rad,
      y: cy + Math.sin(ang) * rad * 0.85,
      z: 0.11,
      start: s,
      end: Math.min(6.48, s + 0.72),
      size: 0.032 + seeded(i + 90) * 0.02,
      seed: seeded(i + 120),
      color: isLeft ? gold : cyan,
    })
  }

  // 3) Étincelles autour des bords de la grande carte violette (6.5 -> 7.95s)
  const cardHalfW = 0.285
  const cardHalfH = 0.42
  for (let i = 0; i < 20; i++) {
    const side = i % 4
    let dx = 0
    let dy = 0
    const u = seeded(i + 200) * 2 - 1
    if (side === 0) { dx = -cardHalfW - 0.018; dy = u * cardHalfH }
    else if (side === 1) { dx = cardHalfW + 0.018; dy = u * cardHalfH }
    else if (side === 2) { dx = u * cardHalfW; dy = cardHalfH + 0.015 }
    else { dx = u * cardHalfW; dy = -cardHalfH - 0.015 }
    const s = 6.55 + (i % 5) * 0.16
    items.push({
      x: cardPivot.x + dx,
      y: cardPivot.y + dy,
      z: 0.075,
      start: s,
      end: Math.min(7.96, s + 0.78),
      size: 0.034 + seeded(i + 240) * 0.02,
      seed: seeded(i + 260),
      color: i % 3 === 0 ? white : i % 2 === 0 ? gold : pink,
    })
  }

  const n = items.length
  const pos = new Float32Array(n * 3)
  const aStart = new Float32Array(n)
  const aEnd = new Float32Array(n)
  const aSize = new Float32Array(n)
  const aSeed = new Float32Array(n)
  const aColor = new Float32Array(n * 3)

  items.forEach((it, i) => {
    pos.set([it.x, it.y, it.z], i * 3)
    aStart[i] = it.start
    aEnd[i] = it.end
    aSize[i] = it.size
    aSeed[i] = it.seed
    aColor.set(it.color, i * 3)
  })

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('aStart', new THREE.BufferAttribute(aStart, 1))
  geo.setAttribute('aEnd', new THREE.BufferAttribute(aEnd, 1))
  geo.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1))
  geo.setAttribute('aSeed', new THREE.BufferAttribute(aSeed, 1))
  geo.setAttribute('aColor', new THREE.BufferAttribute(aColor, 3))

  const points = new THREE.Points(geo, material)
  points.frustumCulled = false
  return points
}

// ---------------------------------------------------------------------------
// Utilitaires

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v }
function mix(a, b, t) { return a + (b - a) * t }
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3) }
function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2 }
function easeQuadIn(t) { return t * t }
function easeOutBackSoft(t) {
  const c1 = 1.25
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}
function seeded(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123
  return x - Math.floor(x)
}
