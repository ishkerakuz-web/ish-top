import React from "react";

const SIZE = "w-[176px] lg:w-[212px]";

/**
 * Berilgan yordam illyustratsiyasi (`q.png`, qayta chizilmagan — faqat qora fon
 * shaffoflashtirilgan): yorug' rejimda nuri qisqartirilgan, tungi rejimda asl
 * porlash. Dekorativ, 768px dan kichikda yashirin.
 */
export function SupportIllustration() {
  return (
    <span aria-hidden className="pointer-events-none -my-4 hidden shrink-0 select-none md:block">
      <img src="/support-help.webp" alt="" width={352} height={240} decoding="async" className={`block ${SIZE} dark:hidden`} />
      <img src="/support-help-dark.webp" alt="" width={352} height={240} decoding="async" loading="lazy" className={`hidden ${SIZE} dark:block`} />
    </span>
  );
}
