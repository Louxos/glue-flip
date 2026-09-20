/**
 * Analytical mass properties for the glue stick.
 *
 * The stick is modelled as one flat-capped cylinder (a rounded capsule would
 * make standing upright physically impossible), but its mass is *not* uniform:
 * the twist mechanism at the bottom is far denser than the glue and the cap.
 *
 * Instead of faking that with several stacked colliders — which produces bad
 * contact manifolds along the seam — the exact mass properties of the composite
 * body are derived here and handed to the physics engine as a single shape.
 */

export interface StickMassProperties {
  /** Total mass in kg. */
  mass: number;
  /** Centre of mass along local Y, measured from the geometric centre (negative = low). */
  comY: number;
  /** Principal moments of inertia around the centre of mass, [Ixx, Iyy, Izz]. */
  inertia: [number, number, number];
}

/** Volume of a cylinder section. */
function sectionVolume(radius: number, height: number): number {
  return Math.PI * radius * radius * height;
}

/**
 * Splits a cylinder of the given height/radius into a dense lower section and a
 * light upper section so that the total mass and the centre of mass match the
 * design values, then integrates the inertia tensor of that composite body.
 *
 * @param height    total height
 * @param radius    cylinder radius
 * @param splitY    height (from the base) where the dense section ends
 * @param mass      total mass in kg
 * @param comRatio  centre of mass height as a ratio of `height`
 */
export function solveStickMassProperties(
  height: number,
  radius: number,
  splitY: number,
  mass: number,
  comRatio: number,
): StickMassProperties {
  const lowerHeight = Math.min(Math.max(splitY, 1e-4), height - 1e-4);
  const upperHeight = height - lowerHeight;

  const vLower = sectionVolume(radius, lowerHeight);
  const vUpper = sectionVolume(radius, upperHeight);

  // Local coordinates, origin at the geometric centre of the stick.
  const yLower = -height / 2 + lowerHeight / 2;
  const yUpper = -height / 2 + lowerHeight + upperHeight / 2;
  const target = (comRatio - 0.5) * height;

  // Solve  V₁ρ₁ + V₂ρ₂ = m  and  V₁ρ₁y₁ + V₂ρ₂y₂ = m·ȳ  for the two densities.
  const span = yUpper - yLower;
  const mLower = span > 1e-9 ? (mass * (yUpper - target)) / span : mass / 2;
  const mUpper = mass - mLower;

  // Inertia of each section about its own centre, then shifted to the composite
  // centre of mass with the parallel axis theorem.
  const inertiaAboutOwnAxis = (m: number, h: number): [number, number] => [
    (m * (3 * radius * radius + h * h)) / 12, // any axis through the centre, perpendicular to Y
    (m * radius * radius) / 2, // the Y (symmetry) axis
  ];

  const [perpLower, axialLower] = inertiaAboutOwnAxis(mLower, lowerHeight);
  const [perpUpper, axialUpper] = inertiaAboutOwnAxis(mUpper, upperHeight);

  const dLower = yLower - target;
  const dUpper = yUpper - target;
  const perp = perpLower + mLower * dLower * dLower + perpUpper + mUpper * dUpper * dUpper;
  const axial = axialLower + axialUpper;

  return { mass, comY: target, inertia: [perp, axial, perp] };
}
