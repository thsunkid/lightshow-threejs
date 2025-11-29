uniform float uTime;
uniform float uAmplitude;    // From high frequencies
uniform float uOffsetGain;   // From mid frequencies
uniform float uFrequency;    // Animation frequency
uniform float uBeat;         // Beat pulse (0-1)
uniform float uIntensity;    // Overall particle visibility/intensity

attribute vec3 aOriginalPosition;
attribute float aPhase;
attribute float aSize;

varying float vDistance;
varying float vAlpha;

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

//
// Curl Noise
// Returns divergence-free vector field for fluid-like particle motion
//
vec3 curlNoise(vec3 p) {
  const float e = 0.1;

  // Sample noise at offset positions to compute curl
  float n1 = snoise(vec3(p.x, p.y + e, p.z));
  float n2 = snoise(vec3(p.x, p.y - e, p.z));
  float n3 = snoise(vec3(p.x, p.y, p.z + e));
  float n4 = snoise(vec3(p.x, p.y, p.z - e));
  float n5 = snoise(vec3(p.x + e, p.y, p.z));
  float n6 = snoise(vec3(p.x - e, p.y, p.z));

  // Compute curl using finite differences
  vec3 curl = vec3(
    n1 - n2 - n3 + n4,
    n3 - n4 - n5 + n6,
    n5 - n6 - n1 + n2
  );

  return curl / (2.0 * e);
}

void main() {
  vec3 pos = aOriginalPosition;

  // Apply curl noise displacement based on amplitude
  vec3 noisePos = pos * uFrequency + uTime * 0.1;
  vec3 curl = curlNoise(noisePos) * uAmplitude;

  // Add wave motion
  pos.z += sin(pos.x * 2.0 + uTime + aPhase) * uOffsetGain;
  pos.y += cos(pos.y * 2.0 + uTime + aPhase) * uOffsetGain * 0.5;

  // Beat response - particles expand outward on beats
  pos += normalize(pos) * uBeat * 0.5;

  // Apply curl displacement scaled by intensity
  // When audio is low, particles contract inward
  pos += curl * (0.2 + uIntensity * 0.8);

  // Contract particles toward origin when intensity is low
  pos = mix(pos * 0.3, pos, 0.2 + uIntensity * 0.8);

  // Calculate distance for color interpolation
  vDistance = length(pos - aOriginalPosition) / max(uAmplitude, 0.1);
  vAlpha = (1.0 - vDistance * 0.3) * (0.3 + uIntensity * 0.7);

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  // Size attenuation with intensity factor
  gl_PointSize = aSize * (300.0 / -mvPosition.z) * (1.0 + uBeat * 0.5) * (0.5 + uIntensity * 0.5);
}
