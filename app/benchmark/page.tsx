"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function BenchmarkRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/benchmarks");
  }, [router]);

  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <p>Redirecting to benchmarks...</p>
    </div>
  );
}
