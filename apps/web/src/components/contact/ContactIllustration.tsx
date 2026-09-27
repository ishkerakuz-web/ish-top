import React from "react";

const SIZE = "w-[176px] lg:w-[212px]";

/**
 * Berilgan aloqa illyustratsiyasi (`x.png`, qayta chizilmagan — faqat qora fon
 * shaffoflashtirilgan): yorug' rejimda nuri qisqartirilgan, tungi rejimda asl
 * porlash. Dekorativ, 768px dan kichikda yashirin.
 */
export function ContactIllustration() {
  return (
    <span aria-hidden className="pointer-events-none -my-4 hidden shrink-0 select-none md:block">
      <img src="/contact-mail.webp" alt="" width={352} height={240} decoding="async" className={`block ${SIZE} dark:hidden`} />
      <img src="/contact-mail-dark.webp" alt="" width={352} height={240} decoding="async" loading="lazy" className={`hidden ${SIZE} dark:block`} />
    </span>
  );
}
