import { SEGMENT_GROUPS, SEGMENTS } from "@/lib/segments";

/** <option>s de nichos agrupados por área (use dentro de um <select>). */
export function SegmentOptions() {
  return (
    <>
      {SEGMENT_GROUPS.map((g) => (
        <optgroup key={g} label={g}>
          {SEGMENTS.filter((s) => s.group === g).map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </optgroup>
      ))}
    </>
  );
}
