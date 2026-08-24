/**
 * The animated stage backdrop, shared by the gate and the showroom.
 *
 * Purely decorative and fixed behind everything, so it is hidden from the
 * accessibility tree and never receives pointer events. All of the motion
 * lives in index.css (.ambience*) and runs on transform/opacity only.
 */
interface AmbienceProps {
  /** Adds the sweeping projector beam. Reserved for the gate, where there is
   *  no content competing with it for attention. */
  beam?: boolean;
}

export const Ambience = ({ beam = false }: AmbienceProps) => (
  <div className="ambience" aria-hidden="true">
    <div className="ambience__blob ambience__blob--red" />
    <div className="ambience__blob ambience__blob--purple" />
    <div className="ambience__blob ambience__blob--cyan" />
    {beam && <div className="ambience__beam" />}
    <div className="ambience__grid" />
    <div className="ambience__grain" />
  </div>
);
