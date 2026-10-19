"use client";

import { useEffect, useRef } from "react";

/** Junta os campos marcados em um único parâmetro `fields` (evita URLs enormes com chaves repetidas). */
export function ExportFieldsScript() {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const form = ref.current?.form;
    if (!form) return;
    const sync = () => {
      const checked = [...form.querySelectorAll<HTMLInputElement>('input[data-fieldsel]:checked')].map((i) => i.value);
      if (ref.current) ref.current.value = checked.join(",");
    };
    sync();
    form.addEventListener("change", sync);
    form.addEventListener("submit", sync);
    return () => { form.removeEventListener("change", sync); form.removeEventListener("submit", sync); };
  }, []);
  return <input ref={ref} type="hidden" name="fields" defaultValue="" />;
}
