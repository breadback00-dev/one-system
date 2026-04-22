import type { PropsWithChildren } from "react";

export function SectionCard({
  children,
  title,
}: PropsWithChildren<{ title: string }>) {
  return (
    <section
      style={{
        border: "1px solid rgba(31, 27, 22, 0.12)",
        borderRadius: "18px",
        padding: "20px",
        background: "rgba(255, 250, 244, 0.84)",
      }}
    >
      <h3>{title}</h3>
      {children}
    </section>
  );
}

