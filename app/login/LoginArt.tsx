"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "motion/react";
import { SuzaniRosette } from "@/components/Ornament";
import { use3DSupport } from "@/components/three/support";

const TeapotScene = dynamic(() => import("@/components/three/TeapotScene"), { ssr: false });

/** 3D-чайник, а если 3D нельзя (нет WebGL / «уменьшить движение») — орнамент-розетка. */
export function LoginArt() {
  const support = use3DSupport();
  const [slow, setSlow] = useState(false);
  const ok = support && !slow;
  return (
    <>
      <SuzaniRosette
        size={460}
        className={`relative transition-opacity duration-700 motion-safe:animate-[spin_120s_linear_infinite] ${ok ? "text-saffron/15" : "text-saffron/45"}`}
      />
      {ok && (
        <motion.div
          className="absolute inset-0"
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
        >
          <TeapotScene onSlow={() => setSlow(true)} />
        </motion.div>
      )}
    </>
  );
}
