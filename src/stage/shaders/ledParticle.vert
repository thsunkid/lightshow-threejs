uniform float uTime;
uniform float uAmplitude;    // From audio (controls displacement)
uniform float uOffsetGain;   // From mid frequencies
uniform float uFrequency;    // Animation frequency
uniform float uBeat;         // Beat pulse (0-1)
uniform float uIntensity;    // Overall particle visibility/intensity
uniform vec2 uBounds;        // Panel bounds (width/2, height/2)

attribute vec3 aOriginalPosition;
attribute vec3 aTargetPosition;
attribute float aPhase;
attribute float aSize;

varying float vDistance;
varying float vAlpha;
varying float vStripeIndex;  // For alternating colors

//
// Simplex 3D Noise
// by Ian McEwan, Ashima Arts
//
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

float snoise(vec3 v){
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

  // First corner
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 =   v - i + dot(i, C.xxx) ;

  // Other corners
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );

  vec3 x1 = x0 - i1 + 1.0 * C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1. + 3.0 * C.xxx;

  // Permutations
  i = mod(i, 289.0 );
  vec4 p = permute( permute( permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

  // Gradients
  float n_ = 1.0/7.0;
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z *ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );

  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );

  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);

  // Normalise gradients
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  // Mix final noise value
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
}

void main() {
  vec3 pos = aOriginalPosition;

  // Calculate distance from center for effects
  float distFromCenter = length(pos.xy) / length(uBounds);

  // Codrops-style: interpolate toward target based on intensity
  // When intensity is high, particles move toward target; when low, stay at original
  float targetMix = pow(uIntensity, 2.0) * 0.6;
  pos = mix(pos, aTargetPosition, targetMix);

  // Add subtle wave motion (reduced to stay within bounds)
  float waveX = sin(pos.x * 3.0 + uTime * 0.5 + aPhase) * uOffsetGain * 0.3;
  float waveY = cos(pos.y * 3.0 + uTime * 0.5 + aPhase) * uOffsetGain * 0.2;
  pos.x += waveX;
  pos.y += waveY;

  // Add noise-based displacement (reduced)
  vec3 noisePos = pos * uFrequency + uTime * 0.1;
  float noiseDisp = snoise(noisePos) * uAmplitude * 0.3;
  pos.z += noiseDisp;

  // Beat response - subtle pulse expansion from center
  float beatPulse = uBeat * 0.15 * (1.0 - distFromCenter * 0.5);
  pos.xy *= 1.0 + beatPulse;

  // CLAMP to panel bounds to prevent escape
  pos.x = clamp(pos.x, -uBounds.x * 0.95, uBounds.x * 0.95);
  pos.y = clamp(pos.y, -uBounds.y * 0.95, uBounds.y * 0.95);
  pos.z = clamp(pos.z, -0.5, 0.5);

  // Calculate distance for color interpolation
  vDistance = length(pos - aOriginalPosition) / max(uAmplitude + 0.1, 0.2);
  vAlpha = (0.5 + uIntensity * 0.5) * (1.0 - distFromCenter * 0.3);

  // Pass stripe index based on y position (for alternating colors)
  // Normalize y to 0-1 range, then create stripe bands
  float normalizedY = (aOriginalPosition.y + uBounds.y) / (uBounds.y * 2.0);
  vStripeIndex = floor(normalizedY * 8.0); // 8 stripes

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  // Size with depth attenuation and intensity
  float baseSize = aSize * (0.6 + uIntensity * 0.4);
  float beatSize = 1.0 + uBeat * 0.3;
  gl_PointSize = baseSize * (200.0 / -mvPosition.z) * beatSize;
}
