uniform vec3 uBaseColor;
uniform vec3 uAccentColor;
uniform float uOpacity;
uniform float uIntensity;

varying float vDistance;
varying float vAlpha;

void main() {
  // Circle shape
  vec2 center = gl_PointCoord - 0.5;
  float dist = length(center);
  if (dist > 0.5) discard;

  // Soft edge with intensity factor
  float alpha = smoothstep(0.5, 0.2, dist) * vAlpha * uOpacity * (0.3 + uIntensity * 0.7);

  // Color interpolation based on distance
  vec3 color = mix(uBaseColor, uAccentColor, vDistance);

  // Reduced glow at center, scaled by intensity
  color += (1.0 - dist * 2.0) * 0.15 * uIntensity;

  gl_FragColor = vec4(color, alpha);
}
