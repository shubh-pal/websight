// ReactBits — Aurora
// Flowing WebGL aurora/northern-lights gradient background
// Use as absolute-positioned background inside position:relative section
import { useEffect, useRef } from 'react';
import { Renderer, Camera, Geometry, Program, Mesh } from 'ogl';

const vertex = /* glsl */`
  attribute vec2 position;
  void main() { gl_Position = vec4(position, 0.0, 1.0); }
`;

const fragment = /* glsl */`
  precision highp float;
  uniform float uTime;
  uniform float uAmplitude;
  uniform vec3 uColorStop1;
  uniform vec3 uColorStop2;
  uniform vec3 uColorStop3;
  uniform float uBlend;
  uniform vec2 uResolution;

  vec3 mod289(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289((x * 34.0 + 1.0) * x); }
  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = x0.x > x0.y ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m * m; m = m * m;
    vec3 x2 = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x2) - 0.5;
    vec3 ox = floor(x2 + 0.5);
    vec3 a0 = x2 - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / uResolution;
    float t = uTime * 0.5;
    float noise = snoise(vec2(uv.x * 2.0 + t, uv.y * 1.5 + t * 0.7));
    float wave = noise * uAmplitude;
    float pos = uv.y + wave * 0.3;
    vec3 color = mix(uColorStop1, uColorStop2, smoothstep(0.0, 0.5, pos));
    color = mix(color, uColorStop3, smoothstep(0.5, 1.0, pos));
    float alpha = smoothstep(0.0, 0.2, pos) * smoothstep(1.0, 0.6, pos);
    alpha = pow(alpha, 1.5) * (0.5 + uBlend * 0.5);
    gl_FragColor = vec4(color, alpha);
  }
`;

const hexToRgb = hex => {
  hex = hex.replace(/^#/, '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const int = parseInt(hex, 16);
  return [((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255];
};

export default function Aurora({
  colorStops = ['#5227FF', '#a78bfa', '#ec4899'],
  amplitude = 1.0,
  blend = 0.6,
  speed = 0.4,
  className = '',
  style = {},
}) {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const renderer = new Renderer({ alpha: true, premultipliedAlpha: false });
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    container.appendChild(gl.canvas);
    gl.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';

    const camera = new Camera(gl);
    camera.position.z = 1;

    const geometry = new Geometry(gl, {
      position: { size: 2, data: new Float32Array([-1,-1, 3,-1, -1,3]) },
    });

    const [c1, c2, c3] = [hexToRgb(colorStops[0]), hexToRgb(colorStops[1] || colorStops[0]), hexToRgb(colorStops[2] || colorStops[0])];

    const program = new Program(gl, {
      vertex, fragment,
      uniforms: {
        uTime: { value: 0 },
        uAmplitude: { value: amplitude },
        uColorStop1: { value: c1 },
        uColorStop2: { value: c2 },
        uColorStop3: { value: c3 },
        uBlend: { value: blend },
        uResolution: { value: [container.clientWidth, container.clientHeight] },
      },
      transparent: true,
    });

    const mesh = new Mesh(gl, { geometry, program });
    let raf, elapsed = 0, last = performance.now();

    const resize = () => {
      renderer.setSize(container.clientWidth, container.clientHeight);
      program.uniforms.uResolution.value = [container.clientWidth, container.clientHeight];
    };
    window.addEventListener('resize', resize);
    resize();

    const update = t => {
      raf = requestAnimationFrame(update);
      elapsed += (t - last) * speed * 0.001; last = t;
      program.uniforms.uTime.value = elapsed;
      renderer.render({ scene: mesh, camera });
    };
    raf = requestAnimationFrame(update);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(raf);
      if (container.contains(gl.canvas)) container.removeChild(gl.canvas);
    };
  }, []);

  return (
    <div ref={containerRef} className={className} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'hidden', ...style }} />
  );
}
