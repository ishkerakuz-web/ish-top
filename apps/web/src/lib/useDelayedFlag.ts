import { useEffect, useState } from "react";

/** `flag` shuncha ms dan uzoq yoqilib tursa true — tez javoblarda skelet "miltillamasin". */
export function useDelayedFlag(flag: boolean, delay: number): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!flag) {
      setOn(false);
      return;
    }
    const timer = window.setTimeout(() => setOn(true), delay);
    return () => window.clearTimeout(timer);
  }, [flag, delay]);
  return on;
}
