"use client";

export default function PrintButton() {
  return <button type="button" className="markers-print" onClick={() => window.print()}>Print the four markers</button>;
}
