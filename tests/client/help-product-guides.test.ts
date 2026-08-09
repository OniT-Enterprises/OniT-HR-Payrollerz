import { describe, expect, it } from "vitest";
import {
  loadProductGuide,
  productGuideMatchesMetadata,
  productGuideSections,
  productGuidesFor,
  searchProductGuide,
} from "../../client/lib/help/product-guides";
import { statutoryReviewHelpPath } from "../../client/lib/help/targets";

describe("in-app product guides", () => {
  const locales = ["en", "pt", "tet"] as const;

  it("surfaces the same five practical guides in every language", () => {
    const expected = productGuidesFor("en").map((guide) => guide.slug);
    expect(expected).toEqual([
      "getting-started",
      "running-payroll",
      "tax-and-filings",
      "invoices-and-money",
      "time-and-leave",
    ]);

    for (const locale of locales) {
      const guides = productGuidesFor(locale);
      expect(guides.map((guide) => guide.slug)).toEqual(expected);
      for (const guide of guides) {
        expect(guide.title.trim()).not.toBe("");
        expect(guide.summary.trim()).not.toBe("");
        expect(guide.action.to).toMatch(/^\//);
      }
    }
  });

  it("loads every guide and keeps section anchors stable across languages", async () => {
    for (const guide of productGuidesFor("en")) {
      const article = await loadProductGuide(guide.slug);
      expect(article, guide.slug).toBeDefined();
      if (!article) continue;

      const englishIds = productGuideSections(guide, article.en).map(
        (section) => section.id,
      );
      for (const locale of locales) {
        const localizedGuide = productGuidesFor(locale).find(
          (candidate) => candidate.slug === guide.slug,
        )!;
        expect(
          productGuideSections(localizedGuide, article[locale]).map(
            (section) => section.id,
          ),
          `${guide.slug}/${locale}`,
        ).toEqual(englishIds);
      }
    }
  });

  it("finds practical answers inside a guide and links to their section", async () => {
    const guide = productGuidesFor("pt").find(
      (candidate) => candidate.slug === "invoices-and-money",
    )!;
    const article = await loadProductGuide(guide.slug);
    expect(article).toBeDefined();

    const results = searchProductGuide(
      "reconciliacao bancaria",
      guide,
      article!.pt,
    );
    expect(results[0]?.id).toBe("bank-reconciliation");
  });

  it("finds common cross-language words and phone-keyboard mistakes", async () => {
    const guide = productGuidesFor("en").find(
      (candidate) => candidate.slug === "time-and-leave",
    )!;
    const article = await loadProductGuide(guide.slug);
    expect(article).toBeDefined();

    for (const query of [
      "nigth shift",
      "turno noturno",
      "turnu kalan",
    ]) {
      expect(searchProductGuide(query, guide, article!.en)[0]?.id).toBe(
        "night-shifts",
      );
    }
    expect(searchProductGuide("attendence", guide, article!.en)[0]?.id).toBe(
      "attendance",
    );
  });

  it("matches useful metadata even before a guide body loads", () => {
    const guide = productGuidesFor("en").find(
      (candidate) => candidate.slug === "tax-and-filings",
    )!;
    expect(productGuideMatchesMetadata("tax deadlines", guide)).toBe(true);
    expect(productGuideMatchesMetadata("banana", guide)).toBe(false);
  });

  it("keeps blocker help links attached to real guide sections", async () => {
    const paths = [
      statutoryReviewHelpPath("employer"),
      statutoryReviewHelpPath("payroll"),
      "/help/guide/getting-started#add-your-team",
    ];

    for (const path of paths) {
      const match = path.match(/^\/help\/guide\/([^#]+)#(.+)$/);
      expect(match, path).not.toBeNull();
      if (!match) continue;

      const [, slug, anchor] = match;
      const guide = productGuidesFor("en").find(
        (candidate) => candidate.slug === slug,
      );
      expect(guide, path).toBeDefined();
      if (!guide) continue;

      const article = await loadProductGuide(slug);
      expect(article, path).toBeDefined();
      if (!article) continue;

      expect(
        productGuideSections(guide, article.en).map((section) => section.id),
        path,
      ).toContain(anchor);
    }
  });
});
