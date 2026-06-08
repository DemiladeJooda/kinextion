// Fix React 19 + Framer Motion 12 type incompatibility
// The issue: framer-motion defines children as `ReactNode | MotionValueNumber | MotionValueString`
// but React 19's ReactNode type is incompatible with React 18's ReactNode in the union.
// See: https://github.com/framer/motion/issues/2838

import type { ReactNode } from "react";

declare module "framer-motion" {
  interface MotionStyle {
    children?: ReactNode;
  }

  export interface MotionAdvancedProps {
    children?: ReactNode;
  }
}
