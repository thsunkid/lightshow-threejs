uniform vec3 uBaseColor;
uniform vec3 uAccentColor;
uniform float uOpacity;

varying float vDistance;
varying float vAlpha;

void main() {
  // Circle shape
  vec2 center = gl_PointCoord - 0.5;
  float dist = length(center);
  if (dist > 0.5) discard;

  // Soft edge
  float alpha = smoothstep(0.5, 0.2, dist) * vAlpha * uOpacity;

  // Color interpolation based on distance
  vec3 color = mix(uBaseColor, uAccentColor, vDistance);

  // Glow at center
  color += (1.0 - dist * 2.0) * 0.3;

  gl_FragColor = vec4(color, alpha);
}
