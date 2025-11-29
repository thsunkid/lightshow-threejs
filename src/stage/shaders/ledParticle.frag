uniform vec3 uWarmColor;     // Warm color (orange/amber)
uniform vec3 uCoolColor;     // Cool color (white-blue)
uniform float uOpacity;
uniform float uIntensity;

varying float vDistance;
varying float vAlpha;
varying float vStripeIndex;

void main() {
  // Circle shape
  vec2 center = gl_PointCoord - 0.5;
  float dist = length(center);
  if (dist > 0.5) discard;

  // Soft edge
  float edgeAlpha = smoothstep(0.5, 0.25, dist);

  // Alternating stripe colors based on y position
  // Even stripes = warm, odd stripes = cool
  float stripeSelect = mod(vStripeIndex, 2.0);
  vec3 color = mix(uWarmColor, uCoolColor, stripeSelect);

  // Add subtle color variation based on distance from original position
  color = mix(color, color * 1.15, vDistance * 0.2);

  // Subtle glow at center
  float glow = (1.0 - dist * 2.0) * 0.1 * uIntensity;
  color += glow;

  // Final alpha
  float alpha = edgeAlpha * vAlpha * uOpacity * (0.4 + uIntensity * 0.6);

  gl_FragColor = vec4(color, alpha);
}
