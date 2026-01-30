import * as THREE from 'three';

// Top memecoins - using wsrv.nl image proxy for CORS
const COINGECKO_IMAGES = [
  // Dogs
  'https://assets.coingecko.com/coins/images/5/large/dogecoin.png', // DOGE
  'https://assets.coingecko.com/coins/images/11939/large/shiba.png', // SHIB
  'https://assets.coingecko.com/coins/images/16746/large/PNG_image.png', // FLOKI
  'https://assets.coingecko.com/coins/images/24383/large/bonk.png', // BONK
  'https://assets.coingecko.com/coins/images/33566/large/dogwifhat.jpg', // WIF
  'https://assets.coingecko.com/coins/images/39488/large/NEIRO200x200.jpg', // NEIRO
  // Frogs
  'https://assets.coingecko.com/coins/images/29850/large/pepe-token.jpeg', // PEPE
  'https://assets.coingecko.com/coins/images/35529/large/1000050750.png', // BRETT
  // Cats
  'https://assets.coingecko.com/coins/images/33760/large/popcat.jpg', // POPCAT
  'https://assets.coingecko.com/coins/images/39765/large/mew.jpg', // MEW
  // Other memes
  'https://assets.coingecko.com/coins/images/31059/large/MOG_LOGO_200x200.png', // MOG
  'https://assets.coingecko.com/coins/images/30117/large/turbo.png', // TURBO
  'https://assets.coingecko.com/coins/images/35581/large/degen.png', // DEGEN
  'https://assets.coingecko.com/coins/images/36407/large/toshi.png', // TOSHI
  'https://assets.coingecko.com/coins/images/34959/large/GIGA.jpg', // GIGA
  'https://assets.coingecko.com/coins/images/32528/large/memecoin_%282%29.png', // MEME
  'https://assets.coingecko.com/coins/images/28452/large/apuapustaja.png', // APU
  'https://assets.coingecko.com/coins/images/33482/large/pork.png', // PORK
  'https://assets.coingecko.com/coins/images/35336/large/coq-logo.png', // COQ
  'https://assets.coingecko.com/coins/images/34258/large/MYRO200x200.png', // MYRO
  'https://assets.coingecko.com/coins/images/37507/large/MOTHER.png', // MOTHER
  'https://assets.coingecko.com/coins/images/33093/large/snek.png', // SNEK
  'https://assets.coingecko.com/coins/images/36077/large/Wen.png', // WEN
  'https://assets.coingecko.com/coins/images/35209/large/Smog_token_logo.png', // SMOG
];

// Convert to proxied URLs using wsrv.nl (reliable CORS proxy for images)
const MEMECOIN_IMAGES = COINGECKO_IMAGES.map(url => ({
  url: `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=256&h=256`
}));

class MemecoinSpheres {
  constructor(canvas) {
    this.canvas = canvas;
    this.spheres = [];
    this.textures = new Map();
    this.paused = false;
    this.mouse = new THREE.Vector2();
    this.targetRotation = new THREE.Vector2();
    this.explosionForce = 0;
    this.isExploding = false;

    // Star field properties
    this.stars = null;
    this.starPositions = null;
    this.starVelocities = [];
    this.starCount = 500;

    this.init();
    this.loadTokensAndTextures();
  }

  init() {
    // Scene
    this.scene = new THREE.Scene();

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.z = 15;

    // Renderer with shadows
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    // Ambient light - low to preserve shadows
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.08);
    this.scene.add(this.ambientLight);

    // Hemisphere light for subtle sky/ground variation
    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x080820, 0.3);
    this.hemiLight.position.set(0, 20, 0);
    this.scene.add(this.hemiLight);

    // Key light - main light source from top-right-front
    this.keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
    this.keyLight.position.set(8, 12, 10);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.width = 2048;
    this.keyLight.shadow.mapSize.height = 2048;
    this.keyLight.shadow.camera.near = 0.5;
    this.keyLight.shadow.camera.far = 50;
    this.keyLight.shadow.camera.left = -20;
    this.keyLight.shadow.camera.right = 20;
    this.keyLight.shadow.camera.top = 20;
    this.keyLight.shadow.camera.bottom = -20;
    this.keyLight.shadow.bias = -0.0001;
    this.scene.add(this.keyLight);

    // Fill light - softer light from opposite side to lift shadows
    this.fillLight = new THREE.DirectionalLight(0x6688cc, 0.4);
    this.fillLight.position.set(-8, 4, 6);
    this.scene.add(this.fillLight);

    // Rim/back light - creates edge definition
    this.rimLight = new THREE.DirectionalLight(0xffffff, 0.6);
    this.rimLight.position.set(0, -5, -10);
    this.scene.add(this.rimLight);

    // Top accent light for highlights
    this.topLight = new THREE.PointLight(0xffffff, 0.5, 40);
    this.topLight.position.set(0, 15, 5);
    this.scene.add(this.topLight);

    // Create environment map for reflections
    this.createEnvironment();

    // Create star field
    this.createStarField();

    // Events
    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));

    // Start animation
    this.animate();
  }

  createEnvironment() {
    // Create environment map with gradient and highlight spots
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Base gradient - dark space with subtle color
    const gradient = ctx.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(0.3, '#16213e');
    gradient.addColorStop(0.6, '#0f0f1a');
    gradient.addColorStop(1, '#000000');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1024, 512);

    // Add bright spot for key light reflection (top right area)
    const keyGradient = ctx.createRadialGradient(750, 100, 0, 750, 100, 200);
    keyGradient.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
    keyGradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.15)');
    keyGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = keyGradient;
    ctx.fillRect(0, 0, 1024, 512);

    // Add subtle fill light reflection (left side)
    const fillGradient = ctx.createRadialGradient(200, 200, 0, 200, 200, 150);
    fillGradient.addColorStop(0, 'rgba(100, 140, 200, 0.2)');
    fillGradient.addColorStop(1, 'rgba(100, 140, 200, 0)');
    ctx.fillStyle = fillGradient;
    ctx.fillRect(0, 0, 1024, 512);

    const texture = new THREE.CanvasTexture(canvas);
    texture.mapping = THREE.EquirectangularReflectionMapping;

    this.scene.environment = texture;
  }

  createStarField() {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.starCount * 3);
    const colors = new Float32Array(this.starCount * 3);

    // Color palette: 80% white, 15% blue, 5% teal
    const white = new THREE.Color(0xffffff);
    const blue = new THREE.Color(0x3b82f6);
    const teal = new THREE.Color(0x14b8a6);

    for (let i = 0; i < this.starCount; i++) {
      const i3 = i * 3;

      // Position stars in a wide cone behind the scene
      const x = (Math.random() - 0.5) * 60;
      const y = (Math.random() - 0.5) * 40;
      const z = -30 - Math.random() * 70; // z: -30 to -100

      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;

      // Random velocity toward camera
      this.starVelocities.push({
        z: 0.05 + Math.random() * 0.15
      });

      // Color variation
      const rand = Math.random();
      let color;
      if (rand < 0.80) {
        color = white;
      } else if (rand < 0.95) {
        color = blue;
      } else {
        color = teal;
      }

      colors[i3] = color.r;
      colors[i3 + 1] = color.g;
      colors[i3 + 2] = color.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    this.starPositions = geometry.attributes.position;

    const material = new THREE.PointsMaterial({
      size: 0.08,
      transparent: true,
      opacity: 0.5,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: true
    });

    this.stars = new THREE.Points(geometry, material);
    this.scene.add(this.stars);
  }

  updateStars() {
    if (!this.starPositions) return;

    const positions = this.starPositions.array;

    for (let i = 0; i < this.starCount; i++) {
      const i3 = i * 3;

      // Move star toward camera
      positions[i3 + 2] += this.starVelocities[i].z;

      // Recycle star when it passes the camera
      if (positions[i3 + 2] > 20) {
        positions[i3] = (Math.random() - 0.5) * 60;
        positions[i3 + 1] = (Math.random() - 0.5) * 40;
        positions[i3 + 2] = -100;
        this.starVelocities[i].z = 0.05 + Math.random() * 0.15;
      }
    }

    this.starPositions.needsUpdate = true;
  }

  async loadTokensAndTextures() {
    const textureLoader = new THREE.TextureLoader();
    textureLoader.crossOrigin = 'anonymous';

    // Load textures using Image objects to handle CORS properly
    const loadTexture = (url) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const texture = new THREE.Texture(img);
          texture.needsUpdate = true;
          resolve(texture);
        };
        img.onerror = () => {
          console.warn(`Failed to load: ${url}`);
          resolve(null);
        };
        img.src = url;
      });
    };

    try {
      const loadPromises = MEMECOIN_IMAGES.map(async (img, index) => {
        const texture = await loadTexture(img.url);
        return { texture, index };
      });

      const results = await Promise.all(loadPromises);
      const successCount = results.filter(r => r.texture !== null).length;
      console.log(`Loaded ${successCount}/${results.length} textures`);

      if (successCount > 0) {
        this.createSpheres(results);
      } else {
        console.warn('No textures loaded, using fallback');
        this.createFallbackSpheres();
      }
    } catch (err) {
      console.error('Failed to load textures:', err);
      this.createFallbackSpheres();
    }
  }

  createSpheres(textureResults) {
    const sphereCount = 50; // Total spheres
    const geometry = new THREE.SphereGeometry(1, 64, 64);
    const validTextures = textureResults.filter(r => r.texture !== null);

    for (let i = 0; i < sphereCount; i++) {
      let material;

      if (validTextures.length > 0) {
        const textureData = validTextures[i % validTextures.length];
        material = new THREE.MeshStandardMaterial({
          map: textureData.texture,
          metalness: 0.1,
          roughness: 0.35,
          envMapIntensity: 0.8,
        });
      } else {
        // Fallback colored material
        const hue = (i / sphereCount) * 360;
        material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(`hsl(${hue}, 70%, 50%)`),
          metalness: 0.1,
          roughness: 0.35,
          envMapIntensity: 0.8,
        });
      }

      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      // Random position
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = 5 + Math.random() * 8;

      mesh.position.set(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi)
      );

      // Random size
      const scale = 0.3 + Math.random() * 0.7;
      mesh.scale.setScalar(scale);

      // Physics properties
      mesh.userData = {
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.02,
          (Math.random() - 0.5) * 0.02,
          (Math.random() - 0.5) * 0.02
        ),
        baseScale: scale,
        rotationSpeed: new THREE.Vector3(
          (Math.random() - 0.5) * 0.002,
          (Math.random() - 0.5) * 0.002,
          (Math.random() - 0.5) * 0.002
        )
      };

      this.scene.add(mesh);
      this.spheres.push(mesh);
    }
  }

  createFallbackSpheres() {
    const sphereCount = 50;
    const geometry = new THREE.SphereGeometry(1, 64, 64);
    // Colors from palette: primary, chart-2 (teal), chart-3 (yellow), chart-4 (green), chart-5 (red)
    const colors = [0x3b82f6, 0x14b8a6, 0xeab308, 0x22c55e, 0xef4444];

    for (let i = 0; i < sphereCount; i++) {
      const material = new THREE.MeshStandardMaterial({
        color: colors[i % colors.length],
        metalness: 0.1,
        roughness: 0.35,
        envMapIntensity: 0.8,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = 5 + Math.random() * 8;

      mesh.position.set(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi)
      );

      const scale = 0.3 + Math.random() * 0.7;
      mesh.scale.setScalar(scale);

      mesh.userData = {
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.02,
          (Math.random() - 0.5) * 0.02,
          (Math.random() - 0.5) * 0.02
        ),
        baseScale: scale,
        rotationSpeed: new THREE.Vector3(
          (Math.random() - 0.5) * 0.01,
          (Math.random() - 0.5) * 0.01,
          (Math.random() - 0.5) * 0.01
        )
      };

      this.scene.add(mesh);
      this.spheres.push(mesh);
    }
  }

  explode() {
    this.isExploding = true;
    this.explosionForce = 1.0;

    // Apply outward velocity to all spheres
    for (const sphere of this.spheres) {
      const direction = sphere.position.clone().normalize();
      if (direction.length() < 0.1) {
        // If sphere is at center, give random direction
        direction.set(
          Math.random() - 0.5,
          Math.random() - 0.5,
          Math.random() - 0.5
        ).normalize();
      }

      const force = 0.3 + Math.random() * 0.2;
      sphere.userData.velocity.add(direction.multiplyScalar(force));

      // Add spin on explosion
      sphere.userData.rotationSpeed.set(
        (Math.random() - 0.5) * 0.02,
        (Math.random() - 0.5) * 0.02,
        (Math.random() - 0.5) * 0.02
      );
    }
  }

  updatePhysics() {
    // Offset center to the right side of screen (+7 on X axis)
    const center = new THREE.Vector3(7, 0, 0);
    // Reduce attraction during explosion
    const baseAttraction = 0.0005;
    const attractionStrength = this.isExploding
      ? baseAttraction * (1 - this.explosionForce * 0.8)
      : baseAttraction;
    const friction = 0.992;
    const maxSpeed = this.isExploding ? 0.5 : 0.15;
    const boundaryRadius = 15;

    // Decay explosion force
    if (this.explosionForce > 0) {
      this.explosionForce *= 0.98;
      if (this.explosionForce < 0.01) {
        this.explosionForce = 0;
        this.isExploding = false;
      }
    }

    for (const sphere of this.spheres) {
      const { velocity, rotationSpeed } = sphere.userData;

      // Attract toward center
      const toCenter = center.clone().sub(sphere.position);
      const distance = toCenter.length();
      toCenter.normalize().multiplyScalar(attractionStrength * distance);
      velocity.add(toCenter);

      // Apply friction
      velocity.multiplyScalar(friction);

      // Clamp speed
      if (velocity.length() > maxSpeed) {
        velocity.normalize().multiplyScalar(maxSpeed);
      }

      // Update position
      sphere.position.add(velocity);

      // Soft boundary constraint
      if (sphere.position.length() > boundaryRadius) {
        const pushBack = sphere.position.clone().normalize().multiplyScalar(-0.02);
        velocity.add(pushBack);
      }

      // Sphere-sphere collision
      for (const other of this.spheres) {
        if (other === sphere) continue;

        const diff = sphere.position.clone().sub(other.position);
        const dist = diff.length();
        const minDist = (sphere.userData.baseScale + other.userData.baseScale) * 1.1;

        if (dist < minDist && dist > 0) {
          const overlap = minDist - dist;
          const pushDir = diff.normalize();
          sphere.position.add(pushDir.clone().multiplyScalar(overlap * 0.5));
          other.position.sub(pushDir.clone().multiplyScalar(overlap * 0.5));

          // Transfer momentum
          const relativeVel = velocity.clone().sub(other.userData.velocity);
          const impulse = pushDir.clone().multiplyScalar(relativeVel.dot(pushDir) * 0.5);
          velocity.sub(impulse);
          other.userData.velocity.add(impulse);
        }
      }

      // Rotate sphere - slow down rotation over time
      sphere.rotation.x += rotationSpeed.x;
      sphere.rotation.y += rotationSpeed.y;
      sphere.rotation.z += rotationSpeed.z;

      // Dampen rotation more aggressively
      rotationSpeed.multiplyScalar(0.99);
    }
  }

  onMouseMove(event) {
    const prevX = this.mouse.x;
    const prevY = this.mouse.y;

    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    this.targetRotation.x = this.mouse.y * 0.3;
    this.targetRotation.y = this.mouse.x * 0.3;

    // Calculate mouse velocity
    const dx = this.mouse.x - prevX;
    const dy = this.mouse.y - prevY;
    const mouseSpeed = Math.sqrt(dx * dx + dy * dy);

    // Push spheres away from mouse position
    if (mouseSpeed > 0.001) {
      this.pushFromMouse(mouseSpeed);
    }
  }

  pushFromMouse(speed) {
    // Convert mouse position to 3D world position (offset to match sphere center)
    const mousePos = new THREE.Vector3(this.mouse.x * 8 + 7, this.mouse.y * 5, 2);

    for (const sphere of this.spheres) {
      const toSphere = sphere.position.clone().sub(mousePos);
      const distance = toSphere.length();

      // Only affect nearby spheres
      if (distance < 5) {
        const force = (1 - distance / 5) * speed * 15;
        const pushDir = toSphere.normalize().multiplyScalar(force);
        sphere.userData.velocity.add(pushDir);

        // Add some spin
        sphere.userData.rotationSpeed.x += (Math.random() - 0.5) * force * 0.1;
        sphere.userData.rotationSpeed.y += (Math.random() - 0.5) * force * 0.1;
      }
    }
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  randomizeColors() {
    // Palette colors for randomization
    const paletteColors = [0x3b82f6, 0x14b8a6, 0xeab308, 0x22c55e, 0xef4444];

    for (const sphere of this.spheres) {
      if (!sphere.material.map) {
        const color = paletteColors[Math.floor(Math.random() * paletteColors.length)];
        sphere.material.color.setHex(color);
      }
      // Vary clearcoat for visual interest
      sphere.material.clearcoat = 0.1 + Math.random() * 0.2;
    }
    // Cycle accent lights through palette colors
    const accentColor = paletteColors[Math.floor(Math.random() * paletteColors.length)];
    this.pointLight.color.setHex(accentColor);
    this.fillLight.color.setHex(0x3b82f6); // Keep fill light as primary blue
  }

  togglePause() {
    this.paused = !this.paused;
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    if (!this.paused) {
      this.updatePhysics();
      this.updateStars();

      // Smooth camera rotation based on mouse
      this.scene.rotation.x += (this.targetRotation.x - this.scene.rotation.x) * 0.05;
      this.scene.rotation.y += (this.targetRotation.y - this.scene.rotation.y) * 0.05;
    }

    this.renderer.render(this.scene, this.camera);
  }
}

// Initialize
const canvas = document.getElementById('webgl-canvas');
const app = new MemecoinSpheres(canvas);


// Click anywhere for a big explosion
document.body.addEventListener('click', () => {
  app.explode();
});

// Also trigger initial scatter on mouse enter
let hasEntered = false;
document.body.addEventListener('mouseenter', () => {
  if (!hasEntered) {
    hasEntered = true;
    app.explode();
  }
});
