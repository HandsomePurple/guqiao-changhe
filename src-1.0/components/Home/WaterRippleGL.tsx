import { useRef, useEffect, useCallback } from 'react'

// ═══════════════════════════════════════════════════════════
// WebGL 水波纹 — Navier-Stokes 浅水方程 + 双缓冲 ping-pong
// ═══════════════════════════════════════════════════════════

// ─── GLSL Shaders ───

const VS_SOURCE = `#version 300 es
in vec2 aPosition;
out vec2 vTexCoord;
void main() {
  vTexCoord = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`

// Wave simulation update shader (ping-pong pass)
const UPDATE_FS = `#version 300 es
precision highp float;
in vec2 vTexCoord;
out vec4 fragColor;

uniform sampler2D uState;       // R = h(t), G = h(t-1)
uniform vec2 uTexelSize;
uniform vec2 uMouse;            // 归一化鼠标坐标 [0,1]
uniform float uStrength;        // 鼠标扰动强度（平滑后）
uniform float uDamping;         // 衰减系数 ~0.985
uniform float uAspect;          // 宽高比
uniform float uTime;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec4 state = texture(uState, vTexCoord);
  float hCurr = state.r;
  float hPrev = state.g;

  // 邻居采样
  float hL = texture(uState, vTexCoord + vec2(-uTexelSize.x, 0.0)).r;
  float hR = texture(uState, vTexCoord + vec2( uTexelSize.x, 0.0)).r;
  float hB = texture(uState, vTexCoord + vec2(0.0, -uTexelSize.y)).r;
  float hT = texture(uState, vTexCoord + vec2(0.0,  uTexelSize.y)).r;

  // 波动方程: h_next = 2*h - h_prev + c² * ∇²h
  float laplacian = hL + hR + hB + hT - 4.0 * hCurr;
  float newH = 2.0 * hCurr - hPrev + 0.12 * laplacian;

  // 衰减
  newH *= uDamping;

  // 鼠标扰动 — 高斯脉冲 + 有机变化
  vec2 dist = vTexCoord - uMouse;
  dist.x *= uAspect;
  float r2 = dot(dist, dist);
  float gauss = exp(-r2 * 16.0);

  // 有机变化：不同位置产生不同频率的扰动，避免"机械同心圆"
  float organic = sin(vTexCoord.x * 41.7 + uTime * 0.6) *
                  cos(vTexCoord.y * 37.3 - uTime * 0.45) * 0.35;
  newH += gauss * uStrength * (0.65 + 0.35 * organic);

  // 环境微动 — 极微弱的水面自然波动
  float ripple1 = sin(vTexCoord.y * 9.42 + uTime * 0.28) *
                  cos(vTexCoord.x * 8.17 - uTime * 0.22);
  float ripple2 = cos(vTexCoord.x * 6.88 + uTime * 0.35) *
                  sin(vTexCoord.y * 7.53 - uTime * 0.31);
  newH += (ripple1 + ripple2) * 0.00012;

  newH = clamp(newH, -0.1, 0.1);

  fragColor = vec4(newH, hCurr, 0.0, 1.0);
}`

// Render shader — 河流原色 + 湖面微闪（水波纹由 PNG 叠加层处理）
const RENDER_FS = `#version 300 es
precision highp float;
in vec2 vTexCoord;
out vec4 fragColor;

uniform sampler2D uHeight;
uniform sampler2D uMask;
uniform float uTime;
uniform float uFade;

void main() {
  vec4 maskTex = texture(uMask, vTexCoord);
  float rawAlpha = maskTex.a;

  // 平滑 alpha 边缘
  float alpha = smoothstep(0.0, 0.15, rawAlpha);
  if (alpha < 0.001) discard;

  // ── 河流原色 ──
  vec3 color = maskTex.rgb;

  // ── 湖面光浮过 — 多层次微闪 + 流动光带 ──
  // 高频闪烁
  float s1 = sin(uTime * 0.7 + vTexCoord.x * 23.5 + vTexCoord.y * 17.3);
  float s2 = cos(uTime * 0.9 - vTexCoord.x * 19.2 + vTexCoord.y * 21.7);
  float s3 = sin(uTime * 0.55 + vTexCoord.x * 31.8 - vTexCoord.y * 28.4);
  float shimmer = s1 * s2 * 0.55 + s3 * 0.45;
  shimmer = pow(max(shimmer, 0.0), 3.0) * 0.08;

  // 慢速流动光带 — 模拟湖面阳光反射（宽光带）
  float flow1 = sin(vTexCoord.x * 2.2 + uTime * 0.10);
  float flow2 = cos(vTexCoord.y * 2.8 - uTime * 0.13);
  float flow = flow1 * flow2 * 0.5 + 0.5;
  flow = pow(flow, 2.5) * 0.05;

  // 超慢呼吸脉动 — 整个湖面明暗变化
  float breath = sin(uTime * 0.18) * 0.02 + 0.02;

  color += (shimmer + flow + breath) * vec3(1.0, 0.97, 0.90) * uFade;

  fragColor = vec4(color, alpha);
}`

// ═══════════════════════════════════════════════════════════
// WebGL 工具函数
// ═══════════════════════════════════════════════════════════

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
  const s = gl.createShader(type)!
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.warn('[WaterRippleGL] shader compile:', gl.getShaderInfoLog(s))
    gl.deleteShader(s)
    return null
  }
  return s
}

function linkProgram(gl: WebGL2RenderingContext, vs: WebGLShader, fs: WebGLShader): WebGLProgram | null {
  const p = gl.createProgram()!
  gl.attachShader(p, vs)
  gl.attachShader(p, fs)
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.warn('[WaterRippleGL] link:', gl.getProgramInfoLog(p))
    gl.deleteProgram(p)
    return null
  }
  return p
}

function makeFloatTexture(gl: WebGL2RenderingContext, w: number, h: number): WebGLTexture {
  const t = gl.createTexture()!
  gl.bindTexture(gl.TEXTURE_2D, t)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  return t
}

function makeFBO(gl: WebGL2RenderingContext, tex: WebGLTexture): WebGLFramebuffer {
  const fbo = gl.createFramebuffer()!
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER)
  if (status !== gl.FRAMEBUFFER_COMPLETE) {
    const codes: Record<number, string> = {
      36053: 'INCOMPLETE_ATTACHMENT',
      36054: 'INCOMPLETE_MISSING_ATTACHMENT / FRAMEBUFFER_UNSUPPORTED',
      36055: 'INCOMPLETE_MULTISAMPLE',
    }
    throw new Error(`[WaterRippleGL] FBO incomplete (${status}): ${codes[status] || 'unknown'}`)
  }
  return fbo
}

function loadTextureFromURL(gl: WebGL2RenderingContext, url: string): Promise<WebGLTexture> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const tex = gl.createTexture()!
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      resolve(tex)
    }
    img.onerror = () => reject(new Error(`Failed to load mask: ${url}`))
    img.src = url
  })
}

// ═══════════════════════════════════════════════════════════
// GL 上下文管理 — 单例（避免重复初始化）
// ═══════════════════════════════════════════════════════════

interface GLState {
  gl: WebGL2RenderingContext
  updateProgram: WebGLProgram
  renderProgram: WebGLProgram
  texA: WebGLTexture
  texB: WebGLTexture
  fboA: WebGLFramebuffer
  fboB: WebGLFramebuffer
  maskTex: WebGLTexture | null
  quadVao: WebGLVertexArrayObject
  w: number
  h: number
  updateULocs: Record<string, WebGLUniformLocation>
  renderULocs: Record<string, WebGLUniformLocation>
}

function initGLState(canvas: HTMLCanvasElement): GLState {
  const gl = canvas.getContext('webgl2', {
    premultipliedAlpha: false,
    alpha: true,
    antialias: false,
  })

  if (!gl) throw new Error('WebGL2 not available')

  // 确保 canvas 背景完全透明（非河流 discard 区域露出下层 ::before 底图）
  gl.clearColor(0, 0, 0, 0)

  // ─── 启用浮点渲染扩展（FBO + blend 必须）───
  const extColorBufferHalfFloat = gl.getExtension('EXT_color_buffer_half_float')
  if (!extColorBufferHalfFloat) throw new Error('EXT_color_buffer_half_float not supported')
  const extFloatBlend = gl.getExtension('EXT_float_blend')
  if (!extFloatBlend) console.warn('[WaterRippleGL] EXT_float_blend not supported — blend on float FBO may fail')

  // 编译 shader
  const vs = compileShader(gl, gl.VERTEX_SHADER, VS_SOURCE)!
  const updateFS = compileShader(gl, gl.FRAGMENT_SHADER, UPDATE_FS)!
  const renderFS = compileShader(gl, gl.FRAGMENT_SHADER, RENDER_FS)!

  const updateProgram = linkProgram(gl, vs, updateFS)!
  const renderProgram = linkProgram(gl, vs, renderFS)!

  gl.deleteShader(vs)
  gl.deleteShader(updateFS)
  gl.deleteShader(renderFS)

  // 全屏四边形
  const vao = gl.createVertexArray()!
  gl.bindVertexArray(vao)
  const buf = gl.createBuffer()!
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1,   1, -1,   -1, 1,
     1, -1,   1,  1,   -1, 1,
  ]), gl.STATIC_DRAW)
  const aPos = 0
  gl.enableVertexAttribArray(aPos)
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

  // 纹理 + FBO
  const w = canvas.width
  const h = canvas.height
  const texA = makeFloatTexture(gl, w, h)
  const texB = makeFloatTexture(gl, w, h)
  const fboA = makeFBO(gl, texA)
  const fboB = makeFBO(gl, texB)

  // uniform 位置
  const getU = (p: WebGLProgram, name: string) => gl.getUniformLocation(p, name)!
  const updateULocs = {
    uState: getU(updateProgram, 'uState'),
    uTexelSize: getU(updateProgram, 'uTexelSize'),
    uMouse: getU(updateProgram, 'uMouse'),
    uStrength: getU(updateProgram, 'uStrength'),
    uDamping: getU(updateProgram, 'uDamping'),
    uAspect: getU(updateProgram, 'uAspect'),
    uTime: getU(updateProgram, 'uTime'),
  }
  const renderULocs = {
    uHeight: getU(renderProgram, 'uHeight'),
    uMask: getU(renderProgram, 'uMask'),
    uTime: getU(renderProgram, 'uTime'),
    uFade: getU(renderProgram, 'uFade'),
  }

  return { gl, updateProgram, renderProgram, texA, texB, fboA, fboB, maskTex: null, quadVao: vao, w, h, updateULocs, renderULocs }
}

// ═══════════════════════════════════════════════════════════
// 组件
// ═══════════════════════════════════════════════════════════

export interface WaterRippleMouse {
  x: number   // 归一化 [0,1] 的 canvas 内坐标
  y: number
  inside: boolean
}

interface WaterRippleGLProps {
  mouseRef: React.MutableRefObject<WaterRippleMouse>
  maskUrl?: string
}

export default function WaterRippleGL({
  mouseRef,
  maskUrl = 'images/千河桥影河流图.webp',
}: WaterRippleGLProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const glStateRef = useRef<GLState | null>(null)
  const maskLoadedRef = useRef(false)
  const maskReadyTimeRef = useRef(0)
  const rafRef = useRef(0)
  const animatingRef = useRef(false)

  // 启动动画（确保只启动一次）
  const startLoop = useCallback(() => {
    if (animatingRef.current) return
    animatingRef.current = true
    const tick: FrameRequestCallback = (ts) => {
      rafRef.current = requestAnimationFrame(tick)
      const st = glStateRef.current
      if (!st || !st.maskTex) return   // ← mask 未就位时静默跳过，但循环不断

      const { gl, updateProgram, renderProgram, texA, texB, fboA, fboB, quadVao, updateULocs, renderULocs } = st
      const mouse = mouseRef.current

      // ─── Pass 1: 更新模拟（texA → fboB）───
      gl.bindFramebuffer(gl.FRAMEBUFFER, fboB)
      gl.viewport(0, 0, st.w, st.h)
      gl.useProgram(updateProgram)

      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, texA)
      gl.uniform1i(updateULocs.uState, 0)

      gl.uniform2f(updateULocs.uTexelSize, 1 / st.w, 1 / st.h)

      // 鼠标坐标映射到 canvas UV
      const mx = mouse.inside ? mouse.x : -100
      const my = mouse.inside ? 1.0 - mouse.y : -100
      gl.uniform2f(updateULocs.uMouse, mx, my)

      // 平滑强度
      gl.uniform1f(updateULocs.uStrength, mouse.inside ? 0.55 : 0.0)
      gl.uniform1f(updateULocs.uDamping, 0.992)
      gl.uniform1f(updateULocs.uAspect, st.w / st.h)
      gl.uniform1f(updateULocs.uTime, ts * 0.001)

      gl.bindVertexArray(quadVao)
      gl.disable(gl.BLEND)
      gl.drawArrays(gl.TRIANGLES, 0, 6)

      // ─── Ping-pong swap ───
      const tmpTex = st.texA
      const tmpFbo = st.fboA
      st.texA = st.texB
      st.fboA = st.fboB
      st.texB = tmpTex
      st.fboB = tmpFbo

      // ─── Pass 2: 渲染到屏幕 ───
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.clear(gl.COLOR_BUFFER_BIT)  // ← 每帧清屏为透明，确保 discard 区域不残留
      gl.viewport(0, 0, st.w, st.h)
      gl.useProgram(renderProgram)
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, st.texA)
      gl.uniform1i(renderULocs.uHeight, 0)

      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, st.maskTex)
      gl.uniform1i(renderULocs.uMask, 1)

      gl.uniform1f(renderULocs.uTime, ts * 0.001)

      // 淡入：mask 就位后 1.5s 渐变，消除初始闪动
      if (maskReadyTimeRef.current > 0) {
        const fade = Math.min((ts * 0.001 - maskReadyTimeRef.current) / 1.5, 1.0)
        gl.uniform1f(renderULocs.uFade, fade)
      } else {
        gl.uniform1f(renderULocs.uFade, 0.0)
      }

      gl.bindVertexArray(quadVao)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
    }
    requestAnimationFrame(tick)
  }, [])

  // 初始化 GL + 加载 mask
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let disposed = false

    const resizeAndInit = async () => {
      const parent = canvas.parentElement
      if (!parent || disposed) return

      const rect = parent.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      const w = Math.round(rect.width * dpr)
      const h = Math.round(rect.height * dpr)

      canvas.width = w
      canvas.height = h
      // 不设 style.width/height，CSS 100% 自动匹配，消除 subpixel 错位

      // 如果尺寸未变且 mask 已加载，跳过重建
      const old = glStateRef.current
      if (old && old.w === w && old.h === h && maskLoadedRef.current) return

      // 销毁旧资源
      if (old) {
        const g = old.gl
        g.deleteFramebuffer(old.fboA)
        g.deleteFramebuffer(old.fboB)
        g.deleteTexture(old.texA)
        g.deleteTexture(old.texB)
        if (old.maskTex) g.deleteTexture(old.maskTex)
        g.deleteProgram(old.updateProgram)
        g.deleteProgram(old.renderProgram)
        g.deleteVertexArray(old.quadVao)
        glStateRef.current = null
      }

      try {
        const state = initGLState(canvas)
        glStateRef.current = state

        // 加载 mask（阻塞等待完成）
        state.maskTex = await loadTextureFromURL(state.gl, maskUrl)
        maskLoadedRef.current = true
        maskReadyTimeRef.current = performance.now() * 0.001
      } catch (err) {
        console.warn('[WaterRippleGL] init failed:', err)
      }
    }

    // 异步初始化，init 完成后 startLoop 会在 mask 就位后自动激活
    resizeAndInit()

    // 立即启动动画循环（init 未完成时静默跳过帧，循环不中断）
    startLoop()

    // ResizeObserver
    let resizeTimer: ReturnType<typeof setTimeout>
    const ro = new ResizeObserver(() => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        resizeAndInit()
        // reinit 后确保循环仍在运行
        startLoop()
      }, 200)
    })
    const parent = canvas.parentElement
    if (parent) ro.observe(parent)

    return () => {
      disposed = true
      animatingRef.current = false
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
      clearTimeout(resizeTimer)
      const st = glStateRef.current
      if (st) {
        const g = st.gl
        g.deleteFramebuffer(st.fboA)
        g.deleteFramebuffer(st.fboB)
        g.deleteTexture(st.texA)
        g.deleteTexture(st.texB)
        if (st.maskTex) g.deleteTexture(st.maskTex)
        g.deleteProgram(st.updateProgram)
        g.deleteProgram(st.renderProgram)
        g.deleteVertexArray(st.quadVao)
        glStateRef.current = null
      }
    }
  }, [maskUrl])

  return (
    <canvas
      ref={canvasRef}
      className="water-ripple-canvas"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1,
      }}
    />
  )
}
