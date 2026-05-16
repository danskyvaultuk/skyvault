import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import type { RoofAnalysis } from "./claude";

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    padding: 48,
    backgroundColor: "#ffffff",
    color: "#1a1a1a",
  },
  header: {
    marginBottom: 24,
    borderBottomWidth: 2,
    borderBottomColor: "#1d4ed8",
    paddingBottom: 16,
  },
  brand: { fontSize: 22, fontFamily: "Helvetica-Bold", color: "#1d4ed8" },
  title: { fontSize: 14, fontFamily: "Helvetica-Bold", marginTop: 8 },
  subtitle: { fontSize: 10, color: "#6b7280", marginTop: 2 },
  section: { marginTop: 20 },
  sectionTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 8, color: "#1d4ed8" },
  scoreBox: {
    backgroundColor: "#eff6ff",
    borderRadius: 6,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  scoreNumber: { fontSize: 40, fontFamily: "Helvetica-Bold", color: "#1d4ed8" },
  scoreLabel: { fontSize: 10, color: "#6b7280" },
  defectRow: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  defectSeverity: { width: 60, fontSize: 9, fontFamily: "Helvetica-Bold" },
  defectType: { width: 100, fontSize: 9 },
  defectDesc: { flex: 1, fontSize: 9, color: "#4b5563" },
  recommendationItem: { marginBottom: 4, flexDirection: "row" },
  bullet: { width: 12, fontSize: 10 },
  urgentBanner: {
    backgroundColor: "#fef2f2",
    borderRadius: 4,
    padding: 10,
    marginBottom: 16,
  },
  urgentText: { color: "#b91c1c", fontFamily: "Helvetica-Bold", fontSize: 10 },
  footer: {
    position: "absolute",
    bottom: 32,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 8,
  },
  footerText: { fontSize: 8, color: "#9ca3af" },
});

// ── Severity colour ────────────────────────────────────────────────────────────
function severityColour(s: string): string {
  switch (s) {
    case "critical": return "#b91c1c";
    case "high":     return "#d97706";
    case "medium":   return "#2563eb";
    default:         return "#6b7280";
  }
}

// ── Score label ────────────────────────────────────────────────────────────────
function scoreLabel(score: number): string {
  if (score <= 3) return "Replace soon";
  if (score <= 6) return "Repair needed";
  if (score <= 9) return "Maintenance recommended";
  return "Excellent condition";
}

// ── PDF Document ───────────────────────────────────────────────────────────────
function ReportDocument({
  analysis,
  address,
  postcode,
  generatedAt,
}: {
  analysis: RoofAnalysis;
  address: string;
  postcode: string;
  generatedAt: string;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.brand}>SkyVault</Text>
          <Text style={styles.title}>Roof Health Report</Text>
          <Text style={styles.subtitle}>
            {address}, {postcode} · Generated {generatedAt}
          </Text>
        </View>

        {/* Urgent action banner */}
        {analysis.urgent_action_required && (
          <View style={styles.urgentBanner}>
            <Text style={styles.urgentText}>
              ⚠ Urgent action required — please contact a roofer as soon as possible.
            </Text>
          </View>
        )}

        {/* Score */}
        <View style={styles.scoreBox}>
          <View>
            <Text style={styles.scoreLabel}>Condition score</Text>
            <Text style={styles.scoreNumber}>{analysis.condition_score}/10</Text>
            <Text style={styles.scoreLabel}>{scoreLabel(analysis.condition_score)}</Text>
          </View>
          <View>
            {analysis.estimated_remaining_life_years !== null && (
              <>
                <Text style={styles.scoreLabel}>Est. remaining life</Text>
                <Text style={{ fontSize: 24, fontFamily: "Helvetica-Bold", color: "#1d4ed8" }}>
                  {analysis.estimated_remaining_life_years} yrs
                </Text>
              </>
            )}
            <Text style={[styles.scoreLabel, { marginTop: 8 }]}>
              AI confidence: {analysis.confidence}
            </Text>
          </View>
        </View>

        {/* Surveyor notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Surveyor notes</Text>
          <Text style={{ fontSize: 10, color: "#374151", lineHeight: 1.5 }}>
            {analysis.surveyor_notes}
          </Text>
        </View>

        {/* Defects */}
        {analysis.defects.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Defects found ({analysis.defects.length})
            </Text>
            {analysis.defects.map((d, i) => (
              <View key={i} style={styles.defectRow}>
                <Text style={[styles.defectSeverity, { color: severityColour(d.severity) }]}>
                  {d.severity.toUpperCase()}
                </Text>
                <Text style={styles.defectType}>
                  {d.type.replace(/_/g, " ")}
                </Text>
                <Text style={styles.defectDesc}>{d.description}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Recommendations */}
        {analysis.recommendations.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recommendations</Text>
            {analysis.recommendations.map((r, i) => (
              <View key={i} style={styles.recommendationItem}>
                <Text style={styles.bullet}>•</Text>
                <Text style={{ flex: 1, fontSize: 10, color: "#374151" }}>{r}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>SkyVault AI Roof Survey · skyvault.co.uk</Text>
          <Text style={styles.footerText}>
            This report is AI-generated and should be verified by a qualified roofer.
          </Text>
        </View>
      </Page>
    </Document>
  );
}

// ── Export ─────────────────────────────────────────────────────────────────────
export async function renderReportPDF(
  analysis: RoofAnalysis,
  address: string,
  postcode: string
): Promise<Buffer> {
  const generatedAt = new Date().toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });

  const element = React.createElement(ReportDocument, {
    analysis, address, postcode, generatedAt,
  }) as unknown as React.ReactElement<import("@react-pdf/renderer").DocumentProps>;

  const buffer = await renderToBuffer(element);
  return Buffer.from(buffer);
}
