import { getRiskScores, getLatestForecast } from "@/lib/actions/ai.actions";
import { RiskAnalysisPanel } from "@/components/features/ai/risk-analysis-panel";
import { RevenueForecastPanel } from "@/components/features/ai/revenue-forecast-panel";

export const metadata = { title: "AI Insights — ATP Fitness" };

export default async function OwnerAiInsightsPage() {
  const [scores, forecast] = await Promise.all([getRiskScores(), getLatestForecast()]);

  const months = forecast.map((f) => ({
    month: f.forecast_month.slice(0, 7),
    revenue: f.projected_revenue,
    isForecast: true,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AI Insights</h1>
        <p className="mt-1 text-sm text-muted-foreground">Cancellation risk and revenue forecasting, powered by AI.</p>
      </div>
      <RiskAnalysisPanel initialScores={scores} />
      <RevenueForecastPanel initialMonths={months} />
    </div>
  );
}
