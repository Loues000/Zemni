import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { existsSync } from "fs";

export const runtime = "nodejs";

export async function GET() {
  try {
    const resultsPath = path.join(process.cwd(), "benchmark", "results", "benchmark_results.json");
    const metricsPath = path.join(process.cwd(), "benchmark", "results", "benchmark_metrics.json");
    
    let results: any[] = [];
    let metrics: {
      model_metrics?: any;
      model_metrics_comprehensive?: any;
      comparative_metrics?: any;
    } = { model_metrics: {}, comparative_metrics: {} };
    
    try {
      const resultsData = await fs.readFile(resultsPath, "utf-8");
      results = JSON.parse(resultsData);
    } catch (error) {
      // Results file doesn't exist yet or parsing failed
      console.error("Benchmark results not found or invalid:", error);
    }
    
    try {
      const metricsData = await fs.readFile(metricsPath, "utf-8");
      metrics = JSON.parse(metricsData);
    } catch (error) {
      // Metrics file doesn't exist yet or parsing failed
      console.error("Benchmark metrics not found or invalid:", error);
    }
    
    return NextResponse.json({
      results,
      metrics: metrics.model_metrics || {},
      metricsComprehensive: metrics.model_metrics_comprehensive || {},
      comparative: metrics.comparative_metrics || {},
      hasResults: results.length > 0
    });
  } catch (error) {
    console.error("Error loading benchmark data:", error);
    return NextResponse.json(
      { error: "Failed to load benchmark data", results: [], metrics: {}, comparative: {}, hasResults: false },
      { status: 500 }
    );
  }
}
