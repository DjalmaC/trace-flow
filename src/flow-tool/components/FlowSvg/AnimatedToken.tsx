"use client";
import { motion, useTransform, type MotionValue } from "framer-motion";
import type { Currency, Stablecoin } from "../../data/schema";
import { useTokenAlongPath } from "../../animation/useTokenAlongPath";
import { CurrencyToken } from "./Tokens";

// A token that travels a path and, if the leg converts, morphs currency mid-leg
// with a small swap pulse. Two tokens are cross-faded around t=0.5 so the change
// reads as a conversion rather than a swap-out.

export function AnimatedToken({
  d,
  progress,
  opacity,
  reverse = false,
  carries,
  convertsTo,
  coin = "both",
}: {
  d: string;
  progress: MotionValue<number>;
  opacity?: MotionValue<number> | number;
  reverse?: boolean;
  carries: Currency;
  convertsTo?: Currency;
  coin?: Stablecoin;
}) {
  const { x, y } = useTokenAlongPath(d, progress, reverse);

  // In disbursement, value flows backwards, so the morph runs the other way.
  const pre = reverse && convertsTo ? convertsTo : carries;
  const post = reverse && convertsTo ? carries : convertsTo;

  const preOpacity = useTransform(progress, (v) => (convertsTo ? (v < 0.5 ? 1 : 0) : 1));
  const postOpacity = useTransform(progress, (v) => (v >= 0.5 ? 1 : 0));
  const scale = useTransform(progress, [0.4, 0.5, 0.6], [1, 1.28, 1]);

  return (
    <motion.g style={{ x, y, opacity: opacity ?? 1 }}>
      {convertsTo ? (
        <motion.g style={{ scale }}>
          <motion.g style={{ opacity: preOpacity }}>
            <CurrencyToken currency={pre} coin={coin} />
          </motion.g>
          <motion.g style={{ opacity: postOpacity }}>
            <CurrencyToken currency={post!} coin={coin} />
          </motion.g>
        </motion.g>
      ) : (
        <CurrencyToken currency={carries} coin={coin} />
      )}
    </motion.g>
  );
}
