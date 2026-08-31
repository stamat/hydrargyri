/*! Liquid metal shader: Paper Shaders, https://github.com/paper-design/shaders, Apache-2.0 */
import {
  ShaderMount,
  ShaderFitOptions,
  liquidMetalFragmentShader,
  toProcessedLiquidMetal,
  getShaderColorFromString
} from '@paper-design/shaders'

// Poisson is solved at 512 on the short side by the library. Rasterising to that size here
// is what keeps it off the 4096 path it takes for anything named `.svg` — a 4096 × 3548
// canvas and a PNG encode of it, for a mark that renders at six rem.
const MASK_SIZE = 512

// The shader reads its shape out of the source image's alpha, which is why the mark carries
// the glyph as a cutout rather than as ink painted over the triangle: the artwork is already
// the mask, so nothing is derived here and there is no second copy to drift.
function toMaskUrl (img) {
  const canvas = document.createElement('canvas')
  const scale = MASK_SIZE / Math.min(img.naturalWidth, img.naturalHeight)
  canvas.width = Math.round(img.naturalWidth * scale)
  canvas.height = Math.round(img.naturalHeight * scale)

  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)

  return canvas.toDataURL('image/png')
}

async function liquify (figure, img) {
  // Rejects on an image that never loaded, which is the same exit as any other failure
  // here: the caller warns and the mark stays as the browser drew it.
  await img.decode()

  const processed = await toProcessedLiquidMetal(toMaskUrl(img))
  const mask = new Image()
  mask.src = URL.createObjectURL(processed.pngBlob)
  await mask.decode()

  const mount = document.createElement('div')
  mount.className = 'brand-logo-shader'
  mount.setAttribute('aria-hidden', 'true')
  figure.append(mount)

  // ShaderMount prepends its canvas before it tests for a context, so a browser without
  // WebGL2 leaves an empty canvas behind on the way out of the constructor.
  try {
    new ShaderMount(mount, liquidMetalFragmentShader, {
      u_colorBack: getShaderColorFromString('#00000000'),
      u_colorTint: getShaderColorFromString('#ffffff'),
      u_image: mask,
      u_isImage: true,
      u_shape: 0,
      u_repetition: 2,
      u_softness: 0.1,
      u_shiftRed: 0.3,
      u_shiftBlue: 0.3,
      u_distortion: 0.07,
      u_contour: 0.4,
      u_angle: 70,
      u_fit: ShaderFitOptions.contain,
      u_scale: 1,
      u_rotation: 0,
      u_offsetX: 0,
      u_offsetY: 0,
      u_originX: 0.5,
      u_originY: 0.5,
      u_worldWidth: 0,
      u_worldHeight: 0
    }, undefined, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1, 0, 2, undefined, ['u_image'])
  } catch (e) {
    mount.remove()
    throw e
  }

  // Only once there is something to look at instead: every path out of here that fails
  // leaves the mark on the page as drawn.
  img.hidden = true
}

const figure = document.querySelector('.brand-logo')
const img = figure?.querySelector('img')

if (img) {
  liquify(figure, img).catch((e) => {
    console.warn('Liquid metal mark skipped:', e.message)
  })
}
